import { loadConfig, loadSecrets, isConfigured } from '../lib/config.js';
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
  // Check configuration
  if (!(await isConfigured())) {
    console.log(renderError('Not configured. Run "rugbyclaw config" first.'));
    process.exit(1);
  }

  const config = await loadConfig();
  const secrets = await loadSecrets();

  if (!secrets) {
    console.log(renderError('API key not found. Run "rugbyclaw config" first.'));
    process.exit(1);
  }

  const provider = new ApiSportsProvider(secrets.api_key);
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

      leagueName = league.name;
      matches = await provider.getLeagueResults(league.id);
    } else {
      // All favorite leagues
      const leagueIds = config.favorite_leagues
        .map((slug) => LEAGUES[slug]?.id)
        .filter(Boolean) as string[];

      if (leagueIds.length === 0) {
        console.log(renderWarning('No favorite leagues configured.'));
        process.exit(0);
      }

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
      const output = matchToOutput(m);
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
