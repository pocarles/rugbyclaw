import {
  loadConfig,
  loadSecrets,
  getEffectiveLeagues,
  DEFAULT_PROXY_LEAGUES,
  getEffectiveTimeZone,
} from '../lib/config.js';
import { LEAGUES } from '../lib/leagues.js';
import { ApiSportsProvider } from '../lib/providers/apisports.js';
import { getProxyQuotaLine, getProxyRateLimit, getProxyStatusIfFree } from '../lib/free-mode.js';
import { renderScores, matchToOutput } from '../render/terminal.js';
import { exitWithError } from '../lib/cli-output.js';
import type { ScoresOutput } from '../types/index.js';
import { getTodayYMD } from '../lib/datetime.js';

interface ScoresOptions {
  json?: boolean;
  quiet?: boolean;
}

export async function scoresCommand(options: ScoresOptions): Promise<void> {
  const config = await loadConfig();
  const timeZone = getEffectiveTimeZone(config);
  // Get API key if available (otherwise use proxy mode)
  const secrets = await loadSecrets();
  const hasApiKey = Boolean(secrets?.api_key);
  const provider = new ApiSportsProvider(secrets?.api_key);

  // Get effective leagues (user's favorites or defaults)
  const favoriteLeagues = secrets?.api_key ? await getEffectiveLeagues() : DEFAULT_PROXY_LEAGUES;
  const leagueIds = favoriteLeagues
    .map((slug) => LEAGUES[slug]?.id)
    .filter(Boolean) as string[];

  try {
    const dateYmd = getTodayYMD(timeZone);
    const matches = await provider.getToday(leagueIds, { dateYmd });

    const wantProxyStatus = !hasApiKey && (options.json || !options.quiet);
    const proxyStatus = await getProxyStatusIfFree(hasApiKey, wantProxyStatus);

    const output: ScoresOutput = {
      matches: matches.map((m) => matchToOutput(m, { timeZone })),
      generated_at: new Date().toISOString(),
      rate_limit: getProxyRateLimit(proxyStatus),
    };

    if (options.json) {
      console.log(JSON.stringify(output, null, 2));
    } else if (!options.quiet) {
      console.log(renderScores(output));
      const quotaLine = getProxyQuotaLine(proxyStatus);
      if (quotaLine) console.log(quotaLine);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    exitWithError(message, options);
  }
}
