import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiSportsProvider } from '../src/lib/providers/apisports.js';
import { getCache } from '../src/lib/cache.js';
import { getConfigPaths, setConfigPathOverride } from '../src/lib/config.js';
import { standingsCommand } from '../src/commands/standings.js';

const originalPaths = getConfigPaths();
const tempDirs: string[] = [];

function withCapturedLogs<T>(fn: () => Promise<T>): Promise<{ logs: string[]; result: T }> {
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map((value) => String(value)).join(' '));
  };

  return fn()
    .then((result) => ({ logs, result }))
    .finally(() => {
      console.log = originalLog;
    });
}

describe('standings', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-06T12:00:00Z'));
    await getCache().clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    setConfigPathOverride(originalPaths.configDir);
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('merges ESPN enrichment fields when available', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/standings?league=16&season=2025')) {
        return new Response(JSON.stringify({
          get: 'standings',
          parameters: { league: '16', season: '2025' },
          errors: [],
          results: 2,
          response: [
            {
              position: 1,
              team: { id: 101, name: 'Toulouse', logo: '' },
              games: { played: 10, win: { total: 8 }, draw: 0, lose: 2 },
              goals: { for: 300, against: 200 },
              points: 37,
              form: 'WWWWW',
              description: 'Playoffs',
            },
            {
              position: 2,
              team: { id: 102, name: 'La Rochelle', logo: '' },
              games: { played: 10, win: { total: 7 }, draw: 1, lose: 2 },
              goals: { for: 280, against: 210 },
              points: 34,
              form: 'WLWWW',
              description: null,
            },
          ],
        }), { status: 200, headers: { 'x-request-id': 'trace-api-1' } });
      }

      if (url.includes('/apis/v2/sports/rugby/270559/standings')) {
        return new Response(JSON.stringify({
          children: [
            {
              standings: {
                entries: [
                  {
                    team: { displayName: 'Toulouse' },
                    stats: [
                      { name: 'rank', value: 1 },
                      { name: 'bonusPoints', value: 5 },
                      { name: 'bonusPointsTry', value: 4 },
                      { name: 'bonusPointsLosing', value: 1 },
                      { name: 'triesFor', value: 33 },
                      { name: 'triesAgainst', value: 22 },
                      { name: 'triesDifference', value: 11 },
                      { name: 'overall', displayValue: 'WWWWW' },
                    ],
                  },
                  {
                    team: { displayName: 'La Rochelle' },
                    stats: [
                      { name: 'rank', value: 2 },
                      { name: 'bonusPoints', value: 3 },
                    ],
                  },
                ],
              },
            },
          ],
        }), { status: 200 });
      }

      return new Response('{}', { status: 404 });
    }));

    const provider = new ApiSportsProvider('test-key');
    const table = await provider.getStandings('16');

    expect(table).toHaveLength(2);
    expect(table[0].bonus_points).toBe(5);
    expect(table[0].bonus_points_try).toBe(4);
    expect(table[0].bonus_points_losing).toBe(1);
    expect(table[0].tries_for).toBe(33);
    expect(table[0].tries_against).toBe(22);
    expect(table[0].tries_diff).toBe(11);
  });

  it('falls back to API-Sports standings when ESPN is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/standings?league=16&season=2025')) {
        return new Response(JSON.stringify({
          get: 'standings',
          parameters: { league: '16', season: '2025' },
          errors: [],
          results: 1,
          response: [
            {
              position: 1,
              team: { id: 101, name: 'Toulouse', logo: '' },
              games: { played: 10, win: { total: 8 }, draw: 0, lose: 2 },
              goals: { for: 300, against: 200 },
              points: 37,
              form: 'WWWWW',
              description: 'Playoffs',
            },
          ],
        }), { status: 200, headers: { 'x-request-id': 'trace-api-2' } });
      }

      if (url.includes('/apis/v2/sports/rugby/270559/standings')) {
        return new Response('upstream error', { status: 503 });
      }

      return new Response('{}', { status: 404 });
    }));

    const provider = new ApiSportsProvider('test-key');
    const table = await provider.getStandings('16');

    expect(table).toHaveLength(1);
    expect(table[0].team.name).toBe('Toulouse');
    expect(table[0].bonus_points).toBeUndefined();
    expect(table[0].points).toBe(37);
  });

  it('parses standings draw/loss totals when provider uses numeric shape', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/standings?league=9999&season=2025')) {
        return new Response(JSON.stringify({
          get: 'standings',
          parameters: { league: '9999', season: '2025' },
          errors: [],
          results: 1,
          response: [
            {
              position: 1,
              team: { id: 101, name: 'Test RFC', logo: '' },
              games: { played: 10, win: 6, draw: 2, lose: 2 },
              goals: { for: 250, against: 200 },
              points: 30,
            },
          ],
        }), { status: 200, headers: { 'x-request-id': 'trace-api-2b' } });
      }

      return new Response('{}', { status: 404 });
    }));

    const provider = new ApiSportsProvider('test-key');
    const table = await provider.getStandings('9999');

    expect(table).toHaveLength(1);
    expect(table[0].won).toBe(6);
    expect(table[0].drawn).toBe(2);
    expect(table[0].lost).toBe(2);
  });

  it('emits standings JSON contract with --json', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rugbyclaw-standings-json-'));
    tempDirs.push(dir);
    setConfigPathOverride(dir);
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({
        schema_version: 1,
        timezone: 'UTC',
        favorite_leagues: ['top14'],
        favorite_teams: [],
      }, null, 2)
    );
    writeFileSync(
      join(dir, 'secrets.json'),
      JSON.stringify({ api_key: 'test', api_tier: 'premium' }, null, 2)
    );

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/standings?league=16&season=2025')) {
        return new Response(JSON.stringify({
          get: 'standings',
          parameters: {},
          errors: [],
          results: 1,
          response: [
            {
              position: 1,
              team: { id: 101, name: 'Toulouse', logo: '' },
              games: { played: 10, win: { total: 8 }, draw: 0, lose: 2 },
              goals: { for: 300, against: 200 },
              points: 37,
              form: 'WWWWW',
              description: 'Playoffs',
            },
          ],
        }), { status: 200, headers: { 'x-request-id': 'trace-api-3' } });
      }
      if (url.includes('/apis/v2/sports/rugby/270559/standings')) {
        return new Response(JSON.stringify({
          children: [{ standings: { entries: [] } }],
        }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    }));

    const { logs } = await withCapturedLogs(async () =>
      standingsCommand('top14', { json: true })
    );

    expect(logs).toHaveLength(1);
    const payload = JSON.parse(logs[0]) as Record<string, unknown>;
    expect(payload).toHaveProperty('generated_at');
    expect(payload).toHaveProperty('league', 'Top 14');
    expect(payload).toHaveProperty('standings');
    expect(payload).toHaveProperty('trace_id');
    const standings = payload.standings as Array<Record<string, unknown>>;
    expect(standings).toHaveLength(1);
    expect(Object.keys(standings[0]).sort()).toEqual([
      'description',
      'drawn',
      'form',
      'lost',
      'played',
      'points',
      'points_against',
      'points_diff',
      'points_for',
      'position',
      'team',
      'won',
    ].sort());
  });

  it('emits strict agent envelope with empty standings', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rugbyclaw-standings-agent-empty-'));
    tempDirs.push(dir);
    setConfigPathOverride(dir);
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({
        schema_version: 1,
        timezone: 'UTC',
        favorite_leagues: ['top14'],
        favorite_teams: [],
      }, null, 2)
    );
    writeFileSync(
      join(dir, 'secrets.json'),
      JSON.stringify({ api_key: 'test', api_tier: 'premium' }, null, 2)
    );

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/standings?league=16&season=2025')) {
        return new Response(JSON.stringify({
          get: 'standings',
          parameters: {},
          errors: [],
          results: 0,
          response: [],
        }), { status: 200, headers: { 'x-request-id': 'trace-api-4' } });
      }
      if (url.includes('/apis/v2/sports/rugby/270559/standings')) {
        return new Response(JSON.stringify({
          children: [{ standings: { entries: [] } }],
        }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    }));

    const { logs } = await withCapturedLogs(async () =>
      standingsCommand('top14', { agent: true })
    );

    expect(logs).toHaveLength(1);
    const payload = JSON.parse(logs[0]) as { ok: boolean; schema_version: number; data: { standings: unknown[] } };
    expect(payload.ok).toBe(true);
    expect(payload.schema_version).toBe(1);
    expect(payload.data.standings).toEqual([]);
  });
});
