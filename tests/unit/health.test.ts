import { appHealthLabel } from '@/lib/health';

describe('app health label', () => {
  it('returns base foundation marker', () => {
    expect(appHealthLabel()).toBe('order-ahead-foundation-ready');
  });
});
