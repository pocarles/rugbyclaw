import { writeFile } from 'node:fs/promises';
import {
  loadConfig,
  loadSecrets,
  getEffectiveLeagues,
  DEFAULT_PROXY_LEAGUES,
  getEffectiveTimeZone,
} from '../lib/config.js';
import { LEAGUES } from '../lib/leagues.js';
import { ApiSportsProvider } from '../lib/providers/apisports.js';
import { normalizeText, similarityScore } from '../lib/fuzzy.js';
import { getTeamQueryCandidates } from '../lib/team-aliases.js';
import {
  renderMatch,
  renderTeamSearch,
  matchToOutput,
  renderError,
  renderWarning,
  renderSuccess,
} from '../render/terminal.js';
import { generateSummary } from '../lib/personality.js';
import { matchToICS } from '../lib/ics.js';
import type { Match, TeamSearchOutput, MatchOutput, Team } from '../types/index.js';

interface TeamOptions {
  json?: boolean;
  quiet?: boolean;
  ics?: boolean;
}

export async function teamCommand(
  nameOrId: string,
  action: string,
  options: TeamOptions
): Promise<void> {
  // Get API key if available (otherwise use proxy mode)
  const config = await loadConfig();
  const timeZone = getEffectiveTimeZone(config);
  const secrets = await loadSecrets();
  const hasApiKey = Boolean(secrets?.api_key);
  const provider = new ApiSportsProvider(secrets?.api_key);
  const leagueSlugs = hasApiKey
    ? (config.favorite_leagues.length > 0 ? config.favorite_leagues : DEFAULT_PROXY_LEAGUES)
    : DEFAULT_PROXY_LEAGUES;
  const leagueIds = leagueSlugs
    .map((slug) => LEAGUES[slug]?.id)
    .filter(Boolean) as string[];

  try {
    switch (action.toLowerCase()) {
      case 'search':
        await handleSearch(nameOrId, provider, leagueIds, options);
        break;
      case 'next':
        await handleNext(nameOrId, provider, config, timeZone, hasApiKey, leagueIds, options);
        break;
      case 'last':
        await handleLast(nameOrId, provider, config, timeZone, hasApiKey, leagueIds, options);
        break;
      default:
        // Default to 'next' if action looks like part of team name
        await handleNext(
          `${nameOrId} ${action}`.trim(),
          provider,
          config,
          timeZone,
          hasApiKey,
          leagueIds,
          options
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(renderError(message));
    process.exit(1);
  }
}

function toOutputTeam(t: Team): TeamSearchOutput['teams'][number] {
  return {
    id: t.id,
    name: t.name,
    slug: t.name.toLowerCase().replace(/\s+/g, '-'),
    country: t.country,
    leagues: [],
  };
}

async function getLeagueTeams(
  provider: ApiSportsProvider,
  leagueIds: string[]
): Promise<Map<string, Team>> {
  const map = new Map<string, Team>();
  for (const leagueId of leagueIds) {
    try {
      const teams = await provider.getLeagueTeams(leagueId);
      for (const team of teams) {
        if (!map.has(team.id)) map.set(team.id, team);
      }
    } catch {
      // ignore per-league failures
    }
  }
  return map;
}

async function getTeamsFromLeagueFixtures(
  provider: ApiSportsProvider,
  leagueIds: string[]
): Promise<Map<string, Team>> {
  const map = new Map<string, Team>();
  for (const leagueId of leagueIds) {
    try {
      const fixtures = await provider.getLeagueFixtures(leagueId);
      for (const match of fixtures) {
        map.set(match.homeTeam.id, match.homeTeam);
        map.set(match.awayTeam.id, match.awayTeam);
      }
    } catch {
      // ignore per-league failures
    }
  }
  return map;
}

async function getTeamsFromLeagueResults(
  provider: ApiSportsProvider,
  leagueIds: string[]
): Promise<Map<string, Team>> {
  const map = new Map<string, Team>();
  for (const leagueId of leagueIds) {
    try {
      const results = await provider.getLeagueResults(leagueId);
      for (const match of results) {
        map.set(match.homeTeam.id, match.homeTeam);
        map.set(match.awayTeam.id, match.awayTeam);
      }
    } catch {
      // ignore per-league failures
    }
  }
  return map;
}

function pickBestTeamId(
  query: string,
  candidates: Array<{ id: string; name: string }>
): string | undefined {
  let bestId: string | undefined;
  let bestScore = 0;

  for (const c of candidates) {
    const score = similarityScore(query, c.name);
    if (score > bestScore) {
      bestScore = score;
      bestId = c.id;
    }
  }

  if (bestId && bestScore >= 0.62) return bestId;
  return undefined;
}

function pickBestTeamIdFromQueries(
  queries: string[],
  candidates: Array<{ id: string; name: string }>
): string | undefined {
  for (const query of queries) {
    const teamId = pickBestTeamId(query, candidates);
    if (teamId) return teamId;
  }
  return undefined;
}

function isWomenTeamName(name: string): boolean {
  const n = normalizeText(name);
  if (n.includes(' women') || n.includes(" women's")) return true;
  if (/\bw\b$/.test(n)) return true;
  return false;
}

async function handleSearch(
  query: string,
  provider: ApiSportsProvider,
  leagueIds: string[],
  options: TeamOptions
): Promise<void> {
  // Limit search to Rugby Union teams in supported leagues.
  let teams = await getLeagueTeams(provider, leagueIds);
  if (teams.size === 0) {
    teams = await getTeamsFromLeagueFixtures(provider, leagueIds);
  }
  if (teams.size === 0) {
    teams = await getTeamsFromLeagueResults(provider, leagueIds);
  }

  const queryCandidates = getTeamQueryCandidates(query);
  const queryNorm = normalizeText(query);
  const wantsWomen = /\b(w|women|womens|women's)\b/.test(queryNorm);

  const ranked = Array.from(teams.values())
    .map((team) => ({
      team,
      score: Math.max(...queryCandidates.map((candidate) => similarityScore(candidate, team.name))),
    }))
    .filter((r) => wantsWomen || !isWomenTeamName(r.team.name))
    .filter((r) => r.score >= 0.55)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((r) => r.team);

  if (ranked.length === 0) {
    console.log(renderWarning(`No Rugby Union team found for "${query}"`));
    process.exit(0);
  }

  const output: TeamSearchOutput = {
    query,
    teams: ranked.map(toOutputTeam),
  };

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
  } else if (!options.quiet) {
    console.log(renderTeamSearch(output));
  }
}

async function handleNext(
  nameOrId: string,
  provider: ApiSportsProvider,
  config: Awaited<ReturnType<typeof loadConfig>>,
  timeZone: string,
  hasApiKey: boolean,
  leagueIds: string[],
  options: TeamOptions
): Promise<void> {
  const queryCandidates = getTeamQueryCandidates(nameOrId);

  // First try to find team in favorites
  let teamId = config.favorite_teams.find(
    (t) =>
      queryCandidates.some((candidate) => t.id === candidate) ||
      queryCandidates.some((candidate) => t.name.toLowerCase().includes(candidate.toLowerCase())) ||
      queryCandidates.some((candidate) => t.slug.includes(candidate.toLowerCase()))
  )?.id;

  // Get effective leagues (user's favorites or defaults)
  if (hasApiKey && leagueIds.length === 0) {
    const favoriteLeagues = await getEffectiveLeagues();
    leagueIds = favoriteLeagues.map((slug) => LEAGUES[slug]?.id).filter(Boolean) as string[];
  }

  const allLeagueFixtures: Match[] = [];
  for (const leagueId of leagueIds) {
    const fixtures = await provider.getLeagueFixtures(leagueId);
    allLeagueFixtures.push(...fixtures);
  }

  // If not in favorites, first try to match team name in fixtures
  if (!teamId) {
    // Find team in fixtures by partial name match
    for (const match of allLeagueFixtures) {
      if (queryCandidates.some((candidate) => match.homeTeam.name.toLowerCase().includes(candidate.toLowerCase()))) {
        teamId = match.homeTeam.id;
        break;
      }
      if (queryCandidates.some((candidate) => match.awayTeam.name.toLowerCase().includes(candidate.toLowerCase()))) {
        teamId = match.awayTeam.id;
        break;
      }
    }
  }

  // If still not found, try search API
  if (!teamId) {
    // First try fuzzy match against teams seen in fixtures.
    const matchCandidates = new Map<string, { id: string; name: string }>();
    for (const m of allLeagueFixtures) {
      matchCandidates.set(m.homeTeam.id, { id: m.homeTeam.id, name: m.homeTeam.name });
      matchCandidates.set(m.awayTeam.id, { id: m.awayTeam.id, name: m.awayTeam.name });
    }

    teamId = pickBestTeamIdFromQueries(queryCandidates, Array.from(matchCandidates.values()));

    // Then try fuzzy match against league teams.
    if (!teamId) {
      const teamsMap = await getLeagueTeams(provider, leagueIds);
      teamId = pickBestTeamIdFromQueries(
        queryCandidates,
        Array.from(teamsMap.values()).map((t) => ({ id: t.id, name: t.name }))
      );
    }

    // Finally, fall back to API search.
    if (!teamId) {
      let searchResults: Team[] = [];
      for (const candidate of queryCandidates) {
        searchResults = await provider.searchTeams(candidate);
        if (searchResults.length > 0) break;
      }
      if (searchResults.length === 0) {
        console.log(renderWarning(`No team found for "${nameOrId}"`));
        process.exit(0);
      }

      // Find first search result that appears in our league fixtures
      for (const team of searchResults) {
        const hasMatches = allLeagueFixtures.some(
          (m) => m.homeTeam.id === team.id || m.awayTeam.id === team.id
        );
        if (hasMatches) {
          teamId = team.id;
          break;
        }
      }

      // Fallback to first result if no matches found
      if (!teamId) {
        teamId = searchResults[0].id;
      }
    }
  }

  // Filter fixtures for this team
  const teamFixtures = allLeagueFixtures.filter(
    (m) => m.homeTeam.id === teamId || m.awayTeam.id === teamId
  );

  // Sort by date and get next match
  teamFixtures.sort((a, b) => a.timestamp - b.timestamp);
  const nextMatch = teamFixtures.find((m) => m.timestamp > Date.now());

  if (!nextMatch) {
    console.log(renderWarning('No upcoming matches found.'));
    process.exit(0);
  }

  // Export to ICS if requested
  if (options.ics) {
    const ics = matchToICS(nextMatch);
    const filename = `${nextMatch.homeTeam.name.toLowerCase().replace(/\s+/g, '-')}-vs-${nextMatch.awayTeam.name.toLowerCase().replace(/\s+/g, '-')}.ics`;
    await writeFile(filename, ics);
    if (!options.quiet) {
      console.log(renderSuccess(`Calendar saved to ${filename}`));
    }
    return;
  }

  const output = matchToOutput(nextMatch, { timeZone });

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
  } else if (!options.quiet) {
    console.log(renderMatch(output, true, timeZone)); // Show calendar hint
  }
}

async function handleLast(
  nameOrId: string,
  provider: ApiSportsProvider,
  config: Awaited<ReturnType<typeof loadConfig>>,
  timeZone: string,
  hasApiKey: boolean,
  leagueIds: string[],
  options: TeamOptions
): Promise<void> {
  const queryCandidates = getTeamQueryCandidates(nameOrId);

  // First try to find team in favorites
  let teamId = config.favorite_teams.find(
    (t) =>
      queryCandidates.some((candidate) => t.id === candidate) ||
      queryCandidates.some((candidate) => t.name.toLowerCase().includes(candidate.toLowerCase())) ||
      queryCandidates.some((candidate) => t.slug.includes(candidate.toLowerCase()))
  )?.id;

  // Get effective leagues (user's favorites or defaults)
  if (hasApiKey && leagueIds.length === 0) {
    const favoriteLeagues = await getEffectiveLeagues();
    leagueIds = favoriteLeagues.map((slug) => LEAGUES[slug]?.id).filter(Boolean) as string[];
  }

  const allLeagueResults: Match[] = [];
  for (const leagueId of leagueIds) {
    const results = await provider.getLeagueResults(leagueId);
    allLeagueResults.push(...results);
  }

  // If not in favorites, first try to match team name in results
  if (!teamId) {
    // Find team in results by partial name match
    for (const match of allLeagueResults) {
      if (queryCandidates.some((candidate) => match.homeTeam.name.toLowerCase().includes(candidate.toLowerCase()))) {
        teamId = match.homeTeam.id;
        break;
      }
      if (queryCandidates.some((candidate) => match.awayTeam.name.toLowerCase().includes(candidate.toLowerCase()))) {
        teamId = match.awayTeam.id;
        break;
      }
    }
  }

  // If still not found, try search API
  if (!teamId) {
    // First try fuzzy match against teams seen in results.
    const matchCandidates = new Map<string, { id: string; name: string }>();
    for (const m of allLeagueResults) {
      matchCandidates.set(m.homeTeam.id, { id: m.homeTeam.id, name: m.homeTeam.name });
      matchCandidates.set(m.awayTeam.id, { id: m.awayTeam.id, name: m.awayTeam.name });
    }

    teamId = pickBestTeamIdFromQueries(queryCandidates, Array.from(matchCandidates.values()));

    // Then try fuzzy match against league teams.
    if (!teamId) {
      const teamsMap = await getLeagueTeams(provider, leagueIds);
      teamId = pickBestTeamIdFromQueries(
        queryCandidates,
        Array.from(teamsMap.values()).map((t) => ({ id: t.id, name: t.name }))
      );
    }

    // Finally, fall back to API search.
    if (!teamId) {
      let searchResults: Team[] = [];
      for (const candidate of queryCandidates) {
        searchResults = await provider.searchTeams(candidate);
        if (searchResults.length > 0) break;
      }
      if (searchResults.length === 0) {
        console.log(renderWarning(`No team found for "${nameOrId}"`));
        process.exit(0);
      }

      // Find first search result that appears in our league results
      for (const team of searchResults) {
        const hasMatches = allLeagueResults.some(
          (m) => m.homeTeam.id === team.id || m.awayTeam.id === team.id
        );
        if (hasMatches) {
          teamId = team.id;
          break;
        }
      }

      // Fallback to first result if no matches found
      if (!teamId) {
        teamId = searchResults[0].id;
      }
    }
  }

  // Filter results for this team
  const teamResults = allLeagueResults.filter(
    (m) => m.homeTeam.id === teamId || m.awayTeam.id === teamId
  );

  // Sort by date (most recent first)
  teamResults.sort((a, b) => b.timestamp - a.timestamp);
  const lastMatch = teamResults[0];

  if (!lastMatch) {
    console.log(renderWarning('No recent results found.'));
    process.exit(0);
  }

  const output: MatchOutput = matchToOutput(lastMatch, { timeZone });
  output.summary = generateSummary(lastMatch, teamId);

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
  } else if (!options.quiet) {
    console.log(renderMatch(output, false, timeZone));
  }
}
