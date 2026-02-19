import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const cliPath = join(repoRoot, 'dist', 'cli.js');

interface CliRun {
  status: number;
  stdout: string;
  stderr: string;
}

function runCli(args: string[]): CliRun {
  const configDir = mkdtempSync(join(tmpdir(), 'rugbyclaw-cli-test-'));

  try {
    const result = spawnSync(
      process.execPath,
      [cliPath, '--config', configDir, '--no-color', ...args],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        env: { ...process.env, FORCE_COLOR: '0' },
      }
    );

    return {
      status: result.status ?? -1,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
    };
  } finally {
    rmSync(configDir, { recursive: true, force: true });
  }
}

beforeAll(() => {
  if (!existsSync(cliPath)) {
    execFileSync('npm', ['run', 'build'], { cwd: repoRoot, stdio: 'ignore' });
  }
});

describe('CLI JSON contract', () => {
  it('fixtures unknown league returns JSON error only', () => {
    const result = runCli(['fixtures', 'not-a-real-league', '--json']);

    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');

    const body = JSON.parse(result.stdout) as {
      error: string;
      available_leagues: string[];
    };

    expect(body.error).toContain('Unknown league');
    expect(Array.isArray(body.available_leagues)).toBe(true);
    expect(result.stdout.startsWith('{')).toBe(true);
  });

  it('fixtures invalid --limit returns JSON error only', () => {
    const result = runCli(['fixtures', '--json', '--limit', '0']);

    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');

    const body = JSON.parse(result.stdout) as { error: string };
    expect(body.error).toContain('Invalid --limit');
  });

  it('calendar rejects --json with --stdout as JSON error', () => {
    const result = runCli(['calendar', '123', '--json', '--stdout']);

    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');

    const body = JSON.parse(result.stdout) as { error: string };
    expect(body.error).toContain('Cannot use --json with --stdout');
  });

  it('calendar refuses to overwrite existing --out target without --force', () => {
    const outPath = join(tmpdir(), `rugbyclaw-calendar-test-${Date.now()}.ics`);
    writeFileSync(outPath, 'existing file');

    try {
      const result = runCli(['calendar', '123', '--json', '--out', outPath]);

      expect(result.status).toBe(1);
      expect(result.stderr).toBe('');

      const body = JSON.parse(result.stdout) as { error: string };
      expect(body.error).toContain('Refusing to overwrite existing file');
      expect(body.error).toContain('--force');
    } finally {
      rmSync(outPath, { force: true });
    }
  });

  it('notify conflicting modes returns JSON error only', () => {
    const result = runCli(['notify', '--json', '--weekly', '--daily']);

    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');

    const body = JSON.parse(result.stdout) as { error: string };
    expect(body.error).toContain('Pick one');
  });
});
