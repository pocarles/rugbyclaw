import { describe, expect, it } from 'vitest';
import { matchToOutput } from '../src/render/terminal.js';
import type {
  FixturesOutput,
  Match,
  MatchOutput,
  NotifyOutput,
  ResultsOutput,
  ScoresOutput,
  TeamSearchOutput,
  MarketPulseOutput,
} from '../src/types/index.js';

function sampleMatchOutput(): MatchOutput {
  const sample: Match = {
    id: '123',
    homeTeam: { id: '1', name: 'Home XV' },
    awayTeam: { id: '2', name: 'Away XV' },
    league: { id: '16', slug: 'top14', name: 'Top 14', country: 'France', sport: 'rugby' },
    date: new Date('2026-02-19T20:05:00Z'),
    status: 'scheduled',
    timestamp: Date.parse('2026-02-19T20:05:00Z'),
    timeSource: 'provider',
  };

  return matchToOutput(sample, { timeZone: 'UTC' });
}

function sortedKeys(value: Record<string, unknown>): string[] {
  return Object.keys(value).sort((a, b) => a.localeCompare(b));
}

describe('json contract', () => {
  it('keeps scores contract stable', () => {
    const output: ScoresOutput = {
      matches: [sampleMatchOutput()],
      generated_at: '2026-02-19T00:00:00.000Z',
    };

    expect(sortedKeys(output as unknown as Record<string, unknown>)).toEqual([
      'generated_at',
      'matches',
    ]);
    expect(sortedKeys(output.matches[0] as unknown as Record<string, unknown>)).toEqual([
      'away',
      'date',
      'home',
      'id',
      'league',
      'status',
      'summary',
      'time',
      'time_confidence',
      'time_source',
      'time_tbd',
      'venue',
    ]);
  });

  it('keeps fixtures/results contract stable', () => {
    const fixtures: FixturesOutput = {
      league: 'Top 14',
      matches: [sampleMatchOutput()],
      generated_at: '2026-02-19T00:00:00.000Z',
    };
    const results: ResultsOutput = {
      league: 'Top 14',
      matches: [{ ...sampleMatchOutput(), status: 'finished', summary: 'Close one.' }],
      generated_at: '2026-02-19T00:00:00.000Z',
    };

    expect(sortedKeys(fixtures as unknown as Record<string, unknown>)).toEqual([
      'generated_at',
      'league',
      'matches',
    ]);
    expect(sortedKeys(results as unknown as Record<string, unknown>)).toEqual([
      'generated_at',
      'league',
      'matches',
    ]);
    expect(sortedKeys(results.matches[0] as unknown as Record<string, unknown>)).toEqual([
      'away',
      'date',
      'home',
      'id',
      'league',
      'status',
      'summary',
      'time',
      'time_confidence',
      'time_source',
      'time_tbd',
      'venue',
    ]);
  });

  it('keeps team search and notify contracts stable', () => {
    const teamSearch: TeamSearchOutput = {
      query: 'toulouse',
      teams: [
        {
          id: '107',
          name: 'Stade Toulousain',
          slug: 'stade-toulousain',
          country: 'France',
          leagues: [],
        },
      ],
    };

    const notify: NotifyOutput = {
      type: 'daily',
      notifications: [
        {
          type: 'hour_before',
          match_id: '123',
          message: 'Kickoff in ~1 hour',
          match: sampleMatchOutput(),
        },
      ],
      generated_at: '2026-02-19T00:00:00.000Z',
    };

    expect(sortedKeys(teamSearch as unknown as Record<string, unknown>)).toEqual([
      'query',
      'teams',
    ]);
    expect(sortedKeys(teamSearch.teams[0] as unknown as Record<string, unknown>)).toEqual([
      'country',
      'id',
      'leagues',
      'name',
      'slug',
    ]);
    expect(sortedKeys(notify as unknown as Record<string, unknown>)).toEqual([
      'generated_at',
      'notifications',
      'type',
    ]);
    expect(sortedKeys(notify.notifications[0] as unknown as Record<string, unknown>)).toEqual([
      'match',
      'match_id',
      'message',
      'type',
    ]);
  });

  it('keeps market pulse contract stable', () => {
    const pulse: MarketPulseOutput = {
      match: {
        id: '991',
        home: 'Home XV',
        away: 'Away XV',
        league: 'Top 14',
        date: '2026-02-19',
        market: 'home-xv-away-xv',
      },
      market_name: 'Home XV vs Away XV - Match Odds',
      outcomes: [
        { selection: 'home', name: 'Home XV', implied_prob: 0.52, best_bid: 0.51, best_ask: 0.53 },
        { selection: 'draw', name: 'Draw', implied_prob: 0.12, best_bid: 0.11, best_ask: 0.13 },
        { selection: 'away', name: 'Away XV', implied_prob: 0.36, best_bid: 0.35, best_ask: 0.37 },
      ],
      confidence: 'high',
      generated_at: '2026-02-19T00:00:00.000Z',
      liquidity: 1500,
      volume_24h: 3200,
      spread: 0.04,
      updated_at: '2026-02-19T10:00:00.000Z',
      trace_id: 'poly-trace',
      quality_warnings: ['missing_spread'],
    };

    expect(sortedKeys(pulse as unknown as Record<string, unknown>)).toEqual([
      'confidence',
      'generated_at',
      'liquidity',
      'market_name',
      'match',
      'outcomes',
      'quality_warnings',
      'spread',
      'trace_id',
      'updated_at',
      'volume_24h',
    ]);
    expect(sortedKeys(pulse.match as unknown as Record<string, unknown>)).toEqual([
      'away',
      'date',
      'home',
      'id',
      'league',
      'market',
    ]);
    expect(sortedKeys(pulse.outcomes[0] as unknown as Record<string, unknown>)).toEqual([
      'best_ask',
      'best_bid',
      'implied_prob',
      'name',
      'selection',
    ]);
  });
});
