import type { Provider, CacheOptions } from './types.js';
import { ProviderError, CACHE_PROFILES } from './types.js';
import type { Match, Team } from '../../types/index.js';
import { getLeagueById } from '../leagues.js';
import { getCache, cacheKey } from '../cache.js';

const BASE_URL = 'https://www.thesportsdb.com/api/v1/json';

interface TheSportsDBTeam {
  idTeam: string;
  strTeam: string;
  strTeamShort?: string;
  strTeamBadge?: string;
  strCountry?: string;
  strLeague?: string;
  idLeague?: string;
}

interface TheSportsDBEvent {
  idEvent: string;
  strEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  idHomeTeam: string;
  idAwayTeam: string;
  intHomeScore?: string;
  intAwayScore?: string;
  strStatus?: string;
  dateEvent: string;
  strTime?: string;
  strTimestamp?: string;
  strVenue?: string;
  intRound?: string;
  idLeague: string;
  strLeague: string;
  strHomeTeamBadge?: string;
  strAwayTeamBadge?: string;
}

/**
 * TheSportsDB provider implementation.
 *
 * API docs: https://www.thesportsdb.com/api.php
 *
 * Free tier limitations:
 * - 30 requests/min
 * - Team next/last only returns HOME matches
 * - No live scores
 */
export class TheSportsDBProvider implements Provider {
  readonly name = 'TheSportsDB';
  private apiKey: string;
  private cache = getCache();

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async fetch<T>(endpoint: string, cacheOptions: CacheOptions): Promise<T> {
    const url = `${BASE_URL}/${this.apiKey}/${endpoint}`;
    const key = cacheKey(endpoint, { apiKey: this.apiKey });

    // Check cache first
    const cached = await this.cache.get<T>(key);
    if (cached && !cached.stale) {
      return cached.data;
    }

    // Fetch fresh data
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        throw new ProviderError(
          'Rate limit exceeded. Try again in a minute.',
          'RATE_LIMITED',
          this.name
        );
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

      const data = await response.json() as T;

      // Cache the result
      await this.cache.set(key, data, cacheOptions);

      return data;
    } catch (error) {
      // If we have stale data, return it on network error
      if (cached) {
        return cached.data;
      }

      if (error instanceof ProviderError) {
        throw error;
      }

      throw new ProviderError(
        'Failed to fetch data. Check your internet connection.',
        'NETWORK_ERROR',
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  private parseEvent(event: TheSportsDBEvent): Match {
    const league = getLeagueById(event.idLeague);

    // Parse date and time
    let date: Date;
    if (event.strTimestamp) {
      date = new Date(event.strTimestamp);
    } else {
      const timeStr = event.strTime || '00:00:00';
      date = new Date(`${event.dateEvent}T${timeStr}Z`);
    }

    // Determine status
    let status: Match['status'] = 'scheduled';
    const eventStatus = event.strStatus?.toLowerCase() || '';

    if (eventStatus.includes('ft') || eventStatus.includes('aet') || eventStatus.includes('finished')) {
      status = 'finished';
    } else if (eventStatus.includes('live') || eventStatus.includes('1h') || eventStatus.includes('2h') || eventStatus.includes('ht')) {
      status = 'live';
    } else if (eventStatus.includes('postponed') || eventStatus.includes('pst')) {
      status = 'postponed';
    } else if (eventStatus.includes('cancelled') || eventStatus.includes('canc')) {
      status = 'cancelled';
    } else if (event.intHomeScore !== null && event.intHomeScore !== undefined && event.intHomeScore !== '') {
      // Has score, likely finished
      status = 'finished';
    }

    return {
      id: event.idEvent,
      homeTeam: {
        id: event.idHomeTeam,
        name: event.strHomeTeam,
        badge: event.strHomeTeamBadge,
      },
      awayTeam: {
        id: event.idAwayTeam,
        name: event.strAwayTeam,
        badge: event.strAwayTeamBadge,
      },
      league: league || {
        id: event.idLeague,
        slug: event.idLeague,
        name: event.strLeague,
        country: 'Unknown',
        sport: 'rugby',
      },
      date,
      venue: event.strVenue,
      status,
      score:
        event.intHomeScore !== null &&
        event.intHomeScore !== undefined &&
        event.intHomeScore !== ''
          ? {
              home: parseInt(event.intHomeScore, 10),
              away: parseInt(event.intAwayScore || '0', 10),
            }
          : undefined,
      round: event.intRound,
      timestamp: date.getTime(),
    };
  }

  async searchTeams(query: string): Promise<Team[]> {
    const endpoint = `searchteams.php?t=${encodeURIComponent(query)}`;

    const data = await this.fetch<{ teams: TheSportsDBTeam[] | null }>(
      endpoint,
      CACHE_PROFILES.search
    );

    if (!data.teams) {
      return [];
    }

    // Filter to rugby teams only (strSport check if available)
    return data.teams.map((t) => ({
      id: t.idTeam,
      name: t.strTeam,
      shortName: t.strTeamShort,
      badge: t.strTeamBadge,
      country: t.strCountry,
    }));
  }

  async getLeagueFixtures(leagueId: string, _days?: number): Promise<Match[]> {
    const endpoint = `eventsnextleague.php?id=${leagueId}`;

    const data = await this.fetch<{ events: TheSportsDBEvent[] | null }>(
      endpoint,
      CACHE_PROFILES.standard
    );

    if (!data.events) {
      return [];
    }

    return data.events.map((e) => this.parseEvent(e));
  }

  async getLeagueResults(leagueId: string, _days?: number): Promise<Match[]> {
    const endpoint = `eventspastleague.php?id=${leagueId}`;

    const data = await this.fetch<{ events: TheSportsDBEvent[] | null }>(
      endpoint,
      CACHE_PROFILES.standard
    );

    if (!data.events) {
      return [];
    }

    return data.events.map((e) => this.parseEvent(e));
  }

  async getMatch(matchId: string): Promise<Match | null> {
    const endpoint = `lookupevent.php?id=${matchId}`;

    const data = await this.fetch<{ events: TheSportsDBEvent[] | null }>(
      endpoint,
      CACHE_PROFILES.live // Use short cache for match lookups
    );

    if (!data.events || data.events.length === 0) {
      return null;
    }

    return this.parseEvent(data.events[0]);
  }

  async getToday(leagueIds: string[]): Promise<Match[]> {
    // TheSportsDB doesn't have a "today" endpoint, so we need to
    // fetch fixtures for each league and filter by date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const matchMap = new Map<string, Match>();

    for (const leagueId of leagueIds) {
      try {
        const fixtures = await this.getLeagueFixtures(leagueId);
        const todayMatches = fixtures.filter((m) => {
          const matchDate = new Date(m.date);
          return matchDate >= today && matchDate < tomorrow;
        });
        // Deduplicate by match ID
        for (const match of todayMatches) {
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
   * Get all teams in a league by name.
   * Uses search_all_teams.php which works on free tier.
   */
  async getLeagueTeams(leagueName: string): Promise<Team[]> {
    const endpoint = `search_all_teams.php?l=${encodeURIComponent(leagueName)}`;

    const data = await this.fetch<{ teams: TheSportsDBTeam[] | null }>(
      endpoint,
      CACHE_PROFILES.long // Teams rarely change, cache longer
    );

    if (!data.teams) {
      return [];
    }

    // Filter to rugby teams only
    return data.teams
      .filter((t) => !t.strLeague || t.strLeague.toLowerCase().includes('rugby') || t.strLeague === leagueName)
      .map((t) => ({
        id: t.idTeam,
        name: t.strTeam,
        shortName: t.strTeamShort,
        badge: t.strTeamBadge,
        country: t.strCountry,
      }));
  }

  /**
   * Get team's next matches.
   *
   * Note: Free tier only returns HOME matches.
   * Use getLeagueFixtures and filter for reliable results.
   */
  async getTeamNext(teamId: string): Promise<Match[]> {
    const endpoint = `eventsnext.php?id=${teamId}`;

    const data = await this.fetch<{ events: TheSportsDBEvent[] | null }>(
      endpoint,
      CACHE_PROFILES.standard
    );

    if (!data.events) {
      return [];
    }

    return data.events.map((e) => this.parseEvent(e));
  }

  /**
   * Get team's last matches.
   *
   * Note: Free tier only returns HOME matches.
   * Use getLeagueResults and filter for reliable results.
   */
  async getTeamLast(teamId: string): Promise<Match[]> {
    const endpoint = `eventslast.php?id=${teamId}`;

    const data = await this.fetch<{ events: TheSportsDBEvent[] | null }>(
      endpoint,
      CACHE_PROFILES.standard
    );

    if (!data.events) {
      return [];
    }

    return data.events.map((e) => this.parseEvent(e));
  }
}
