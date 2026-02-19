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
import {
  renderMatch,
  renderTeamSearch,
  matchToOutput,
  renderWarning,
  renderSuccess,
} from '../render/terminal.js';
import { exitWithError, printJson } from '../lib/cli-output.js';
import { generateSummary } from '../lib/personality.js';
import { matchToICS } from '../lib/ics.js';
import { toSafeFileSlug } from '../lib/safe-filename.js';
import type { Match, TeamSearchOutput, MatchOutput, Team, TeamMatchQueryOutput } from '../types/index.js';

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
    exitWithError(message, options);
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

  const queryNorm = normalizeText(query);
  const wantsWomen = /\b(w|women|womens|women's)\b/.test(queryNorm);

  const ranked = Array.from(teams.values())
    .map((t) => ({ team: t, score: similarityScore(query, t.name) }))
    .filter((r) => wantsWomen || !isWomenTeamName(r.team.name))
    .filter((r) => r.score >= 0.55)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((r) => r.team);

  if (ranked.length === 0) {
    const output: TeamSearchOutput = { query, teams: [] };
    if (options.json) {
      printJson(output);
      return;
    }
    if (!options.quiet) {
      console.log(renderWarning(`No Rugby Union team found for "${query}"`));
    }
    return;
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
  // First try to find team in favorites
  let teamId = config.favorite_teams.find(
    (t) =>
      t.id === nameOrId ||
      t.name.toLowerCase().includes(nameOrId.toLowerCase()) ||
      t.slug.includes(nameOrId.toLowerCase())
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
    const searchLower = nameOrId.toLowerCase();

    // Find team in fixtures by partial name match
    for (const match of allLeagueFixtures) {
      if (match.homeTeam.name.toLowerCase().includes(searchLower)) {
        teamId = match.homeTeam.id;
        break;
      }
      if (match.awayTeam.name.toLowerCase().includes(searchLower)) {
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

    teamId = pickBestTeamId(nameOrId, Array.from(matchCandidates.values()));

    // Then try fuzzy match against league teams.
    if (!teamId) {
      const teamsMap = await getLeagueTeams(provider, leagueIds);
      teamId = pickBestTeamId(
        nameOrId,
        Array.from(teamsMap.values()).map((t) => ({ id: t.id, name: t.name }))
      );
    }

    // Finally, fall back to API search.
  if (!teamId) {
      const searchResults = await provider.searchTeams(nameOrId);
      if (searchResults.length === 0) {
        if (options.json) {
          const output: TeamMatchQueryOutput = {
            action: 'next',
            query: nameOrId,
            team_id: null,
            match: null,
            reason: `No team found for "${nameOrId}"`,
            generated_at: new Date().toISOString(),
          };
          printJson(output);
          return;
        }
        if (!options.quiet) {
          console.log(renderWarning(`No team found for "${nameOrId}"`));
        }
        return;
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
    if (options.json) {
      const output: TeamMatchQueryOutput = {
        action: 'next',
        query: nameOrId,
        team_id: teamId ?? null,
        match: null,
        reason: 'No upcoming matches found.',
        generated_at: new Date().toISOString(),
      };
      printJson(output);
      return;
    }
    if (!options.quiet) {
      console.log(renderWarning('No upcoming matches found.'));
    }
    return;
  }

  // Export to ICS if requested
  if (options.ics) {
    const ics = matchToICS(nextMatch);
    const filename = `${toSafeFileSlug(nextMatch.homeTeam.name)}-vs-${toSafeFileSlug(nextMatch.awayTeam.name)}-${nextMatch.id}.ics`;
    await writeFile(filename, ics);
    if (options.json) {
      printJson({
        exported: true,
        out: filename,
        match_id: nextMatch.id,
        home: nextMatch.homeTeam.name,
        away: nextMatch.awayTeam.name,
        generated_at: new Date().toISOString(),
      });
      return;
    }
    if (!options.quiet) {
      console.log(renderSuccess(`Calendar saved to ${filename}`));
    }
    return;
  }

  const output = matchToOutput(nextMatch, { timeZone });

  if (options.json) {
    const jsonOutput: TeamMatchQueryOutput = {
      action: 'next',
      query: nameOrId,
      team_id: teamId ?? null,
      match: output,
      generated_at: new Date().toISOString(),
    };
    printJson(jsonOutput);
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
  // First try to find team in favorites
  let teamId = config.favorite_teams.find(
    (t) =>
      t.id === nameOrId ||
      t.name.toLowerCase().includes(nameOrId.toLowerCase()) ||
      t.slug.includes(nameOrId.toLowerCase())
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
    const searchLower = nameOrId.toLowerCase();

    // Find team in results by partial name match
    for (const match of allLeagueResults) {
      if (match.homeTeam.name.toLowerCase().includes(searchLower)) {
        teamId = match.homeTeam.id;
        break;
      }
      if (match.awayTeam.name.toLowerCase().includes(searchLower)) {
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

    teamId = pickBestTeamId(nameOrId, Array.from(matchCandidates.values()));

    // Then try fuzzy match against league teams.
    if (!teamId) {
      const teamsMap = await getLeagueTeams(provider, leagueIds);
      teamId = pickBestTeamId(
        nameOrId,
        Array.from(teamsMap.values()).map((t) => ({ id: t.id, name: t.name }))
      );
    }

    // Finally, fall back to API search.
    if (!teamId) {
      const searchResults = await provider.searchTeams(nameOrId);
      if (searchResults.length === 0) {
        if (options.json) {
          const output: TeamMatchQueryOutput = {
            action: 'last',
            query: nameOrId,
            team_id: null,
            match: null,
            reason: `No team found for "${nameOrId}"`,
            generated_at: new Date().toISOString(),
          };
          printJson(output);
          return;
        }
        if (!options.quiet) {
          console.log(renderWarning(`No team found for "${nameOrId}"`));
        }
        return;
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
    if (options.json) {
      const output: TeamMatchQueryOutput = {
        action: 'last',
        query: nameOrId,
        team_id: teamId ?? null,
        match: null,
        reason: 'No recent results found.',
        generated_at: new Date().toISOString(),
      };
      printJson(output);
      return;
    }
    if (!options.quiet) {
      console.log(renderWarning('No recent results found.'));
    }
    return;
  }

  const output: MatchOutput = matchToOutput(lastMatch, { timeZone });
  output.summary = generateSummary(lastMatch, teamId);

  if (options.json) {
    const jsonOutput: TeamMatchQueryOutput = {
      action: 'last',
      query: nameOrId,
      team_id: teamId ?? null,
      match: output,
      generated_at: new Date().toISOString(),
    };
    printJson(jsonOutput);
    return;
  }
  if (!options.quiet) {
    console.log(renderMatch(output, false, timeZone));
  }
}
