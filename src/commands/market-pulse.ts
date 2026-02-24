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
import { ProviderError } from '../lib/providers/types.js';

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

const MAX_TEAM_NAME_LENGTH = 55;
const MAX_LEAGUE_NAME_LENGTH = 60;
const MAX_MATCH_ID_LENGTH = 24;
const MAX_SEARCH_QUERY_LENGTH = 120;

function invalid(message: string, options: MarketPulseOptions): never {
  emitCommandError(message, options, EXIT_CODES.INVALID_INPUT);
}

function validateDate(date?: string): boolean {
  if (!date) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function sanitizeTextInput(value: string | undefined, label: string, maxLength: number, options: MarketPulseOptions): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) invalid(`${label} cannot be empty.`, options);
  if (trimmed.length > maxLength) invalid(`${label} is too long (max ${maxLength} characters).`, options);
  if (/[\r\n\t]/.test(trimmed)) invalid(`${label} cannot include control characters.`, options);
  return trimmed;
}

function sanitizeMatchId(matchId: string | undefined, options: MarketPulseOptions): string | undefined {
  if (matchId === undefined) return undefined;
  const trimmed = matchId.trim();
  if (!trimmed) invalid('Match id cannot be empty.', options);
  if (trimmed.length > MAX_MATCH_ID_LENGTH) invalid(`Match id is too long (max ${MAX_MATCH_ID_LENGTH} characters).`, options);
  if (!/^[0-9]+$/.test(trimmed)) invalid('Match id must be numeric.', options);
  return trimmed;
}

function validateSearchQuery(home: string, away: string, options: MarketPulseOptions): string {
  const query = `${home} ${away}`;
  if (query.length > MAX_SEARCH_QUERY_LENGTH) {
    invalid(`Combined search is too long (max ${MAX_SEARCH_QUERY_LENGTH} characters).`, options);
  }
  return query;
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
  const matchId = sanitizeMatchId(options.matchId, options);
  const home = sanitizeTextInput(options.home, 'Home team', MAX_TEAM_NAME_LENGTH, options);
  const away = sanitizeTextInput(options.away, 'Away team', MAX_TEAM_NAME_LENGTH, options);
  const league = sanitizeTextInput(options.league, 'League', MAX_LEAGUE_NAME_LENGTH, options);
  const date = options.date?.trim();

  const hasMatchId = Boolean(matchId);
  const hasTeams = Boolean(home && away);

  if (hasMatchId && hasTeams) {
    invalid('Use either --match-id or --home/--away (not both).', options);
  }

  if (!hasMatchId && !hasTeams) {
    invalid('Provide --match-id or --home/--away to identify a game.', options);
  }

  if (!validateDate(date)) {
    invalid('Invalid date format. Use YYYY-MM-DD.', options);
  }

  const config = await loadConfig();
  const timeZone = getEffectiveTimeZone(config);

  const provider = new PolymarketProvider();
  let request: MarketPulseRequest;
  const includeLowConfidence = options.includeLowConfidence === true;

  try {
    if (hasMatchId) {
      request = await resolveMatchFromId(matchId as string, timeZone, options);
    } else {
      const resolvedLeague = league ? resolveLeague(league)?.name ?? league : undefined;
      request = {
        home: home as string,
        away: away as string,
        league: resolvedLeague,
        date,
      };
    }

    const searchQuery = validateSearchQuery(request.home, request.away, options);
    const markets = await provider.searchMarkets(searchQuery, { limit: 75, activeOnly: true });
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

    if (evaluation.confidence === 'low' && !includeLowConfidence) {
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
      if (!includeLowConfidence && evaluation.confidence !== 'high') {
        hints.push('Include low confidence data: add --include-low-confidence');
      }
      printFollowups(options, hints);
    }
  } catch (error) {
    const runtime = provider.consumeRuntimeMeta();
    if (error instanceof ProviderError) {
      const exitCode = error.code === 'RATE_LIMITED'
        ? EXIT_CODES.RATE_LIMITED
        : error.code === 'UNAUTHORIZED'
          ? EXIT_CODES.AUTH_ERROR
          : EXIT_CODES.UPSTREAM_ERROR;
      const traceId = error.traceId ?? runtime.traceId;
      emitCommandError(error.message, options, exitCode, { traceId });
    }

    // Allow mocked process.exit (in tests) to surface without double-wrapping.
    if (error instanceof Error && error.message.startsWith('exit:')) {
      throw error;
    }

    emitCommandError(
      'Unable to complete market pulse request. Please try again later.',
      options,
      EXIT_CODES.UPSTREAM_ERROR,
      { traceId: runtime.traceId }
    );
  }
}
