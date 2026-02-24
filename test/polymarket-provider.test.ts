import { afterEach, describe, expect, it, vi } from 'vitest';
import { PolymarketProvider } from '../src/lib/providers/polymarket.js';

const SAMPLE_RESPONSE = {
  markets: [
    {
      id: 'poly-123',
      slug: 'home-away-draw',
      question: 'Home vs Away - Match Odds',
      outcomes: ['Home', 'Draw', 'Away'],
      outcomePrices: ['0.55', '0.1', '0.35'],
      bestBidPrices: ['0.54', '0.09', '0.34'],
      bestAskPrices: ['0.56', '0.11', '0.36'],
      liquidity: '1200',
      volume24h: '2300',
      endDate: '2026-02-25T20:00:00Z',
      updatedAt: '2026-02-24T12:00:00Z',
    },
  ],
};

describe('PolymarketProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes Polymarket markets with prices and metadata', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(SAMPLE_RESPONSE), {
      status: 200,
      headers: { 'x-request-id': 'poly-trace' },
    })));

    const provider = new PolymarketProvider();
    const markets = await provider.searchMarkets('home away');
    const runtime = provider.consumeRuntimeMeta();

    expect(markets).toHaveLength(1);
    expect(markets[0].outcomes[0].lastPrice).toBeCloseTo(0.55);
    expect(markets[0].liquidity).toBe(1200);
    expect(runtime.traceId).toBe('poly-trace');
  });

  it('throws on unexpected status codes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    const provider = new PolymarketProvider();
    await expect(provider.searchMarkets('broken')).rejects.toThrow(/Polymarket returned 500/);
  });
});
