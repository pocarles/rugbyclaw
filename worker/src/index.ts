/**
 * Rugbyclaw Proxy Worker
 *
 * Proxies requests to API-Sports Rugby API with rate limiting.
 * Allows users to try Rugbyclaw without their own API key.
 */

import { getAllowedEndpoint, isAllowedEndpoint, type AllowedEndpoint } from './allowlist';

interface Env {
  API_SPORTS_KEY: string;
  RATE_LIMIT_PER_DAY: string;
  RATE_LIMIT_PER_MINUTE: string;
  DEFAULT_LEAGUES: string;
  RATE_LIMITS: KVNamespace;
}

const API_SPORTS_BASE = 'https://v1.rugby.api-sports.io';
const MAX_URL_LENGTH = 2048;
const MAX_QUERY_LENGTH = 1024;
const MAX_QUERY_PARAMS = 8;
const MAX_ID_LENGTH = 12;
const MIN_SEASON = 2000;
const USER_AGENT_MAX_LENGTH = 256;
const ENDPOINT_BURST_LIMITS: Record<AllowedEndpoint, number> = {
  '/games': 8,
  '/teams': 6,
  '/leagues': 12,
};
const BLOCKED_USER_AGENT_PATTERNS = [
  /sqlmap/i,
  /nikto/i,
  /acunetix/i,
  /nessus/i,
  /nmap/i,
  /masscan/i,
  /zgrab/i,
  /dirbuster/i,
  /wpscan/i,
];

function isPositiveInteger(value: string): boolean {
  return /^\d+$/.test(value);
}

function isValidSeason(value: string): boolean {
  if (!/^\d{4}$/.test(value)) return false;
  const season = Number(value);
  const maxSeason = new Date().getUTCFullYear() + 1;
  return season >= MIN_SEASON && season <= maxSeason;
}

function isValidDateYmd(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map((part) => Number(part));
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

function isValidSearchQuery(value: string): boolean {
  return /^[\p{L}\p{N}\s.'-]+$/u.test(value);
}

function isSafeRequestId(value: string): boolean {
  return /^[a-zA-Z0-9._:-]{8,128}$/.test(value);
}

function getRequestId(request: Request): string {
  const incoming = request.headers.get('x-rugbyclaw-trace-id')?.trim();
  if (incoming && isSafeRequestId(incoming)) return incoming;

  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function jsonHeaders(requestId: string, headers: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'X-Request-Id': requestId,
    ...headers,
  };
}

export function validateUserAgent(userAgent: string | null): { ok: true } | { ok: false; message: string; status: number } {
  if (!userAgent || userAgent.trim().length < 4) {
    return { ok: false, message: 'User-Agent header is required', status: 400 };
  }

  if (userAgent.length > USER_AGENT_MAX_LENGTH) {
    return { ok: false, message: 'User-Agent header too long', status: 400 };
  }

  if (/[\x00-\x1F\x7F]/.test(userAgent)) {
    return { ok: false, message: 'Invalid User-Agent header', status: 400 };
  }

  if (BLOCKED_USER_AGENT_PATTERNS.some((pattern) => pattern.test(userAgent))) {
    return { ok: false, message: 'Client not allowed', status: 403 };
  }

  return { ok: true };
}

export function validateRequestSize(url: URL): { ok: true } | { ok: false; message: string; status: number } {
  if (url.toString().length > MAX_URL_LENGTH) {
    return { ok: false, message: 'URL too long', status: 414 };
  }
  if (url.search.length > MAX_QUERY_LENGTH) {
    return { ok: false, message: 'Query string too long', status: 400 };
  }
  return { ok: true };
}

function parseAllowedLeagues(env: Env): Set<string> {
  return new Set(
    (env.DEFAULT_LEAGUES || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

export function validateQuery(
  endpoint: AllowedEndpoint,
  searchParams: URLSearchParams,
  allowedLeagues: Set<string>
): { ok: true; cacheTtlSeconds: number } | { ok: false; message: string; status: number } {
  const keys = Array.from(searchParams.keys());
  const allowedKeysByEndpoint: Record<AllowedEndpoint, Set<string>> = {
    '/games': new Set(['league', 'season', 'date', 'id']),
    '/teams': new Set(['search', 'league', 'season', 'id']),
    '/leagues': new Set(['id', 'season']),
  };

  if (keys.length > MAX_QUERY_PARAMS) {
    return { ok: false, message: 'Too many query parameters', status: 400 };
  }

  const allowedKeys = allowedKeysByEndpoint[endpoint];
  for (const key of keys) {
    if (!allowedKeys.has(key)) {
      return { ok: false, message: `Query parameter not allowed: ${key}`, status: 400 };
    }
  }

  for (const key of allowedKeys) {
    if (searchParams.getAll(key).length > 1) {
      return { ok: false, message: `Duplicate query parameter not allowed: ${key}`, status: 400 };
    }
  }

  const id = searchParams.get('id');
  if (id && (!isPositiveInteger(id) || id.length > MAX_ID_LENGTH)) {
    return { ok: false, message: 'Invalid id parameter', status: 400 };
  }

  const season = searchParams.get('season');
  if (season && !isValidSeason(season)) {
    return { ok: false, message: 'Invalid season parameter', status: 400 };
  }

  const date = searchParams.get('date');
  if (date && !isValidDateYmd(date)) {
    return { ok: false, message: 'Invalid date parameter (expected YYYY-MM-DD)', status: 400 };
  }

  // Restrict league-scoped access to the default leagues only.
  const league = searchParams.get('league');
  if (league) {
    if (!isPositiveInteger(league) || league.length > MAX_ID_LENGTH) {
      return { ok: false, message: 'Invalid league parameter', status: 400 };
    }
    if (!allowedLeagues.has(league)) {
      return {
        ok: false,
        message: 'League not available in free mode. Run "rugbyclaw config" to add your own API key.',
        status: 403,
      };
    }
  }

  // Limit search size to reduce abuse.
  const search = searchParams.get('search');
  if (search) {
    if (search.length > 64) {
      return { ok: false, message: 'Search query too long', status: 400 };
    }
    if (!isValidSearchQuery(search)) {
      return { ok: false, message: 'Invalid search query', status: 400 };
    }
  }

  // Endpoint-specific query combinations.
  if (endpoint === '/games') {
    const hasId = searchParams.has('id');
    const hasLeague = searchParams.has('league');
    const hasSeason = searchParams.has('season');
    const hasDate = searchParams.has('date');

    if (hasId && (hasLeague || hasSeason || hasDate)) {
      return { ok: false, message: 'For /games with id, no other query parameters are allowed', status: 400 };
    }

    if (!hasId) {
      if (!hasLeague) {
        return { ok: false, message: 'league is required for /games queries', status: 400 };
      }
      if (!hasSeason && !hasDate) {
        return { ok: false, message: 'season or date is required for /games queries', status: 400 };
      }
      if (hasSeason && hasDate) {
        return { ok: false, message: 'Use either season or date for /games queries, not both', status: 400 };
      }
    }
  }

  if (endpoint === '/teams') {
    const hasId = searchParams.has('id');
    const hasSearch = searchParams.has('search');
    const hasLeague = searchParams.has('league');
    const hasSeason = searchParams.has('season');

    if (hasId && (hasSearch || hasLeague || hasSeason)) {
      return { ok: false, message: 'For /teams with id, no other query parameters are allowed', status: 400 };
    }

    if (!hasId) {
      if (hasSearch) {
        if (hasLeague || hasSeason) {
          return { ok: false, message: 'For /teams search, only search is allowed', status: 400 };
        }
      } else if (!hasLeague || !hasSeason) {
        return { ok: false, message: '/teams requires either id, search, or league+season', status: 400 };
      }
    }
  }

  // Restrict leagues endpoint to default leagues only.
  if (endpoint === '/leagues') {
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

function getEndpointMinuteRateLimitKey(
  ip: string,
  endpoint: AllowedEndpoint,
  now: Date = new Date()
): string {
  const minute = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  return `ratelimit:${endpoint}:${ip}:${minute}`;
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
  endpoint: AllowedEndpoint,
  limitPerDay: number,
  limitPerMinute: number,
  limitPerEndpointPerMinute: number
): Promise<
  | {
    allowed: true;
    remainingDay: number;
    remainingMinute: number;
    remainingEndpointMinute: number;
    limitDay: number;
    limitMinute: number;
    limitEndpointMinute: number;
  }
  | {
    allowed: false;
    remainingDay: number;
    remainingMinute: number;
    remainingEndpointMinute: number;
    limitDay: number;
    limitMinute: number;
    limitEndpointMinute: number;
  }
> {
  const key = getRateLimitKey(ip);
  const minuteKey = getMinuteRateLimitKey(ip);
  const endpointMinuteKey = getEndpointMinuteRateLimitKey(ip, endpoint);

  // Get current count
  const [currentDay, currentMinute, currentEndpointMinute] = await Promise.all([
    kv.get(key),
    kv.get(minuteKey),
    kv.get(endpointMinuteKey),
  ]);
  const countDay = currentDay ? parseInt(currentDay, 10) : 0;
  const countMinute = currentMinute ? parseInt(currentMinute, 10) : 0;
  const countEndpointMinute = currentEndpointMinute ? parseInt(currentEndpointMinute, 10) : 0;

  if (
    countDay >= limitPerDay
    || countMinute >= limitPerMinute
    || countEndpointMinute >= limitPerEndpointPerMinute
  ) {
    return {
      allowed: false,
      remainingDay: Math.max(0, limitPerDay - countDay),
      remainingMinute: Math.max(0, limitPerMinute - countMinute),
      remainingEndpointMinute: Math.max(0, limitPerEndpointPerMinute - countEndpointMinute),
      limitDay: limitPerDay,
      limitMinute: limitPerMinute,
      limitEndpointMinute: limitPerEndpointPerMinute,
    };
  }

  const newCountDay = countDay + 1;
  const newCountMinute = countMinute + 1;
  const newCountEndpointMinute = countEndpointMinute + 1;

  // Increment count (expires at midnight UTC + buffer)
  await kv.put(key, newCountDay.toString(), {
    expirationTtl: 86400 + 3600, // 25 hours to handle timezone edge cases
  });

  // Minute burst key
  await kv.put(minuteKey, newCountMinute.toString(), {
    expirationTtl: 120,
  });
  await kv.put(endpointMinuteKey, newCountEndpointMinute.toString(), {
    expirationTtl: 120,
  });

  return {
    allowed: true,
    remainingDay: limitPerDay - newCountDay,
    remainingMinute: limitPerMinute - newCountMinute,
    remainingEndpointMinute: limitPerEndpointPerMinute - newCountEndpointMinute,
    limitDay: limitPerDay,
    limitMinute: limitPerMinute,
    limitEndpointMinute: limitPerEndpointPerMinute,
  };
}

/**
 * Create a JSON error response.
 */
function errorResponse(message: string, status: number, headers: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers,
    }
  );
}

/**
 * Handle CORS preflight requests.
 */
function handleCors(requestId: string): Response {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Rugbyclaw-Trace-Id',
      'Access-Control-Max-Age': '86400',
      'X-Request-Id': requestId,
    },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestId = getRequestId(request);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCors(requestId);
    }

    // Only allow GET requests
    if (request.method !== 'GET') {
      return errorResponse('Method not allowed', 405, jsonHeaders(requestId));
    }

    const url = new URL(request.url);
    const sizeValidation = validateRequestSize(url);
    if (!sizeValidation.ok) {
      return errorResponse(sizeValidation.message, sizeValidation.status, jsonHeaders(requestId));
    }
    const pathname = url.pathname;

    // Health check endpoint
    if (pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: jsonHeaders(requestId),
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
          trace_id: requestId,
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
            endpoint_minute_limits: ENDPOINT_BURST_LIMITS,
          },
        }),
        {
          headers: jsonHeaders(requestId, {
            'Cache-Control': 'no-store',
          }),
        }
      );
    }

    // Validate endpoint
    if (!isAllowedEndpoint(pathname)) {
      return errorResponse('Endpoint not allowed', 403, jsonHeaders(requestId));
    }

    const endpoint = getAllowedEndpoint(pathname);
    if (!endpoint) {
      return errorResponse('Endpoint not allowed', 403, jsonHeaders(requestId));
    }

    const userAgentValidation = validateUserAgent(request.headers.get('User-Agent'));
    if (!userAgentValidation.ok) {
      return errorResponse(
        userAgentValidation.message,
        userAgentValidation.status,
        jsonHeaders(requestId)
      );
    }

    const allowedLeagues = parseAllowedLeagues(env);
    const validation = validateQuery(endpoint, url.searchParams, allowedLeagues);
    if (!validation.ok) {
      return errorResponse(validation.message, validation.status, jsonHeaders(requestId));
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
      headers.set('X-Request-Id', requestId);
      return new Response(cached.body, { status: cached.status, headers });
    }

    // Check rate limit (cache miss only)
    const rateLimitDay = parseInt(env.RATE_LIMIT_PER_DAY || '50', 10);
    const rateLimitMinute = parseInt(env.RATE_LIMIT_PER_MINUTE || '10', 10);
    const endpointBurstLimit = ENDPOINT_BURST_LIMITS[endpoint] ?? rateLimitMinute;
    const rate = await checkRateLimit(
      env.RATE_LIMITS,
      ip,
      endpoint,
      rateLimitDay,
      rateLimitMinute,
      endpointBurstLimit
    );

    if (!rate.allowed) {
      return errorResponse(
        'Rate limit exceeded. Run "rugbyclaw config" to add your own API key for unlimited access.',
        429,
        jsonHeaders(requestId, {
          'X-RateLimit-Limit-Day': rate.limitDay.toString(),
          'X-RateLimit-Remaining-Day': rate.remainingDay.toString(),
          'X-RateLimit-Limit-Minute': rate.limitMinute.toString(),
          'X-RateLimit-Remaining-Minute': rate.remainingMinute.toString(),
          'X-RateLimit-Limit-Endpoint-Minute': rate.limitEndpointMinute.toString(),
          'X-RateLimit-Remaining-Endpoint-Minute': rate.remainingEndpointMinute.toString(),
          'X-RateLimit-Reset': 'midnight UTC',
        })
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
        headers: jsonHeaders(requestId, {
          'Cache-Control': `public, max-age=${validation.cacheTtlSeconds}`,
          'X-RateLimit-Limit-Day': rate.limitDay.toString(),
          'X-RateLimit-Remaining-Day': rate.remainingDay.toString(),
          'X-RateLimit-Limit-Minute': rate.limitMinute.toString(),
          'X-RateLimit-Remaining-Minute': rate.remainingMinute.toString(),
          'X-RateLimit-Limit-Endpoint-Minute': rate.limitEndpointMinute.toString(),
          'X-RateLimit-Remaining-Endpoint-Minute': rate.remainingEndpointMinute.toString(),
          'X-Proxy': 'rugbyclaw',
          'X-Cache': 'MISS',
          'X-Upstream-Request-Id': apiResponse.headers.get('x-request-id') || '',
        }),
      });

      // Cache successful responses.
      if (apiResponse.ok) {
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }

      return response;
    } catch (error) {
      console.error('API-Sports request failed:', error);
      return errorResponse('Upstream API error', 502, jsonHeaders(requestId));
    }
  },
};
