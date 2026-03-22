import { createHash, randomBytes, randomInt } from 'node:crypto';
import { NextRequest } from 'next/server';
import { getCustomerSessionTokenFromRequest } from '@/server/modules/customer-auth/session';
import type {
  AuthenticatedCustomerSession,
  CustomerAuthRepository,
  CustomerRecord,
  SmsProvider,
} from '@/server/modules/customer-auth/types';

export class CustomerAuthError extends Error {}
export class CustomerAuthValidationError extends Error {}
export class CustomerAuthInvalidOtpError extends Error {}
export class CustomerAuthExpiredOtpError extends Error {}

const OTP_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const OTP_LENGTH = 6;
const MAX_OTP_ATTEMPTS = 5;
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function getSessionSecret() {
  const secret = process.env.CUSTOMER_AUTH_SESSION_SECRET?.trim();

  if (!secret) {
    if (process.env.NODE_ENV === 'test') {
      return 'test-customer-auth-session-secret';
    }

    throw new CustomerAuthError('CUSTOMER_AUTH_SESSION_SECRET is required.');
  }

  return secret;
}

function getOtpSecret() {
  const secret = process.env.CUSTOMER_AUTH_OTP_SECRET?.trim();

  if (!secret) {
    if (process.env.NODE_ENV === 'test') {
      return 'test-customer-auth-otp-secret';
    }

    throw new CustomerAuthError('CUSTOMER_AUTH_OTP_SECRET is required.');
  }

  return secret;
}

export function normalizePhoneNumber(phoneNumber: string) {
  const normalized = phoneNumber.replace(/[\s()-]/g, '').replace(/^00/, '+');

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new CustomerAuthValidationError('Ingresa tu teléfono en formato internacional.');
  }

  return normalized;
}

function normalizeOtpCode(code: string) {
  const normalized = code.replace(/\s+/g, '');

  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(normalized)) {
    throw new CustomerAuthValidationError('Ingresa el código de 6 dígitos.');
  }

  return normalized;
}

function buildOtpHash(phoneNumber: string, code: string) {
  return sha256(`${getOtpSecret()}:${phoneNumber}:${code}`);
}

function buildSessionTokenHash(token: string) {
  return sha256(`${getSessionSecret()}:${token}`);
}

function generateOtpCode() {
  return String(randomInt(10 ** (OTP_LENGTH - 1), 10 ** OTP_LENGTH));
}

function generateSessionToken() {
  return randomBytes(32).toString('hex');
}

async function getOrCreateCustomerByPhone(
  repository: CustomerAuthRepository,
  phoneNumber: string,
): Promise<CustomerRecord> {
  const existing = await repository.findCustomerByPhoneNumber(phoneNumber);

  if (existing) {
    return existing;
  }

  return repository.createCustomer({ phoneNumber });
}

export async function requestCustomerOtp(
  repository: CustomerAuthRepository,
  smsProvider: SmsProvider,
  input: { phoneNumber: string },
) {
  const phoneNumber = normalizePhoneNumber(input.phoneNumber);
  const customer = await getOrCreateCustomerByPhone(repository, phoneNumber);
  const code = generateOtpCode();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  await repository.invalidateOtpChallengesForCustomer(customer.id, createdAt);
  await repository.createOtpChallenge({
    customerId: customer.id,
    phoneNumber,
    codeHash: buildOtpHash(phoneNumber, code),
    expiresAt,
    createdAt,
  });

  await smsProvider.sendOtp({
    phoneNumber,
    message: `Tu código para pedir café es ${code}. Vence en 10 minutos.`,
  });

  return {
    customer,
    phoneNumber,
    expiresAt,
  };
}

export async function verifyCustomerOtp(
  repository: CustomerAuthRepository,
  input: { phoneNumber: string; code: string },
) {
  const phoneNumber = normalizePhoneNumber(input.phoneNumber);
  const code = normalizeOtpCode(input.code);
  const challenge = await repository.findLatestOtpChallengeByPhoneNumber(phoneNumber);

  if (!challenge) {
    throw new CustomerAuthInvalidOtpError('Ese código no es válido. Pide uno nuevo e intenta otra vez.');
  }

  if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
    throw new CustomerAuthExpiredOtpError('Ese código ya venció. Pide uno nuevo para continuar.');
  }

  if (challenge.attemptCount >= MAX_OTP_ATTEMPTS) {
    throw new CustomerAuthInvalidOtpError('Probemos con un código nuevo.');
  }

  const expectedHash = buildOtpHash(phoneNumber, code);
  if (challenge.codeHash !== expectedHash) {
    await repository.incrementOtpChallengeAttempt({
      challengeId: challenge.id,
      attemptedAt: new Date().toISOString(),
    });

    throw new CustomerAuthInvalidOtpError('Ese código no coincide. Revisa el mensaje e intenta otra vez.');
  }

  const consumedAt = new Date().toISOString();
  await repository.consumeOtpChallenge({
    challengeId: challenge.id,
    consumedAt,
  });

  const sessionToken = generateSessionToken();
  const session = await repository.createSession({
    customerId: challenge.customerId,
    tokenHash: buildSessionTokenHash(sessionToken),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    createdAt: consumedAt,
    lastSeenAt: consumedAt,
  });
  const customer = await repository.findCustomerById(challenge.customerId);

  if (!customer) {
    throw new CustomerAuthError('Customer record was not found after OTP verification.');
  }

  return {
    customer,
    session,
    sessionToken,
  };
}

export async function getAuthenticatedCustomerSession(
  repository: CustomerAuthRepository,
  request: NextRequest,
) {
  const sessionToken = getCustomerSessionTokenFromRequest(request);
  if (!sessionToken) {
    return null;
  }

  const authenticatedSession = await repository.findAuthenticatedSessionByTokenHash(
    buildSessionTokenHash(sessionToken),
  );

  if (!authenticatedSession) {
    return null;
  }

  if (authenticatedSession.session.revokedAt) {
    return null;
  }

  if (new Date(authenticatedSession.session.expiresAt).getTime() <= Date.now()) {
    return null;
  }

  const lastSeenAtMs = authenticatedSession.session.lastSeenAt
    ? new Date(authenticatedSession.session.lastSeenAt).getTime()
    : 0;

  if (Date.now() - lastSeenAtMs >= SESSION_TOUCH_INTERVAL_MS) {
    const seenAt = new Date().toISOString();
    const touchedSession = await repository.touchSession({
      sessionId: authenticatedSession.session.id,
      seenAt,
    });

    return {
      ...authenticatedSession,
      session: touchedSession ?? authenticatedSession.session,
    } satisfies AuthenticatedCustomerSession;
  }

  return authenticatedSession;
}

export async function requireAuthenticatedCustomerSession(
  repository: CustomerAuthRepository,
  request: NextRequest,
) {
  const authenticatedSession = await getAuthenticatedCustomerSession(repository, request);

  if (!authenticatedSession) {
    throw new CustomerAuthError('Inicia sesión con tu teléfono para continuar.');
  }

  return authenticatedSession;
}

export async function signOutCustomerSession(
  repository: CustomerAuthRepository,
  request: NextRequest,
) {
  const sessionToken = getCustomerSessionTokenFromRequest(request);

  if (!sessionToken) {
    return;
  }

  await repository.revokeSessionByTokenHash(
    buildSessionTokenHash(sessionToken),
    new Date().toISOString(),
  );
}

export async function resolveCustomerIdentifierReference(
  repository: CustomerAuthRepository,
  rawReference: string,
  options?: { createIfPhoneNumber?: boolean },
) {
  const reference = rawReference.trim();

  if (!reference) {
    throw new CustomerAuthValidationError('Customer reference is required.');
  }

  if (reference.startsWith('+')) {
    const phoneNumber = normalizePhoneNumber(reference);
    const existing = await repository.findCustomerByPhoneNumber(phoneNumber);

    if (existing) {
      return existing.id;
    }

    if (options?.createIfPhoneNumber) {
      const customer = await repository.createCustomer({ phoneNumber });
      return customer.id;
    }
  }

  return reference;
}
