import { rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const distPath = join(here, '..', 'dist');

// Keep builds deterministic. Also avoids rare hangs when tsc tries to overwrite old emit output.
rmSync(distPath, { recursive: true, force: true });

