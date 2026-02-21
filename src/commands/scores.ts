import {
  loadConfig,
  loadSecrets,
  getEffectiveLeagues,
  DEFAULT_PROXY_LEAGUES,
  getEffectiveTimeZone,
} from '../lib/config.js';
import { LEAGUES } from '../lib/leagues.js';
import { ApiSportsProvider } from '../lib/providers/apisports.js';
import {
  getProxyQuotaLine,
  getProxyRateLimit,
  getProxyStatusIfFree,
  getStaleFallbackLine,
} from '../lib/free-mode.js';
import { getScoresNoMatchesExplanation, getScoresNoMatchesHint } from '../lib/explain.js';
import { renderScores, matchToOutput } from '../render/terminal.js';
import type { ScoresOutput } from '../types/index.js';
import { getTodayYMD } from '../lib/datetime.js';
import { emitCommandError } from '../lib/command-error.js';
import { emitCommandSuccess, wantsStructuredOutput } from '../lib/output.js';
import { printFollowups } from '../lib/followups.js';

interface ScoresOptions {
  json?: boolean;
  agent?: boolean;
  quiet?: boolean;
  followups?: boolean;
  explain?: boolean;
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
  const selectedLeagues = favoriteLeagues
    .map((slug) => ({ slug, id: LEAGUES[slug]?.id, name: LEAGUES[slug]?.name }))
    .filter((league): league is { slug: string; id: string; name: string } => Boolean(league.id && league.name));
  const leagueIds = favoriteLeagues
    .map((slug) => LEAGUES[slug]?.id)
    .filter(Boolean) as string[];

  try {
    const dateYmd = getTodayYMD(timeZone);
    const matches = await provider.getToday(leagueIds, { dateYmd });

    const wantProxyStatus = !hasApiKey && (wantsStructuredOutput(options) || !options.quiet);
    const proxyStatus = await getProxyStatusIfFree(hasApiKey, wantProxyStatus);
    const runtime = provider.consumeRuntimeMeta();

    const output: ScoresOutput = {
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
      console.log(renderScores(output));
      if (runtime.staleFallback) {
        console.log(getStaleFallbackLine(runtime.cachedAt));
      }
      const explainInput = {
        mode: hasApiKey ? 'direct' as const : 'proxy' as const,
        timeZone,
        dateYmd,
        leagues: selectedLeagues,
        matchCount: output.matches.length,
      };
      const noMatchHints = getScoresNoMatchesHint(explainInput);
      if (noMatchHints.length > 0) {
        console.log('');
        for (const line of noMatchHints) console.log(line);
      }
      if (options.explain) {
        const explanation = getScoresNoMatchesExplanation(explainInput);
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
        if (first.id) {
          hints.push(`Save the first match to calendar: rugbyclaw calendar ${first.id} --out ~/Desktop/rugby-match.ics`);
        }
        hints.push('See what is coming next: rugbyclaw fixtures');
      } else {
        hints.push('Check upcoming games instead: rugbyclaw fixtures');
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
