import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderError } from '../src/lib/providers/types.js';

const cacheGet = vi.fn();
const cacheSet = vi.fn();

vi.mock('../src/lib/cache.js', () => ({
  getCache: () => ({ get: cacheGet, set: cacheSet }),
  cacheKey: (endpoint: string, params: Record<string, string>) =>
    `${endpoint}:${JSON.stringify(params)}`,
}));

import { ApiSportsProvider } from '../src/lib/providers/apisports.js';

type MockedFetch = ReturnType<typeof vi.fn>;

function makeGame(id = 1): Record<string, unknown> {
  return {
    id,
    date: '2026-03-01',
    time: '15:00',
    timestamp: 1772377200,
    timezone: 'UTC',
    week: 'Regular Season - 1',
    status: { long: 'Not Started', short: 'NS' },
    country: { id: 1, name: 'France', code: 'FR', flag: '' },
    league: { id: 16, name: 'Top 14', type: 'League', logo: '', season: 2026 },
    teams: {
      home: { id: 101, name: 'Home XV', logo: '' },
      away: { id: 202, name: 'Away XV', logo: '' },
    },
    scores: { home: null, away: null },
  };
}

function makeEnvelope(games: Array<Record<string, unknown>>): string {
  return JSON.stringify({
    get: 'games',
    parameters: {},
    errors: {},
    results: games.length,
    response: games,
  });
}

describe('ApiSportsProvider resilience', () => {
  beforeEach(() => {
    cacheGet.mockReset();
    cacheSet.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retries once on transient 5xx and succeeds', async () => {
    cacheGet.mockResolvedValue(null);
    const fetchMock = global.fetch as unknown as MockedFetch;

    fetchMock
      .mockResolvedValueOnce(new Response('upstream down', { status: 502 }))
      .mockResolvedValueOnce(
        new Response(makeEnvelope([makeGame(42)]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );

    const provider = new ApiSportsProvider();
    const match = await provider.getMatch('42');

    expect(match?.id).toBe('42');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cacheSet).toHaveBeenCalledTimes(1);
  });

  it('serves stale cache when network fails', async () => {
    const staleEnvelope = {
      get: 'games',
      parameters: {},
      errors: {},
      results: 1,
      response: [makeGame(7)],
    };

    cacheGet.mockResolvedValue({ data: staleEnvelope, stale: true });
    const fetchMock = global.fetch as unknown as MockedFetch;
    fetchMock.mockRejectedValue(new Error('socket hang up'));

    const provider = new ApiSportsProvider();
    const match = await provider.getMatch('7');

    expect(match?.id).toBe('7');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('throws NETWORK_ERROR when no cache and network fails', async () => {
    cacheGet.mockResolvedValue(null);
    const fetchMock = global.fetch as unknown as MockedFetch;
    fetchMock.mockRejectedValue(new Error('network unavailable'));

    const provider = new ApiSportsProvider();

    await expect(provider.getMatch('99')).rejects.toMatchObject<Partial<ProviderError>>({
      name: 'ProviderError',
      code: 'NETWORK_ERROR',
      provider: 'API-Sports',
    });
  });
});

