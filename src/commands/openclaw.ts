import chalk from 'chalk';
import { createRequire } from 'node:module';
import {
  loadConfig,
  loadSecrets,
  getEffectiveTimeZone,
  DEFAULT_PROXY_LEAGUES,
  getEffectiveLeagues,
} from '../lib/config.js';
import { PROXY_URL } from '../lib/providers/apisports.js';
import { emitCommandSuccess, wantsStructuredOutput } from '../lib/output.js';
import { emitCommandError } from '../lib/command-error.js';

interface OpenClawInitOptions {
  json?: boolean;
  agent?: boolean;
  quiet?: boolean;
}

export async function openclawInitCommand(options: OpenClawInitOptions): Promise<void> {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require('../../package.json') as { version?: string };
    const version = pkg.version ?? '0.0.0';

    const config = await loadConfig();
    const secrets = await loadSecrets();
    const hasApiKey = Boolean(secrets?.api_key);
    const mode = hasApiKey ? 'direct' : 'proxy';
    const effectiveLeagues = hasApiKey ? await getEffectiveLeagues() : DEFAULT_PROXY_LEAGUES;
    const timezone = getEffectiveTimeZone(config);

    const payload = {
      tool: 'rugbyclaw',
      version,
      mode,
      timezone,
      effective_leagues: effectiveLeagues,
      proxy_url: PROXY_URL,
      install: {
        global: 'npm install -g rugbyclaw@latest',
        npx: 'npx -y rugbyclaw@latest --version',
      },
      bootstrap: [
        'rugbyclaw start --yes --mode proxy --agent',
        'rugbyclaw status --agent',
        'rugbyclaw doctor --agent --strict',
      ],
      health_checks: {
        proxy: 'curl -fsS "$RUGBYCLAW_PROXY_URL/health"',
        doctor: 'rugbyclaw doctor --agent --strict',
        status: 'rugbyclaw status --agent',
        scores: 'rugbyclaw scores --agent --explain',
      },
      command_map: {
        scores: 'rugbyclaw scores --agent',
        fixtures: 'rugbyclaw fixtures [league] --agent',
        results: 'rugbyclaw results [league] --agent',
        team_next: 'rugbyclaw team next <name> --agent',
        team_last: 'rugbyclaw team last <name> --agent',
        team_search: 'rugbyclaw team search <query> --agent',
        notify: 'rugbyclaw notify --live --agent',
      },
    };

    if (wantsStructuredOutput(options)) {
      emitCommandSuccess(payload, options);
      return;
    }

    if (options.quiet) return;

    const lines: string[] = [];
    lines.push(chalk.bold('OpenClaw Bootstrap'));
    lines.push('');
    lines.push(`${chalk.dim('Version:')} ${version}`);
    lines.push(`${chalk.dim('Mode:')} ${mode}`);
    lines.push(`${chalk.dim('Timezone:')} ${timezone}`);
    lines.push(`${chalk.dim('Leagues:')} ${effectiveLeagues.join(', ')}`);
    lines.push(`${chalk.dim('Proxy URL:')} ${PROXY_URL}`);
    lines.push('');
    lines.push(chalk.bold('Run in order'));
    for (const cmd of payload.bootstrap) {
      lines.push(`  ${chalk.cyan(cmd)}`);
    }
    lines.push('');
    lines.push(chalk.dim('For agent-safe output, always use --agent.'));

    console.log(lines.join('\n'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    emitCommandError(message, options);
  }
}
