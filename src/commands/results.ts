import {
  loadConfig,
  loadSecrets,
  getEffectiveLeagues,
  DEFAULT_PROXY_LEAGUES,
  getEffectiveTimeZone,
} from '../lib/config.js';
import { LEAGUES, resolveLeague } from '../lib/leagues.js';
import { ApiSportsProvider } from '../lib/providers/apisports.js';
import {
  getProxyQuotaLine,
  getProxyRateLimit,
  getProxyStatusIfFree,
  getStaleFallbackLine,
} from '../lib/free-mode.js';
import { renderResults, matchToOutput, renderError, renderWarning } from '../render/terminal.js';
import { generateNeutralSummary } from '../lib/personality.js';
import type { ResultsOutput, Match, MatchOutput } from '../types/index.js';
import { emitCommandError } from '../lib/command-error.js';
import { EXIT_CODES } from '../lib/exit-codes.js';
import { emitCommandSuccess, wantsStructuredOutput } from '../lib/output.js';
import { printFollowups, quoteArg } from '../lib/followups.js';

interface ResultsOptions {
  json?: boolean;
  agent?: boolean;
  quiet?: boolean;
  followups?: boolean;
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
  const hasApiKey = Boolean(secrets?.api_key);
  const provider = new ApiSportsProvider(secrets?.api_key);
  const limit = parseInt(options.limit || '15', 10);

  let matches: Match[] = [];
  let leagueName: string | undefined;

  try {
    if (leagueInput) {
      // Specific league
      const league = resolveLeague(leagueInput);

      if (!league) {
        if (!wantsStructuredOutput(options) && !options.quiet) {
          console.log(renderError(`Unknown league: "${leagueInput}"`));
          console.log('Available: ' + Object.keys(LEAGUES).join(', '));
        }
        emitCommandError(`Unknown league: "${leagueInput}"`, options, EXIT_CODES.INVALID_INPUT);
      }

      if (!hasApiKey && !DEFAULT_PROXY_LEAGUES.includes(league.slug)) {
        if (!wantsStructuredOutput(options) && !options.quiet) {
          console.log(renderError(`"${league.name}" is not available in free mode.`));
          console.log(renderWarning('Run "rugbyclaw config" to add your own API key to unlock more leagues.'));
        }
        emitCommandError(`"${league.name}" is not available in free mode.`, options, EXIT_CODES.INVALID_INPUT);
      }

      leagueName = league.name;
      matches = await provider.getLeagueResults(league.id);
    } else {
      // Get effective leagues (user's favorites or defaults)
      const favoriteLeagues = hasApiKey ? await getEffectiveLeagues() : DEFAULT_PROXY_LEAGUES;
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

    const wantProxyStatus = !hasApiKey && (wantsStructuredOutput(options) || !options.quiet);
    const proxyStatus = await getProxyStatusIfFree(hasApiKey, wantProxyStatus);
    const runtime = provider.consumeRuntimeMeta();

    const output: ResultsOutput = {
      league: leagueName,
      matches: matchOutputs,
      generated_at: new Date().toISOString(),
      rate_limit: getProxyRateLimit(proxyStatus),
      trace_id: runtime.traceId || undefined,
      stale: runtime.staleFallback || undefined,
      cached_at: runtime.cachedAt || undefined,
    };

    if (wantsStructuredOutput(options)) {
      emitCommandSuccess(output, options, { traceId: runtime.traceId });
    } else if (!options.quiet) {
      console.log(renderResults(output));
      if (runtime.staleFallback) {
        console.log(getStaleFallbackLine(runtime.cachedAt));
      }
      const quotaLine = getProxyQuotaLine(proxyStatus, hasApiKey);
      if (quotaLine) console.log(quotaLine);

      const hints: string[] = [];
      if (output.matches.length > 0) {
        const first = output.matches[0];
        hints.push(leagueInput ? `See upcoming games: rugbyclaw fixtures ${leagueInput}` : 'See upcoming games: rugbyclaw fixtures');
        if (first.home?.name) {
          hints.push(`Track this team: rugbyclaw team ${quoteArg(first.home.name)} next`);
        }
      } else {
        hints.push('Try a different league: rugbyclaw results top14');
        hints.push('Check upcoming matches instead: rugbyclaw fixtures');
      }
      printFollowups(options, hints);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const runtime = provider.consumeRuntimeMeta();
    emitCommandError(message, options, undefined, { traceId: runtime.traceId });
  }
}
