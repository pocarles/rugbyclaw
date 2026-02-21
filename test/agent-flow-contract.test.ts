import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
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
  delete process.env.RUGBYCLAW_PROXY_URL;
  process.exitCode = 0;
  vi.restoreAllMocks();
});

describe('agent flow json contracts', () => {
  it('config --yes --json emits pure json payload', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rugbyclaw-agent-config-'));
    tempDirs.push(dir);
    setConfigPathOverride(dir);

    const { configCommand } = await import('../src/commands/config.js');
    const { logs } = await withCapturedLogs(async () =>
      configCommand({
        yes: true,
        json: true,
        quiet: true,
        mode: 'proxy',
        timezone: 'UTC',
      })
    );

    expect(logs).toHaveLength(1);
    const payload = JSON.parse(logs[0]) as Record<string, unknown>;

    expect(Object.keys(payload).sort()).toEqual([
      'api_key_saved',
      'config',
      'mode',
      'setup_style',
    ]);
    expect(payload.mode).toBe('proxy');
    expect(payload.setup_style).toBe('quick');
  });

  it('config --mode proxy clears existing saved API key', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rugbyclaw-agent-config-proxy-'));
    tempDirs.push(dir);
    setConfigPathOverride(dir);

    writeFileSync(
      join(dir, 'secrets.json'),
      JSON.stringify({ api_key: 'old-key', api_tier: 'premium' }, null, 2)
    );

    const { configCommand } = await import('../src/commands/config.js');
    await withCapturedLogs(async () => configCommand({
      yes: true,
      json: true,
      quiet: true,
      mode: 'proxy',
      timezone: 'UTC',
    }));

    expect(existsSync(join(dir, 'secrets.json'))).toBe(false);
  });

  it('doctor --json returns stable envelope and strict sets non-zero exit code', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rugbyclaw-agent-doctor-'));
    tempDirs.push(dir);
    setConfigPathOverride(dir);

    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('fetch failed');
    }));

    const { doctorCommand } = await import('../src/commands/doctor.js');

    const normal = await withCapturedLogs(async () => {
      await doctorCommand({ json: true });
    });
    expect(normal.logs).toHaveLength(1);
    const normalPayload = JSON.parse(normal.logs[0]) as Record<string, unknown>;
    expect(Object.keys(normalPayload).sort()).toEqual([
      'checks',
      'config_dir',
      'generated_at',
      'kickoff_overrides',
      'mode',
      'node',
      'ok',
      'proxy_url',
      'proxy_url_override',
      'scores_probe',
      'strict',
      'timezone',
      'timezone_valid',
      'trace_id',
      'version',
    ]);
    expect(normalPayload.strict).toBe(false);
    expect(process.exitCode ?? 0).toBe(0);

    process.exitCode = 0;
    const strict = await withCapturedLogs(async () => {
      await doctorCommand({ json: true, strict: true });
    });
    expect(strict.logs).toHaveLength(1);
    const strictPayload = JSON.parse(strict.logs[0]) as Record<string, unknown>;
    expect(strictPayload.strict).toBe(true);
    expect((process.exitCode ?? 0) > 0).toBe(true);
  });
});
