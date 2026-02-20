import { normalizeText } from '../fuzzy.js';

const TOP14_LEAGUE_ID = '16';
const PRO_D2_LEAGUE_ID = '17';
const PREMIERSHIP_LEAGUE_ID = '13';
const SIX_NATIONS_LEAGUE_ID = '51';
const SUPER_RUGBY_LEAGUE_ID = '71';
const CHAMPIONS_CUP_LEAGUE_ID = '54';
const CHALLENGE_CUP_LEAGUE_ID = '52';
const URC_LEAGUE_ID = '76';

const TOP14_SOURCE_URL = 'https://top14.lnr.fr/';
const PRO_D2_SOURCE_URL = 'https://prod2.lnr.fr/';
const URC_GRAPHQL_URL = 'https://www.unitedrugby.com/graphql';
const INCROWD_MATCHES_URL = 'https://rugby-union-feeds.incrowdsports.com/v1/matches';
const INCROWD_PROVIDER = 'rugbyviz';
const OFFICIAL_FETCH_TTL_MS = 10 * 60 * 1000;
const MAX_KICKOFF_DELTA_MS = 31 * 24 * 60 * 60 * 1000;
const MIN_OVERRIDE_DELTA_MS = 60 * 1000;

const fixtureCache = new Map<string, { fixtures: OfficialFixture[]; cachedAtMs: number }>();

const INCROWD_COMPETITION_IDS: Record<string, number> = {
  [PREMIERSHIP_LEAGUE_ID]: 1011,
  [SIX_NATIONS_LEAGUE_ID]: 1055,
  [SUPER_RUGBY_LEAGUE_ID]: 1020,
  [CHAMPIONS_CUP_LEAGUE_ID]: 1008,
  [CHALLENGE_CUP_LEAGUE_ID]: 1026,
};

export interface OfficialFixture {
  sourceId: string;
  home: string;
  away: string;
  kickoffMs: number;
  round: number | null;
  leagueId?: string;
}

export type Top14OfficialFixture = OfficialFixture;

export interface ApiGameForFallback {
  id: number;
  timestamp: number;
  week: string;
  league?: { id?: number | string };
  teams: {
    home: { name: string };
    away: { name: string };
  };
}

export type Top14GameLike = ApiGameForFallback;

interface Top14SourceMatch {
  id?: number;
  hosting_club?: { name?: string };
  visiting_club?: { name?: string };
  timer?: { firstPeriodStartDate?: string | null };
  link?: string;
}

const TOP14_TEAM_ALIASES: Record<string, string> = {
  'aviron bayonnais': 'bayonne',
  bayonne: 'bayonne',
  bordeaux: 'bordeaux begles',
  'bordeaux begles': 'bordeaux begles',
  clermont: 'clermont',
  'asm clermont': 'clermont',
  'lou rugby': 'lyon',
  lyon: 'lyon',
  montauban: 'montauban',
  'us montauban': 'montauban',
  montpellier: 'montpellier',
  'montpellier herault rugby': 'montpellier',
  pau: 'pau',
  'section paloise': 'pau',
  perpignan: 'perpignan',
  'usa perpignan': 'perpignan',
  'racing 92': 'racing 92',
  'la rochelle': 'la rochelle',
  'stade rochelais': 'la rochelle',
  toulon: 'toulon',
  'rc toulon': 'toulon',
  'rc toulonnais': 'toulon',
  toulouse: 'stade toulousain',
  'stade toulousain': 'stade toulousain',
  'stade francais': 'stade francais',
  'stade francais paris': 'stade francais',
  'union bordeaux begles': 'bordeaux begles',
};

const PRO_D2_TEAM_ALIASES: Record<string, string> = {
  'su agen': 'agen',
  agen: 'agen',
  aurillac: 'aurillac',
  'stade aurillacois': 'aurillac',
  beziers: 'beziers',
  'as beziers herault': 'beziers',
  biarritz: 'biarritz',
  'biarritz olympique pb': 'biarritz',
  brive: 'brive',
  'ca brive': 'brive',
  carcassonne: 'carcassonne',
  'us carcassonne': 'carcassonne',
  'us carcassonnaise': 'carcassonne',
  colomiers: 'colomiers',
  'colomiers rugby': 'colomiers',
  dax: 'dax',
  'us dax': 'dax',
  'grenoble fc': 'grenoble',
  grenoble: 'grenoble',
  'fc grenoble rugby': 'grenoble',
  m2m: 'mont de marsan',
  nevers: 'nevers',
  'uson nevers': 'nevers',
  oyonnax: 'oyonnax',
  'us oyonnax': 'oyonnax',
  'oyonnax rugby': 'oyonnax',
  provence: 'provence rugby',
  'provence rugby': 'provence rugby',
  'soyaux angouleme xv': 'angouleme',
  'stade montois rugby': 'mont de marsan',
  'valence romans': 'valence romans',
  vannes: 'vannes',
  'rc vannes': 'vannes',
};

const URC_TEAM_ALIASES: Record<string, string> = {
  benetton: 'benetton',
  'benetton rugby': 'benetton',
  bulls: 'bulls',
  'vodacom bulls': 'bulls',
  cardiff: 'cardiff',
  'cardiff rugby': 'cardiff',
  connacht: 'connacht',
  'connacht rugby': 'connacht',
  dragons: 'dragons',
  'dragons rfc': 'dragons',
  edinburgh: 'edinburgh',
  'edinburgh rugby': 'edinburgh',
  glasgow: 'glasgow',
  'glasgow warriors': 'glasgow',
  leinster: 'leinster',
  'leinster rugby': 'leinster',
  lions: 'lions',
  munster: 'munster',
  'munster rugby': 'munster',
  ospreys: 'ospreys',
  scarlets: 'scarlets',
  sharks: 'sharks',
  'hollywoodbets sharks': 'sharks',
  stormers: 'stormers',
  'dhl stormers': 'stormers',
  ulster: 'ulster',
  'ulster rugby': 'ulster',
  zebre: 'zebre',
  'zebre parma': 'zebre',
};

const PREMIERSHIP_TEAM_ALIASES: Record<string, string> = {
  bath: 'bath rugby',
  'bath rugby': 'bath rugby',
  bristol: 'bristol bears',
  'bristol bears': 'bristol bears',
  'exeter chiefs': 'exeter chiefs',
  gloucester: 'gloucester rugby',
  'gloucester rugby': 'gloucester rugby',
  harlequins: 'harlequins',
  'leicester tigers': 'leicester tigers',
  'newcastle falcons': 'newcastle red bulls',
  'newcastle red bulls': 'newcastle red bulls',
  'northampton saints': 'northampton saints',
  saracens: 'saracens',
  'sale sharks': 'sale sharks',
};

const SIX_NATIONS_TEAM_ALIASES: Record<string, string> = {
  england: 'england',
  france: 'france',
  ireland: 'ireland',
  italy: 'italy',
  scotland: 'scotland',
  wales: 'wales',
};

const SUPER_RUGBY_TEAM_ALIASES: Record<string, string> = {
  blues: 'blues',
  brumbies: 'brumbies',
  'act brumbies': 'brumbies',
  chiefs: 'chiefs',
  crusaders: 'crusaders',
  drua: 'fijian drua',
  'fijian drua': 'fijian drua',
  highlanders: 'highlanders',
  hurricanes: 'hurricanes',
  'moana pasifika': 'moana pasifika',
  reds: 'reds',
  'queensland reds': 'reds',
  waratahs: 'waratahs',
  'nsw waratahs': 'waratahs',
  'western force': 'western force',
};

const CHAMPIONS_CUP_TEAM_ALIASES: Record<string, string> = {
  'aviron bayonnais': 'bayonne',
  bayonne: 'bayonne',
  bath: 'bath rugby',
  'bath rugby': 'bath rugby',
  bordeaux: 'bordeaux begles',
  'bordeaux begles': 'bordeaux begles',
  'bristol bears': 'bristol bears',
  bristol: 'bristol bears',
  bulls: 'bulls',
  'vodacom bulls': 'bulls',
  'castres olympique': 'castres olympique',
  clermont: 'clermont',
  'clermont auvergne': 'clermont',
  edinburgh: 'edinburgh',
  'edinburgh rugby': 'edinburgh',
  'dhl stormers': 'stormers',
  stormers: 'stormers',
  'glasgow warriors': 'glasgow warriors',
  gloucester: 'gloucester rugby',
  'gloucester rugby': 'gloucester rugby',
  harlequins: 'harlequins',
  'hollywoodbets sharks': 'sharks',
  sharks: 'sharks',
  leinster: 'leinster',
  'leinster rugby': 'leinster',
  'leicester tigers': 'leicester tigers',
  'la rochelle': 'la rochelle',
  'stade rochelais': 'la rochelle',
  munster: 'munster',
  'munster rugby': 'munster',
  pau: 'pau',
  'section paloise': 'pau',
  'northampton saints': 'northampton saints',
  sale: 'sale sharks',
  'sale sharks': 'sale sharks',
  saracens: 'saracens',
  scarlets: 'scarlets',
  toulon: 'toulon',
  'rc toulon': 'toulon',
  'rc toulonnais': 'toulon',
  toulouse: 'stade toulousain',
  'stade toulousain': 'stade toulousain',
  'union bordeaux begles': 'bordeaux begles',
};

const CHALLENGE_CUP_TEAM_ALIASES: Record<string, string> = {
  'black lion': 'black lion',
  cardiff: 'cardiff',
  'cardiff rugby': 'cardiff',
  cheetahs: 'cheetahs',
  'toyota cheetahs': 'cheetahs',
  connacht: 'connacht',
  'connacht rugby': 'connacht',
  dragons: 'dragons',
  'dragons rfc': 'dragons',
  'exeter chiefs': 'exeter chiefs',
  lions: 'lions',
  lyon: 'lyon',
  'lyon o u': 'lyon',
  montauban: 'montauban',
  montpellier: 'montpellier',
  'newcastle red bulls': 'newcastle red bulls',
  ospreys: 'ospreys',
  perpignan: 'perpignan',
  'usa perpignan': 'perpignan',
  'racing 92': 'racing 92',
  'stade francais paris': 'stade francais',
  'stade francais': 'stade francais',
  ulster: 'ulster',
  'ulster rugby': 'ulster',
  zebre: 'zebre',
  'zebre parma': 'zebre',
  benetton: 'benetton',
  'benetton rugby': 'benetton',
};

function getTeamAliases(leagueId: string): Record<string, string> {
  if (leagueId === TOP14_LEAGUE_ID) return TOP14_TEAM_ALIASES;
  if (leagueId === PRO_D2_LEAGUE_ID) return PRO_D2_TEAM_ALIASES;
  if (leagueId === PREMIERSHIP_LEAGUE_ID) return PREMIERSHIP_TEAM_ALIASES;
  if (leagueId === SIX_NATIONS_LEAGUE_ID) return SIX_NATIONS_TEAM_ALIASES;
  if (leagueId === SUPER_RUGBY_LEAGUE_ID) return SUPER_RUGBY_TEAM_ALIASES;
  if (leagueId === CHAMPIONS_CUP_LEAGUE_ID) return CHAMPIONS_CUP_TEAM_ALIASES;
  if (leagueId === CHALLENGE_CUP_LEAGUE_ID) return CHALLENGE_CUP_TEAM_ALIASES;
  if (leagueId === URC_LEAGUE_ID) return URC_TEAM_ALIASES;
  return {};
}

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, '\'')
    .replace(/&#39;/g, '\'')
    .replace(/&#x27;/gi, '\'')
    .replace(/&amp;/g, '&');
}

function canonicalizeTeam(name: string, leagueId: string): string {
  const aliases = getTeamAliases(leagueId);
  const normalized = normalizeText(name);
  return aliases[normalized] || normalized;
}

function extractRound(value: string | number | undefined | null): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value) return null;
  const asString = String(value);
  const match = asString.match(/j(\d+)/i) || asString.match(/(\d+)/);
  if (!match) return null;
  const round = Number(match[1]);
  return Number.isFinite(round) ? round : null;
}

function fixtureKey(home: string, away: string, leagueId: string): string {
  return `${canonicalizeTeam(home, leagueId)}|${canonicalizeTeam(away, leagueId)}`;
}

function parseLnrFixturesFromHtml(html: string, leagueId: string): OfficialFixture[] {
  const fixtures: OfficialFixture[] = [];
  const blocks = html.matchAll(/:matches='([^']+)'/g);

  for (const block of blocks) {
    const encoded = block[1];
    if (!encoded) continue;

    const decoded = decodeHtml(encoded);
    let matches: Top14SourceMatch[] = [];
    try {
      const parsed = JSON.parse(decoded) as unknown;
      if (Array.isArray(parsed)) {
        matches = parsed as Top14SourceMatch[];
      }
    } catch {
      continue;
    }

    for (const match of matches) {
      const home = match.hosting_club?.name?.trim();
      const away = match.visiting_club?.name?.trim();
      const kickoffIso = match.timer?.firstPeriodStartDate;
      const sourceId = String(match.id || '');
      if (!home || !away || !kickoffIso || !sourceId) continue;

      const kickoffMs = Date.parse(kickoffIso);
      if (!Number.isFinite(kickoffMs)) continue;

      fixtures.push({
        sourceId,
        home,
        away,
        kickoffMs,
        round: extractRound(match.link),
        leagueId,
      });
    }
  }

  return fixtures;
}

export function parseTop14FixturesFromHtml(html: string): Top14OfficialFixture[] {
  return parseLnrFixturesFromHtml(html, TOP14_LEAGUE_ID);
}

export function parseProD2FixturesFromHtml(html: string): OfficialFixture[] {
  return parseLnrFixturesFromHtml(html, PRO_D2_LEAGUE_ID);
}

function getCachedFixtures(cacheKey: string, nowMs: number): OfficialFixture[] | null {
  const cached = fixtureCache.get(cacheKey);
  if (!cached) return null;
  if (nowMs - cached.cachedAtMs > OFFICIAL_FETCH_TTL_MS) return null;
  return cached.fixtures;
}

function setCachedFixtures(cacheKey: string, fixtures: OfficialFixture[], nowMs: number): void {
  fixtureCache.set(cacheKey, { fixtures, cachedAtMs: nowMs });
}

async function fetchLnrOfficialFixtures(
  sourceUrl: string,
  leagueId: string,
  fetchFn: typeof fetch = fetch,
  nowMs = Date.now()
): Promise<OfficialFixture[]> {
  const cacheKey = `lnr:${leagueId}`;
  const cached = getCachedFixtures(cacheKey, nowMs);
  if (cached) return cached;

  const response = await fetchFn(sourceUrl, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'rugbyclaw/1.0 (+https://github.com/pocarles/rugbyclaw)',
    },
  });

  if (!response.ok) {
    throw new Error(`LNR source returned ${response.status}`);
  }

  const html = await response.text();
  const fixtures = parseLnrFixturesFromHtml(html, leagueId);
  setCachedFixtures(cacheKey, fixtures, nowMs);
  return fixtures;
}

export async function fetchTop14OfficialFixtures(
  fetchFn: typeof fetch = fetch,
  nowMs = Date.now()
): Promise<Top14OfficialFixture[]> {
  return fetchLnrOfficialFixtures(TOP14_SOURCE_URL, TOP14_LEAGUE_ID, fetchFn, nowMs);
}

export async function fetchProD2OfficialFixtures(
  fetchFn: typeof fetch = fetch,
  nowMs = Date.now()
): Promise<OfficialFixture[]> {
  return fetchLnrOfficialFixtures(PRO_D2_SOURCE_URL, PRO_D2_LEAGUE_ID, fetchFn, nowMs);
}

interface InCrowdMatch {
  id?: number | string;
  date?: string;
  round?: number | string | null;
  homeTeam?: { name?: string | null };
  awayTeam?: { name?: string | null };
}

interface InCrowdMatchesResponse {
  status?: string;
  data?: InCrowdMatch[];
}

function resolveInCrowdSeasonIds(games: ApiGameForFallback[]): number[] {
  const seasonIds = new Set<number>();

  for (const game of games) {
    const year = new Date(game.timestamp * 1000).getUTCFullYear();
    seasonIds.add(year * 100);
    seasonIds.add(year * 100 + 1);
    seasonIds.add((year - 1) * 100);
    seasonIds.add((year - 1) * 100 + 1);
  }

  return Array.from(seasonIds).sort((a, b) => a - b);
}

function isUnknownTeamName(name: string): boolean {
  const normalized = normalizeText(name);
  return normalized === 'tbc' || normalized === 'to be confirmed';
}

export async function fetchInCrowdOfficialFixtures(
  leagueId: string,
  games: ApiGameForFallback[],
  fetchFn: typeof fetch = fetch,
  nowMs = Date.now()
): Promise<OfficialFixture[]> {
  if (games.length === 0) return [];
  const competitionId = INCROWD_COMPETITION_IDS[leagueId];
  if (!competitionId) return [];

  const seasonIds = resolveInCrowdSeasonIds(games);
  const cacheKey = `incrowd:${leagueId}:${seasonIds.join(',')}`;
  const cached = getCachedFixtures(cacheKey, nowMs);
  if (cached) return cached;

  const fixturesById = new Map<string, OfficialFixture>();
  let requestSucceeded = false;

  for (const seasonId of seasonIds) {
    const url = new URL(INCROWD_MATCHES_URL);
    url.searchParams.set('provider', INCROWD_PROVIDER);
    url.searchParams.set('compId', String(competitionId));
    url.searchParams.set('season', String(seasonId));
    url.searchParams.set('pageSize', '500');

    const response = await fetchFn(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'rugbyclaw/1.0 (+https://github.com/pocarles/rugbyclaw)',
      },
    });
    if (!response.ok) continue;
    requestSucceeded = true;

    const payload = await response.json() as InCrowdMatchesResponse;
    const matches = Array.isArray(payload.data) ? payload.data : [];

    for (const match of matches) {
      const home = match.homeTeam?.name?.trim();
      const away = match.awayTeam?.name?.trim();
      const kickoffIso = match.date;
      const sourceId = String(match.id || '');
      if (!home || !away || !kickoffIso || !sourceId) continue;
      if (isUnknownTeamName(home) || isUnknownTeamName(away)) continue;

      const kickoffMs = Date.parse(kickoffIso);
      if (!Number.isFinite(kickoffMs)) continue;

      fixturesById.set(sourceId, {
        sourceId,
        home,
        away,
        kickoffMs,
        round: extractRound(match.round),
        leagueId,
      });
    }
  }

  if (!requestSucceeded) {
    throw new Error(`InCrowd source returned non-success for league ${leagueId}`);
  }

  const fixtures = Array.from(fixturesById.values()).sort((a, b) => a.kickoffMs - b.kickoffMs);
  setCachedFixtures(cacheKey, fixtures, nowMs);
  return fixtures;
}

interface UrcGraphqlMatch {
  id?: number;
  match_data?: {
    dateTime?: string;
    round?: number;
    competition?: { name?: string };
    homeTeam?: { name?: string; shortName?: string };
    awayTeam?: { name?: string; shortName?: string };
  };
}

interface UrcGraphqlResponse {
  data?: { matches?: UrcGraphqlMatch[] };
}

function resolveUrcSeasonIds(games: ApiGameForFallback[]): number[] {
  const ids = new Set<number>();

  for (const game of games) {
    const year = new Date(game.timestamp * 1000).getUTCFullYear();
    ids.add(year * 100 + 1);
    ids.add((year - 1) * 100 + 1);
  }

  return Array.from(ids).sort((a, b) => a - b);
}

export async function fetchUrcOfficialFixtures(
  games: ApiGameForFallback[],
  fetchFn: typeof fetch = fetch,
  nowMs = Date.now()
): Promise<OfficialFixture[]> {
  if (games.length === 0) return [];
  const seasonIds = resolveUrcSeasonIds(games);
  const cacheKey = `urc:${seasonIds.join(',')}`;
  const cached = getCachedFixtures(cacheKey, nowMs);
  if (cached) return cached;

  const response = await fetchFn(URC_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'rugbyclaw/1.0 (+https://github.com/pocarles/rugbyclaw)',
    },
    body: JSON.stringify({
      query: 'query($season_id:[Int], $limit:Int){ matches(season_id:$season_id, limit:$limit, orderBy:"match_data.dateTime", order:"ASC"){ id season_id season_name match_data { dateTime round competition { name } homeTeam { name shortName } awayTeam { name shortName } } } }',
      variables: { season_id: seasonIds, limit: 500 },
    }),
  });

  if (!response.ok) {
    throw new Error(`URC GraphQL returned ${response.status}`);
  }

  const payload = await response.json() as UrcGraphqlResponse;
  const matches = payload.data?.matches || [];
  const fixtures: OfficialFixture[] = [];

  for (const match of matches) {
    const kickoffIso = match.match_data?.dateTime;
    const competitionName = normalizeText(match.match_data?.competition?.name || '');
    if (competitionName && competitionName !== 'united rugby championship') continue;
    if (!kickoffIso) continue;

    const kickoffMs = Date.parse(kickoffIso);
    if (!Number.isFinite(kickoffMs)) continue;

    const home = match.match_data?.homeTeam?.name?.trim();
    const away = match.match_data?.awayTeam?.name?.trim();
    const sourceId = String(match.id || '');
    if (!home || !away || !sourceId) continue;

    fixtures.push({
      sourceId,
      home,
      away,
      kickoffMs,
      round: extractRound(match.match_data?.round),
      leagueId: URC_LEAGUE_ID,
    });
  }

  setCachedFixtures(cacheKey, fixtures, nowMs);
  return fixtures;
}

function matchKickoffFallbacks(
  games: ApiGameForFallback[],
  fixtures: OfficialFixture[],
  defaultLeagueId: string
): Map<string, number> {
  const byPair = new Map<string, OfficialFixture[]>();

  for (const fixture of fixtures) {
    const leagueId = fixture.leagueId || defaultLeagueId;
    const key = fixtureKey(fixture.home, fixture.away, leagueId);
    const bucket = byPair.get(key) || [];
    bucket.push(fixture);
    byPair.set(key, bucket);
  }

  for (const bucket of byPair.values()) {
    bucket.sort((a, b) => a.kickoffMs - b.kickoffMs);
  }

  const overrides = new Map<string, number>();

  for (const game of games) {
    const leagueId = String(game.league?.id || defaultLeagueId);
    const key = fixtureKey(game.teams.home.name, game.teams.away.name, leagueId);
    const candidates = byPair.get(key);
    if (!candidates || candidates.length === 0) continue;

    const apiRound = extractRound(game.week);
    const apiKickoffMs = game.timestamp * 1000;
    let best: { kickoffMs: number; delta: number } | null = null;

    for (const candidate of candidates) {
      if (apiRound !== null && candidate.round !== null && apiRound !== candidate.round) {
        continue;
      }

      const delta = Math.abs(candidate.kickoffMs - apiKickoffMs);
      if (delta > MAX_KICKOFF_DELTA_MS) continue;
      if (!best || delta < best.delta) {
        best = { kickoffMs: candidate.kickoffMs, delta };
      }
    }

    if (best && best.delta >= MIN_OVERRIDE_DELTA_MS) {
      overrides.set(String(game.id), best.kickoffMs);
    }
  }

  return overrides;
}

export function matchTop14KickoffFallbacks(
  games: Top14GameLike[],
  fixtures: Top14OfficialFixture[]
): Map<string, number> {
  return matchKickoffFallbacks(games, fixtures, TOP14_LEAGUE_ID);
}

export function matchProD2KickoffFallbacks(
  games: ApiGameForFallback[],
  fixtures: OfficialFixture[]
): Map<string, number> {
  return matchKickoffFallbacks(games, fixtures, PRO_D2_LEAGUE_ID);
}

export function matchUrcKickoffFallbacks(
  games: ApiGameForFallback[],
  fixtures: OfficialFixture[]
): Map<string, number> {
  return matchKickoffFallbacks(games, fixtures, URC_LEAGUE_ID);
}

function mergeMaps(target: Map<string, number>, source: Map<string, number>): void {
  for (const [matchId, kickoff] of source.entries()) {
    target.set(matchId, kickoff);
  }
}

export async function resolveOfficialKickoffFallbacks(
  games: ApiGameForFallback[],
  fetchFn: typeof fetch = fetch,
  nowMs = Date.now()
): Promise<Map<string, number>> {
  const overrides = new Map<string, number>();

  const top14Games = games.filter((game) => String(game.league?.id) === TOP14_LEAGUE_ID);
  if (top14Games.length > 0) {
    try {
      const fixtures = await fetchTop14OfficialFixtures(fetchFn, nowMs);
      mergeMaps(overrides, matchTop14KickoffFallbacks(top14Games, fixtures));
    } catch {
      // Best-effort fallback only
    }
  }

  const proD2Games = games.filter((game) => String(game.league?.id) === PRO_D2_LEAGUE_ID);
  if (proD2Games.length > 0) {
    try {
      const fixtures = await fetchProD2OfficialFixtures(fetchFn, nowMs);
      mergeMaps(overrides, matchProD2KickoffFallbacks(proD2Games, fixtures));
    } catch {
      // Best-effort fallback only
    }
  }

  const urcGames = games.filter((game) => String(game.league?.id) === URC_LEAGUE_ID);
  if (urcGames.length > 0) {
    try {
      const fixtures = await fetchUrcOfficialFixtures(urcGames, fetchFn, nowMs);
      mergeMaps(overrides, matchUrcKickoffFallbacks(urcGames, fixtures));
    } catch {
      // Best-effort fallback only
    }
  }

  const inCrowdLeagueIds = [
    PREMIERSHIP_LEAGUE_ID,
    SIX_NATIONS_LEAGUE_ID,
    SUPER_RUGBY_LEAGUE_ID,
    CHAMPIONS_CUP_LEAGUE_ID,
    CHALLENGE_CUP_LEAGUE_ID,
  ];

  for (const leagueId of inCrowdLeagueIds) {
    const leagueGames = games.filter((game) => String(game.league?.id) === leagueId);
    if (leagueGames.length === 0) continue;
    try {
      const fixtures = await fetchInCrowdOfficialFixtures(leagueId, leagueGames, fetchFn, nowMs);
      mergeMaps(overrides, matchKickoffFallbacks(leagueGames, fixtures, leagueId));
    } catch {
      // Best-effort fallback only
    }
  }

  return overrides;
}
