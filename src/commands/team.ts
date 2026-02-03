import { writeFile } from 'node:fs/promises';
import { loadConfig, loadSecrets, getEffectiveLeagues, DEFAULT_PROXY_LEAGUES } from '../lib/config.js';
import { LEAGUES } from '../lib/leagues.js';
import { ApiSportsProvider } from '../lib/providers/apisports.js';
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
import type { Match, TeamSearchOutput, MatchOutput } from '../types/index.js';

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
  const secrets = await loadSecrets();
  const hasApiKey = Boolean(secrets?.api_key);
  const provider = new ApiSportsProvider(secrets?.api_key);

  try {
    switch (action.toLowerCase()) {
      case 'search':
        await handleSearch(nameOrId, provider, options);
        break;
      case 'next':
        await handleNext(nameOrId, provider, config, hasApiKey, options);
        break;
      case 'last':
        await handleLast(nameOrId, provider, config, hasApiKey, options);
        break;
      default:
        // Default to 'next' if action looks like part of team name
        await handleNext(`${nameOrId} ${action}`.trim(), provider, config, hasApiKey, options);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(renderError(message));
    process.exit(1);
  }
}

async function handleSearch(
  query: string,
  provider: ApiSportsProvider,
  options: TeamOptions
): Promise<void> {
  const teams = await provider.searchTeams(query);

  const output: TeamSearchOutput = {
    query,
    teams: teams.slice(0, 10).map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.name.toLowerCase().replace(/\s+/g, '-'),
      country: t.country,
      leagues: [], // Would need additional API call to get leagues
    })),
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
  hasApiKey: boolean,
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
  const favoriteLeagues = hasApiKey ? await getEffectiveLeagues() : DEFAULT_PROXY_LEAGUES;
  const leagueIds = favoriteLeagues
    .map((slug) => LEAGUES[slug]?.id)
    .filter(Boolean) as string[];

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
    const searchResults = await provider.searchTeams(nameOrId);
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

  const output = matchToOutput(nextMatch, { timeZone: config.timezone });

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
  } else if (!options.quiet) {
    console.log(renderMatch(output, true, config.timezone)); // Show calendar hint
  }
}

async function handleLast(
  nameOrId: string,
  provider: ApiSportsProvider,
  config: Awaited<ReturnType<typeof loadConfig>>,
  hasApiKey: boolean,
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
  const favoriteLeagues = hasApiKey ? await getEffectiveLeagues() : DEFAULT_PROXY_LEAGUES;
  const leagueIds = favoriteLeagues
    .map((slug) => LEAGUES[slug]?.id)
    .filter(Boolean) as string[];

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
    const searchResults = await provider.searchTeams(nameOrId);
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

  const output: MatchOutput = matchToOutput(lastMatch, { timeZone: config.timezone });
  output.summary = generateSummary(lastMatch, teamId);

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
  } else if (!options.quiet) {
    console.log(renderMatch(output, false, config.timezone));
  }
}
