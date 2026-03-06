import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { notifyCommand } from '../src/commands/notify.js';
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

describe('notify command contract', () => {
  it('emits type=all when no mode flags are provided', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rugbyclaw-notify-default-'));
    tempDirs.push(dir);
    setConfigPathOverride(dir);

    writeFileSync(join(dir, 'config.json'), JSON.stringify({
      schema_version: 1,
      timezone: 'UTC',
      favorite_leagues: ['top14'],
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
      results: 0,
      response: [],
    }), { status: 200, headers: { 'x-request-id': 'notify-trace-1' } })));

    const { logs } = await withCapturedLogs(async () => {
      await notifyCommand({ json: true, quiet: true });
    });

    expect(logs).toHaveLength(1);
    const payload = JSON.parse(logs[0]) as Record<string, unknown>;
    expect(payload.type).toBe('all');
    expect(Array.isArray(payload.notifications)).toBe(true);
  });
});
