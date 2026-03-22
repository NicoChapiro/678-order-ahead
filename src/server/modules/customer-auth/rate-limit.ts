import { NextRequest } from 'next/server';
import type {
  CustomerAuthRateLimitRecord,
  CustomerAuthRateLimitRepository,
} from '@/server/modules/customer-auth/rate-limit-repository';

export class CustomerAuthRateLimitError extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds: number,
  ) {
    super(message);
  }
}

type RateLimitPolicy = {
  action: string;
  scopeKey: string;
  maxHits: number;
  windowMs: number;
  blockMs: number;
  message: string;
};

const OTP_REQUEST_PHONE_POLICY = {
  action: 'request_otp_phone',
  maxHits: 3,
  windowMs: 10 * 60 * 1000,
  blockMs: 30 * 60 * 1000,
  message: 'Espera un momento antes de pedir otro código.',
} as const;

const OTP_REQUEST_IP_POLICY = {
  action: 'request_otp_ip',
  maxHits: 8,
  windowMs: 10 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
  message: 'Espera un momento antes de pedir otro código.',
} as const;

const OTP_REQUEST_GLOBAL_POLICY = {
  action: 'request_otp_global',
  maxHits: 150,
  windowMs: 10 * 60 * 1000,
  blockMs: 5 * 60 * 1000,
  message: 'Espera un momento antes de pedir otro código.',
} as const;

const OTP_VERIFY_PHONE_POLICY = {
  action: 'verify_otp_phone',
  maxHits: 10,
  windowMs: 10 * 60 * 1000,
  blockMs: 30 * 60 * 1000,
  message: 'Espera un momento antes de intentar de nuevo.',
} as const;

const OTP_VERIFY_IP_POLICY = {
  action: 'verify_otp_ip',
  maxHits: 20,
  windowMs: 10 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
  message: 'Espera un momento antes de intentar de nuevo.',
} as const;

const OTP_VERIFY_FAILURE_PHONE_POLICY = {
  action: 'verify_otp_failure_phone',
  maxHits: 5,
  windowMs: 15 * 60 * 1000,
  blockMs: 30 * 60 * 1000,
  message: 'Espera un momento antes de intentar de nuevo.',
} as const;

const OTP_VERIFY_FAILURE_IP_POLICY = {
  action: 'verify_otp_failure_ip',
  maxHits: 8,
  windowMs: 15 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
  message: 'Espera un momento antes de intentar de nuevo.',
} as const;

function secondsUntil(dateIso: string) {
  return Math.max(1, Math.ceil((new Date(dateIso).getTime() - Date.now()) / 1000));
}

function hasWindowExpired(record: CustomerAuthRateLimitRecord, windowMs: number) {
  return Date.now() - new Date(record.windowStartedAt).getTime() >= windowMs;
}

async function applyRateLimit(
  repository: CustomerAuthRateLimitRepository,
  policy: RateLimitPolicy,
) {
  const now = new Date();
  const nowIso = now.toISOString();
  const existingRecord = await repository.getRateLimitRecord(policy.action, policy.scopeKey);

  if (existingRecord?.blockedUntil && new Date(existingRecord.blockedUntil).getTime() > now.getTime()) {
    throw new CustomerAuthRateLimitError(
      policy.message,
      secondsUntil(existingRecord.blockedUntil),
    );
  }

  const resetWindow = !existingRecord || hasWindowExpired(existingRecord, policy.windowMs);
  const nextHitCount = resetWindow ? 1 : existingRecord.hitCount + 1;
  const blockedUntil =
    nextHitCount > policy.maxHits
      ? new Date(now.getTime() + policy.blockMs).toISOString()
      : null;

  await repository.saveRateLimitRecord({
    action: policy.action,
    scopeKey: policy.scopeKey,
    hitCount: nextHitCount,
    windowStartedAt: resetWindow ? nowIso : existingRecord.windowStartedAt,
    blockedUntil,
    updatedAt: nowIso,
  });

  if (blockedUntil) {
    throw new CustomerAuthRateLimitError(policy.message, secondsUntil(blockedUntil));
  }
}

function getScopeIp(ipAddress: string | null) {
  return ipAddress?.trim() || 'unknown';
}

export function getRequestIpAddress(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null;
  }

  const realIp = request.headers.get('x-real-ip');
  return realIp?.trim() || null;
}

export async function assertOtpRequestAllowed(
  repository: CustomerAuthRateLimitRepository,
  input: { phoneNumber: string; ipAddress: string | null },
) {
  await applyRateLimit(repository, {
    ...OTP_REQUEST_PHONE_POLICY,
    scopeKey: input.phoneNumber,
  });
  await applyRateLimit(repository, {
    ...OTP_REQUEST_IP_POLICY,
    scopeKey: getScopeIp(input.ipAddress),
  });
  await applyRateLimit(repository, {
    ...OTP_REQUEST_GLOBAL_POLICY,
    scopeKey: 'global',
  });
}

export async function assertOtpVerifyAllowed(
  repository: CustomerAuthRateLimitRepository,
  input: { phoneNumber: string; ipAddress: string | null },
) {
  await applyRateLimit(repository, {
    ...OTP_VERIFY_PHONE_POLICY,
    scopeKey: input.phoneNumber,
  });
  await applyRateLimit(repository, {
    ...OTP_VERIFY_IP_POLICY,
    scopeKey: getScopeIp(input.ipAddress),
  });
}

export async function recordOtpVerifyFailure(
  repository: CustomerAuthRateLimitRepository,
  input: { phoneNumber: string; ipAddress: string | null },
) {
  await applyRateLimit(repository, {
    ...OTP_VERIFY_FAILURE_PHONE_POLICY,
    scopeKey: input.phoneNumber,
  });
  await applyRateLimit(repository, {
    ...OTP_VERIFY_FAILURE_IP_POLICY,
    scopeKey: getScopeIp(input.ipAddress),
  });
}

export async function clearOtpVerifyFailures(
  repository: CustomerAuthRateLimitRepository,
  input: { phoneNumber: string; ipAddress: string | null },
) {
  await repository.clearRateLimitRecord(
    OTP_VERIFY_FAILURE_PHONE_POLICY.action,
    input.phoneNumber,
  );
  await repository.clearRateLimitRecord(
    OTP_VERIFY_FAILURE_IP_POLICY.action,
    getScopeIp(input.ipAddress),
  );
}
