import { describe, expect, it } from 'vitest';
import {
  getFixturesNoMatchesExplanation,
  getFixturesNoMatchesHint,
  getResultsNoMatchesExplanation,
  getResultsNoMatchesHint,
  getScoresNoMatchesExplanation,
  getScoresNoMatchesHint,
} from '../src/lib/explain.js';

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

  it('returns hints for empty outputs by default', () => {
    const scoresHint = getScoresNoMatchesHint({
      mode: 'proxy',
      timeZone: 'America/New_York',
      dateYmd: '2026-02-19',
      leagues: [{ slug: 'top14', id: '16', name: 'Top 14' }],
      matchCount: 0,
    });
    expect(scoresHint[0]).toContain('No matches returned for 2026-02-19');

    const fixturesHint = getFixturesNoMatchesHint({
      mode: 'direct',
      timeZone: 'Europe/Paris',
      leagues: [{ slug: 'six_nations', id: '51', name: 'Six Nations' }],
      matchCount: 0,
      limit: 10,
    });
    expect(fixturesHint[1]).toContain('limit 10');

    const resultsHint = getResultsNoMatchesHint({
      mode: 'direct',
      timeZone: 'Europe/Paris',
      leagues: [{ slug: 'six_nations', id: '51', name: 'Six Nations' }],
      matchCount: 0,
      limit: 5,
    });
    expect(resultsHint[0]).toContain('No recent results');
  });

  it('returns results explanation when no results are found', () => {
    const lines = getResultsNoMatchesExplanation({
      mode: 'proxy',
      timeZone: 'America/New_York',
      leagues: [{ slug: 'top14', id: '16', name: 'Top 14' }],
      matchCount: 0,
      limit: 12,
    });

    expect(lines[0]).toBe('Why no recent results:');
    expect(lines).toContain('- Match limit: 12');
    expect(lines).toContain('- API result count: 0');
  });
});
