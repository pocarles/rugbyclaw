// Core domain types

export interface Team {
  id: string;
  name: string;
  shortName?: string;
  badge?: string;
  country?: string;
}

export interface League {
  id: string;
  slug: string;
  name: string;
  country: string;
  sport: 'rugby';
  searchName?: string; // Alternative league name for team search
}

export interface Score {
  home: number;
  away: number;
}

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';

export interface RateLimitInfo {
  day?: { limit: number; remaining: number; reset?: string };
  minute?: { limit: number; remaining: number };
}

export interface Match {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  league: League;
  date: Date;
  venue?: string;
  status: MatchStatus;
  score?: Score;
  round?: string;
  timestamp: number; // Unix timestamp for easier comparison
  timeTbd?: boolean;
}

// Config types

export interface FavoriteTeam {
  id: string;
  name: string;
  slug: string;
  leagueIds: string[];
}

export interface Config {
  schema_version: number;
  timezone: string;
  favorite_leagues: string[]; // slugs
  favorite_teams: FavoriteTeam[];
}

export interface Secrets {
  api_key: string;
  api_tier: 'free' | 'premium';
}

// Notification state types

export interface MatchNotificationState {
  match_id: string;
  status: MatchStatus;
  last_score_hash: string;
  last_notified_at: number;
  notified: {
    day_before: boolean;
    hour_before: boolean;
    kickoff: boolean;
    halftime: boolean;
    fulltime: boolean;
  };
}

export interface State {
  matches: Record<string, MatchNotificationState>;
  last_updated: number;
}

// API response types (for provider implementations)

export interface ProviderMatch {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  leagueId: string;
  date: string; // ISO string
  venue?: string;
  status: string;
  homeScore?: number;
  awayScore?: number;
  round?: string;
}

// CLI output types (JSON contract)

export interface MatchOutput {
  id: string;
  home: { name: string; score?: number };
  away: { name: string; score?: number };
  league: string;
  date: string;
  time: string;
  time_tbd?: boolean;
  time_confidence?: 'exact' | 'pending';
  venue?: string;
  status: MatchStatus;
  summary?: string; // Personality-driven summary for results
}

export interface ScoresOutput {
  matches: MatchOutput[];
  generated_at: string;
  rate_limit?: RateLimitInfo;
}

export interface FixturesOutput {
  league?: string;
  matches: MatchOutput[];
  generated_at: string;
  rate_limit?: RateLimitInfo;
}

export interface ResultsOutput {
  league?: string;
  matches: MatchOutput[];
  generated_at: string;
  rate_limit?: RateLimitInfo;
}

export interface TeamSearchOutput {
  query: string;
  teams: Array<{
    id: string;
    name: string;
    slug: string;
    country?: string;
    leagues: string[];
  }>;
}

export interface NotifyOutput {
  type: 'weekly' | 'daily' | 'live';
  notifications: Notification[];
  generated_at: string;
}

export interface Notification {
  type: 'weekly_digest' | 'day_before' | 'hour_before' | 'kickoff' | 'score_update' | 'halftime' | 'fulltime';
  match_id: string;
  message: string;
  match?: MatchOutput;
}

// Calendar types

export interface CalendarEvent {
  uid: string;
  summary: string;
  description: string;
  location?: string;
  start: Date;
  end: Date;
  url?: string;
}
