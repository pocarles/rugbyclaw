import type { StandingsEntry } from '../../types/index.js';
import { cacheKey, type Cache } from '../cache.js';
import { CACHE_PROFILES } from './types.js';

const URC_LEAGUE_SLUG = 'urc';
const URC_BASE_URL = 'https://stats.unitedrugby.com/match-centre/table';

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

function toInt(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number(value.replace(/[^\d-]/g, ''));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function computeUrcSeasonSlug(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  if (month < 7) {
    const start = year - 1;
    return `${start}-${String(year).slice(-2)}`;
  }
  const end = year + 1;
  return `${year}-${String(end).slice(-2)}`;
}

function extractTeamName(cellHtml: string, fallbackText: string): string {
  const altMatch = cellHtml.match(/<img[^>]*alt=["']([^"']+)["'][^>]*>/i);
  if (altMatch?.[1]) return cleanText(altMatch[1]);

  const linkMatch = cellHtml.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
  if (linkMatch?.[1]) {
    const fromLink = cleanText(linkMatch[1]);
    if (fromLink) return fromLink;
  }

  return cleanText(fallbackText);
}

function extractCells(rowHtml: string): { text: string; html: string }[] {
  return Array.from(rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((cell) => {
    const html = cell[1] || '';
    return {
      html,
      text: cleanText(html),
    };
  });
}

export function parseUrcStandingsHtml(html: string): StandingsEntry[] | null {
  if (!html) return null;

  const rows = Array.from(html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)).map((match) => match[1] || '');
  if (rows.length < 2) return null;

  const headers = extractCells(rows[0]).map((cell) => normalizeHeader(cell.text));
  const headerIdx = new Map<string, number>();
  headers.forEach((header, idx) => headerIdx.set(header, idx));

  const idx = (...aliases: string[]): number => {
    for (const alias of aliases) {
      const found = headerIdx.get(alias);
      if (found !== undefined) return found;
    }
    return -1;
  };

  const teamIdx = idx('team', 'club');
  const playedIdx = idx('pl', 'played', 'p');
  const wonIdx = idx('w', 'won');
  const drawnIdx = idx('d', 'drawn');
  const lostIdx = idx('l', 'lost');
  const bpIdx = idx('bp', 'bonuspoints');
  const pfIdx = idx('pf', 'pointsfor');
  const paIdx = idx('pa', 'pointsagainst');
  const diffIdx = idx('diff', 'pd');
  const tfIdx = idx('tf', 'triesfor');
  const taIdx = idx('ta', 'triesagainst');
  const tbIdx = idx('tb', 'trybonus');
  const lbIdx = idx('lb', 'losingbonus');
  const ptsIdx = idx('pts', 'points');
  const formIdx = idx('form');

  if (teamIdx < 0 || playedIdx < 0 || ptsIdx < 0) return null;

  const entries: StandingsEntry[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = extractCells(rows[i]);
    if (cells.length <= Math.max(teamIdx, playedIdx, ptsIdx)) continue;

    const teamName = extractTeamName(cells[teamIdx].html, cells[teamIdx].text);
    if (!teamName) continue;

    const pointsFor = toInt(cells[pfIdx]?.text);
    const pointsAgainst = toInt(cells[paIdx]?.text);

    entries.push({
      league: URC_LEAGUE_SLUG,
      position: entries.length + 1,
      team: {
        id: `${URC_LEAGUE_SLUG}-${teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: teamName,
      },
      played: toInt(cells[playedIdx]?.text),
      won: toInt(cells[wonIdx]?.text),
      drawn: toInt(cells[drawnIdx]?.text),
      lost: toInt(cells[lostIdx]?.text),
      points_for: pointsFor,
      points_against: pointsAgainst,
      points_diff: diffIdx >= 0 ? toInt(cells[diffIdx]?.text) : pointsFor - pointsAgainst,
      points: toInt(cells[ptsIdx]?.text),
      form: formIdx >= 0 ? cells[formIdx]?.text || undefined : undefined,
      bonus_points: bpIdx >= 0 ? toInt(cells[bpIdx]?.text) : undefined,
      tries_for: tfIdx >= 0 ? toInt(cells[tfIdx]?.text) : undefined,
      tries_against: taIdx >= 0 ? toInt(cells[taIdx]?.text) : undefined,
      tries_diff: tfIdx >= 0 && taIdx >= 0
        ? toInt(String(toInt(cells[tfIdx]?.text) - toInt(cells[taIdx]?.text)))
        : undefined,
      bonus_points_try: tbIdx >= 0 ? toInt(cells[tbIdx]?.text) : undefined,
      bonus_points_losing: lbIdx >= 0 ? toInt(cells[lbIdx]?.text) : undefined,
    });
  }

  return entries.length > 0 ? entries : null;
}

export async function fetchUrcStandings(
  leagueSlug: string,
  cache: Cache
): Promise<StandingsEntry[] | null> {
  if (leagueSlug !== URC_LEAGUE_SLUG) return null;

  const seasonSlug = computeUrcSeasonSlug();
  const key = cacheKey('urc-standings', { season: seasonSlug });
  const cached = await cache.get<StandingsEntry[]>(key);
  if (cached && !cached.stale) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let response: Response;
    try {
      response = await fetch(`${URC_BASE_URL}/${seasonSlug}`, {
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
    const entries = parseUrcStandingsHtml(html);
    if (!entries || entries.length === 0) {
      return cached?.data || null;
    }

    await cache.set(key, entries, CACHE_PROFILES.standard);
    return entries;
  } catch {
    return cached?.data || null;
  }
}

export { computeUrcSeasonSlug };
