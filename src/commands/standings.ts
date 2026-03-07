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
import { renderStandings, renderError, renderWarning } from '../render/terminal.js';
import type { StandingsEntry, StandingsOutput } from '../types/index.js';
import { emitCommandError } from '../lib/command-error.js';
import { EXIT_CODES } from '../lib/exit-codes.js';
import { emitCommandSuccess, wantsStructuredOutput } from '../lib/output.js';
import { printFollowups } from '../lib/followups.js';
import { validateStandings } from '../lib/validators.js';

interface StandingsOptions {
  json?: boolean;
  agent?: boolean;
  quiet?: boolean;
  followups?: boolean;
}

const STANDINGS_TEAM_RANGES: Record<string, [number, number]> = {
  top14: [14, 14],
  pro_d2: [16, 16],
  premiership: [10, 10],
  urc: [16, 16],
  six_nations: [6, 6],
  champions_cup: [4, 40],
  challenge_cup: [4, 40],
  super_rugby: [10, 20],
};

function warnIfStandingsInvalid(
  entries: StandingsEntry[],
  leagueSlug: string,
  options: StandingsOptions
): void {
  const validation = validateStandings(entries, STANDINGS_TEAM_RANGES[leagueSlug]);
  if (validation.valid || wantsStructuredOutput(options) || options.quiet) return;
  const summary = validation.errors.slice(0, 3).join('; ');
  console.warn(renderWarning(`Standings validation warning for ${leagueSlug}: ${summary}`));
}

export async function standingsCommand(
  leagueInput: string | undefined,
  options: StandingsOptions
): Promise<void> {
  const config = await loadConfig();
  const timeZone = getEffectiveTimeZone(config);
  const secrets = await loadSecrets();
  const hasApiKey = Boolean(secrets?.api_key);
  const provider = new ApiSportsProvider(secrets?.api_key);

  let standings: StandingsEntry[] = [];
  let leagueName: string | undefined;
  let requestUnits = 1;
  let selectedLeagues: Array<{ slug: string; id: string; name: string }> = [];

  try {
    if (leagueInput) {
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
      standings = await provider.getStandings(league.id) ?? [];
      warnIfStandingsInvalid(standings, league.slug, options);
    } else {
      const favoriteLeagues = hasApiKey ? await getEffectiveLeagues() : DEFAULT_PROXY_LEAGUES;
      selectedLeagues = favoriteLeagues
        .map((slug) => ({ slug, id: LEAGUES[slug]?.id, name: LEAGUES[slug]?.name }))
        .filter((league): league is { slug: string; id: string; name: string } => Boolean(league.id && league.name));
      requestUnits = Math.max(1, selectedLeagues.length);

      for (const league of selectedLeagues) {
        const leagueStandings = await provider.getStandings(league.id) ?? [];
        warnIfStandingsInvalid(leagueStandings, league.slug, options);
        standings.push(
          ...leagueStandings.map((entry) => ({ ...entry, league: league.name }))
        );
      }
    }

    const wantProxyStatus = !hasApiKey && (wantsStructuredOutput(options) || !options.quiet);
    const proxyStatus = await getProxyStatusIfFree(hasApiKey, wantProxyStatus);
    const runtime = provider.consumeRuntimeMeta();

    const output: StandingsOutput = {
      league: leagueName,
      standings,
      generated_at: new Date().toISOString(),
      rate_limit: getProxyRateLimit(proxyStatus),
      trace_id: runtime.traceId || undefined,
      stale: runtime.staleFallback || undefined,
      cached_at: runtime.cachedAt || undefined,
    };

    if (wantsStructuredOutput(options)) {
      emitCommandSuccess(output, options, { traceId: runtime.traceId });
      return;
    }

    if (!options.quiet) {
      console.log(renderStandings(output, timeZone));
      if (runtime.staleFallback) {
        console.log(getStaleFallbackLine(runtime.cachedAt));
      }
      const quotaLine = getProxyQuotaLine(proxyStatus, hasApiKey, {
        staleFallback: runtime.staleFallback,
        requestUnits,
        timeZone,
      });
      if (quotaLine) console.log(quotaLine);

      const hints: string[] = [];
      if (leagueInput && selectedLeagues.length === 1) {
        const slug = selectedLeagues[0].slug;
        hints.push(`See upcoming games: rugbyclaw fixtures ${slug}`);
        hints.push(`See recent results: rugbyclaw results ${slug}`);
      } else {
        hints.push('See upcoming games: rugbyclaw fixtures');
        hints.push('See recent results: rugbyclaw results');
      }
      printFollowups(options, hints);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const runtime = provider.consumeRuntimeMeta();
    emitCommandError(message, options, undefined, { traceId: runtime.traceId });
  }
}
