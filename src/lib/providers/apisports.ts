import type { Provider, CacheOptions } from './types.js';
import { ProviderError, CACHE_PROFILES } from './types.js';
import type { Match, Team, MatchStatus } from '../../types/index.js';
import { getLeagueById } from '../leagues.js';
import { getCache, cacheKey } from '../cache.js';

const BASE_URL = 'https://v1.rugby.api-sports.io';
const DEFAULT_PROXY_URL = 'https://rugbyclaw-proxy.pocarles.workers.dev';
const PROXY_URL = process.env.RUGBYCLAW_PROXY_URL || DEFAULT_PROXY_URL;

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
const TOP14_PLACEHOLDER_UTC_TIMES = new Set(['11:00', '13:00', '15:00', '17:00', '19:00', '21:00']);

function isTop14PlaceholderTime(game: ApiGame): boolean {
  if (String(game.league.id) !== TOP14_LEAGUE_ID) return false;
  if (!game.time || !game.timezone) return false;
  if (game.timezone.toUpperCase() !== 'UTC') return false;
  if (!game.time.endsWith(':00')) return false;
  return TOP14_PLACEHOLDER_UTC_TIMES.has(game.time);
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

	  private async fetch<T>(endpoint: string, params: Record<string, string>, cacheOptions: CacheOptions): Promise<T> {
    const searchParams = new URLSearchParams(params);
    const baseUrl = this.mode === 'proxy' ? PROXY_URL : BASE_URL;
    const url = `${baseUrl}/${endpoint}?${searchParams}`;
    const key = cacheKey(endpoint, params);

    // Check cache first
    const cached = await this.cache.get<ApiResponse<T>>(key);
    if (cached && !cached.stale) {
      return cached.data.response;
    }

    // Fetch fresh data
    try {
      const headers: Record<string, string> = {};
      if (this.mode === 'direct' && this.apiKey) {
        headers['x-apisports-key'] = this.apiKey;
      }

      const response = await fetch(url, { headers });

      if (response.status === 429) {
        // Return stale data if available on rate limit
        if (cached) {
          return cached.data.response;
        }

        // Different message for proxy vs direct mode
        const message = this.mode === 'proxy'
          ? 'Daily limit reached. Run "rugbyclaw config" to add your own API key for unlimited access.'
          : 'Rate limit exceeded. Try again later.';

        throw new ProviderError(message, 'RATE_LIMITED', this.name);
      }

      if (response.status === 401 || response.status === 403) {
        throw new ProviderError(
          'Invalid API key. Check your configuration.',
          'UNAUTHORIZED',
          this.name
        );
      }

      if (!response.ok) {
        throw new ProviderError(
          `API returned ${response.status}`,
          'UNKNOWN',
          this.name
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
          this.name
        );
      }

      // Cache the result
      await this.cache.set(key, data, cacheOptions);

      return data.response;
	    } catch (error) {
      // If we have stale data, return it on network error
      if (cached) {
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
	        error instanceof Error ? error : undefined
	      );
	    }
	  }

	  private parseGame(game: ApiGame): Match {
    const league = getLeagueById(String(game.league.id)) || {
      id: String(game.league.id),
      slug: game.league.name.toLowerCase().replace(/\s+/g, '_'),
      name: game.league.name,
      country: game.country.name,
      sport: 'rugby' as const,
    };

	    // Prefer the server-provided UNIX timestamp for accurate time + timezone handling.
	    const date = new Date(game.timestamp * 1000);
	    const status = mapStatus(game.status);
	    const timeTbd = status === 'scheduled' && isTop14PlaceholderTime(game);

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
	      timestamp: game.timestamp * 1000, // Convert to ms
	      timeTbd,
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

    const now = Date.now();

    // Filter to upcoming matches only and sort by date
    return games
      .map((g) => this.parseGame(g))
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

    return this.parseGame(games[0]);
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

        for (const game of games) {
          const match = this.parseGame(game);
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
