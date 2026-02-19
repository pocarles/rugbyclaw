import { describe, expect, it } from 'vitest';
import { matchToICS } from '../src/lib/ics.js';
import type { Match } from '../src/types/index.js';

function makeBaseMatch(): Match {
  return {
    id: '49983',
    homeTeam: { id: '107', name: 'Stade Toulousain' },
    awayTeam: { id: '999', name: 'Montauban' },
    league: { id: '16', slug: 'top14', name: 'Top 14', country: 'France', sport: 'rugby' },
    date: new Date('2026-02-28T15:00:00Z'),
    status: 'scheduled',
    round: 'Regular Season - 18',
    timestamp: Date.parse('2026-02-28T15:00:00Z'),
  };
}

describe('ICS export', () => {
  it('exports timed kickoff for known kickoff times', () => {
    const match = makeBaseMatch();
    const ics = matchToICS(match);

    expect(ics).toContain('DTSTART:20260228T150000Z');
    expect(ics).toContain('DTEND:20260228T164000Z');
    expect(ics).not.toContain('DTSTART;VALUE=DATE');
  });

  it('exports all-day event when kickoff time is TBD', () => {
    const match = { ...makeBaseMatch(), timeTbd: true };
    const ics = matchToICS(match);

    expect(ics).toContain('DTSTART;VALUE=DATE:20260228');
    expect(ics).toContain('DTEND;VALUE=DATE:20260301');
    expect(ics).toContain('Kickoff time: TBD');
    expect(ics).not.toContain('DTSTART:20260228T150000Z');
  });
});
