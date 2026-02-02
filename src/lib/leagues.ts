import type { League } from '../types/index.js';

/**
 * Supported rugby leagues with API-Sports IDs.
 *
 * Rugby Union only. IDs verified against API-Sports Rugby API.
 * https://api-sports.io/documentation/rugby/v1
 */
export const LEAGUES: Record<string, League> = {
  // Club Competitions - Europe
  top14: {
    id: '16',
    slug: 'top14',
    name: 'Top 14',
    country: 'France',
    sport: 'rugby',
  },
  premiership: {
    id: '13',
    slug: 'premiership',
    name: 'Premiership Rugby',
    country: 'England',
    sport: 'rugby',
  },
  urc: {
    id: '76',
    slug: 'urc',
    name: 'United Rugby Championship',
    country: 'Multi',
    sport: 'rugby',
  },
  pro_d2: {
    id: '17',
    slug: 'pro_d2',
    name: 'Pro D2',
    country: 'France',
    sport: 'rugby',
  },

  // Club Competitions - Southern Hemisphere
  super_rugby: {
    id: '71',
    slug: 'super_rugby',
    name: 'Super Rugby Pacific',
    country: 'Pacific',
    sport: 'rugby',
  },

  // European Cups
  champions_cup: {
    id: '54',
    slug: 'champions_cup',
    name: 'European Rugby Champions Cup',
    country: 'Europe',
    sport: 'rugby',
  },
  challenge_cup: {
    id: '52',
    slug: 'challenge_cup',
    name: 'European Rugby Challenge Cup',
    country: 'Europe',
    sport: 'rugby',
  },

  // International
  six_nations: {
    id: '51',
    slug: 'six_nations',
    name: 'Six Nations',
    country: 'Europe',
    sport: 'rugby',
  },
} as const;

/**
 * Get league by slug.
 */
export function getLeague(slug: string): League | undefined {
  return LEAGUES[slug.toLowerCase().replace(/-/g, '_')];
}

/**
 * Get league by ID.
 */
export function getLeagueById(id: string): League | undefined {
  return Object.values(LEAGUES).find((l) => l.id === id);
}

/**
 * Get all league slugs.
 */
export function getLeagueSlugs(): string[] {
  return Object.keys(LEAGUES);
}

/**
 * Resolve a user input to a league.
 * Handles common aliases and partial matches.
 */
export function resolveLeague(input: string): League | undefined {
  const normalized = input.toLowerCase().trim();

  // Direct slug match
  if (LEAGUES[normalized]) {
    return LEAGUES[normalized];
  }

  // Common aliases
  const aliases: Record<string, string> = {
    // Top 14
    'top 14': 'top14',
    'french top 14': 'top14',

    // Premiership
    'prem': 'premiership',
    'gallagher premiership': 'premiership',
    'english premiership': 'premiership',
    'gallagher': 'premiership',

    // URC
    'united rugby championship': 'urc',

    // Pro D2
    'prod2': 'pro_d2',
    'pro d2': 'pro_d2',

    // Super Rugby
    'super rugby': 'super_rugby',
    'super rugby pacific': 'super_rugby',
    'srp': 'super_rugby',

    // Champions Cup
    'heineken champions cup': 'champions_cup',
    'champions': 'champions_cup',
    'hcup': 'champions_cup',

    // Challenge Cup
    'challenge': 'challenge_cup',
    'epcr challenge cup': 'challenge_cup',

    // Six Nations
    '6 nations': 'six_nations',
    'six nations': 'six_nations',
    '6n': 'six_nations',
  };

  if (aliases[normalized]) {
    return LEAGUES[aliases[normalized]];
  }

  // Partial match on name
  const partialMatch = Object.values(LEAGUES).find((l) =>
    l.name.toLowerCase().includes(normalized)
  );
  if (partialMatch) {
    return partialMatch;
  }

  return undefined;
}
