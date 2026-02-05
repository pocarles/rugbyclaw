import chalk from 'chalk';
import { loadConfig, loadSecrets, DEFAULT_PROXY_LEAGUES, getConfigDir, getEffectiveTimeZone } from '../lib/config.js';
import { LEAGUES } from '../lib/leagues.js';
import type { Config } from '../types/index.js';

interface StatusOptions {
  json?: boolean;
  quiet?: boolean;
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
    notes: mode === 'proxy'
      ? ['Free mode: limited requests, default leagues only.']
      : [],
  };

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  if (options.quiet) return;

  const lines: string[] = [];
  lines.push(chalk.bold('Rugbyclaw Status'));
  lines.push('');
  lines.push(`${chalk.dim('Mode:')} ${mode === 'proxy' ? chalk.yellow('Free (no API key)') : chalk.green('API key')}`);
  lines.push(`${chalk.dim('Timezone:')} ${timeZone}`);
  if (config.timezone && config.timezone !== timeZone) {
    lines.push(chalk.dim(`Stored timezone: ${config.timezone}`));
  }
  lines.push(`${chalk.dim('Leagues:')} ${leagueNames.join(', ')}`);
  if (config.favorite_teams.length > 0) {
    lines.push(`${chalk.dim('Favorite teams:')} ${config.favorite_teams.length}`);
  }
  lines.push('');
  lines.push(chalk.dim('Tip: run "rugbyclaw config" to change leagues/teams/timezone.'));
  lines.push(chalk.dim('Tip: use "rugbyclaw scores --json" for OpenClaw integration.'));

  console.log(lines.join('\n'));
}
