/**
 * Rugbyclaw Proxy Worker
 *
 * Proxies requests to API-Sports Rugby API with rate limiting.
 * Allows users to try Rugbyclaw without their own API key.
 */

import { isAllowedEndpoint } from './allowlist';

interface Env {
  API_SPORTS_KEY: string;
  RATE_LIMIT_PER_DAY: string;
  RATE_LIMIT_PER_MINUTE: string;
  DEFAULT_LEAGUES: string;
  RATE_LIMITS: KVNamespace;
}

const API_SPORTS_BASE = 'https://v1.rugby.api-sports.io';

type Endpoint = '/games' | '/teams' | '/leagues';

function parseAllowedLeagues(env: Env): Set<string> {
  return new Set(
    (env.DEFAULT_LEAGUES || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function getEndpoint(pathname: string): Endpoint | null {
  if (pathname === '/games' || pathname.startsWith('/games/')) return '/games';
  if (pathname === '/teams' || pathname.startsWith('/teams/')) return '/teams';
  if (pathname === '/leagues' || pathname.startsWith('/leagues/')) return '/leagues';
  return null;
}

function validateQuery(
  endpoint: Endpoint,
  searchParams: URLSearchParams,
  allowedLeagues: Set<string>
): { ok: true; cacheTtlSeconds: number } | { ok: false; message: string; status: number } {
  const keys = Array.from(searchParams.keys());
  const allowedKeysByEndpoint: Record<Endpoint, Set<string>> = {
    '/games': new Set(['league', 'season', 'date', 'id']),
    '/teams': new Set(['search', 'league', 'season', 'id']),
    '/leagues': new Set(['id', 'season']),
  };

  const allowedKeys = allowedKeysByEndpoint[endpoint];
  for (const key of keys) {
    if (!allowedKeys.has(key)) {
      return { ok: false, message: `Query parameter not allowed: ${key}`, status: 400 };
    }
  }

  // Restrict league-scoped access to the default leagues only.
  const league = searchParams.get('league');
  if (league && !allowedLeagues.has(league)) {
    return {
      ok: false,
      message: 'League not available in free mode. Run "rugbyclaw config" to add your own API key.',
      status: 403,
    };
  }

  // Restrict leagues endpoint to default leagues only.
  if (endpoint === '/leagues') {
    const id = searchParams.get('id');
    if (!id) {
      return {
        ok: false,
        message: 'Endpoint not available in free mode.',
        status: 403,
      };
    }
    if (!allowedLeagues.has(id)) {
      return {
        ok: false,
        message: 'League not available in free mode. Run "rugbyclaw config" to add your own API key.',
        status: 403,
      };
    }
  }

  // Limit search size to reduce abuse.
  const search = searchParams.get('search');
  if (search && search.length > 64) {
    return { ok: false, message: 'Search query too long', status: 400 };
  }

  // Cache TTL heuristics (seconds).
  if (endpoint === '/teams') return { ok: true, cacheTtlSeconds: 24 * 60 * 60 };
  if (endpoint === '/leagues') return { ok: true, cacheTtlSeconds: 7 * 24 * 60 * 60 };

  // /games
  if (searchParams.has('date') || searchParams.has('id')) return { ok: true, cacheTtlSeconds: 30 };
  return { ok: true, cacheTtlSeconds: 5 * 60 };
}

/**
 * Get the rate limit key for an IP (resets daily).
 */
function getRateLimitKey(ip: string): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `ratelimit:${ip}:${today}`;
}

function getMinuteRateLimitKey(ip: string, now: Date = new Date()): string {
  const minute = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  return `ratelimit:${ip}:${minute}`;
}

async function getRateLimitStatus(
  kv: KVNamespace,
  ip: string,
  limitPerDay: number,
  limitPerMinute: number
): Promise<{ remainingDay: number; remainingMinute: number; limitDay: number; limitMinute: number }> {
  const key = getRateLimitKey(ip);
  const minuteKey = getMinuteRateLimitKey(ip);

  const [currentDay, currentMinute] = await Promise.all([kv.get(key), kv.get(minuteKey)]);
  const countDay = currentDay ? parseInt(currentDay, 10) : 0;
  const countMinute = currentMinute ? parseInt(currentMinute, 10) : 0;

  return {
    remainingDay: Math.max(0, limitPerDay - countDay),
    remainingMinute: Math.max(0, limitPerMinute - countMinute),
    limitDay: limitPerDay,
    limitMinute: limitPerMinute,
  };
}

/**
 * Check and increment rate limit for an IP.
 * Returns { allowed: boolean, remaining: number, limit: number }
 */
async function checkRateLimit(
  kv: KVNamespace,
  ip: string,
  limitPerDay: number,
  limitPerMinute: number
): Promise<
  | { allowed: true; remainingDay: number; remainingMinute: number; limitDay: number; limitMinute: number }
  | { allowed: false; remainingDay: number; remainingMinute: number; limitDay: number; limitMinute: number }
> {
  const key = getRateLimitKey(ip);
  const minuteKey = getMinuteRateLimitKey(ip);

  // Get current count
  const [currentDay, currentMinute] = await Promise.all([kv.get(key), kv.get(minuteKey)]);
  const countDay = currentDay ? parseInt(currentDay, 10) : 0;
  const countMinute = currentMinute ? parseInt(currentMinute, 10) : 0;

  if (countDay >= limitPerDay || countMinute >= limitPerMinute) {
    return {
      allowed: false,
      remainingDay: Math.max(0, limitPerDay - countDay),
      remainingMinute: Math.max(0, limitPerMinute - countMinute),
      limitDay: limitPerDay,
      limitMinute: limitPerMinute,
    };
  }

  const newCountDay = countDay + 1;
  const newCountMinute = countMinute + 1;

  // Increment count (expires at midnight UTC + buffer)
  await kv.put(key, newCountDay.toString(), {
    expirationTtl: 86400 + 3600, // 25 hours to handle timezone edge cases
  });

  // Minute burst key
  await kv.put(minuteKey, newCountMinute.toString(), {
    expirationTtl: 120,
  });

  return {
    allowed: true,
    remainingDay: limitPerDay - newCountDay,
    remainingMinute: limitPerMinute - newCountMinute,
    limitDay: limitPerDay,
    limitMinute: limitPerMinute,
  };
}

/**
 * Validate that the requested endpoint is allowed.
 */
/**
 * Create a JSON error response.
 */
function errorResponse(message: string, status: number, headers: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        ...headers,
      },
    }
  );
}

/**
 * Handle CORS preflight requests.
 */
function handleCors(): Response {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCors();
    }

    // Only allow GET requests
    if (request.method !== 'GET') {
      return errorResponse('Method not allowed', 405);
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    // Health check endpoint
    if (pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (pathname === '/status') {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const rateLimitDay = parseInt(env.RATE_LIMIT_PER_DAY || '50', 10);
      const rateLimitMinute = parseInt(env.RATE_LIMIT_PER_MINUTE || '10', 10);
      const rate = await getRateLimitStatus(env.RATE_LIMITS, ip, rateLimitDay, rateLimitMinute);

      return new Response(
        JSON.stringify({
          status: 'ok',
          mode: 'free',
          now: new Date().toISOString(),
          rate_limit: {
            day: {
              limit: rate.limitDay,
              remaining: rate.remainingDay,
              reset: 'midnight UTC',
            },
            minute: {
              limit: rate.limitMinute,
              remaining: rate.remainingMinute,
            },
          },
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // Validate endpoint
    if (!isAllowedEndpoint(pathname)) {
      return errorResponse('Endpoint not allowed', 403);
    }

    const endpoint = getEndpoint(pathname);
    if (!endpoint) {
      return errorResponse('Endpoint not allowed', 403);
    }

    const allowedLeagues = parseAllowedLeagues(env);
    const validation = validateQuery(endpoint, url.searchParams, allowedLeagues);
    if (!validation.ok) {
      return errorResponse(validation.message, validation.status);
    }

    // Get client IP
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    // Edge cache: serve cached responses without consuming quota.
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: 'GET' });
    const cached = await cache.match(cacheKey);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set('X-Cache', 'HIT');
      headers.set('X-Proxy', 'rugbyclaw');
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(cached.body, { status: cached.status, headers });
    }

    // Check rate limit (cache miss only)
    const rateLimitDay = parseInt(env.RATE_LIMIT_PER_DAY || '50', 10);
    const rateLimitMinute = parseInt(env.RATE_LIMIT_PER_MINUTE || '10', 10);
    const rate = await checkRateLimit(env.RATE_LIMITS, ip, rateLimitDay, rateLimitMinute);

    if (!rate.allowed) {
      return errorResponse(
        'Rate limit exceeded. Run "rugbyclaw config" to add your own API key for unlimited access.',
        429,
        {
          'X-RateLimit-Limit-Day': rate.limitDay.toString(),
          'X-RateLimit-Remaining-Day': rate.remainingDay.toString(),
          'X-RateLimit-Limit-Minute': rate.limitMinute.toString(),
          'X-RateLimit-Remaining-Minute': rate.remainingMinute.toString(),
          'X-RateLimit-Reset': 'midnight UTC',
        }
      );
    }

    // Build API-Sports request
    const apiUrl = new URL(pathname, API_SPORTS_BASE);

    // Forward allowed query parameters
    for (const [key, value] of url.searchParams) {
      apiUrl.searchParams.set(key, value);
    }

    try {
      // Call API-Sports
      const apiResponse = await fetch(apiUrl.toString(), {
        headers: {
          'x-apisports-key': env.API_SPORTS_KEY,
        },
      });

      // Get response body
      const body = await apiResponse.text();

      // Return proxied response with rate limit headers
      const response = new Response(body, {
        status: apiResponse.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': `public, max-age=${validation.cacheTtlSeconds}`,
          'X-RateLimit-Limit-Day': rate.limitDay.toString(),
          'X-RateLimit-Remaining-Day': rate.remainingDay.toString(),
          'X-RateLimit-Limit-Minute': rate.limitMinute.toString(),
          'X-RateLimit-Remaining-Minute': rate.remainingMinute.toString(),
          'X-Proxy': 'rugbyclaw',
          'X-Cache': 'MISS',
        },
      });

      // Cache successful responses.
      if (apiResponse.ok) {
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }

      return response;
    } catch (error) {
      console.error('API-Sports request failed:', error);
      return errorResponse('Upstream API error', 502);
    }
  },
};
