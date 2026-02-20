import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCache } from '../src/lib/cache.js';
import { ApiSportsProvider, PROXY_URL } from '../src/lib/providers/apisports.js';

const URC_GAMES_RESPONSE = {
  get: 'games',
  parameters: { league: '76', season: '2025' },
  errors: [],
  results: 1,
  response: [
    {
      id: 88801,
      date: '2026-02-28T15:00:00+00:00',
      time: '15:00',
      timestamp: Math.floor(Date.parse('2026-02-28T15:00:00Z') / 1000),
      timezone: 'UTC',
      week: 'Round 12',
      status: { short: 'NS', long: 'Not Started' },
      country: { id: 1, name: 'Multi', code: 'EU', flag: '' },
      league: { id: 76, name: 'United Rugby Championship', type: 'League', logo: '', season: 2025 },
      teams: {
        home: { id: 10, name: 'Sharks', logo: '' },
        away: { id: 20, name: 'Bulls', logo: '' },
      },
      scores: { home: null, away: null },
    },
  ],
};

const URC_GRAPHQL_RESPONSE = {
  data: {
    matches: [
      {
        id: 412345,
        season_id: '202501',
        season_name: '2025/26',
        match_data: {
          dateTime: '2026-02-28T15:05:00.000Z',
          round: 12,
          competition: { name: 'United Rugby Championship' },
          homeTeam: { name: 'Hollywoodbets Sharks', shortName: 'Sharks' },
          awayTeam: { name: 'Vodacom Bulls', shortName: 'Bulls' },
        },
      },
    ],
  },
};

describe('urc provider fallback', () => {
  beforeEach(async () => {
    await getCache().clear();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await getCache().clear();
  });

  it('uses URC official GraphQL kickoff when it differs from API-Sports', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

      if (url.startsWith(`${PROXY_URL}/games?`)) {
        return new Response(JSON.stringify(URC_GAMES_RESPONSE), {
          status: 200,
          headers: { 'x-request-id': 'proxy-trace-id' },
        });
      }

      if (url === 'https://www.unitedrugby.com/graphql') {
        return new Response(JSON.stringify(URC_GRAPHQL_RESPONSE), { status: 200 });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const provider = new ApiSportsProvider();
    const matches = await provider.getLeagueFixtures('76');

    expect(matches).toHaveLength(1);
    expect(matches[0]?.timestamp).toBe(Date.parse('2026-02-28T15:05:00.000Z'));
    expect(matches[0]?.timeSource).toBe('secondary');
  });
});
