import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scoresCommand } from '../commands/scores.js';
import { fixturesCommand } from '../commands/fixtures.js';
import { getConfigPaths, setConfigPathOverride } from '../lib/config.js';

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

afterEach(() => {
  setConfigPathOverride(originalPaths.configDir);
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

describe('smoke tests', () => {
  it('runs scores command end-to-end with structured output', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rugbyclaw-smoke-scores-'));
    tempDirs.push(dir);
    setConfigPathOverride(dir);
    writeFileSync(join(dir, 'config.json'), JSON.stringify({
      schema_version: 1,
      timezone: 'UTC',
      favorite_leagues: ['six_nations'],
      favorite_teams: [],
    }, null, 2));
    writeFileSync(join(dir, 'secrets.json'), JSON.stringify({
      api_key: 'test-key',
      api_tier: 'premium',
    }, null, 2));

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      get: 'games',
      parameters: {},
      errors: [],
      results: 1,
      response: [
        {
          id: 301,
          date: '2026-03-06T20:00:00+00:00',
          time: '20:00',
          timestamp: 1772827200,
          timezone: 'UTC',
          week: 'Round 4',
          status: { short: '1H', long: 'In Progress' },
          country: { id: 1, name: 'Europe', code: 'EU', flag: '' },
          league: { id: 51, name: 'Six Nations', type: 'league', logo: '', season: 2026 },
          teams: {
            home: { id: 10, name: 'France', logo: '' },
            away: { id: 20, name: 'Ireland', logo: '' },
          },
          scores: { home: null, away: null },
        },
      ],
    }), { status: 200, headers: { 'x-request-id': 'smoke-trace-1' } })));

    const { logs } = await withCapturedLogs(async () => {
      await scoresCommand({ json: true, quiet: true });
    });

    expect(logs).toHaveLength(1);
    const payload = JSON.parse(logs[0]) as Record<string, unknown>;
    expect(Array.isArray(payload.matches)).toBe(true);
    expect((payload.matches as Array<Record<string, unknown>>)[0].league).toBe('Six Nations');
  });

  it('surfaces command errors for invalid fixtures league input', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(fixturesCommand('not-a-league', { quiet: true })).rejects.toThrow('exit:1');
    expect(exitSpy).toHaveBeenCalledWith(1);

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
