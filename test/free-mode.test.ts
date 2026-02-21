import { describe, expect, it } from 'vitest';
import { getProxyQuotaLine } from '../src/lib/free-mode.js';

describe('free mode quota line', () => {
  it('returns no free-mode line when API key mode is active', () => {
    expect(getProxyQuotaLine(null, true)).toBeNull();
  });

  it('shows proxy unavailable warning in free mode when status is missing', () => {
    const line = getProxyQuotaLine(null, false);
    expect(line).toContain('Free mode: proxy status unavailable right now.');
  });

  it('shows remaining quota in free mode when rate limits are present', () => {
    const line = getProxyQuotaLine({
      status: 'ok',
      rate_limit: {
        day: { limit: 50, remaining: 49, reset: 'midnight UTC' },
        minute: { limit: 10, remaining: 9 },
      },
    }, false);

    expect(line).toContain('Free quota: 49/50 today, 9/10 per minute');
    expect(line).toContain('est 49 full runs left (9 right now)');
    expect(line).toContain('resets midnight UTC');
  });

  it('shows stale fallback status when proxy status cannot be fetched', () => {
    const line = getProxyQuotaLine(null, false, { staleFallback: true });
    expect(line).toContain('using cached data');
  });
});
