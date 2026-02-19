import { describe, expect, it } from 'vitest';
import { renderFixtures, renderMatch } from '../src/render/terminal.js';
import type { FixturesOutput, MatchOutput } from '../src/types/index.js';

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

function makeScheduledMatch(match: Partial<MatchOutput>): MatchOutput {
  return {
    id: match.id ?? '1',
    home: match.home ?? { name: 'Home' },
    away: match.away ?? { name: 'Away' },
    league: match.league ?? 'Top 14',
    date: match.date ?? '2026-02-14',
    time: match.time ?? '15:10',
    status: 'scheduled',
    ...match,
  };
}

describe('pending kickoff rendering', () => {
  it('moves pending kickoff fixtures into a Coming Soon section', () => {
    const output: FixturesOutput = {
      matches: [
        makeScheduledMatch({
          id: 'pending',
          home: { name: 'Stade Francais Paris' },
          away: { name: 'Stade Toulousain' },
          date: '2026-02-14',
          time: '',
          time_tbd: true,
          time_confidence: 'pending',
        }),
        makeScheduledMatch({
          id: 'exact',
          home: { name: 'France' },
          away: { name: 'Ireland' },
          date: '2026-02-05',
          time: '15:10',
          time_confidence: 'exact',
        }),
      ],
      generated_at: '2026-02-01T00:00:00Z',
    };

    const rendered = stripAnsi(renderFixtures(output, false, 'America/New_York'));
    expect(rendered).toContain('⚠ Kickoff date/time pending from API-Sports');
    expect(rendered).toContain('Coming Soon');
    expect(rendered).toContain('Stade Francais Paris');
    expect(rendered).toContain('France');
    expect(rendered).toContain('Thu, Feb 5');
    expect(rendered).not.toContain('Sat, Feb 14');
  });

  it('shows only Coming Soon for team match when kickoff is pending', () => {
    const match = makeScheduledMatch({
      home: { name: 'Stade Francais Paris' },
      away: { name: 'Stade Toulousain' },
      date: '2026-02-14',
      time: '',
      time_tbd: true,
      time_confidence: 'pending',
    });

    const rendered = stripAnsi(renderMatch(match, false, 'America/New_York'));
    expect(rendered).toContain('Coming Soon');
    expect(rendered).toContain('Top 14 · Coming Soon');
    expect(rendered).not.toContain('Sat, Feb 14');
    expect(rendered).not.toContain(' at ');
  });
});
