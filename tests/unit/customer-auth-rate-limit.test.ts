import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CustomerAuthRateLimitRecord,
  CustomerAuthRateLimitRepository,
} from '@/server/modules/customer-auth/rate-limit-repository';
import {
  assertOtpRequestAllowed,
  assertOtpVerifyAllowed,
  clearOtpVerifyFailures,
  CustomerAuthRateLimitError,
  recordOtpVerifyFailure,
} from '@/server/modules/customer-auth/rate-limit';

class InMemoryCustomerAuthRateLimitRepository implements CustomerAuthRateLimitRepository {
  records = new Map<string, CustomerAuthRateLimitRecord>();

  private key(action: string, scopeKey: string) {
    return `${action}:${scopeKey}`;
  }

  async getRateLimitRecord(action: string, scopeKey: string) {
    return this.records.get(this.key(action, scopeKey)) ?? null;
  }

  async saveRateLimitRecord(input: {
    action: string;
    scopeKey: string;
    hitCount: number;
    windowStartedAt: string;
    blockedUntil?: string | null;
    updatedAt: string;
  }) {
    const key = this.key(input.action, input.scopeKey);
    const existing = this.records.get(key);
    const record: CustomerAuthRateLimitRecord = {
      id: existing?.id ?? key,
      action: input.action,
      scopeKey: input.scopeKey,
      hitCount: input.hitCount,
      windowStartedAt: input.windowStartedAt,
      blockedUntil: input.blockedUntil ?? null,
      createdAt: existing?.createdAt ?? input.updatedAt,
      updatedAt: input.updatedAt,
    };
    this.records.set(key, record);
    return record;
  }

  async clearRateLimitRecord(action: string, scopeKey: string) {
    this.records.delete(this.key(action, scopeKey));
  }
}

describe('customer auth rate limiting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T10:00:00.000Z'));
  });

  it('rate limits OTP requests per phone number with a cooldown', async () => {
    const repository = new InMemoryCustomerAuthRateLimitRepository();

    await assertOtpRequestAllowed(repository, {
      phoneNumber: '+56912345678',
      ipAddress: '127.0.0.1',
    });
    await assertOtpRequestAllowed(repository, {
      phoneNumber: '+56912345678',
      ipAddress: '127.0.0.1',
    });
    await assertOtpRequestAllowed(repository, {
      phoneNumber: '+56912345678',
      ipAddress: '127.0.0.1',
    });

    await expect(
      assertOtpRequestAllowed(repository, {
        phoneNumber: '+56912345678',
        ipAddress: '127.0.0.1',
      }),
    ).rejects.toBeInstanceOf(CustomerAuthRateLimitError);
  });

  it('rate limits OTP verify attempts per phone number with a cooldown', async () => {
    const repository = new InMemoryCustomerAuthRateLimitRepository();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await assertOtpVerifyAllowed(repository, {
        phoneNumber: '+56912345678',
        ipAddress: '127.0.0.1',
      });
    }

    await expect(
      assertOtpVerifyAllowed(repository, {
        phoneNumber: '+56912345678',
        ipAddress: '127.0.0.1',
      }),
    ).rejects.toBeInstanceOf(CustomerAuthRateLimitError);
  });

  it('applies a failure-based cooldown after repeated invalid OTP verifies and clears it after a success', async () => {
    const repository = new InMemoryCustomerAuthRateLimitRepository();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await recordOtpVerifyFailure(repository, {
        phoneNumber: '+56912345678',
        ipAddress: '127.0.0.1',
      });
    }

    await expect(
      recordOtpVerifyFailure(repository, {
        phoneNumber: '+56912345678',
        ipAddress: '127.0.0.1',
      }),
    ).rejects.toBeInstanceOf(CustomerAuthRateLimitError);

    await clearOtpVerifyFailures(repository, {
      phoneNumber: '+56912345678',
      ipAddress: '127.0.0.1',
    });

    await expect(
      recordOtpVerifyFailure(repository, {
        phoneNumber: '+56912345678',
        ipAddress: '127.0.0.1',
      }),
    ).resolves.toBeUndefined();
  });
});
