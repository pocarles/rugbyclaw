import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { selectBestMarket, MAX_OUTCOME_SPREAD } from '../src/lib/market-pulse.js';
import type { PolymarketMarket } from '../src/lib/providers/polymarket.js';

const BASE_MARKET: PolymarketMarket = {
  id: 'poly-123',
  slug: 'home-away-draw',
  question: 'Home XV vs Away XV - Match Odds',
  outcomes: [
    { name: 'Home XV', bestBid: 0.54, bestAsk: 0.56, lastPrice: 0.55 },
    { name: 'Draw', bestBid: 0.11, bestAsk: 0.13, lastPrice: 0.12 },
    { name: 'Away XV', bestBid: 0.32, bestAsk: 0.34, lastPrice: 0.33 },
  ],
  liquidity: 1800,
  volume24h: 3200,
  endDate: '2026-02-25T18:00:00Z',
  updatedAt: '2026-02-24T10:00:00Z',
};

describe('market pulse matching and gating', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-24T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('maps outcomes to deterministic home/draw/away ordering', () => {
    const evaluation = selectBestMarket(
      { home: 'Home XV', away: 'Away XV', league: 'Top 14', date: '2026-02-25' },
      [BASE_MARKET]
    );

    expect(evaluation).not.toBeNull();
    expect(evaluation?.outcomes.map((o) => o.selection)).toEqual(['home', 'draw', 'away']);
    expect(evaluation?.outcomes[0].name).toBe('Home XV');
    expect(evaluation?.confidence).toBe('high');
    expect(evaluation?.spread).toBeLessThan(MAX_OUTCOME_SPREAD);
  });

  it('drops confidence when market is stale or spreads are wide', () => {
    const stale: PolymarketMarket = {
      ...BASE_MARKET,
      updatedAt: '2026-02-22T00:00:00Z',
      outcomes: [
        { name: 'Home XV', bestBid: 0.2, bestAsk: 0.6 },
        { name: 'Draw', bestBid: 0.1, bestAsk: 0.5 },
        { name: 'Away XV', bestBid: 0.15, bestAsk: 0.65 },
      ],
    };

    const evaluation = selectBestMarket({ home: 'Home XV', away: 'Away XV' }, [stale]);

    expect(evaluation).not.toBeNull();
    expect(evaluation?.confidence).toBe('low');
    expect(evaluation?.issues).toContain('stale_market');
    expect(evaluation?.issues).toContain('wide_spread');
  });

  it('requires a draw outcome to qualify', () => {
    const twoWay: PolymarketMarket = {
      ...BASE_MARKET,
      outcomes: [
        { name: 'Home XV', bestBid: 0.6, bestAsk: 0.62 },
        { name: 'Away XV', bestBid: 0.38, bestAsk: 0.4 },
      ],
    };

    const evaluation = selectBestMarket({ home: 'Home XV', away: 'Away XV' }, [twoWay]);
    expect(evaluation).toBeNull();
  });
});
