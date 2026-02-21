import chalk from 'chalk';
import { loadConfig, loadSecrets, DEFAULT_PROXY_LEAGUES, getConfigDir, getEffectiveTimeZone } from '../lib/config.js';
import { LEAGUES } from '../lib/leagues.js';
import { fetchProxyStatus } from '../lib/providers/apisports.js';
import type { Config } from '../types/index.js';
import { emitCommandSuccess, wantsStructuredOutput } from '../lib/output.js';
import { renderFollowups, shouldShowFollowups } from '../lib/followups.js';

interface StatusOptions {
  json?: boolean;
  agent?: boolean;
  quiet?: boolean;
  followups?: boolean;
}

function getEffectiveLeagueSlugs(config: Config, hasApiKey: boolean): string[] {
  if (!hasApiKey) return DEFAULT_PROXY_LEAGUES;
  if (config.favorite_leagues.length > 0) return config.favorite_leagues;
  return DEFAULT_PROXY_LEAGUES;
}

export async function statusCommand(options: StatusOptions): Promise<void> {
  const config = await loadConfig();
  const timeZone = getEffectiveTimeZone(config);
  const secrets = await loadSecrets();
  const hasApiKey = Boolean(secrets?.api_key);
  const mode = hasApiKey ? 'direct' : 'proxy';
  const proxyStatus = !hasApiKey ? await fetchProxyStatus() : null;

  const leagueSlugs = getEffectiveLeagueSlugs(config, hasApiKey);
  const leagueNames = leagueSlugs.map((slug) => LEAGUES[slug]?.name ?? slug);

  const output = {
    mode,
    has_api_key: hasApiKey,
    config_dir: getConfigDir(),
    timezone: timeZone,
    stored_timezone: config.timezone,
    favorite_leagues: config.favorite_leagues,
    effective_leagues: leagueSlugs,
    effective_leagues_names: leagueNames,
    favorite_teams_count: config.favorite_teams.length,
    proxy_status: mode === 'proxy' ? (proxyStatus?.status ?? 'unavailable') : undefined,
    trace_id: proxyStatus?.trace_id,
    rate_limit: proxyStatus?.rate_limit,
    notes: mode === 'proxy'
      ? ['Free mode: limited requests, default leagues only.']
      : [],
  };

  if (wantsStructuredOutput(options)) {
    emitCommandSuccess(output, options, { traceId: proxyStatus?.trace_id });
    return;
  }

  if (options.quiet) return;

  const lines: string[] = [];
  lines.push(chalk.bold('Rugbyclaw Status'));
  lines.push('');
  lines.push(`${chalk.dim('Mode:')} ${mode === 'proxy' ? chalk.yellow('Free (no API key)') : chalk.green('API key')}`);
  if (mode === 'proxy') {
    lines.push(`${chalk.dim('Proxy:')} ${proxyStatus ? chalk.green('online') : chalk.yellow('unavailable')}`);
  }
  lines.push(`${chalk.dim('Timezone:')} ${timeZone}`);
  if (config.timezone && config.timezone !== timeZone) {
    lines.push(chalk.dim(`Stored timezone: ${config.timezone}`));
  }
  lines.push(`${chalk.dim('Leagues:')} ${leagueNames.join(', ')}`);
  if (proxyStatus?.rate_limit?.day) {
    const day = proxyStatus.rate_limit.day;
    const minute = proxyStatus.rate_limit.minute;
    const minuteText = minute ? `, ${minute.remaining}/${minute.limit} per minute` : '';
    lines.push(`${chalk.dim('Quota:')} ${day.remaining}/${day.limit} daily${minuteText}`);
  }
  if (config.favorite_teams.length > 0) {
    lines.push(`${chalk.dim('Favorite teams:')} ${config.favorite_teams.length}`);
  }
  if (shouldShowFollowups(options)) {
    const followups = renderFollowups([
      'Change setup anytime: rugbyclaw config --guided',
      'Today in machine mode (OpenClaw): rugbyclaw scores --agent',
    ]);
    if (followups) {
      lines.push('');
      lines.push(followups);
    }
  }

  console.log(lines.join('\n'));
}
