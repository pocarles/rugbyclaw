import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiSportsProvider } from '../src/lib/providers/apisports.js';
import { getCache } from '../src/lib/cache.js';

const SAMPLE_RESPONSE = {
  get: 'games',
  parameters: { league: '51', date: '2026-02-19' },
  errors: [],
  results: 1,
  response: [
    {
      id: 12345,
      date: '2026-02-19T20:10:00+00:00',
      time: '20:10',
      timestamp: 1771531800,
      timezone: 'UTC',
      week: 'Round 1',
      status: { short: 'NS', long: 'Not Started' },
      country: { id: 1, name: 'Europe', code: 'EU', flag: '' },
      league: { id: 51, name: 'Six Nations', type: 'league', logo: '', season: 2026 },
      teams: {
        home: { id: 10, name: 'France', logo: '' },
        away: { id: 20, name: 'Ireland', logo: '' },
      },
      scores: { home: null, away: null },
    },
  ],
};

describe('provider stale fallback metadata', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-19T12:00:00.000Z'));
    await getCache().clear();
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await getCache().clear();
  });

  it('returns stale cache and exposes stale metadata on upstream failure', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(SAMPLE_RESPONSE), {
          status: 200,
          headers: { 'x-request-id': 'proxy-trace-1' },
        })
      )
      .mockRejectedValueOnce(new Error('network down'));

    vi.stubGlobal('fetch', fetchMock);

    const provider = new ApiSportsProvider();
    await provider.getToday(['51'], { dateYmd: '2026-02-19' });
    provider.consumeRuntimeMeta(); // isolate second call assertions

    vi.setSystemTime(new Date('2026-02-19T12:00:45.000Z')); // stale-after (30s) passed, still not expired

    const matches = await provider.getToday(['51'], { dateYmd: '2026-02-19' });
    const meta = provider.consumeRuntimeMeta();

    expect(matches).toHaveLength(1);
    expect(meta.staleFallback).toBe(true);
    expect(meta.cachedAt).toBe('2026-02-19T12:00:00.000Z');
    expect(meta.traceIds.length).toBeGreaterThan(0);
  });
});
