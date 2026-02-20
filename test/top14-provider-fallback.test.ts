import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCache } from '../src/lib/cache.js';
import { ApiSportsProvider, PROXY_URL } from '../src/lib/providers/apisports.js';

const TOP14_GAMES_RESPONSE = {
  get: 'games',
  parameters: { league: '16', season: '2025' },
  errors: [],
  results: 1,
  response: [
    {
      id: 55555,
      date: '2026-02-28T15:00:00+00:00',
      time: '15:00',
      timestamp: Math.floor(Date.parse('2026-02-28T15:00:00Z') / 1000),
      timezone: 'UTC',
      week: 'Regular Season - 18',
      status: { short: 'NS', long: 'Not Started' },
      country: { id: 1, name: 'France', code: 'FR', flag: '' },
      league: { id: 16, name: 'Top 14', type: 'League', logo: '', season: 2025 },
      teams: {
        home: { id: 7, name: 'Bordeaux Begles', logo: '' },
        away: { id: 18, name: 'Castres Olympique', logo: '' },
      },
      scores: { home: null, away: null },
    },
  ],
};

const TOP14_HTML = `<score-slider :matches='${JSON.stringify([{
  id: 11499,
  hosting_club: { name: 'Union Bordeaux-Bègles' },
  visiting_club: { name: 'Castres Olympique' },
  timer: { firstPeriodStartDate: '2026-02-28T21:00:00+01:00' },
  link: 'https://top14.lnr.fr/feuille-de-match/2025-2026/j18/11499-bordeaux-castres',
}])}'></score-slider>`;

describe('top14 provider fallback', () => {
  beforeEach(async () => {
    await getCache().clear();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await getCache().clear();
  });

  it('uses official fallback kickoff when API-Sports time is placeholder', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

      if (url.startsWith(`${PROXY_URL}/games?`)) {
        return new Response(JSON.stringify(TOP14_GAMES_RESPONSE), {
          status: 200,
          headers: { 'x-request-id': 'proxy-trace-id' },
        });
      }

      if (url === 'https://top14.lnr.fr/') {
        return new Response(TOP14_HTML, { status: 200 });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const provider = new ApiSportsProvider();
    const matches = await provider.getLeagueFixtures('16');

    expect(matches).toHaveLength(1);
    expect(matches[0]?.timestamp).toBe(Date.parse('2026-02-28T21:00:00+01:00'));
    expect(matches[0]?.timeSource).toBe('secondary');
    expect(matches[0]?.timeTbd).toBe(false);
  });
});
