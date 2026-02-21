import type { Provider, CacheOptions } from './types.js';
import { ProviderError, CACHE_PROFILES } from './types.js';
import type { Match, Team, MatchStatus, RateLimitInfo } from '../../types/index.js';
import { getLeagueById } from '../leagues.js';
import { getCache, cacheKey } from '../cache.js';
import { loadKickoffOverrides } from '../kickoff-overrides.js';
import { randomUUID } from 'node:crypto';
import { resolveOfficialKickoffFallbacks } from './top14-fallback.js';

export const API_SPORTS_BASE_URL = 'https://v1.rugby.api-sports.io';
const DEFAULT_PROXY_URL = 'https://rugbyclaw-proxy.pocarles.workers.dev';
export const PROXY_URL = process.env.RUGBYCLAW_PROXY_URL || DEFAULT_PROXY_URL;

export interface ProxyStatus {
  status: string;
  mode?: string;
  now?: string;
  trace_id?: string;
  rate_limit?: RateLimitInfo;
}

export interface ProviderRuntimeMeta {
  traceId: string | null;
  traceIds: string[];
  staleFallback: boolean;
  cachedAt: string | null;
  staleFallbackCount: number;
}

export async function fetchProxyStatus(): Promise<ProxyStatus | null> {
  try {
    const res = await fetch(`${PROXY_URL}/status`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as ProxyStatus;
  } catch {
    return null;
  }
}

export type ProviderMode = 'direct' | 'proxy';

/**
 * API-Sports response wrapper
 */
interface ApiResponse<T> {
  get: string;
  parameters: Record<string, string>;
  errors: Record<string, string> | string[];
  results: number;
  response: T;
}

/**
 * API-Sports game response
 */
interface ApiGame {
  id: number;
  date: string;
  time: string;
  timestamp: number;
  timezone: string;
  week: string;
  status: {
    long: string;
    short: string;
  };
  country: {
    id: number;
    name: string;
    code: string;
    flag: string;
  };
  league: {
    id: number;
    name: string;
    type: string;
    logo: string;
    season: number;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
    };
    away: {
      id: number;
      name: string;
      logo: string;
    };
  };
  scores: {
    home: number | null;
    away: number | null;
  };
  periods?: {
    first?: { home: number | null; away: number | null };
    second?: { home: number | null; away: number | null };
  };
}

/**
 * API-Sports team response
 */
interface ApiTeam {
  id: number;
  name: string;
  logo: string;
  national: boolean;
  founded: number | null;
  arena: {
    name: string | null;
    capacity: number | null;
    location: string | null;
  };
  country: {
    id: number;
    name: string;
    code: string;
    flag: string;
  };
}

const TOP14_LEAGUE_ID = '16';
const PRO_D2_LEAGUE_ID = '17';
const URC_LEAGUE_ID = '76';
const LNR_LEAGUE_IDS = new Set([TOP14_LEAGUE_ID, PRO_D2_LEAGUE_ID]);
const INCROWD_FALLBACK_LEAGUE_IDS = new Set(['13', '51', '71', '54', '52']);
const KICKOFF_FALLBACK_LEAGUE_IDS = new Set([
  ...LNR_LEAGUE_IDS,
  URC_LEAGUE_ID,
  ...INCROWD_FALLBACK_LEAGUE_IDS,
]);
const LNR_PLACEHOLDER_UTC_TIMES = new Set(['11:00', '13:00', '15:00', '17:00', '19:00', '21:00']);
const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 500, 502, 503, 504]);
const RETRY_MAX_ATTEMPTS = 3;

export function isLikelyTop14PlaceholderKickoff(game: ApiGame, nowMs = Date.now()): boolean {
  if (!LNR_LEAGUE_IDS.has(String(game.league.id))) return false;
  if (!game.time || !game.timezone) return false;
  if (game.timezone.toUpperCase() !== 'UTC') return false;
  if (!/^\d{2}:\d{2}$/.test(game.time)) return false;
  const [hoursStr, minutesStr] = game.time.split(':');
  const hours = Number(hoursStr);
  if (!Number.isFinite(hours)) return false;
  if (minutesStr !== '00') return false;

  if (LNR_PLACEHOLDER_UTC_TIMES.has(game.time)) return true;

  const kickoffMs = game.timestamp * 1000;
  const hoursAhead = (kickoffMs - nowMs) / (60 * 60 * 1000);
  if (hoursAhead > 24) return true;

  return false;
}

/**
 * Map API-Sports status codes to RugbyClaw status
 */
function mapStatus(status: { short: string; long: string }): MatchStatus {
  const code = status.short.toUpperCase();

  // Not started
  if (code === 'NS' || code === 'TBD') {
    return 'scheduled';
  }

  // Live
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT'].includes(code)) {
    return 'live';
  }

  // Finished
  if (['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(code)) {
    return 'finished';
  }

  // Postponed
  if (['PST', 'POST', 'SUSP'].includes(code)) {
    return 'postponed';
  }

  // Cancelled
  if (['CANC', 'ABD'].includes(code)) {
    return 'cancelled';
  }

  // Default based on long status
  const longLower = status.long.toLowerCase();
  if (longLower.includes('finish')) return 'finished';
  if (longLower.includes('live') || longLower.includes('half')) return 'live';
  if (longLower.includes('postpon')) return 'postponed';
  if (longLower.includes('cancel')) return 'cancelled';

  return 'scheduled';
}

/**
 * Get current season year for a league
 * Different competitions use different season conventions:
 * - Domestic leagues (Top 14, Premiership): Aug-June, use previous year
 * - International cups (Six Nations): Jan-Mar, use current year
 * - European cups: Oct-May, use previous year
 */
function getCurrentSeason(leagueId?: string): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();

  // International tournaments and southern hemisphere leagues use calendar year
  const calendarYearLeagues = ['51', '71']; // Six Nations, Super Rugby
  if (leagueId && calendarYearLeagues.includes(leagueId)) {
    return year;
  }

  // Domestic leagues and European cups use season year
  // If we're in Jan-July, use previous year as season start
  // If we're in Aug-Dec, use current year
  if (month < 7) { // Jan-July
    return year - 1;
  }
  return year;
}

/**
 * API-Sports provider implementation.
 *
 * Supports two modes:
 * - 'direct': Uses user's API key directly with API-Sports
 * - 'proxy': Uses the Rugbyclaw proxy (no API key required, rate limited)
 *
 * Docs: https://api-sports.io/documentation/rugby/v1
 *
 * Pro tier: 7,500 requests/day, 300 requests/min
 */
export class ApiSportsProvider implements Provider {
  readonly name = 'API-Sports';
  private apiKey: string | null;
  private mode: ProviderMode;
  private cache = getCache();
  private kickoffOverrides = loadKickoffOverrides();
  private traceIds: string[] = [];
  private staleFallbackTimestamps: number[] = [];

  constructor(apiKey?: string) {
    this.apiKey = apiKey || null;
    this.mode = apiKey ? 'direct' : 'proxy';
  }

  /**
   * Check if using proxy mode (no user API key).
   */
  isProxyMode(): boolean {
    return this.mode === 'proxy';
  }

  private recordTrace(traceId: string | null | undefined): void {
    if (!traceId) return;
    if (!this.traceIds.includes(traceId)) {
      this.traceIds.push(traceId);
    }
  }

  private markStaleFallback(cachedAt: number): void {
    this.staleFallbackTimestamps.push(cachedAt);
  }

  private resolveResponseTraceId(response: Response, fallbackTraceId: string): string {
    return response.headers.get('x-request-id')
      || response.headers.get('x-rugbyclaw-trace-id')
      || response.headers.get('cf-ray')
      || fallbackTraceId;
  }

  private isRetryableNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    if (message.includes('aborted') || message.includes('timeout')) return true;
    if (message.includes('fetch failed')) return true;
    if (message.includes('network')) return true;
    if (message.includes('socket')) return true;
    if (message.includes('econnreset') || message.includes('enotfound') || message.includes('eai_again')) {
      return true;
    }
    return error.name === 'TypeError';
  }

  private async waitForRetry(attempt: number): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    const baseDelay = 150 * Math.pow(2, attempt - 1);
    const jitter = Math.floor(Math.random() * 120);
    const delayMs = Math.min(1000, baseDelay + jitter);
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), delayMs);
    });
  }

  private async fetchWithRetry(url: string, headers: Record<string, string>): Promise<Response> {
    let lastNetworkError: unknown;

    for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(url, { headers });

        const shouldRetryStatus = RETRYABLE_HTTP_STATUSES.has(response.status);
        if (shouldRetryStatus && attempt < RETRY_MAX_ATTEMPTS) {
          await this.waitForRetry(attempt);
          continue;
        }

        return response;
      } catch (error) {
        lastNetworkError = error;
        const shouldRetryNetworkError = this.isRetryableNetworkError(error);
        if (!shouldRetryNetworkError || attempt >= RETRY_MAX_ATTEMPTS) {
          throw error;
        }
        await this.waitForRetry(attempt);
      }
    }

    throw (lastNetworkError instanceof Error ? lastNetworkError : new Error('fetch failed'));
  }

  consumeRuntimeMeta(): ProviderRuntimeMeta {
    const traceIds = [...this.traceIds];
    const latestTraceId = traceIds.length > 0 ? traceIds[traceIds.length - 1] : null;
    const staleFallbackCount = this.staleFallbackTimestamps.length;
    const cachedAtMs = this.staleFallbackTimestamps.length > 0
      ? Math.max(...this.staleFallbackTimestamps)
      : null;

    this.traceIds = [];
    this.staleFallbackTimestamps = [];

    return {
      traceId: latestTraceId,
      traceIds,
      staleFallback: cachedAtMs !== null,
      cachedAt: cachedAtMs !== null ? new Date(cachedAtMs).toISOString() : null,
      staleFallbackCount,
    };
  }

  private async fetch<T>(endpoint: string, params: Record<string, string>, cacheOptions: CacheOptions): Promise<T> {
    const searchParams = new URLSearchParams(params);
    const baseUrl = this.mode === 'proxy' ? PROXY_URL : API_SPORTS_BASE_URL;
    const url = `${baseUrl}/${endpoint}?${searchParams}`;
    const key = cacheKey(endpoint, params);
    const clientTraceId = randomUUID();

    // Check cache first
    const cached = await this.cache.get<ApiResponse<T>>(key);
    if (cached && !cached.stale) {
      return cached.data.response;
    }

    // Fetch fresh data
    try {
      const headers: Record<string, string> = {};
      headers['x-rugbyclaw-trace-id'] = clientTraceId;
      if (this.mode === 'direct' && this.apiKey) {
        headers['x-apisports-key'] = this.apiKey;
      }

      const response = await this.fetchWithRetry(url, headers);
      const traceId = this.resolveResponseTraceId(response, clientTraceId);
      this.recordTrace(traceId);

      if (response.status === 429) {
        // Return stale data if available on rate limit
        if (cached) {
          this.markStaleFallback(cached.cachedAt);
          return cached.data.response;
        }

        // Different message for proxy vs direct mode
        const message = this.mode === 'proxy'
          ? 'Daily limit reached. Run "rugbyclaw config" to add your own API key for unlimited access.'
          : 'Rate limit exceeded. Try again later.';

        throw new ProviderError(message, 'RATE_LIMITED', this.name, undefined, traceId);
      }

      if (response.status === 401 || response.status === 403) {
        throw new ProviderError(
          'Invalid API key. Check your configuration.',
          'UNAUTHORIZED',
          this.name,
          undefined,
          traceId
        );
      }

      if (!response.ok) {
        throw new ProviderError(
          `API returned ${response.status}`,
          'UNKNOWN',
          this.name,
          undefined,
          traceId
        );
      }

      const data = await response.json() as ApiResponse<T>;

      // Check for API errors
      if (data.errors && Object.keys(data.errors).length > 0) {
        const errorMsg = Array.isArray(data.errors)
          ? data.errors.join(', ')
          : Object.values(data.errors).join(', ');
        throw new ProviderError(
          `API error: ${errorMsg}`,
          'UNKNOWN',
          this.name,
          undefined,
          traceId
        );
      }

      // Cache the result
      await this.cache.set(key, data, cacheOptions);

      return data.response;
    } catch (error) {
      this.recordTrace(clientTraceId);
      // If we have stale data, return it on network error
      if (cached) {
        this.markStaleFallback(cached.cachedAt);
        return cached.data.response;
      }

      if (error instanceof ProviderError) {
        throw error;
      }

      const message = this.mode === 'proxy'
        ? 'Free mode is temporarily unavailable. Try again later, or run "rugbyclaw config" to add your own API key.'
        : 'Failed to fetch data. Check your internet connection.';

      throw new ProviderError(
        message,
        'NETWORK_ERROR',
        this.name,
        error instanceof Error ? error : undefined,
        clientTraceId
      );
    }
  }

  private async resolveKickoffFallbackOverrides(games: ApiGame[]): Promise<Map<string, number>> {
    const candidates = games.filter((game) => (
      mapStatus(game.status) === 'scheduled'
      && KICKOFF_FALLBACK_LEAGUE_IDS.has(String(game.league.id))
    ));

    if (candidates.length === 0) return new Map();

    return resolveOfficialKickoffFallbacks(candidates);
  }

  private parseGame(game: ApiGame, runtimeKickoff?: number): Match {
    const league = getLeagueById(String(game.league.id)) || {
      id: String(game.league.id),
      slug: game.league.name.toLowerCase().replace(/\s+/g, '_'),
      name: game.league.name,
      country: game.country.name,
      sport: 'rugby' as const,
    };

    const status = mapStatus(game.status);
    const override = this.kickoffOverrides.get(String(game.id));
    const hasRuntimeKickoff = Number.isFinite(runtimeKickoff);
    const timestamp = override
      ? override.kickoffMs
      : hasRuntimeKickoff
        ? Number(runtimeKickoff)
        : game.timestamp * 1000;
    const date = new Date(timestamp);
    const timeTbd = !override && !hasRuntimeKickoff && status === 'scheduled' && isLikelyTop14PlaceholderKickoff(game);

    return {
      id: String(game.id),
      homeTeam: {
        id: String(game.teams.home.id),
        name: game.teams.home.name,
        badge: game.teams.home.logo,
      },
      awayTeam: {
        id: String(game.teams.away.id),
        name: game.teams.away.name,
        badge: game.teams.away.logo,
      },
      league,
      date,
      status,
      score: game.scores.home !== null && game.scores.away !== null
        ? { home: game.scores.home, away: game.scores.away }
        : undefined,
      round: game.week || undefined,
      timestamp, // ms
      timeTbd,
      timeSource: override || hasRuntimeKickoff ? 'secondary' : 'provider',
    };
  }

  async searchTeams(query: string): Promise<Team[]> {
    const teams = await this.fetch<ApiTeam[]>(
      'teams',
      { search: query },
      CACHE_PROFILES.search
    );

    return teams.map((t) => ({
      id: String(t.id),
      name: t.name,
      badge: t.logo,
      country: t.country.name,
    }));
  }

  async getLeagueFixtures(leagueId: string, _days?: number): Promise<Match[]> {
    const season = getCurrentSeason(leagueId);
    const games = await this.fetch<ApiGame[]>(
      'games',
      { league: leagueId, season: String(season) },
      CACHE_PROFILES.standard
    );
    const fallbackOverrides = await this.resolveKickoffFallbackOverrides(games);

    const now = Date.now();

    return games
      .map((g) => this.parseGame(g, fallbackOverrides.get(String(g.id))))
      .filter((m) => m.status === 'scheduled' && m.timestamp > now)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async getLeagueResults(leagueId: string, _days?: number): Promise<Match[]> {
    const season = getCurrentSeason(leagueId);
    const games = await this.fetch<ApiGame[]>(
      'games',
      { league: leagueId, season: String(season) },
      CACHE_PROFILES.standard
    );

    // Filter to finished matches and sort by date descending (most recent first)
    return games
      .map((g) => this.parseGame(g))
      .filter((m) => m.status === 'finished')
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  async getMatch(matchId: string): Promise<Match | null> {
    const games = await this.fetch<ApiGame[]>(
      'games',
      { id: matchId },
      CACHE_PROFILES.live
    );

    if (!games || games.length === 0) {
      return null;
    }

    const fallbackOverrides = await this.resolveKickoffFallbackOverrides(games);
    return this.parseGame(games[0], fallbackOverrides.get(String(games[0].id)));
  }

  async getToday(leagueIds: string[], options?: { dateYmd?: string }): Promise<Match[]> {
    const dateStr = options?.dateYmd || new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const matchMap = new Map<string, Match>();

    // Fetch games for today across all favorite leagues
    // API-Sports allows filtering by date
    for (const leagueId of leagueIds) {
      try {
        const games = await this.fetch<ApiGame[]>(
          'games',
          { league: leagueId, date: dateStr },
          CACHE_PROFILES.live
        );
        const fallbackOverrides = await this.resolveKickoffFallbackOverrides(games);

        for (const game of games) {
          const match = this.parseGame(game, fallbackOverrides.get(String(game.id)));
          if (!matchMap.has(match.id)) {
            matchMap.set(match.id, match);
          }
        }
      } catch {
        // Skip leagues that fail
      }
    }

    // Sort by time
    return Array.from(matchMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get live matches (for real-time score updates)
   */
  async getLive(leagueIds: string[]): Promise<Match[]> {
    const matchMap = new Map<string, Match>();

    for (const leagueId of leagueIds) {
      try {
        const season = getCurrentSeason(leagueId);
        const games = await this.fetch<ApiGame[]>(
          'games',
          { league: leagueId, season: String(season) },
          CACHE_PROFILES.live
        );

        for (const game of games) {
          const match = this.parseGame(game);
          if (match.status === 'live' && !matchMap.has(match.id)) {
            matchMap.set(match.id, match);
          }
        }
      } catch {
        // Skip leagues that fail
      }
    }

    return Array.from(matchMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get all teams in a league for the current season
   */
  async getLeagueTeams(leagueId: string): Promise<Team[]> {
    const season = getCurrentSeason(leagueId);
    const teams = await this.fetch<ApiTeam[]>(
      'teams',
      { league: leagueId, season: String(season) },
      CACHE_PROFILES.long
    );

    return teams.map((t) => ({
      id: String(t.id),
      name: t.name,
      badge: t.logo,
      country: t.country.name,
    }));
  }
}
