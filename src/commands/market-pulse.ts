import { loadConfig, loadSecrets, getEffectiveTimeZone } from '../lib/config.js';
import { ApiSportsProvider } from '../lib/providers/apisports.js';
import { PolymarketProvider } from '../lib/providers/polymarket.js';
import { emitCommandError } from '../lib/command-error.js';
import { emitCommandSuccess, wantsStructuredOutput } from '../lib/output.js';
import { EXIT_CODES } from '../lib/exit-codes.js';
import { renderMarketPulse } from '../render/terminal.js';
import type { MarketPulseOutput } from '../types/index.js';
import { selectBestMarket, type MarketPulseRequest } from '../lib/market-pulse.js';
import { formatDateYMD } from '../lib/datetime.js';
import { resolveLeague } from '../lib/leagues.js';
import { printFollowups } from '../lib/followups.js';

interface MarketPulseOptions {
  matchId?: string;
  home?: string;
  away?: string;
  league?: string;
  date?: string;
  includeLowConfidence?: boolean;
  json?: boolean;
  agent?: boolean;
  quiet?: boolean;
  followups?: boolean;
}

function invalid(message: string, options: MarketPulseOptions): never {
  emitCommandError(message, options, EXIT_CODES.INVALID_INPUT);
}

function validateDate(date?: string): boolean {
  if (!date) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

async function resolveMatchFromId(matchId: string, timeZone: string, options: MarketPulseOptions): Promise<MarketPulseRequest> {
  const secrets = await loadSecrets();
  const provider = new ApiSportsProvider(secrets?.api_key);
  const match = await provider.getMatch(matchId);
  const runtime = provider.consumeRuntimeMeta();

  if (!match) {
    emitCommandError(`Match not found: ${matchId}`, options, EXIT_CODES.INVALID_INPUT, { traceId: runtime.traceId });
  }

  return {
    matchId,
    home: match.homeTeam.name,
    away: match.awayTeam.name,
    league: match.league.name,
    date: formatDateYMD(match.date, timeZone),
  };
}

export async function marketPulseCommand(options: MarketPulseOptions): Promise<void> {
  const hasMatchId = Boolean(options.matchId);
  const hasTeams = Boolean(options.home && options.away);

  if (hasMatchId && hasTeams) {
    invalid('Use either --match-id or --home/--away (not both).', options);
  }

  if (!hasMatchId && !hasTeams) {
    invalid('Provide --match-id or --home/--away to identify a game.', options);
  }

  if (!validateDate(options.date)) {
    invalid('Invalid date format. Use YYYY-MM-DD.', options);
  }

  const config = await loadConfig();
  const timeZone = getEffectiveTimeZone(config);

  const provider = new PolymarketProvider();
  let request: MarketPulseRequest;

  try {
    if (hasMatchId) {
      request = await resolveMatchFromId(options.matchId as string, timeZone, options);
    } else {
      const league = options.league ? resolveLeague(options.league)?.name ?? options.league : undefined;
      request = {
        home: options.home as string,
        away: options.away as string,
        league,
        date: options.date,
      };
    }

    const markets = await provider.searchMarkets(`${request.home} ${request.away}`, { limit: 75, activeOnly: true });
    const runtime = provider.consumeRuntimeMeta();

    const evaluation = selectBestMarket(request, markets);
    if (!evaluation) {
      emitCommandError(
        'No matching Polymarket 3-way market found for that game.',
        options,
        EXIT_CODES.UPSTREAM_ERROR,
        { traceId: runtime.traceId }
      );
    }

    if (evaluation.confidence === 'low' && !options.includeLowConfidence) {
      emitCommandError(
        'Only low-confidence Polymarket market found. Re-run with --include-low-confidence to inspect anyway.',
        options,
        EXIT_CODES.GENERAL_ERROR,
        { traceId: runtime.traceId }
      );
    }

    const output: MarketPulseOutput = {
      match: {
        id: request.matchId,
        home: request.home,
        away: request.away,
        league: request.league,
        date: request.date,
        market: evaluation.market.slug,
      },
      market_name: evaluation.market.question,
      outcomes: evaluation.outcomes,
      confidence: evaluation.confidence,
      generated_at: new Date().toISOString(),
      liquidity: evaluation.liquidity,
      volume_24h: evaluation.volume24h,
      spread: evaluation.spread,
      updated_at: evaluation.updatedAt,
      trace_id: runtime.traceId || undefined,
      quality_warnings: evaluation.issues.length > 0 ? evaluation.issues : undefined,
    };

    if (wantsStructuredOutput(options)) {
      emitCommandSuccess(output, options, { traceId: runtime.traceId });
      return;
    }

    if (!options.quiet) {
      console.log(renderMarketPulse(output));
      const hints = [
        'Show JSON output: add --json',
        'For agent envelopes: add --agent',
      ];
      if (!options.includeLowConfidence && evaluation.confidence !== 'high') {
        hints.push('Include low confidence data: add --include-low-confidence');
      }
      printFollowups(options, hints);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const runtime = provider.consumeRuntimeMeta();
    emitCommandError(message, options, undefined, { traceId: runtime.traceId });
  }
}
