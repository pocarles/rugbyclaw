import { randomUUID } from 'node:crypto';
import { ProviderError } from './types.js';

export const POLYMARKET_BASE_URL = 'https://gamma-api.polymarket.com';

export interface PolymarketOutcomeQuote {
  name: string;
  bestBid?: number;
  bestAsk?: number;
  lastPrice?: number;
}

export interface PolymarketMarket {
  id: string;
  slug: string;
  question: string;
  outcomes: PolymarketOutcomeQuote[];
  liquidity?: number;
  volume24h?: number;
  endDate?: string;
  updatedAt?: string;
  active?: boolean;
  closed?: boolean;
}

interface MarketsResponse {
  markets?: RawMarket[];
  data?: RawMarket[];
  market?: RawMarket;
}

interface RawMarket {
  id?: string;
  slug?: string;
  name?: string;
  title?: string;
  question?: string;
  description?: string;
  outcomes?: string[];
  outcomePrices?: Array<string | number>;
  prices?: Array<string | number>;
  bestBidPrices?: Array<string | number>;
  bestAskPrices?: Array<string | number>;
  bids?: Array<string | number>;
  asks?: Array<string | number>;
  liquidity?: number | string;
  volume24h?: number | string;
  volume?: number | string;
  endDate?: string;
  closesAt?: string;
  closeTime?: string;
  updatedAt?: string;
  lastUpdated?: string;
  lastTradeTime?: string;
  last_trade_time?: string;
  active?: boolean;
  closed?: boolean;
  conditionId?: string;
}

export interface PolymarketRuntimeMeta {
  traceId: string | null;
  traceIds: string[];
  staleFallback: boolean;
  cachedAt: string | null;
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function normalizeMarket(raw: RawMarket): PolymarketMarket {
  const outcomes = raw.outcomes ?? [];
  const prices = raw.outcomePrices ?? raw.prices ?? [];
  const bestBids = raw.bestBidPrices ?? raw.bids ?? [];
  const bestAsks = raw.bestAskPrices ?? raw.asks ?? [];

  const normalizedOutcomes: PolymarketOutcomeQuote[] = outcomes.map((name, idx) => ({
    name,
    lastPrice: toNumber(prices[idx]),
    bestBid: toNumber(bestBids[idx]),
    bestAsk: toNumber(bestAsks[idx]),
  }));

  const id = raw.id ?? raw.conditionId ?? raw.slug;

  if (!id) {
    throw new ProviderError('Polymarket response missing market id', 'PARSE_ERROR', 'Polymarket');
  }

  return {
    id: String(id),
    slug: raw.slug ?? String(id),
    question: raw.question ?? raw.title ?? raw.name ?? 'Unknown market',
    outcomes: normalizedOutcomes,
    liquidity: toNumber(raw.liquidity),
    volume24h: toNumber(raw.volume24h ?? raw.volume),
    endDate: raw.endDate ?? raw.closesAt ?? raw.closeTime,
    updatedAt: raw.updatedAt ?? raw.lastUpdated ?? raw.lastTradeTime ?? raw.last_trade_time,
    active: raw.active,
    closed: raw.closed,
  };
}

export class PolymarketProvider {
  readonly name = 'Polymarket';
  private traceIds: string[] = [];

  private recordTrace(traceId: string | null): void {
    if (traceId) {
      this.traceIds.push(traceId);
    }
  }

  consumeRuntimeMeta(): PolymarketRuntimeMeta {
    const traceIds = [...this.traceIds];
    const latest = traceIds[traceIds.length - 1] ?? null;
    this.traceIds = [];
    return {
      traceId: latest,
      traceIds,
      staleFallback: false,
      cachedAt: null,
    };
  }

  async searchMarkets(query: string, options?: { limit?: number; activeOnly?: boolean }): Promise<PolymarketMarket[]> {
    const params = new URLSearchParams();
    if (query) params.set('search', query);
    params.set('limit', String(options?.limit ?? 50));
    if (options?.activeOnly !== false) params.set('active', 'true');
    const response = await this.fetchJson(`/markets?${params.toString()}`);
    const markets = response.markets ?? response.data;
    if (!markets || !Array.isArray(markets)) {
      throw new ProviderError('Unexpected Polymarket response shape', 'PARSE_ERROR', this.name);
    }
    return markets.map(normalizeMarket);
  }

  async getMarketBySlug(slug: string): Promise<PolymarketMarket | null> {
    if (!slug) return null;
    const response = await this.fetchJson(`/markets/${slug}`);
    const market = response.market ?? response;
    if (!market || typeof market !== 'object') return null;
    return normalizeMarket(market as RawMarket);
  }

  private async fetchJson(path: string): Promise<MarketsResponse> {
    const clientTraceId = randomUUID();
    let response: Response;
    try {
      response = await fetch(`${POLYMARKET_BASE_URL}${path}`, {
        headers: {
          Accept: 'application/json',
          'x-rugbyclaw-trace-id': clientTraceId,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'fetch failed';
      throw new ProviderError(`Polymarket request failed: ${message}`, 'NETWORK_ERROR', this.name, undefined, clientTraceId);
    }

    const traceId = this.resolveTraceId(response, clientTraceId);
    this.recordTrace(traceId);

    if (response.status === 429) {
      throw new ProviderError('Polymarket rate limited. Try again shortly.', 'RATE_LIMITED', this.name, undefined, traceId);
    }

    if (!response.ok) {
      throw new ProviderError(
        `Polymarket returned ${response.status}`,
        response.status === 401 || response.status === 403 ? 'UNAUTHORIZED' : 'UNKNOWN',
        this.name,
        undefined,
        traceId
      );
    }

    try {
      return (await response.json()) as MarketsResponse;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown parse error';
      throw new ProviderError(`Failed to parse Polymarket response: ${message}`, 'PARSE_ERROR', this.name, undefined, traceId);
    }
  }

  private resolveTraceId(response: Response, fallback: string): string {
    return response.headers.get('x-request-id')
      || response.headers.get('cf-ray')
      || response.headers.get('x-trace-id')
      || fallback;
  }
}
