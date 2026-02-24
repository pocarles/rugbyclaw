import { randomUUID } from 'node:crypto';
import { ProviderError } from './types.js';

export const POLYMARKET_BASE_URL = 'https://gamma-api.polymarket.com';
const REQUEST_TIMEOUT_MS = 7000;
const MAX_SEARCH_QUERY_LENGTH = 120;
const MAX_SLUG_LENGTH = 120;

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

type MarketsResponse =
  | RawMarket[]
  | {
      markets?: RawMarket[];
      data?: RawMarket[];
      results?: RawMarket[];
      market?: RawMarket;
    };

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

function coerceOutcomeNames(rawOutcomes: unknown): string[] {
  if (!Array.isArray(rawOutcomes)) return [];
  return rawOutcomes
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((name) => Boolean(name));
}

function coercePriceArray(values: unknown): Array<string | number> {
  return Array.isArray(values) ? values : [];
}

function coerceText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeMarket(raw: RawMarket): PolymarketMarket {
  const outcomes = coerceOutcomeNames(raw.outcomes);
  const prices = coercePriceArray(raw.outcomePrices ?? raw.prices);
  const bestBids = coercePriceArray(raw.bestBidPrices ?? raw.bids);
  const bestAsks = coercePriceArray(raw.bestAskPrices ?? raw.asks);

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
    slug: coerceText(raw.slug) ?? String(id),
    question: coerceText(raw.question) ?? coerceText(raw.title) ?? coerceText(raw.name) ?? 'Unknown market',
    outcomes: normalizedOutcomes,
    liquidity: toNumber(raw.liquidity),
    volume24h: toNumber(raw.volume24h ?? raw.volume),
    endDate: coerceText(raw.endDate ?? raw.closesAt ?? raw.closeTime),
    updatedAt: coerceText(raw.updatedAt ?? raw.lastUpdated ?? raw.lastTradeTime ?? raw.last_trade_time),
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
    const safeQuery = this.sanitizeQuery(query);
    const params = new URLSearchParams();
    if (safeQuery) params.set('search', safeQuery);
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
    params.set('limit', String(limit));
    if (options?.activeOnly !== false) params.set('active', 'true');
    const url = this.buildUrl('/markets', params);
    const response = await this.fetchJson(url);
    const markets = this.extractMarkets(response);
    return markets.map(normalizeMarket);
  }

  async getMarketBySlug(slug: string): Promise<PolymarketMarket | null> {
    const safeSlug = this.sanitizeSlug(slug);
    if (!safeSlug) return null;
    const url = this.buildUrl(`/markets/${encodeURIComponent(safeSlug)}`);
    const response = await this.fetchJson(url);
    const market = this.extractSingleMarket(response);
    if (!market) return null;
    return normalizeMarket(market);
  }

  private sanitizeQuery(query: string): string {
    const trimmed = query.trim();
    if (trimmed.length > MAX_SEARCH_QUERY_LENGTH) {
      throw new ProviderError('Polymarket search query too long', 'PARSE_ERROR', this.name);
    }
    if (/[\r\n\t]/.test(trimmed)) {
      throw new ProviderError('Polymarket search query contains invalid characters', 'PARSE_ERROR', this.name);
    }
    return trimmed;
  }

  private sanitizeSlug(slug: string): string | null {
    const trimmed = slug.trim();
    if (!trimmed) return null;
    if (trimmed.length > MAX_SLUG_LENGTH) {
      throw new ProviderError('Polymarket market id too long', 'PARSE_ERROR', this.name);
    }
    if (/[\r\n\t/]/.test(trimmed)) {
      throw new ProviderError('Polymarket market id contains invalid characters', 'PARSE_ERROR', this.name);
    }
    return trimmed;
  }

  private buildUrl(path: string, params?: URLSearchParams): URL {
    const sanitizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(sanitizedPath, POLYMARKET_BASE_URL);
    if (params) {
      url.search = params.toString();
    }
    return url;
  }

  private extractMarkets(payload: MarketsResponse): RawMarket[] {
    if (Array.isArray(payload)) {
      if (!payload.every((entry) => entry && typeof entry === 'object')) {
        throw new ProviderError('Unexpected Polymarket response shape', 'PARSE_ERROR', this.name);
      }
      return payload;
    }

    const candidates = [payload.markets, payload.data, payload.results];
    const arrayCandidate = candidates.find((candidate) => Array.isArray(candidate));

    if (arrayCandidate && arrayCandidate.every((entry) => entry && typeof entry === 'object')) {
      return arrayCandidate;
    }

    throw new ProviderError('Unexpected Polymarket response shape', 'PARSE_ERROR', this.name);
  }

  private extractSingleMarket(payload: MarketsResponse): RawMarket | null {
    if (Array.isArray(payload)) {
      const [first] = payload;
      return first && typeof first === 'object' ? (first as RawMarket) : null;
    }

    if (payload.market && typeof payload.market === 'object') {
      return payload.market as RawMarket;
    }

    const candidates = [payload.markets, payload.data, payload.results].find((candidate) => Array.isArray(candidate));
    if (candidates && candidates[0] && typeof candidates[0] === 'object') {
      return candidates[0] as RawMarket;
    }

    if (payload && typeof payload === 'object') {
      return payload as RawMarket;
    }

    return null;
  }

  private async fetchJson(url: URL): Promise<MarketsResponse> {
    const clientTraceId = randomUUID();
    let response: Response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'x-rugbyclaw-trace-id': clientTraceId,
        },
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      const timedOut = error instanceof Error && error.name === 'AbortError';
      const message = timedOut ? 'Polymarket request timed out. Try again shortly.' : 'Polymarket request failed. Please retry.';
      throw new ProviderError(message, 'NETWORK_ERROR', this.name, undefined, clientTraceId);
    } finally {
      clearTimeout(timeout);
    }

    const traceId = this.resolveTraceId(response, clientTraceId);
    this.recordTrace(traceId);

    if (response.status === 429) {
      throw new ProviderError('Polymarket rate limited. Try again shortly.', 'RATE_LIMITED', this.name, undefined, traceId);
    }

    if (!response.ok) {
      throw new ProviderError(
        `Polymarket unavailable (status ${response.status}).`,
        response.status === 401 || response.status === 403 ? 'UNAUTHORIZED' : 'UNKNOWN',
        this.name,
        undefined,
        traceId
      );
    }

    try {
      return (await response.json()) as MarketsResponse;
    } catch (error) {
      const message = error instanceof Error && error.name === 'AbortError'
        ? 'Polymarket request timed out while reading response.'
        : 'Invalid response from Polymarket.';
      throw new ProviderError(message, 'PARSE_ERROR', this.name, undefined, traceId);
    }
  }

  private resolveTraceId(response: Response, fallback: string): string {
    return response.headers.get('x-request-id')
      || response.headers.get('cf-ray')
      || response.headers.get('x-trace-id')
      || fallback;
  }
}
