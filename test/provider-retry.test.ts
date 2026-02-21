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
      id: 991,
      date: '2026-02-19T20:10:00+00:00',
      time: '20:10',
      timestamp: 1771531800,
      timezone: 'UTC',
      week: 'Round 1',
      status: { short: '1H', long: 'In Progress' },
      country: { id: 1, name: 'Europe', code: 'EU', flag: '' },
      league: { id: 51, name: 'Six Nations', type: 'league', logo: '', season: 2026 },
      teams: {
        home: { id: 10, name: 'France', logo: '' },
        away: { id: 20, name: 'Ireland', logo: '' },
      },
      scores: { home: 7, away: 3 },
    },
  ],
};

describe('provider retry behavior', () => {
  beforeEach(async () => {
    await getCache().clear();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await getCache().clear();
  });

  it('retries transient network failures before succeeding', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(SAMPLE_RESPONSE), {
          status: 200,
          headers: { 'x-request-id': 'proxy-trace-retry' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new ApiSportsProvider();
    const matches = await provider.getToday(['51'], { dateYmd: '2026-02-19' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(matches).toHaveLength(1);
  });

  it('does not retry unauthorized responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'unauthorized' }), {
        status: 401,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new ApiSportsProvider('bad-key');

    await expect(provider.getLeagueFixtures('16')).rejects.toThrow('Invalid API key');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
