import { describe, expect, it } from 'vitest';
import { cacheKey } from '../src/lib/cache.js';

describe('cache key namespacing', () => {
  it('includes namespace so provider modes do not collide', () => {
    const direct = cacheKey('games', { league: '16', season: '2025' }, 'direct:v1.rugby.api-sports.io');
    const proxy = cacheKey('games', { league: '16', season: '2025' }, 'proxy:rugbyclaw-proxy.pocarles.workers.dev');

    expect(direct).not.toBe(proxy);
  });
});
