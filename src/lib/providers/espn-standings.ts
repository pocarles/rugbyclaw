import { cacheKey, type Cache } from '../cache.js';
import { CACHE_PROFILES } from './types.js';

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/v2/sports/rugby';

const ESPN_LEAGUE_IDS: Record<string, string> = {
  top14: '270559',
  premiership: '267979',
  urc: '270557',
  currie_cup: '270555',
  npc: '270563',
};

interface EspnStat {
  name?: string;
  displayName?: string;
  shortDisplayName?: string;
  abbreviation?: string;
  value?: number | string;
  displayValue?: string;
}

interface EspnEntryNode {
  team?: {
    name?: string;
    displayName?: string;
    shortDisplayName?: string;
  };
  stats?: EspnStat[];
}

export interface EspnStandingsEntry {
  rank: number;
  teamName: string;
  gamesPlayed?: number;
  gamesWon?: number;
  gamesDrawn?: number;
  gamesLost?: number;
  points?: number;
  pointsFor?: number;
  pointsAgainst?: number;
  pointsDifference?: number;
  bonusPoints?: number;
  bonusPointsTry?: number;
  bonusPointsLosing?: number;
  triesFor?: number;
  triesAgainst?: number;
  triesDifference?: number;
  winPercent?: number;
  avgPointsFor?: number;
  avgPointsAgainst?: number;
  form?: string;
}

function statNames(stat: EspnStat): string[] {
  return [
    stat.name,
    stat.displayName,
    stat.shortDisplayName,
    stat.abbreviation,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase().replace(/\s+/g, ''));
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readNumericStat(stats: EspnStat[], targets: string[]): number | undefined {
  const normalizedTargets = new Set(targets.map((value) => value.toLowerCase().replace(/\s+/g, '')));
  for (const stat of stats) {
    const names = statNames(stat);
    if (names.some((name) => normalizedTargets.has(name))) {
      const direct = toNumber(stat.value);
      if (direct !== undefined) return direct;
      const fallback = toNumber(stat.displayValue);
      if (fallback !== undefined) return fallback;
    }
  }
  return undefined;
}

function readTextStat(stats: EspnStat[], targets: string[]): string | undefined {
  const normalizedTargets = new Set(targets.map((value) => value.toLowerCase().replace(/\s+/g, '')));
  for (const stat of stats) {
    const names = statNames(stat);
    if (names.some((name) => normalizedTargets.has(name))) {
      if (typeof stat.displayValue === 'string' && stat.displayValue.trim().length > 0) {
        return stat.displayValue.trim();
      }
      if (typeof stat.value === 'string' && stat.value.trim().length > 0) {
        return stat.value.trim();
      }
    }
  }
  return undefined;
}

function parseEspnEntry(entry: EspnEntryNode): EspnStandingsEntry | null {
  const stats = Array.isArray(entry.stats) ? entry.stats : [];
  const rank = readNumericStat(stats, ['rank', 'rk', 'position']);
  const teamName = entry.team?.displayName || entry.team?.name || entry.team?.shortDisplayName;

  if (!teamName || rank === undefined) {
    return null;
  }

  return {
    rank,
    teamName: teamName.trim(),
    gamesPlayed: readNumericStat(stats, ['gamesplayed', 'played', 'p']),
    gamesWon: readNumericStat(stats, ['gameswon', 'wins', 'w']),
    gamesDrawn: readNumericStat(stats, ['gamesdrawn', 'draws', 'd']),
    gamesLost: readNumericStat(stats, ['gameslost', 'losses', 'l']),
    points: readNumericStat(stats, ['points', 'pts']),
    pointsFor: readNumericStat(stats, ['pointsfor', 'pf']),
    pointsAgainst: readNumericStat(stats, ['pointsagainst', 'pa']),
    pointsDifference: readNumericStat(stats, ['pointsdifference', 'pd', '+/-']),
    bonusPoints: readNumericStat(stats, ['bonuspoints', 'bp']),
    bonusPointsTry: readNumericStat(stats, ['bonuspointstry', 'trybonuspoints']),
    bonusPointsLosing: readNumericStat(stats, ['bonuspointslosing', 'losingbonuspoints']),
    triesFor: readNumericStat(stats, ['triesfor', 'tf']),
    triesAgainst: readNumericStat(stats, ['triesagainst', 'ta']),
    triesDifference: readNumericStat(stats, ['triesdifference', 'td']),
    winPercent: readNumericStat(stats, ['winpercent', 'winpct', 'winpercentage']),
    avgPointsFor: readNumericStat(stats, ['avgpointsfor', 'pointsforavg']),
    avgPointsAgainst: readNumericStat(stats, ['avgpointsagainst', 'pointsagainstavg']),
    form: readTextStat(stats, ['overall', 'form']),
  };
}

function collectStandingsEntries(node: unknown, output: EspnStandingsEntry[]): void {
  if (!node) return;

  if (Array.isArray(node)) {
    for (const value of node) {
      collectStandingsEntries(value, output);
    }
    return;
  }

  if (typeof node !== 'object') return;

  const candidate = node as Record<string, unknown>;
  if (Array.isArray(candidate.entries)) {
    for (const rawEntry of candidate.entries) {
      const parsed = parseEspnEntry(rawEntry as EspnEntryNode);
      if (parsed) output.push(parsed);
    }
  }

  for (const value of Object.values(candidate)) {
    collectStandingsEntries(value, output);
  }
}

export async function fetchEspnStandings(
  leagueSlug: string,
  cache: Cache
): Promise<EspnStandingsEntry[] | null> {
  const espnLeagueId = ESPN_LEAGUE_IDS[leagueSlug];
  if (!espnLeagueId) return null;

  const key = cacheKey('espn-standings', { league: espnLeagueId });
  const cached = await cache.get<EspnStandingsEntry[]>(key);
  if (cached && !cached.stale) {
    return cached.data;
  }

  try {
    const response = await fetch(`${ESPN_BASE_URL}/${espnLeagueId}/standings`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      return cached?.data || null;
    }

    const raw = await response.json() as unknown;
    const entries: EspnStandingsEntry[] = [];
    collectStandingsEntries(raw, entries);

    const deduped = Array.from(
      new Map(entries.map((entry) => [`${entry.rank}-${entry.teamName.toLowerCase()}`, entry])).values()
    ).sort((a, b) => a.rank - b.rank);

    if (deduped.length === 0) {
      return cached?.data || null;
    }

    await cache.set(key, deduped, CACHE_PROFILES.standard);
    return deduped;
  } catch {
    return cached?.data || null;
  }
}
