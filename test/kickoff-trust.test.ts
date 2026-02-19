import { describe, expect, it } from 'vitest';
import { isLikelyTop14PlaceholderKickoff } from '../src/lib/providers/apisports.js';

type KickoffInput = Parameters<typeof isLikelyTop14PlaceholderKickoff>[0];

function makeGame(overrides: Partial<KickoffInput>): KickoffInput {
  return {
    id: 1,
    date: '2026-02-14T15:00:00+00:00',
    time: '15:00',
    timestamp: Math.floor(Date.parse('2026-02-14T15:00:00Z') / 1000),
    timezone: 'UTC',
    week: 'Regular Season - 17',
    status: { short: 'NS', long: 'Not Started' },
    country: { id: 1, name: 'France', code: 'FR', flag: '' },
    league: { id: 16, name: 'Top 14', type: 'League', logo: '', season: 2025 },
    teams: {
      home: { id: 1, name: 'Home', logo: '' },
      away: { id: 2, name: 'Away', logo: '' },
    },
    scores: { home: null, away: null },
    ...overrides,
  };
}

describe('kickoff trust heuristics', () => {
  it('flags known Top 14 placeholder UTC times', () => {
    const game = makeGame({ time: '15:00', timezone: 'UTC', league: { id: 16, name: 'Top 14', type: 'League', logo: '', season: 2025 } });
    expect(isLikelyTop14PlaceholderKickoff(game, Date.parse('2026-02-10T00:00:00Z'))).toBe(true);
  });

  it('flags far-future Top 14 exact-hour UTC times', () => {
    const game = makeGame({
      time: '12:00',
      timestamp: Math.floor(Date.parse('2026-02-20T12:00:00Z') / 1000),
    });
    expect(isLikelyTop14PlaceholderKickoff(game, Date.parse('2026-02-10T00:00:00Z'))).toBe(true);
  });

  it('does not flag non-Top14 or non-UTC timings', () => {
    const nonTop14 = makeGame({ league: { id: 51, name: 'Six Nations', type: 'Cup', logo: '', season: 2026 } });
    expect(isLikelyTop14PlaceholderKickoff(nonTop14)).toBe(false);

    const nonUtc = makeGame({ timezone: 'Europe/Paris', time: '21:05' });
    expect(isLikelyTop14PlaceholderKickoff(nonUtc)).toBe(false);
  });
});
