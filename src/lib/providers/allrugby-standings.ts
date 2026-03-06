import type { StandingsEntry } from '../../types/index.js';
import { cacheKey, type Cache } from '../cache.js';
import { CACHE_PROFILES } from './types.js';

const ALL_RUGBY_BASE_URL = 'https://all.rugby/tournament';
const LEAGUE_SLUG_MAP: Record<string, string> = {
  top14: 'top-14',
  pro_d2: 'pro-d2',
  premiership: 'premiership-rugby',
  urc: 'urc',
  champions_cup: 'champions-cup',
  challenge_cup: 'challenge-cup',
  super_rugby: 'super-rugby-pacific',
  six_nations: 'six-nations',
};

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

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function toInt(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number(value.replace(/[^\d-]/g, ''));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function toOptional(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractCells(rowHtml: string): string[] {
  const cells = Array.from(rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi));
  return cells.map((cell) => cleanText(cell[1] || ''));
}

export function parseAllRugbyStandingsHtml(html: string, leagueSlug: string): StandingsEntry[] | null {
  if (!html || !leagueSlug) return null;

  const rows = Array.from(html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)).map((match) => match[1] || '');
  if (rows.length < 2) return null;

  const headerCells = extractCells(rows[0]);
  if (headerCells.length === 0) return null;

  const headerIndex = new Map<string, number>();
  headerCells.forEach((header, index) => {
    headerIndex.set(normalizeHeader(header), index);
  });

  const findIndex = (...aliases: string[]): number => {
    for (const alias of aliases) {
      const hit = headerIndex.get(alias);
      if (hit !== undefined) return hit;
    }
    return -1;
  };

  const teamIdx = findIndex('team', 'club');
  const ptsIdx = findIndex('pts', 'points');
  const playedIdx = findIndex('pl', 'played', 'p');
  const wonIdx = findIndex('w', 'won');
  const drawnIdx = findIndex('d', 'draw', 'drawn');
  const lostIdx = findIndex('l', 'lost');
  const diffIdx = findIndex('diff', 'pd');
  const bpIdx = findIndex('bp', 'bonuspoints');
  const formIdx = findIndex('form');
  const pfIdx = findIndex('pf', 'pointsfor');
  const paIdx = findIndex('pa', 'pointsagainst');
  const tfIdx = findIndex('tf', 'triesfor');
  const taIdx = findIndex('ta', 'triesagainst');
  const tbIdx = findIndex('tb', 'trybonus');
  const lbIdx = findIndex('lb', 'losingbonus');
  const ycIdx = findIndex('yc');
  const rcIdx = findIndex('rc');

  if (teamIdx < 0 || ptsIdx < 0 || playedIdx < 0) return null;

  const entries: StandingsEntry[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = extractCells(rows[i]);
    if (cells.length <= Math.max(teamIdx, ptsIdx, playedIdx)) continue;

    const rawTeam = cells[teamIdx] || '';
    const teamName = rawTeam.replace(/^\d+\s*/, '').trim();
    if (!teamName) continue;

    const pointsFor = toInt(cells[pfIdx]);
    const pointsAgainst = toInt(cells[paIdx]);

    const parsed: StandingsEntry = {
      league: leagueSlug,
      position: entries.length + 1,
      team: {
        id: `${leagueSlug}-${teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: teamName,
      },
      played: toInt(cells[playedIdx]),
      won: toInt(cells[wonIdx]),
      drawn: toInt(cells[drawnIdx]),
      lost: toInt(cells[lostIdx]),
      points_for: pointsFor,
      points_against: pointsAgainst,
      points_diff: diffIdx >= 0 ? toInt(cells[diffIdx]) : pointsFor - pointsAgainst,
      points: toInt(cells[ptsIdx]),
      form: formIdx >= 0 ? cells[formIdx] || undefined : undefined,
      bonus_points: toOptional(cells[bpIdx]),
      tries_for: toOptional(cells[tfIdx]),
      tries_against: toOptional(cells[taIdx]),
      bonus_points_try: toOptional(cells[tbIdx]),
      bonus_points_losing: toOptional(cells[lbIdx]),
      win_percent: undefined,
      avg_points_for: undefined,
      avg_points_against: undefined,
      tries_diff: tfIdx >= 0 && taIdx >= 0
        ? toOptional(String(toInt(cells[tfIdx]) - toInt(cells[taIdx])))
        : undefined,
      description: ycIdx >= 0 || rcIdx >= 0
        ? [
            ycIdx >= 0 ? `YC:${toInt(cells[ycIdx])}` : null,
            rcIdx >= 0 ? `RC:${toInt(cells[rcIdx])}` : null,
          ].filter((value): value is string => Boolean(value)).join(' ')
        : undefined,
    };

    entries.push(parsed);
  }

  if (entries.length === 0) return null;
  return entries;
}

export async function fetchAllRugbyStandings(
  leagueSlug: string,
  cache: Cache
): Promise<StandingsEntry[] | null> {
  const mapped = LEAGUE_SLUG_MAP[leagueSlug];
  if (!mapped) return null;

  const key = cacheKey('allrugby-standings', { league: mapped });
  const cached = await cache.get<StandingsEntry[]>(key);
  if (cached && !cached.stale) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let response: Response;
    try {
      response = await fetch(`${ALL_RUGBY_BASE_URL}/${mapped}/table`, {
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
    const entries = parseAllRugbyStandingsHtml(html, leagueSlug);
    if (!entries || entries.length === 0) {
      return cached?.data || null;
    }

    await cache.set(key, entries, CACHE_PROFILES.standard);
    return entries;
  } catch {
    return cached?.data || null;
  }
}
