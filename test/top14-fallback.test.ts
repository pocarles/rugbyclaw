import { describe, expect, it } from 'vitest';
import {
  matchProD2KickoffFallbacks,
  matchTop14KickoffFallbacks,
  matchUrcKickoffFallbacks,
  parseProD2FixturesFromHtml,
  parseTop14FixturesFromHtml,
} from '../src/lib/providers/top14-fallback.js';

describe('top14 fallback parser', () => {
  it('extracts fixtures from score-slider payload', () => {
    const payload = JSON.stringify([
      {
        id: 11431,
        hosting_club: { name: 'Stade Français Paris' },
        visiting_club: { name: 'Stade Toulousain' },
        timer: { firstPeriodStartDate: '2026-02-15T21:05:00+01:00' },
        link: 'https://top14.lnr.fr/feuille-de-match/2025-2026/j17/11431-paris-toulouse',
      },
      {
        id: 11432,
        hosting_club: { name: 'Union Bordeaux-Bègles' },
        visiting_club: { name: 'Castres Olympique' },
        timer: { firstPeriodStartDate: '2026-02-15T14:30:00+01:00' },
        link: 'https://top14.lnr.fr/feuille-de-match/2025-2026/j17/11432-bordeaux-castres',
      },
    ]);
    const html = `<score-slider :matches='${payload}'></score-slider>`;

    const fixtures = parseTop14FixturesFromHtml(html);
    expect(fixtures).toHaveLength(2);
    expect(fixtures[0]).toMatchObject({
      sourceId: '11431',
      home: 'Stade Français Paris',
      away: 'Stade Toulousain',
      round: 17,
    });
    expect(fixtures[0]?.kickoffMs).toBe(Date.parse('2026-02-15T21:05:00+01:00'));
  });
});

describe('top14 fallback matching', () => {
  it('matches alias team names and maps kickoff overrides', () => {
    const fixtures = [
      {
        sourceId: '11432',
        home: 'Union Bordeaux-Bègles',
        away: 'Castres Olympique',
        kickoffMs: Date.parse('2026-02-15T14:30:00+01:00'),
        round: 17,
      },
    ];

    const overrides = matchTop14KickoffFallbacks([
      {
        id: 9001,
        timestamp: Math.floor(Date.parse('2026-02-15T15:00:00Z') / 1000),
        week: 'Regular Season - 17',
        teams: {
          home: { name: 'Bordeaux Begles' },
          away: { name: 'Castres Olympique' },
        },
      },
    ], fixtures);

    expect(overrides.get('9001')).toBe(Date.parse('2026-02-15T14:30:00+01:00'));
  });

  it('skips overrides when round does not match', () => {
    const fixtures = [
      {
        sourceId: '11432',
        home: 'Union Bordeaux-Bègles',
        away: 'Castres Olympique',
        kickoffMs: Date.parse('2026-02-15T14:30:00+01:00'),
        round: 18,
      },
    ];

    const overrides = matchTop14KickoffFallbacks([
      {
        id: 9001,
        timestamp: Math.floor(Date.parse('2026-02-15T15:00:00Z') / 1000),
        week: 'Regular Season - 17',
        teams: {
          home: { name: 'Bordeaux Begles' },
          away: { name: 'Castres Olympique' },
        },
      },
    ], fixtures);

    expect(overrides.has('9001')).toBe(false);
  });
});

describe('pro d2 + urc fallback matching', () => {
  it('parses Pro D2 fixtures from LNR payload', () => {
    const payload = JSON.stringify([
      {
        id: 22001,
        hosting_club: { name: 'Colomiers Rugby' },
        visiting_club: { name: 'AS Béziers Hérault' },
        timer: { firstPeriodStartDate: '2026-02-20T19:30:00+01:00' },
        link: 'https://prod2.lnr.fr/feuille-de-match/2025-2026/j21/22001-colomiers-beziers',
      },
    ]);
    const html = `<score-slider :matches='${payload}'></score-slider>`;
    const fixtures = parseProD2FixturesFromHtml(html);
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0]).toMatchObject({ sourceId: '22001', round: 21 });
  });

  it('matches Pro D2 aliases', () => {
    const overrides = matchProD2KickoffFallbacks([
      {
        id: 9301,
        timestamp: Math.floor(Date.parse('2026-02-20T19:00:00Z') / 1000),
        week: 'Regular Season - 21',
        league: { id: 17 },
        teams: {
          home: { name: 'Colomiers' },
          away: { name: 'Beziers' },
        },
      },
      {
        id: 9302,
        timestamp: Math.floor(Date.parse('2026-02-21T21:00:00Z') / 1000),
        week: 'Regular Season - 21',
        league: { id: 17 },
        teams: {
          home: { name: 'Grenoble FC' },
          away: { name: 'CA Brive' },
        },
      },
    ], [
      {
        sourceId: '22001',
        home: 'Colomiers Rugby',
        away: 'AS Béziers Hérault',
        kickoffMs: Date.parse('2026-02-20T19:30:00+01:00'),
        round: 21,
      },
      {
        sourceId: '22002',
        home: 'FC Grenoble Rugby',
        away: 'CA Brive',
        kickoffMs: Date.parse('2026-02-21T21:00:00+01:00'),
        round: 21,
      },
    ]);

    expect(overrides.get('9301')).toBe(Date.parse('2026-02-20T19:30:00+01:00'));
    expect(overrides.get('9302')).toBe(Date.parse('2026-02-21T21:00:00+01:00'));
  });

  it('matches URC aliases', () => {
    const overrides = matchUrcKickoffFallbacks([
      {
        id: 9401,
        timestamp: Math.floor(Date.parse('2026-02-28T15:00:00Z') / 1000),
        week: 'Round 12',
        league: { id: 76 },
        teams: {
          home: { name: 'Sharks' },
          away: { name: 'Bulls' },
        },
      },
    ], [
      {
        sourceId: '555',
        home: 'Hollywoodbets Sharks',
        away: 'Vodacom Bulls',
        kickoffMs: Date.parse('2026-02-28T15:05:00Z'),
        round: 12,
      },
    ]);

    expect(overrides.get('9401')).toBe(Date.parse('2026-02-28T15:05:00Z'));
  });
});
