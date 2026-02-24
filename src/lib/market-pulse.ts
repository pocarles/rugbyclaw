import type { MarketConfidence, MarketOutcome } from '../types/index.js';
import { normalizeText, similarityScore } from './fuzzy.js';
import type { PolymarketMarket, PolymarketOutcomeQuote } from './providers/polymarket.js';

export interface MarketPulseRequest {
  home: string;
  away: string;
  league?: string;
  date?: string;
  matchId?: string;
}

export interface MarketPulseEvaluation {
  market: PolymarketMarket;
  outcomes: MarketOutcome[];
  confidence: MarketConfidence;
  issues: string[];
  spread?: number;
  liquidity?: number;
  volume24h?: number;
  updatedAt?: string;
}

export const MIN_LIQUIDITY = 500;
export const MIN_VOLUME_24H = 1000;
export const MAX_OUTCOME_SPREAD = 0.18;
export const MAX_DATA_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

interface OutcomeMapping {
  outcome: PolymarketOutcomeQuote;
  similarity: number;
}

function clampProbability(prob: number): number {
  if (!Number.isFinite(prob)) return prob;
  if (prob < 0) return 0;
  if (prob > 1) return 1;
  return prob;
}

function resolveProbability(outcome: PolymarketOutcomeQuote): number | null {
  const values: number[] = [];
  if (outcome.bestBid !== undefined) values.push(outcome.bestBid);
  if (outcome.bestAsk !== undefined) values.push(outcome.bestAsk);
  if (outcome.lastPrice !== undefined) values.push(outcome.lastPrice);

  if (values.length === 0) return null;

  if (outcome.bestBid !== undefined && outcome.bestAsk !== undefined) {
    return clampProbability((outcome.bestBid + outcome.bestAsk) / 2);
  }

  return clampProbability(values[0]);
}

function findDrawOutcome(outcomes: PolymarketOutcomeQuote[]): PolymarketOutcomeQuote | null {
  for (const outcome of outcomes) {
    const normalized = normalizeText(outcome.name);
    if (normalized.includes('draw') || normalized.includes('tie')) {
      return outcome;
    }
  }
  return null;
}

function pickBestOutcome(target: string, outcomes: PolymarketOutcomeQuote[], used: Set<string>): OutcomeMapping | null {
  const normalizedTarget = normalizeText(target);
  let best: OutcomeMapping | null = null;
  for (const outcome of outcomes) {
    if (used.has(outcome.name)) continue;
    const score = similarityScore(normalizedTarget, normalizeText(outcome.name));
    if (!best || score > best.similarity) {
      best = { outcome, similarity: score };
    }
  }
  return best;
}

function computeMaxSpread(outcomes: PolymarketOutcomeQuote[]): number | undefined {
  const spreads: number[] = [];
  for (const outcome of outcomes) {
    if (outcome.bestBid !== undefined && outcome.bestAsk !== undefined) {
      spreads.push(outcome.bestAsk - outcome.bestBid);
    }
  }
  if (spreads.length === 0) return undefined;
  return Math.max(...spreads);
}

function mapOutcomes(
  request: MarketPulseRequest,
  market: PolymarketMarket
): { outcomes: MarketOutcome[]; spread?: number; mappingIssues: string[] } | null {
  if (!market.outcomes || market.outcomes.length < 3) return null;

  const drawOutcome = findDrawOutcome(market.outcomes);
  if (!drawOutcome) return null;

  const used = new Set<string>([drawOutcome.name]);

  const homeMatch = pickBestOutcome(request.home, market.outcomes, used);
  if (!homeMatch) return null;
  used.add(homeMatch.outcome.name);

  const awayMatch = pickBestOutcome(request.away, market.outcomes, used);
  if (!awayMatch) return null;

  const mappingIssues: string[] = [];
  if (homeMatch.similarity < 0.35) mappingIssues.push('weak_home_match');
  if (awayMatch.similarity < 0.35) mappingIssues.push('weak_away_match');

  const ordered: MarketOutcome[] = [
    {
      selection: 'home',
      name: homeMatch.outcome.name,
      implied_prob: resolveProbability(homeMatch.outcome) ?? Number.NaN,
      best_bid: homeMatch.outcome.bestBid,
      best_ask: homeMatch.outcome.bestAsk,
    },
    {
      selection: 'draw',
      name: drawOutcome.name,
      implied_prob: resolveProbability(drawOutcome) ?? Number.NaN,
      best_bid: drawOutcome.bestBid,
      best_ask: drawOutcome.bestAsk,
    },
    {
      selection: 'away',
      name: awayMatch.outcome.name,
      implied_prob: resolveProbability(awayMatch.outcome) ?? Number.NaN,
      best_bid: awayMatch.outcome.bestBid,
      best_ask: awayMatch.outcome.bestAsk,
    },
  ];

  const spread = computeMaxSpread([homeMatch.outcome, drawOutcome, awayMatch.outcome]);
  return { outcomes: ordered, spread, mappingIssues };
}

function sanitizeOutcomes(outcomes: MarketOutcome[]): { cleaned: MarketOutcome[]; missing: boolean } {
  let missing = false;
  const cleaned = outcomes.map((outcome) => {
    if (!Number.isFinite(outcome.implied_prob)) {
      missing = true;
      return { ...outcome, implied_prob: 0 };
    }
    return outcome;
  });
  return { cleaned, missing };
}

function evaluateConfidence(
  mapped: { outcomes: MarketOutcome[]; spread?: number; mappingIssues: string[] },
  market: PolymarketMarket
): { confidence: MarketConfidence; issues: string[]; outcomes: MarketOutcome[] } {
  const issues = [...mapped.mappingIssues];

  const { cleaned, missing } = sanitizeOutcomes(mapped.outcomes);
  if (missing) issues.push('missing_prices');

  const liquidity = market.liquidity ?? 0;
  const volume = market.volume24h ?? 0;
  if (liquidity < MIN_LIQUIDITY) issues.push('low_liquidity');
  if (volume < MIN_VOLUME_24H) issues.push('low_volume');

  if (mapped.spread !== undefined) {
    if (mapped.spread > MAX_OUTCOME_SPREAD) {
      issues.push('wide_spread');
    }
  } else {
    issues.push('missing_spread');
  }

  const updatedAtMs = market.updatedAt ? Date.parse(market.updatedAt) : Number.NaN;
  if (!Number.isFinite(updatedAtMs) || Date.now() - updatedAtMs > MAX_DATA_AGE_MS) {
    issues.push('stale_market');
  }

  const uniqueIssues = Array.from(new Set(issues));
  const count = uniqueIssues.length;

  const confidence: MarketConfidence = count === 0 ? 'high' : count === 1 ? 'medium' : 'low';
  return { confidence, issues: uniqueIssues, outcomes: cleaned };
}

function confidenceWeight(confidence: MarketConfidence): number {
  if (confidence === 'high') return 2;
  if (confidence === 'medium') return 1;
  return 0;
}

function scoreMarket(request: MarketPulseRequest, market: PolymarketMarket): number {
  const questionScore = similarityScore(
    normalizeText(`${request.home} ${request.away}`),
    normalizeText(market.question)
  );

  const outcomeNames = market.outcomes.map((o) => normalizeText(o.name));
  const homeOutcomeScore = Math.max(0, ...outcomeNames.map((o) => similarityScore(normalizeText(request.home), o)));
  const awayOutcomeScore = Math.max(0, ...outcomeNames.map((o) => similarityScore(normalizeText(request.away), o)));

  let leagueScore = 0;
  if (request.league) {
    leagueScore = similarityScore(normalizeText(request.league), normalizeText(market.question)) * 0.5;
  }

  let dateScore = 0;
  if (request.date && market.endDate) {
    const marketDateMs = Date.parse(market.endDate);
    const requestDateMs = Date.parse(`${request.date}T00:00:00Z`);
    if (Number.isFinite(marketDateMs) && Number.isFinite(requestDateMs)) {
      const diffHours = Math.abs(marketDateMs - requestDateMs) / (60 * 60 * 1000);
      if (diffHours < 6) dateScore = 0.6;
      else if (diffHours < 24) dateScore = 0.4;
      else if (diffHours < 72) dateScore = 0.15;
    }
  }

  return questionScore + homeOutcomeScore + awayOutcomeScore + leagueScore + dateScore;
}

export function selectBestMarket(
  request: MarketPulseRequest,
  markets: PolymarketMarket[]
): MarketPulseEvaluation | null {
  let best: { eval: MarketPulseEvaluation; score: number } | null = null;

  for (const market of markets) {
    const mapped = mapOutcomes(request, market);
    if (!mapped) continue;

    const { confidence, issues, outcomes } = evaluateConfidence(mapped, market);
    const score = scoreMarket(request, market);
    const evaluation: MarketPulseEvaluation = {
      market,
      outcomes,
      confidence,
      issues,
      spread: mapped.spread,
      liquidity: market.liquidity,
      volume24h: market.volume24h,
      updatedAt: market.updatedAt,
    };

    if (
      !best ||
      score > best.score ||
      (score === best.score && confidenceWeight(confidence) > confidenceWeight(best.eval.confidence))
    ) {
      best = { eval: evaluation, score };
    }
  }

  return best?.eval ?? null;
}
