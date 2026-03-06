import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getConfigPaths,
  loadConfig,
  loadSecrets,
  loadState,
  setConfigPathOverride,
} from '../src/lib/config.js';

const originalPaths = getConfigPaths();
const tempDirs: string[] = [];

afterEach(() => {
  setConfigPathOverride(originalPaths.configDir);
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('config loaders', () => {
  it('returns defaults/null when files are missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rugbyclaw-config-missing-'));
    tempDirs.push(dir);
    setConfigPathOverride(dir);

    const config = await loadConfig();
    const secrets = await loadSecrets();
    const state = await loadState();

    expect(config.favorite_leagues).toEqual([]);
    expect(secrets).toBeNull();
    expect(state.matches).toEqual({});
  });

  it('throws on corrupted config/secrets/state files', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rugbyclaw-config-corrupt-'));
    tempDirs.push(dir);
    setConfigPathOverride(dir);

    writeFileSync(join(dir, 'config.json'), '{broken');
    writeFileSync(join(dir, 'secrets.json'), '{broken');
    writeFileSync(join(dir, 'state.json'), '{broken');

    await expect(loadConfig()).rejects.toThrow();
    await expect(loadSecrets()).rejects.toThrow();
    await expect(loadState()).rejects.toThrow();
  });
});
