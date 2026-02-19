import type { Match, Team } from '../../types/index.js';

/**
 * Provider interface for rugby data sources.
 *
 * Implementations should:
 * - Handle rate limiting internally
 * - Normalize responses to Match/Team types
 * - Throw ProviderError for API failures
 */
export interface Provider {
  readonly name: string;

  /**
   * Search for teams by name.
   */
  searchTeams(query: string): Promise<Team[]>;

  /**
   * Get upcoming fixtures for a league.
   * @param leagueId - The league ID
   * @param days - Number of days ahead to fetch (default: 14)
   */
  getLeagueFixtures(leagueId: string, days?: number): Promise<Match[]>;

  /**
   * Get recent results for a league.
   * @param leagueId - The league ID
   * @param days - Number of days back to fetch (default: 14)
   */
  getLeagueResults(leagueId: string, days?: number): Promise<Match[]>;

  /**
   * Get a specific match by ID.
   */
  getMatch(matchId: string): Promise<Match | null>;

  /**
   * Get today's matches across multiple leagues.
   * Useful for "scores" command.
   */
  getToday(leagueIds: string[], options?: { dateYmd?: string }): Promise<Match[]>;

  /**
   * Get live matches (if API supports it).
   * Returns empty array if not supported.
   */
  getLive?(leagueIds: string[]): Promise<Match[]>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly code: ProviderErrorCode,
    public readonly provider: string,
    public readonly cause?: Error,
    public readonly traceId?: string
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export type ProviderErrorCode =
  | 'RATE_LIMITED'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'PARSE_ERROR'
  | 'UNKNOWN';

/**
 * Cache entry for provider responses.
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  stale_at: number;
  expires_at: number;
}

/**
 * Cache options for different request types.
 */
export interface CacheOptions {
  /** Time in ms before data is considered stale (SWR window opens) */
  stale_after: number;
  /** Time in ms before data expires completely */
  expires_after: number;
}

export const CACHE_PROFILES = {
  /** For fixtures/results: stale after 5min, expires after 15min */
  standard: { stale_after: 5 * 60 * 1000, expires_after: 15 * 60 * 1000 },
  /** For live scores: stale after 30s, expires after 60s */
  live: { stale_after: 30 * 1000, expires_after: 60 * 1000 },
  /** For team search: stale after 1hr, expires after 24hr */
  search: { stale_after: 60 * 60 * 1000, expires_after: 24 * 60 * 60 * 1000 },
  /** For static data (league teams): stale after 24hr, expires after 7 days */
  long: { stale_after: 24 * 60 * 60 * 1000, expires_after: 7 * 24 * 60 * 60 * 1000 },
} as const;
