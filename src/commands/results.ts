import {
  loadConfig,
  loadSecrets,
  getEffectiveLeagues,
  DEFAULT_PROXY_LEAGUES,
  getEffectiveTimeZone,
} from '../lib/config.js';
import { LEAGUES, resolveLeague } from '../lib/leagues.js';
import { ApiSportsProvider } from '../lib/providers/apisports.js';
import { renderResults, matchToOutput, renderError, renderWarning } from '../render/terminal.js';
import { generateNeutralSummary } from '../lib/personality.js';
import type { ResultsOutput, Match, MatchOutput } from '../types/index.js';

interface ResultsOptions {
  json?: boolean;
  quiet?: boolean;
  limit?: string;
}

export async function resultsCommand(
  leagueInput: string | undefined,
  options: ResultsOptions
): Promise<void> {
  const config = await loadConfig();
  const timeZone = getEffectiveTimeZone(config);
  // Get API key if available (otherwise use proxy mode)
  const secrets = await loadSecrets();
  const provider = new ApiSportsProvider(secrets?.api_key);
  const limit = parseInt(options.limit || '15', 10);

  let matches: Match[] = [];
  let leagueName: string | undefined;

  try {
    if (leagueInput) {
      // Specific league
      const league = resolveLeague(leagueInput);

      if (!league) {
        console.log(renderError(`Unknown league: "${leagueInput}"`));
        console.log('Available: ' + Object.keys(LEAGUES).join(', '));
        process.exit(1);
      }

      if (!secrets?.api_key && !DEFAULT_PROXY_LEAGUES.includes(league.slug)) {
        console.log(renderError(`"${league.name}" is not available in free mode.`));
        console.log(renderWarning('Run "rugbyclaw config" to add your own API key to unlock more leagues.'));
        process.exit(1);
      }

      leagueName = league.name;
      matches = await provider.getLeagueResults(league.id);
    } else {
      // Get effective leagues (user's favorites or defaults)
      const favoriteLeagues = secrets?.api_key ? await getEffectiveLeagues() : DEFAULT_PROXY_LEAGUES;
      const leagueIds = favoriteLeagues
        .map((slug) => LEAGUES[slug]?.id)
        .filter(Boolean) as string[];

      for (const id of leagueIds) {
        const leagueMatches = await provider.getLeagueResults(id);
        matches.push(...leagueMatches);
      }

      // Sort by date (most recent first)
      matches.sort((a, b) => b.timestamp - a.timestamp);
    }

    // Apply limit
    matches = matches.slice(0, limit);

    // Add personality summaries
    const matchOutputs: MatchOutput[] = matches.map((m) => {
      const output = matchToOutput(m, { timeZone });
      output.summary = generateNeutralSummary(m);
      return output;
    });

    const output: ResultsOutput = {
      league: leagueName,
      matches: matchOutputs,
      generated_at: new Date().toISOString(),
    };

    if (options.json) {
      console.log(JSON.stringify(output, null, 2));
    } else if (!options.quiet) {
      console.log(renderResults(output));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(renderError(message));
    process.exit(1);
  }
}
