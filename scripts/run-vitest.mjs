import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const tmpDir = process.env.TMPDIR || resolve(repoRoot, '.cache', 'tmp');
mkdirSync(tmpDir, { recursive: true });

const env = {
  ...process.env,
  TMPDIR: tmpDir,
  TMP: tmpDir,
  TEMP: tmpDir,
};

const vitestEntrypoint = resolve(repoRoot, 'node_modules', 'vitest', 'vitest.mjs');
const args = [vitestEntrypoint, 'run', ...process.argv.slice(2)];

const result = spawnSync(process.execPath, args, {
  stdio: 'inherit',
  env,
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
