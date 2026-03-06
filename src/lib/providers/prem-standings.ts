import type { StandingsEntry } from '../../types/index.js';
import { cacheKey, type Cache } from '../cache.js';
import { CACHE_PROFILES } from './types.js';

const PREM_LEAGUE_SLUG = 'premiership';
const PREM_STANDINGS_URL = 'https://www.premiershiprugby.com/competitions/gallagher-prem/standings';

const PREM_TEAMS = [
  'Northampton Saints',
  'Bath Rugby',
  'Bristol Bears',
  'Exeter Chiefs',
  'Gloucester Rugby',
  'Harlequins',
  'Leicester Tigers',
  'Newcastle Falcons',
  'Sale Sharks',
  'Saracens',
] as const;

function cleanText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalPremTeam(team: string): string {
  if (team === 'Newcastle Falcons') return 'Newcastle Red Bulls';
  return team;
}

interface PremExtract {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsDiff: number;
  bonusTry: number;
  bonusLosing: number;
  bonusTotal: number;
  form?: string;
  points: number;
}

function parsePremChunk(chunk: string): PremExtract | null {
  const compact = chunk.replace(/[^0-9A-Za-z-]/g, '');
  const pattern = /^(\d{1,2})(\d{1,2})(\d{1,2})(\d{1,2})(-?\d{1,4})(\d{1,2})(\d{1,2})(\d{1,2})([WLD]{1,8})(\d{1,3})$/;

  for (let trim = 0; trim <= 2; trim++) {
    const candidate = trim > 0 ? compact.slice(0, -trim) : compact;
    if (!candidate) continue;

    const match = candidate.match(pattern);
    if (!match) continue;

    const played = Number(match[1]);
    const won = Number(match[2]);
    const drawn = Number(match[3]);
    const lost = Number(match[4]);
    const points = Number(match[10]);
    if (played !== won + drawn + lost) {
      continue;
    }
    if (points > played * 6 + 10) {
      continue;
    }

    return {
      played,
      won,
      drawn,
      lost,
      pointsDiff: Number(match[5]),
      bonusTry: Number(match[6]),
      bonusLosing: Number(match[7]),
      bonusTotal: Number(match[8]),
      form: match[9],
      points,
    };
  }

  return null;
}

export function parsePremiershipStandingsText(text: string): StandingsEntry[] | null {
  const cleaned = cleanText(text);
  if (!cleaned) return null;

  const locatedTeams = PREM_TEAMS
    .map((team) => ({ team, idx: cleaned.indexOf(team) }))
    .filter((hit) => hit.idx >= 0)
    .sort((a, b) => a.idx - b.idx);

  if (locatedTeams.length === 0) return null;

  const entries: StandingsEntry[] = [];

  for (let i = 0; i < locatedTeams.length; i++) {
    const current = locatedTeams[i];
    const next = locatedTeams[i + 1];
    const statsStart = current.idx + current.team.length;
    const statsEnd = next ? next.idx : cleaned.length;
    const chunk = cleaned.slice(statsStart, statsEnd);

    const parsed = parsePremChunk(chunk);
    if (!parsed) continue;

    entries.push({
      league: PREM_LEAGUE_SLUG,
      position: entries.length + 1,
      team: {
        id: `${PREM_LEAGUE_SLUG}-${canonicalPremTeam(current.team).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: canonicalPremTeam(current.team),
      },
      played: parsed.played,
      won: parsed.won,
      drawn: parsed.drawn,
      lost: parsed.lost,
      points_for: 0,
      points_against: 0,
      points_diff: parsed.pointsDiff,
      points: parsed.points,
      bonus_points: parsed.bonusTotal,
      bonus_points_try: parsed.bonusTry,
      bonus_points_losing: parsed.bonusLosing,
      form: parsed.form,
    });
  }

  return entries.length > 0 ? entries : null;
}

export async function fetchPremStandings(
  leagueSlug: string,
  cache: Cache
): Promise<StandingsEntry[] | null> {
  if (leagueSlug !== PREM_LEAGUE_SLUG) return null;

  const key = cacheKey('prem-standings', { league: leagueSlug });
  const cached = await cache.get<StandingsEntry[]>(key);
  if (cached && !cached.stale) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let response: Response;
    try {
      response = await fetch(PREM_STANDINGS_URL, {
        headers: { Accept: 'text/html' },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return cached?.data || null;
    }

    const html = await response.text();
    const entries = parsePremiershipStandingsText(html);
    if (!entries || entries.length === 0) {
      return cached?.data || null;
    }

    await cache.set(key, entries, CACHE_PROFILES.standard);
    return entries;
  } catch {
    return cached?.data || null;
  }
}
