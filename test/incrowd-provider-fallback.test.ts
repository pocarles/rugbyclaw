import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCache } from '../src/lib/cache.js';
import { ApiSportsProvider, PROXY_URL } from '../src/lib/providers/apisports.js';

const INCROWD_MATCHES_URL = 'https://rugby-union-feeds.incrowdsports.com/v1/matches';

interface InCrowdFallbackCase {
  label: string;
  leagueId: string;
  leagueName: string;
  season: string;
  week: string;
  round: number;
  competitionId: number;
  apiKickoffIso: string;
  officialKickoffIso: string;
  apiHome: string;
  apiAway: string;
  officialHome: string;
  officialAway: string;
}

const CASES: InCrowdFallbackCase[] = [
  {
    label: 'Premiership Rugby',
    leagueId: '13',
    leagueName: 'Premiership Rugby',
    season: '2029',
    week: 'Regular Season - 4',
    round: 4,
    competitionId: 1011,
    apiKickoffIso: '2030-03-22T15:00:00Z',
    officialKickoffIso: '2030-03-22T17:30:00Z',
    apiHome: 'Bristol',
    apiAway: 'Saracens',
    officialHome: 'Bristol Bears',
    officialAway: 'Saracens',
  },
  {
    label: 'Six Nations',
    leagueId: '51',
    leagueName: 'Six Nations',
    season: '2030',
    week: 'Round 2',
    round: 2,
    competitionId: 1055,
    apiKickoffIso: '2030-02-10T15:00:00Z',
    officialKickoffIso: '2030-02-10T16:10:00Z',
    apiHome: 'France',
    apiAway: 'Ireland',
    officialHome: 'France',
    officialAway: 'Ireland',
  },
  {
    label: 'Super Rugby Pacific',
    leagueId: '71',
    leagueName: 'Super Rugby Pacific',
    season: '2030',
    week: 'Round 3',
    round: 3,
    competitionId: 1020,
    apiKickoffIso: '2030-03-01T06:00:00Z',
    officialKickoffIso: '2030-03-01T08:35:00Z',
    apiHome: 'Waratahs',
    apiAway: 'Reds',
    officialHome: 'NSW Waratahs',
    officialAway: 'Queensland Reds',
  },
  {
    label: 'Champions Cup',
    leagueId: '54',
    leagueName: 'European Rugby Champions Cup',
    season: '2029',
    week: 'Pool Stage - 2',
    round: 2,
    competitionId: 1008,
    apiKickoffIso: '2030-01-13T15:00:00Z',
    officialKickoffIso: '2030-01-13T20:00:00Z',
    apiHome: 'Stade Toulousain',
    apiAway: 'Sharks',
    officialHome: 'Toulouse',
    officialAway: 'Hollywoodbets Sharks',
  },
  {
    label: 'Challenge Cup',
    leagueId: '52',
    leagueName: 'European Rugby Challenge Cup',
    season: '2029',
    week: 'Pool Stage - 2',
    round: 2,
    competitionId: 1026,
    apiKickoffIso: '2030-01-12T15:00:00Z',
    officialKickoffIso: '2030-01-12T17:30:00Z',
    apiHome: 'USA Perpignan',
    apiAway: 'Dragons',
    officialHome: 'Perpignan',
    officialAway: 'Dragons RFC',
  },
];

function buildGamesResponse(testCase: InCrowdFallbackCase, gameId: number) {
  const apiKickoffDate = new Date(testCase.apiKickoffIso);
  const time = apiKickoffDate.toISOString().slice(11, 16);

  return {
    get: 'games',
    parameters: { league: testCase.leagueId, season: testCase.season },
    errors: [],
    results: 1,
    response: [
      {
        id: gameId,
        date: apiKickoffDate.toISOString(),
        time,
        timestamp: Math.floor(apiKickoffDate.getTime() / 1000),
        timezone: 'UTC',
        week: testCase.week,
        status: { short: 'NS', long: 'Not Started' },
        country: { id: 1, name: 'Multi', code: 'XX', flag: '' },
        league: {
          id: Number(testCase.leagueId),
          name: testCase.leagueName,
          type: 'League',
          logo: '',
          season: Number(testCase.season),
        },
        teams: {
          home: { id: 1, name: testCase.apiHome, logo: '' },
          away: { id: 2, name: testCase.apiAway, logo: '' },
        },
        scores: { home: null, away: null },
      },
    ],
  };
}

function buildInCrowdResponse(testCase: InCrowdFallbackCase, sourceId: string) {
  return {
    status: 'success',
    data: [
      {
        id: sourceId,
        compId: testCase.competitionId,
        date: testCase.officialKickoffIso,
        round: testCase.round,
        homeTeam: { name: testCase.officialHome },
        awayTeam: { name: testCase.officialAway },
      },
    ],
  };
}

describe('incrowd provider fallback', () => {
  beforeEach(async () => {
    await getCache().clear();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await getCache().clear();
  });

  for (const [index, testCase] of CASES.entries()) {
    it(`overrides kickoff for ${testCase.label}`, async () => {
      const gameId = 91000 + index;
      const sourceId = `incrowd-${testCase.leagueId}-${index}`;
      const gamesResponse = buildGamesResponse(testCase, gameId);
      const inCrowdResponse = buildInCrowdResponse(testCase, sourceId);

      const fetchMock = vi.fn(async (input: string | URL | Request) => {
        const url = typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

        if (url.startsWith(`${PROXY_URL}/games?`)) {
          return new Response(JSON.stringify(gamesResponse), {
            status: 200,
            headers: { 'x-request-id': 'proxy-trace-id' },
          });
        }

        if (url.startsWith(INCROWD_MATCHES_URL)) {
          const parsed = new URL(url);
          if (parsed.searchParams.get('compId') === String(testCase.competitionId)) {
            return new Response(JSON.stringify(inCrowdResponse), { status: 200 });
          }
          return new Response(JSON.stringify({ status: 'success', data: [] }), { status: 200 });
        }

        throw new Error(`Unexpected URL: ${url}`);
      });

      vi.stubGlobal('fetch', fetchMock);

      const provider = new ApiSportsProvider();
      const fixtures = await provider.getLeagueFixtures(testCase.leagueId);

      expect(fixtures).toHaveLength(1);
      expect(fixtures[0]?.timestamp).toBe(Date.parse(testCase.officialKickoffIso));
      expect(fixtures[0]?.timeSource).toBe('secondary');
      expect(fixtures[0]?.timeTbd).toBe(false);
    });
  }
});
