import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getConfigPaths, setConfigPathOverride } from '../src/lib/config.js';

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

describe('structured empty output contracts', () => {
  it('team search emits strict JSON envelope with empty teams', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rugbyclaw-team-agent-empty-'));
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

    vi.stubGlobal('fetch', vi.fn(async () => (
      new Response(JSON.stringify({
        get: 'teams',
        parameters: {},
        errors: [],
        results: 1,
        response: [
          {
            id: 1,
            name: 'Leinster Rugby',
            logo: '',
            national: false,
            founded: 1879,
            arena: { name: null, capacity: null, location: null },
            country: { id: 1, name: 'Ireland', code: 'IE', flag: '' },
          },
        ],
      }), { status: 200, headers: { 'x-request-id': 'trace-1' } })
    )));

    const { teamCommand } = await import('../src/commands/team.js');
    const { logs } = await withCapturedLogs(async () =>
      teamCommand('zzzzzz-team', 'search', { agent: true })
    );

    expect(logs).toHaveLength(1);
    const payload = JSON.parse(logs[0]) as Record<string, unknown>;
    expect(payload.ok).toBe(true);
    expect(payload.schema_version).toBe(1);
    expect((payload.data as { query: string }).query).toBe('zzzzzz-team');
    expect((payload.data as { teams: unknown[] }).teams).toEqual([]);
  });

  it('fixtures --ics with no matches emits strict success envelope', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rugbyclaw-fixtures-agent-empty-'));
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

    vi.stubGlobal('fetch', vi.fn(async () => (
      new Response(JSON.stringify({
        get: 'games',
        parameters: {},
        errors: [],
        results: 0,
        response: [],
      }), { status: 200, headers: { 'x-request-id': 'trace-2' } })
    )));

    const { fixturesCommand } = await import('../src/commands/fixtures.js');
    const { logs } = await withCapturedLogs(async () =>
      fixturesCommand('top14', { agent: true, ics: true, limit: '0' })
    );

    expect(logs).toHaveLength(1);
    const payload = JSON.parse(logs[0]) as Record<string, unknown>;
    expect(payload.ok).toBe(true);
    expect(payload.schema_version).toBe(1);
    const data = payload.data as Record<string, unknown>;
    expect(data.exported).toBe(0);
    expect(data.reason).toBe('no_fixtures');
  });
});
