import { describe, expect, it, vi } from 'vitest';

describe('staff auth sessions', () => {
  it('creates a session with persisted token hash and future expiry', async () => {
    const valuesSpy = vi.fn().mockResolvedValue(undefined);
    const insertSpy = vi.fn(() => ({ values: valuesSpy }));

    vi.doMock('@/server/db/client', () => ({
      getDb: () => ({
        insert: insertSpy,
      }),
    }));

    const { createStaffSession } = await import('@/server/modules/staff-auth/service');
    const session = await createStaffSession('staff-1');

    expect(session.token).toBeTruthy();
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(insertSpy).toHaveBeenCalled();
    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        staffUserId: 'staff-1',
        tokenHash: expect.any(String),
      }),
    );

    const insertedTokenHash = valuesSpy.mock.calls[0][0].tokenHash as string;
    expect(insertedTokenHash).not.toBe(session.token);

    vi.doUnmock('@/server/db/client');
  });

  it('getRequiredStaffSession rejects when cookie is missing', async () => {
    const { getRequiredStaffSession, StaffAuthError } = await import('@/server/modules/staff-auth/service');

    await expect(
      getRequiredStaffSession({
        cookies: {
          get: () => undefined,
        },
      }),
    ).rejects.toBeInstanceOf(StaffAuthError);
  });
});
