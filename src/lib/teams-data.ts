import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Team } from '../types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEAMS_FILE = join(__dirname, '../../data/teams.json');

interface TeamsData {
  updated_at: string;
  leagues: Record<string, Array<{ id: string; name: string; badge?: string }>>;
}

let teamsCache: TeamsData | null = null;

/**
 * Load static teams data from data/teams.json.
 * Used as fallback when API is unavailable or for offline use.
 */
export async function loadStaticTeams(): Promise<TeamsData | null> {
  if (teamsCache) return teamsCache;

  try {
    const content = await readFile(TEAMS_FILE, 'utf-8');
    teamsCache = JSON.parse(content) as TeamsData;
    return teamsCache;
  } catch {
    return null;
  }
}

/**
 * Get static teams for a league by slug.
 */
export async function getStaticTeams(leagueSlug: string): Promise<Team[]> {
  const data = await loadStaticTeams();
  if (!data || !data.leagues[leagueSlug]) {
    return [];
  }

  return data.leagues[leagueSlug].map((t) => ({
    id: t.id,
    name: t.name,
    badge: t.badge,
  }));
}
