import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { marketPulseCommand } from '../src/commands/market-pulse.js';

const SAMPLE_RESPONSE = {
  markets: [
    {
      id: 'poly-abc',
      slug: 'home-away-draw',
      question: 'Home XV vs Away XV - Match Odds',
      outcomes: ['Home XV', 'Draw', 'Away XV'],
      outcomePrices: ['0.55', '0.12', '0.33'],
      bestBidPrices: ['0.54', '0.11', '0.32'],
      bestAskPrices: ['0.56', '0.13', '0.34'],
      liquidity: 1400,
      volume24h: 2800,
      updatedAt: '2026-02-24T11:30:00Z',
    },
  ],
};

function withCapturedLogs<T>(fn: () => Promise<T>): Promise<{ logs: string[]; result: T }> {
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map((value) => String(value)).join(' '));
  };

  return fn()
    .then((result) => ({ logs, result }))
    .finally(() => {
      console.log = originalLog;
    });
}

describe('market pulse command output', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-24T12:00:00Z'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('emits JSON contract with --json', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(SAMPLE_RESPONSE), { status: 200 })));

    const { logs } = await withCapturedLogs(async () => {
      await marketPulseCommand({
        home: 'Home XV',
        away: 'Away XV',
        json: true,
        quiet: true,
      });
    });

    expect(logs).toHaveLength(1);
    const payload = JSON.parse(logs[0]) as Record<string, unknown>;
    expect(payload.confidence).toBe('high');
    expect((payload.match as { home: string }).home).toBe('Home XV');
    expect(Array.isArray(payload.outcomes)).toBe(true);
  });

  it('wraps agent envelope with --agent', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(SAMPLE_RESPONSE), { status: 200 })));

    const { logs } = await withCapturedLogs(async () => {
      await marketPulseCommand({
        home: 'Home XV',
        away: 'Away XV',
        agent: true,
        quiet: true,
      });
    });

    expect(logs).toHaveLength(1);
    const payload = JSON.parse(logs[0]) as { ok: boolean; data: Record<string, unknown> };
    expect(payload.ok).toBe(true);
    expect(payload.data.confidence).toBe('high');
    expect(Array.isArray(payload.data.outcomes)).toBe(true);
  });

  it('rejects oversized input to prevent noisy queries', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(marketPulseCommand({
      home: 'H'.repeat(80),
      away: 'Away XV',
      quiet: true,
    })).rejects.toThrow(/exit:2/);

    expect(exitSpy).toHaveBeenCalledWith(2);
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('keeps low-confidence markets suppressed by default', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      markets: [
        {
          id: 'poly-low',
          slug: 'low',
          question: 'Home XV vs Away XV - Match Odds',
          outcomes: ['Home XV', 'Draw', 'Away XV'],
          outcomePrices: ['0.5', '0.3', '0.2'],
          bestBidPrices: ['0.05', '0.02', '0.01'],
          bestAskPrices: ['0.95', '0.92', '0.91'],
          liquidity: 10,
          volume24h: 25,
          updatedAt: '2026-02-24T11:30:00Z',
        },
      ],
    }), { status: 200 })));

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(marketPulseCommand({
      home: 'Home XV',
      away: 'Away XV',
      quiet: true,
    })).rejects.toThrow(/exit:1/);

    expect(exitSpy).toHaveBeenCalledWith(1);
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('validates match id format before querying providers', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(marketPulseCommand({
      matchId: 'abc123',
      quiet: true,
    })).rejects.toThrow(/exit:2/);

    expect(exitSpy).toHaveBeenCalledWith(2);
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
