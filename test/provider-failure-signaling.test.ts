import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiSportsProvider } from '../src/lib/providers/apisports.js';
import { getCache } from '../src/lib/cache.js';

describe('provider failure signaling', () => {
  beforeEach(async () => {
    await getCache().clear();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await getCache().clear();
  });

  it('getToday fails when all requested leagues fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('upstream down')));

    const provider = new ApiSportsProvider();
    await expect(provider.getToday(['51', '16'], { dateYmd: '2026-03-06' }))
      .rejects
      .toThrow('all 2 league requests failed');
  });

  it('getLive fails when all requested leagues fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('upstream down')));

    const provider = new ApiSportsProvider();
    await expect(provider.getLive(['51', '16']))
      .rejects
      .toThrow('all 2 league requests failed');
  });
});
