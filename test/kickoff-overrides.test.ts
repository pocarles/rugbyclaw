import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { getConfigPaths, setConfigPathOverride } from '../src/lib/config.js';
import { loadKickoffOverrides } from '../src/lib/kickoff-overrides.js';

const originalPaths = getConfigPaths();
const tempDirs: string[] = [];

afterEach(() => {
  setConfigPathOverride(originalPaths.configDir);
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('kickoff overrides', () => {
  it('loads user overrides from config directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rugbyclaw-kickoff-overrides-'));
    tempDirs.push(dir);
    setConfigPathOverride(dir);

    writeFileSync(
      join(dir, 'kickoff-overrides.json'),
      JSON.stringify({
        '12345': {
          kickoff: '2026-02-15T20:05:00+01:00',
          source: 'manual-rugbyrama',
        },
      }),
      'utf-8'
    );

    const overrides = loadKickoffOverrides();
    const override = overrides.get('12345');

    expect(override).toBeDefined();
    expect(override?.source).toBe('manual-rugbyrama');
    expect(override?.kickoffMs).toBe(Date.parse('2026-02-15T20:05:00+01:00'));
  });
});
