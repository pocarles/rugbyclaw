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

  // Extract the first table that contains a PTS/Pts header (the main standings table)
  const tables = Array.from(html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi));
  let bestTable = '';
  for (const tableMatch of tables) {
    const tableHtml = tableMatch[1] || '';
    if (/\bPTS\b/i.test(tableHtml) && /<tr/i.test(tableHtml)) {
      bestTable = tableHtml;
      break;
    }
  }
  if (!bestTable) return null;

  const rows = Array.from(bestTable.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)).map((match) => match[1] || '');
  if (rows.length < 2) return null;

  const headerCells = extractCells(rows[0]);
  if (headerCells.length === 0) return null;

  // Build header→index map, but skip blank headers to align with data
  // all.rugby headers have blanks for logo/rank columns that don't exist in data after slicing
  const headerIndex = new Map<string, number>();
  let dataOffset = 0;
  headerCells.forEach((header) => {
    const key = normalizeHeader(header);
    if (!key) {
      // Blank header — skip it, don't increment data offset
      return;
    }
    if (!headerIndex.has(key)) {
      headerIndex.set(key, dataOffset);
    }
    dataOffset++;
  });

  const findIndex = (...aliases: string[]): number => {
    for (const alias of aliases) {
      const hit = headerIndex.get(alias);
      if (hit !== undefined) return hit;
    }
    return -1;
  };

  // all.rugby uses "ALL.RUGBY" as header for the team column
  // Some pages have blank headers for rank/logo cols, with team name at index 2
  let teamIdx = findIndex('team', 'club', 'allrugby');
  // If no team header found, try column 2 (rank, logo, team pattern)
  if (teamIdx < 0 && headerCells.length > 3) {
    teamIdx = 2;
  }
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
    let cells = extractCells(rows[i]);
    // all.rugby data rows may have extra columns (rank number, blank logo) vs headers.
    // Strip leading cells that don't map to any meaningful header:
    // 1) If first cell is a small number (rank) and we have more cells than non-blank headers
    const nonBlankHeaderCount = headerCells.filter(h => normalizeHeader(h) !== '').length;
    while (cells.length > nonBlankHeaderCount && (/^\d{1,3}$/.test(cells[0]) || cells[0] === '')) {
      cells = cells.slice(1);
    }
    if (cells.length <= Math.max(teamIdx, ptsIdx, playedIdx)) continue;

    const rawTeam = cells[teamIdx] || '';
    const stripped = rawTeam.replace(/^\d+\s*/, '').trim();
    // all.rugby cells often contain "TeamName TeamName" (img alt + display text)
    // Also may have trailing abbreviation: "ToulouseST", "PauSP"
    let teamName = stripped;
    // Check for exact duplicate: "Brumbies Brumbies" → "Brumbies"
    const words = stripped.split(' ');
    const half = Math.floor(words.length / 2);
    if (half > 0 && words.length % 2 === 0) {
      const firstHalf = words.slice(0, half).join(' ');
      const secondHalf = words.slice(half).join(' ');
      if (firstHalf === secondHalf) {
        teamName = firstHalf;
      }
    }
    // Also handle "Western Force Western Force" (even-length duplicate)
    // And "ToulouseST" → strip trailing 2-5 uppercase abbreviation
    const abbrevMatch = teamName.match(/^(.+?)([A-Z]{2,5})$/);
    if (abbrevMatch && abbrevMatch[1].trim().length > 1) {
      teamName = abbrevMatch[1].trim();
    }
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
        headers: {
          Accept: 'text/html',
          'User-Agent': 'Mozilla/5.0 (compatible; rugbyclaw/0.2.0)',
        },
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
