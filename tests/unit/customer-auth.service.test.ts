import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAuthenticatedCustomerSession,
  requestCustomerOtp,
  CustomerAuthExpiredOtpError,
  CustomerAuthInvalidOtpError,
  verifyCustomerOtp,
} from '@/server/modules/customer-auth/service';
import type {
  AuthenticatedCustomerSession,
  CreateCustomerInput,
  CreateCustomerOtpChallengeInput,
  CreateCustomerSessionInput,
  CustomerAuthRepository,
  CustomerOtpChallenge,
  CustomerRecord,
  CustomerSessionRecord,
  SmsProvider,
} from '@/server/modules/customer-auth/types';
import { NextRequest } from 'next/server';

class InMemoryCustomerAuthRepository implements CustomerAuthRepository {
  customers: CustomerRecord[] = [];
  otpChallenges: CustomerOtpChallenge[] = [];
  sessions: CustomerSessionRecord[] = [];
  private customerSeq = 1;
  private challengeSeq = 1;
  private sessionSeq = 1;

  async findCustomerById(customerId: string) {
    return this.customers.find((customer) => customer.id === customerId) ?? null;
  }

  async findCustomerByPhoneNumber(phoneNumber: string) {
    return this.customers.find((customer) => customer.phoneNumber === phoneNumber) ?? null;
  }

  async createCustomer(input: CreateCustomerInput) {
    const existing = await this.findCustomerByPhoneNumber(input.phoneNumber);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const customer: CustomerRecord = {
      id: `customer-${this.customerSeq++}`,
      phoneNumber: input.phoneNumber,
      createdAt: now,
      updatedAt: now,
    };
    this.customers.push(customer);
    return customer;
  }

  async createOtpChallenge(input: CreateCustomerOtpChallengeInput) {
    const challenge: CustomerOtpChallenge = {
      id: `challenge-${this.challengeSeq++}`,
      customerId: input.customerId,
      phoneNumber: input.phoneNumber,
      codeHash: input.codeHash,
      expiresAt: input.expiresAt,
      consumedAt: null,
      invalidatedAt: null,
      attemptCount: 0,
      lastAttemptAt: null,
      createdAt: input.createdAt,
    };
    this.otpChallenges.push(challenge);
    return challenge;
  }

  async findLatestOtpChallengeByPhoneNumber(phoneNumber: string) {
    const active = this.otpChallenges
      .filter(
        (challenge) =>
          challenge.phoneNumber === phoneNumber &&
          !challenge.consumedAt &&
          !challenge.invalidatedAt,
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return active[0] ?? null;
  }

  async incrementOtpChallengeAttempt(input: { challengeId: string; attemptedAt: string }) {
    const challenge = this.otpChallenges.find((entry) => entry.id === input.challengeId) ?? null;
    if (!challenge) {
      return null;
    }

    challenge.attemptCount += 1;
    challenge.lastAttemptAt = input.attemptedAt;
    return challenge;
  }

  async invalidateOtpChallengesForCustomer(customerId: string, invalidatedAt: string) {
    this.otpChallenges.forEach((challenge) => {
      if (challenge.customerId === customerId && !challenge.consumedAt && !challenge.invalidatedAt) {
        challenge.invalidatedAt = invalidatedAt;
      }
    });
  }

  async consumeOtpChallenge(input: { challengeId: string; consumedAt: string }) {
    const challenge = this.otpChallenges.find((entry) => entry.id === input.challengeId) ?? null;
    if (!challenge) {
      return null;
    }

    challenge.consumedAt = input.consumedAt;
    return challenge;
  }

  async createSession(input: CreateCustomerSessionInput) {
    const session: CustomerSessionRecord = {
      id: `session-${this.sessionSeq++}`,
      customerId: input.customerId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
      lastSeenAt: input.lastSeenAt ?? null,
      createdAt: input.createdAt,
    };
    this.sessions.push(session);
    return session;
  }

  async findAuthenticatedSessionByTokenHash(tokenHash: string) {
    const session = this.sessions.find((entry) => entry.tokenHash === tokenHash) ?? null;
    if (!session) {
      return null;
    }

    const customer = await this.findCustomerById(session.customerId);
    if (!customer) {
      return null;
    }

    return { session, customer } satisfies AuthenticatedCustomerSession;
  }

  async touchSession(input: { sessionId: string; seenAt: string }) {
    const session = this.sessions.find((entry) => entry.id === input.sessionId) ?? null;
    if (!session) {
      return null;
    }

    session.lastSeenAt = input.seenAt;
    return session;
  }

  async revokeSessionByTokenHash(tokenHash: string, revokedAt: string) {
    const session = this.sessions.find((entry) => entry.tokenHash === tokenHash);
    if (session) {
      session.revokedAt = revokedAt;
    }
  }
}

describe('customer auth service', () => {
  const smsProvider: SmsProvider = {
    sendOtp: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    process.env = { ...process.env, NODE_ENV: 'test' };
  });

  it('requests an OTP and creates a customer record linked to the phone number', async () => {
    const repository = new InMemoryCustomerAuthRepository();

    const result = await requestCustomerOtp(repository, smsProvider, {
      phoneNumber: '+56912345678',
    });

    expect(result.customer.phoneNumber).toBe('+56912345678');
    expect(repository.customers).toHaveLength(1);
    expect(repository.otpChallenges).toHaveLength(1);
    expect(smsProvider.sendOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumber: '+56912345678',
      }),
    );
  });

  it('verifies an OTP, creates a persistent customer session, and can read it back from the cookie', async () => {
    const repository = new InMemoryCustomerAuthRepository();
    const smsSpy = vi.spyOn(smsProvider, 'sendOtp');

    await requestCustomerOtp(repository, smsProvider, {
      phoneNumber: '+56912345678',
    });

    const sentMessage = String(smsSpy.mock.calls[0]?.[0].message ?? '');
    const code = sentMessage.match(/(\d{6})/)?.[1];

    expect(code).toBeTruthy();

    const verification = await verifyCustomerOtp(repository, {
      phoneNumber: '+56912345678',
      code: code as string,
    });

    expect(verification.customer.phoneNumber).toBe('+56912345678');
    expect(repository.sessions).toHaveLength(1);

    const request = new NextRequest('http://localhost/client', {
      headers: {
        cookie: `customer_auth_session=${verification.sessionToken}`,
      },
    });

    const authenticatedSession = await getAuthenticatedCustomerSession(repository, request);
    expect(authenticatedSession?.customer.id).toBe(verification.customer.id);
  });

  it('keeps different customers separated by phone number and session', async () => {
    const repository = new InMemoryCustomerAuthRepository();
    const smsSpy = vi.spyOn(smsProvider, 'sendOtp');

    await requestCustomerOtp(repository, smsProvider, { phoneNumber: '+56911111111' });
    const codeA = String(smsSpy.mock.calls.at(-1)?.[0].message).match(/(\d{6})/)?.[1] as string;
    const authA = await verifyCustomerOtp(repository, { phoneNumber: '+56911111111', code: codeA });

    await requestCustomerOtp(repository, smsProvider, { phoneNumber: '+56922222222' });
    const codeB = String(smsSpy.mock.calls.at(-1)?.[0].message).match(/(\d{6})/)?.[1] as string;
    const authB = await verifyCustomerOtp(repository, { phoneNumber: '+56922222222', code: codeB });

    expect(authA.customer.id).not.toBe(authB.customer.id);
    expect(authA.session.customerId).toBe(authA.customer.id);
    expect(authB.session.customerId).toBe(authB.customer.id);
  });

  it('rejects invalid OTP codes and counts the failed attempt', async () => {
    const repository = new InMemoryCustomerAuthRepository();

    await requestCustomerOtp(repository, smsProvider, {
      phoneNumber: '+56912345678',
    });

    await expect(
      verifyCustomerOtp(repository, {
        phoneNumber: '+56912345678',
        code: '999999',
      }),
    ).rejects.toBeInstanceOf(CustomerAuthInvalidOtpError);

    expect(repository.otpChallenges[0]?.attemptCount).toBe(1);
  });

  it('rejects expired OTP codes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T10:00:00.000Z'));
    const repository = new InMemoryCustomerAuthRepository();
    const smsSpy = vi.spyOn(smsProvider, 'sendOtp');

    await requestCustomerOtp(repository, smsProvider, {
      phoneNumber: '+56912345678',
    });

    const code = String(smsSpy.mock.calls[0]?.[0].message).match(/(\d{6})/)?.[1] as string;
    vi.setSystemTime(new Date('2026-03-22T10:11:00.000Z'));

    await expect(
      verifyCustomerOtp(repository, {
        phoneNumber: '+56912345678',
        code,
      }),
    ).rejects.toBeInstanceOf(CustomerAuthExpiredOtpError);
  });
});
