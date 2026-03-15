import { hashPassword, verifyPassword } from '@/server/modules/staff-auth/service';

describe('staff auth password helpers', () => {
  it('hashes password and verifies a valid password', async () => {
    const passwordHash = await hashPassword('super-secret-password');

    expect(passwordHash).toContain(':');
    await expect(verifyPassword('super-secret-password', passwordHash)).resolves.toBe(true);
  });

  it('rejects invalid password', async () => {
    const passwordHash = await hashPassword('super-secret-password');

    await expect(verifyPassword('wrong-password', passwordHash)).resolves.toBe(false);
  });
});
