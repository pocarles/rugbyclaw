import { describe, expect, it } from 'vitest';
import { getFixturesNoMatchesExplanation, getScoresNoMatchesExplanation } from '../src/lib/explain.js';

describe('explain helpers', () => {
  it('returns scores explanation when no matches are found', () => {
    const lines = getScoresNoMatchesExplanation({
      mode: 'proxy',
      timeZone: 'America/New_York',
      dateYmd: '2026-02-19',
      leagues: [{ slug: 'top14', id: '16', name: 'Top 14' }],
      matchCount: 0,
    });

    expect(lines[0]).toBe('Why no matches today:');
    expect(lines).toContain('- API result count: 0');
    expect(lines).toContain('- Date queried: 2026-02-19');
  });

  it('returns fixtures explanation when no fixtures are found', () => {
    const lines = getFixturesNoMatchesExplanation({
      mode: 'direct',
      timeZone: 'Europe/Paris',
      leagues: [{ slug: 'six_nations', id: '51', name: 'Six Nations' }],
      matchCount: 0,
      limit: 15,
    });

    expect(lines[0]).toBe('Why no upcoming fixtures:');
    expect(lines).toContain('- Mode: API key (direct)');
    expect(lines).toContain('- Match limit: 15');
  });

  it('returns empty arrays when matches exist', () => {
    expect(
      getScoresNoMatchesExplanation({
        mode: 'proxy',
        timeZone: 'America/New_York',
        dateYmd: '2026-02-19',
        leagues: [],
        matchCount: 1,
      })
    ).toEqual([]);

    expect(
      getFixturesNoMatchesExplanation({
        mode: 'direct',
        timeZone: 'Europe/Paris',
        leagues: [],
        matchCount: 2,
        limit: 15,
      })
    ).toEqual([]);
  });
});
