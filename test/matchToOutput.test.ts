import { describe, expect, it } from 'vitest';
import { matchToOutput } from '../src/render/terminal.js';
import type { Match } from '../src/types/index.js';

describe('matchToOutput', () => {
  it('formats date/time from timestamp (not match.date)', () => {
    const match: Match = {
      id: '1',
      homeTeam: { id: 'h', name: 'Home' },
      awayTeam: { id: 'a', name: 'Away' },
      league: { id: '16', slug: 'top14', name: 'Top 14', country: 'France', sport: 'rugby' },
      // Deliberately wrong date to ensure we use timestamp
      date: new Date('2000-01-01T00:00:00Z'),
      status: 'scheduled',
      timestamp: Date.parse('2026-02-03T01:30:00Z'),
    };

    const output = matchToOutput(match, { timeZone: 'America/Los_Angeles' });
    expect(output.date).toBe('2026-02-02');
    expect(output.time).toBe('17:30');
    expect(output.time_confidence).toBe('exact');
  });

  it('marks placeholder kickoff times as pending confidence', () => {
    const match: Match = {
      id: '2',
      homeTeam: { id: 'h', name: 'Home' },
      awayTeam: { id: 'a', name: 'Away' },
      league: { id: '16', slug: 'top14', name: 'Top 14', country: 'France', sport: 'rugby' },
      date: new Date('2026-02-14T15:00:00Z'),
      status: 'scheduled',
      timestamp: Date.parse('2026-02-14T15:00:00Z'),
      timeTbd: true,
    };

    const output = matchToOutput(match, { timeZone: 'Europe/Paris' });
    expect(output.time).toBe('');
    expect(output.time_tbd).toBe(true);
    expect(output.time_confidence).toBe('pending');
  });
});
