import { loadConfig, loadSecrets, getEffectiveLeagues, DEFAULT_PROXY_LEAGUES } from '../lib/config.js';
import { LEAGUES } from '../lib/leagues.js';
import { ApiSportsProvider } from '../lib/providers/apisports.js';
import { renderScores, matchToOutput, renderError } from '../render/terminal.js';
import type { ScoresOutput } from '../types/index.js';
import { getTodayYMD } from '../lib/datetime.js';

interface ScoresOptions {
  json?: boolean;
  quiet?: boolean;
}

export async function scoresCommand(options: ScoresOptions): Promise<void> {
  const config = await loadConfig();
  // Get API key if available (otherwise use proxy mode)
  const secrets = await loadSecrets();
  const provider = new ApiSportsProvider(secrets?.api_key);

  // Get effective leagues (user's favorites or defaults)
  const favoriteLeagues = secrets?.api_key ? await getEffectiveLeagues() : DEFAULT_PROXY_LEAGUES;
  const leagueIds = favoriteLeagues
    .map((slug) => LEAGUES[slug]?.id)
    .filter(Boolean) as string[];

  try {
    const dateYmd = getTodayYMD(config.timezone);
    const matches = await provider.getToday(leagueIds, { dateYmd });

    const output: ScoresOutput = {
      matches: matches.map((m) => matchToOutput(m, { timeZone: config.timezone })),
      generated_at: new Date().toISOString(),
    };

    if (options.json) {
      console.log(JSON.stringify(output, null, 2));
    } else if (!options.quiet) {
      console.log(renderScores(output));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(renderError(message));
    process.exit(1);
  }
}
