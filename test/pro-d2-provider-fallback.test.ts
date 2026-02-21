import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCache } from '../src/lib/cache.js';
import { ApiSportsProvider, PROXY_URL } from '../src/lib/providers/apisports.js';

const PRO_D2_GAMES_RESPONSE = {
  get: 'games',
  parameters: { league: '17', season: '2025' },
  errors: [],
  results: 1,
  response: [
    {
      id: 77701,
      date: '2026-02-20T19:00:00+00:00',
      time: '19:00',
      timestamp: Math.floor(Date.parse('2026-02-20T19:00:00Z') / 1000),
      timezone: 'UTC',
      week: 'Regular Season - 21',
      status: { short: 'NS', long: 'Not Started' },
      country: { id: 1, name: 'France', code: 'FR', flag: '' },
      league: { id: 17, name: 'Pro D2', type: 'League', logo: '', season: 2025 },
      teams: {
        home: { id: 1, name: 'Colomiers', logo: '' },
        away: { id: 2, name: 'Beziers', logo: '' },
      },
      scores: { home: null, away: null },
    },
  ],
};

const PRO_D2_HTML = `<score-slider :matches='${JSON.stringify([{
  id: 9991,
  hosting_club: { name: 'Colomiers Rugby' },
  visiting_club: { name: 'AS Béziers Hérault' },
  timer: { firstPeriodStartDate: '2026-02-20T19:30:00+01:00' },
  link: 'https://prod2.lnr.fr/feuille-de-match/2025-2026/j21/9991-colomiers-beziers',
}])}'></score-slider>`;

describe('pro d2 provider fallback', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    await getCache().clear();
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await getCache().clear();
  });

  it('replaces placeholder kickoff with official Pro D2 kickoff', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

      if (url.startsWith(`${PROXY_URL}/games?`)) {
        return new Response(JSON.stringify(PRO_D2_GAMES_RESPONSE), {
          status: 200,
          headers: { 'x-request-id': 'proxy-trace-id' },
        });
      }

      if (url === 'https://prod2.lnr.fr/') {
        return new Response(PRO_D2_HTML, { status: 200 });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const provider = new ApiSportsProvider();
    const matches = await provider.getLeagueFixtures('17');

    expect(matches).toHaveLength(1);
    expect(matches[0]?.timestamp).toBe(Date.parse('2026-02-20T19:30:00+01:00'));
    expect(matches[0]?.timeSource).toBe('secondary');
    expect(matches[0]?.timeTbd).toBe(false);
  });
});
