import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
});

describe('server env domain getters', () => {
  it('getDatabaseEnv only requires DATABASE_URL', async () => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: 'https://db.example.com',
    };
    delete process.env.PHONE_AUTH_PROVIDER;
    delete process.env.PHONE_AUTH_API_KEY;

    const { getDatabaseEnv } = await import('@/server/env');

    expect(getDatabaseEnv()).toEqual({
      DATABASE_URL: 'https://db.example.com',
    });
  });
});
