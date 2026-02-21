import { writeFile } from 'node:fs/promises';
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
import { getFixturesNoMatchesExplanation, getFixturesNoMatchesHint } from '../lib/explain.js';
import { renderFixtures, matchToOutput, renderError, renderWarning, renderSuccess } from '../render/terminal.js';
import { matchesToICS } from '../lib/ics.js';
import type { FixturesOutput, Match } from '../types/index.js';
import { emitCommandError } from '../lib/command-error.js';
import { EXIT_CODES } from '../lib/exit-codes.js';
import { emitCommandSuccess, wantsStructuredOutput } from '../lib/output.js';
import { printFollowups, quoteArg } from '../lib/followups.js';

interface FixturesOptions {
  json?: boolean;
  agent?: boolean;
  quiet?: boolean;
  followups?: boolean;
  limit?: string;
  ics?: boolean;
  showIds?: boolean;
  explain?: boolean;
}

export async function fixturesCommand(
  leagueInput: string | undefined,
  options: FixturesOptions
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
  let selectedLeagues: Array<{ slug: string; id: string; name: string }> = [];

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
      selectedLeagues = [{ slug: league.slug, id: league.id, name: league.name }];
      matches = await provider.getLeagueFixtures(league.id);
    } else {
      // Get effective leagues (user's favorites or defaults)
      const favoriteLeagues = hasApiKey ? await getEffectiveLeagues() : DEFAULT_PROXY_LEAGUES;
      selectedLeagues = favoriteLeagues
        .map((slug) => ({ slug, id: LEAGUES[slug]?.id, name: LEAGUES[slug]?.name }))
        .filter((league): league is { slug: string; id: string; name: string } => Boolean(league.id && league.name));
      const leagueIds = favoriteLeagues
        .map((slug) => LEAGUES[slug]?.id)
        .filter(Boolean) as string[];

      for (const id of leagueIds) {
        const leagueMatches = await provider.getLeagueFixtures(id);
        matches.push(...leagueMatches);
      }

      // Sort by date
      matches.sort((a, b) => a.timestamp - b.timestamp);
    }

    // Apply limit
    matches = matches.slice(0, limit);

    // Export to ICS file
    if (options.ics) {
      if (matches.length === 0) {
        const runtime = provider.consumeRuntimeMeta();
        if (wantsStructuredOutput(options)) {
          emitCommandSuccess(
            {
              league: leagueName,
              exported: 0,
              out: null,
              reason: 'no_fixtures',
              trace_id: runtime.traceId || undefined,
              stale: runtime.staleFallback || undefined,
              cached_at: runtime.cachedAt || undefined,
            },
            options,
            { traceId: runtime.traceId }
          );
        } else if (!options.quiet) {
          console.log(renderWarning('No fixtures to export.'));
          if (runtime.staleFallback) {
            console.log(getStaleFallbackLine(runtime.cachedAt));
          }
        }
        return;
      }
      const ics = matchesToICS(matches);
      const filename = leagueName
        ? `${leagueName.toLowerCase().replace(/\s+/g, '-')}-fixtures.ics`
        : 'rugby-fixtures.ics';
      await writeFile(filename, ics);
      if (!options.quiet) {
        console.log(renderSuccess(`Exported ${matches.length} fixtures to ${filename}`));
      }
      return;
    }

    const wantProxyStatus = !hasApiKey && (wantsStructuredOutput(options) || !options.quiet);
    const proxyStatus = await getProxyStatusIfFree(hasApiKey, wantProxyStatus);
    const runtime = provider.consumeRuntimeMeta();

    const output: FixturesOutput = {
      league: leagueName,
      matches: matches.map((m) => matchToOutput(m, { timeZone })),
      generated_at: new Date().toISOString(),
      rate_limit: getProxyRateLimit(proxyStatus),
      trace_id: runtime.traceId || undefined,
      stale: runtime.staleFallback || undefined,
      cached_at: runtime.cachedAt || undefined,
    };

    if (wantsStructuredOutput(options)) {
      emitCommandSuccess(output, options, { traceId: runtime.traceId });
    } else if (!options.quiet) {
      console.log(renderFixtures(output, options.showIds, timeZone));
      if (runtime.staleFallback) {
        console.log(getStaleFallbackLine(runtime.cachedAt));
      }
      const explainInput = {
        mode: hasApiKey ? 'direct' as const : 'proxy' as const,
        timeZone,
        leagues: selectedLeagues,
        matchCount: output.matches.length,
        limit,
      };
      const noMatchHints = getFixturesNoMatchesHint(explainInput);
      if (noMatchHints.length > 0) {
        console.log('');
        for (const line of noMatchHints) console.log(line);
      }
      if (options.explain) {
        const explanation = getFixturesNoMatchesExplanation(explainInput);
        if (explanation.length > 0) {
          console.log('');
          for (const line of explanation) console.log(line);
        }
      }
      const quotaLine = getProxyQuotaLine(proxyStatus, hasApiKey, {
        staleFallback: runtime.staleFallback,
        requestUnits: Math.max(1, selectedLeagues.length),
        timeZone,
      });
      if (quotaLine) console.log(quotaLine);

      const hints: string[] = [];
      if (output.matches.length > 0) {
        const first = output.matches[0];
        const fixturesCommand = leagueInput ? `rugbyclaw fixtures ${leagueInput}` : 'rugbyclaw fixtures';
        if (options.showIds && first.id) {
          hints.push(`Export this match to calendar: rugbyclaw calendar ${first.id} --out ~/Desktop/rugby-match.ics`);
        } else {
          hints.push(`Show IDs for calendar export: ${fixturesCommand} --show-ids`);
        }
        if (first.home?.name) {
          hints.push(`Track one team next match: rugbyclaw team ${quoteArg(first.home.name)} next`);
        }
        hints.push(leagueInput ? `See recent results too: rugbyclaw results ${leagueInput}` : 'See recent results too: rugbyclaw results');
      } else {
        hints.push('Ask for context on empty output: rugbyclaw fixtures --explain');
        hints.push('Run health checks: rugbyclaw doctor');
      }
      printFollowups(options, hints);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const runtime = provider.consumeRuntimeMeta();
    emitCommandError(message, options, undefined, { traceId: runtime.traceId });
  }
}
