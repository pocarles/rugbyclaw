import chalk from 'chalk';
import {
  DEFAULT_PROXY_LEAGUES,
  getEffectiveLeagues,
  getEffectiveTimeZone,
  loadConfig,
  loadSecrets,
} from './config.js';
import { getTodayYMD } from './datetime.js';
import { LEAGUES } from './leagues.js';
import { ApiSportsProvider, fetchProxyStatus } from './providers/apisports.js';

function checkLine(ok: boolean, label: string, detail?: string): string {
  const icon = ok ? chalk.green('✓') : chalk.red('✗');
  if (!detail) return `${icon} ${label}`;
  return `${icon} ${label} ${chalk.dim(detail)}`;
}

export async function runStartPostSetupCheck(): Promise<void> {
  try {
    const config = await loadConfig();
    const secrets = await loadSecrets();
    const hasApiKey = Boolean(secrets?.api_key);
    const mode: 'direct' | 'proxy' = hasApiKey ? 'direct' : 'proxy';
    const provider = new ApiSportsProvider(secrets?.api_key);
    const timeZone = getEffectiveTimeZone(config);
    const dateYmd = getTodayYMD(timeZone);
    const effectiveLeagues = hasApiKey ? await getEffectiveLeagues() : DEFAULT_PROXY_LEAGUES;
    const firstLeague = effectiveLeagues
      .map((slug) => ({ slug, id: LEAGUES[slug]?.id, name: LEAGUES[slug]?.name }))
      .find((league) => Boolean(league.id && league.name));

    const lines: string[] = [];
    lines.push(chalk.bold.cyan('Mini check'));
    lines.push(chalk.dim('Quick sanity check after setup.'));

    let ok = true;

    if (mode === 'proxy') {
      const status = await fetchProxyStatus();
      if (!status) {
        ok = false;
        lines.push(checkLine(false, 'Proxy status check', '(unreachable right now)'));
      } else {
        lines.push(checkLine(true, 'Proxy status check', `(mode: ${status.mode || 'proxy'})`));
      }
    } else {
      lines.push(checkLine(true, 'API key mode enabled'));
    }

    if (!firstLeague?.id || !firstLeague?.name) {
      ok = false;
      lines.push(checkLine(false, 'League probe', '(no effective leagues configured)'));
    } else {
      try {
        const matches = await provider.getToday([firstLeague.id], { dateYmd });
        const runtime = provider.consumeRuntimeMeta();
        const staleSuffix = runtime.staleFallback ? ' (cached fallback)' : '';
        lines.push(
          checkLine(
            true,
            `Data probe (${firstLeague.name})`,
            `date ${dateYmd}, ${matches.length} match(es)${staleSuffix}`
          )
        );
      } catch (error) {
        ok = false;
        const message = error instanceof Error ? error.message : 'Unknown error';
        lines.push(checkLine(false, `Data probe (${firstLeague.name})`, `(${message})`));
      }
    }

    if (ok) {
      lines.push(chalk.green('Setup looks healthy. You are good to go.'));
    } else {
      lines.push(chalk.yellow('Setup saved, but checks found issues.'));
      lines.push(chalk.dim('Run "rugbyclaw doctor --strict" for full diagnostics.'));
    }

    console.log('');
    console.log(lines.join('\n'));
    console.log('');
  } catch {
    // Never block setup success on post-check.
  }
}
