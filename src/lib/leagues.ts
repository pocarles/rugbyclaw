import type { League } from '../types/index.js';

/**
 * Supported rugby leagues with TheSportsDB IDs.
 *
 * IDs verified against TheSportsDB API.
 * Southern hemisphere IDs to be confirmed.
 */
export const LEAGUES: Record<string, League> = {
  // European Club
  top14: {
    id: '4430',
    slug: 'top14',
    name: 'French Top 14',
    country: 'France',
    sport: 'rugby',
  },
  premiership: {
    id: '4413',
    slug: 'premiership',
    name: 'English Premiership',
    country: 'England',
    sport: 'rugby',
  },
  urc: {
    id: '4446',
    slug: 'urc',
    name: 'United Rugby Championship',
    country: 'Multi',
    sport: 'rugby',
  },
  pro_d2: {
    id: '5172',
    slug: 'pro_d2',
    name: 'Pro D2',
    country: 'France',
    sport: 'rugby',
  },

  // European Cups
  champions_cup: {
    id: '4550',
    slug: 'champions_cup',
    name: 'European Rugby Champions Cup',
    country: 'Europe',
    sport: 'rugby',
  },
  challenge_cup: {
    id: '5418',
    slug: 'challenge_cup',
    name: 'European Rugby Challenge Cup',
    country: 'Europe',
    sport: 'rugby',
  },

  // International
  six_nations: {
    id: '4714',
    slug: 'six_nations',
    name: 'Six Nations Championship',
    country: 'Europe',
    sport: 'rugby',
  },
  rugby_championship: {
    id: '4986',
    slug: 'rugby_championship',
    name: 'The Rugby Championship',
    country: 'Southern',
    sport: 'rugby',
  },

  // Southern Hemisphere Club
  super_rugby: {
    id: '4551',
    slug: 'super_rugby',
    name: 'Super Rugby Pacific',
    country: 'Pacific',
    sport: 'rugby',
  },
  currie_cup: {
    id: '5069',
    slug: 'currie_cup',
    name: 'Currie Cup',
    country: 'South Africa',
    sport: 'rugby',
  },
  npc: {
    id: '5278',
    slug: 'npc',
    name: 'NPC (Bunnings)',
    country: 'New Zealand',
    sport: 'rugby',
  },

  // Americas
  mlr: {
    id: '5070',
    slug: 'mlr',
    name: 'Major League Rugby',
    country: 'United States',
    sport: 'rugby',
  },

  // World Cups
  rugby_world_cup: {
    id: '4574',
    slug: 'rugby_world_cup',
    name: 'Rugby World Cup',
    country: 'World',
    sport: 'rugby',
  },

  // Women's
  womens_six_nations: {
    id: '5563',
    slug: 'womens_six_nations',
    name: "Women's Six Nations",
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
    'top 14': 'top14',
    'french top 14': 'top14',
    'prem': 'premiership',
    'gallagher premiership': 'premiership',
    'english premiership': 'premiership',
    'united rugby championship': 'urc',
    '6 nations': 'six_nations',
    'six nations': 'six_nations',
    '6n': 'six_nations',
    'heineken champions cup': 'champions_cup',
    'champions': 'champions_cup',
    'challenge': 'challenge_cup',
    'super rugby': 'super_rugby',
    'trc': 'rugby_championship',
    'the rugby championship': 'rugby_championship',
    'currie': 'currie_cup',
    'bunnings npc': 'npc',
    'major league rugby': 'mlr',
    'rwc': 'rugby_world_cup',
    'world cup': 'rugby_world_cup',
    "women's six nations": 'womens_six_nations',
    'womens 6 nations': 'womens_six_nations',
    'w6n': 'womens_six_nations',
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
