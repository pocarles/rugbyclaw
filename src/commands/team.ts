import { loadConfig, loadSecrets, isConfigured } from '../lib/config.js';
import { LEAGUES } from '../lib/leagues.js';
import { TheSportsDBProvider } from '../lib/providers/thesportsdb.js';
import {
  renderMatch,
  renderTeamSearch,
  matchToOutput,
  renderError,
  renderWarning,
} from '../render/terminal.js';
import { generateSummary } from '../lib/personality.js';
import type { Match, TeamSearchOutput, MatchOutput } from '../types/index.js';

interface TeamOptions {
  json?: boolean;
  quiet?: boolean;
}

export async function teamCommand(
  nameOrId: string,
  action: string,
  options: TeamOptions
): Promise<void> {
  // Check configuration
  if (!(await isConfigured())) {
    console.log(renderError('Not configured. Run "rugbyclaw config" first.'));
    process.exit(1);
  }

  const config = await loadConfig();
  const secrets = await loadSecrets();

  if (!secrets) {
    console.log(renderError('API key not found. Run "rugbyclaw config" first.'));
    process.exit(1);
  }

  const provider = new TheSportsDBProvider(secrets.api_key);

  try {
    switch (action.toLowerCase()) {
      case 'search':
        await handleSearch(nameOrId, provider, options);
        break;
      case 'next':
        await handleNext(nameOrId, provider, config, options);
        break;
      case 'last':
        await handleLast(nameOrId, provider, config, options);
        break;
      default:
        // Default to 'next' if action looks like part of team name
        await handleNext(`${nameOrId} ${action}`.trim(), provider, config, options);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(renderError(message));
    process.exit(1);
  }
}

async function handleSearch(
  query: string,
  provider: TheSportsDBProvider,
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
  provider: TheSportsDBProvider,
  config: Awaited<ReturnType<typeof loadConfig>>,
  options: TeamOptions
): Promise<void> {
  // First try to find team in favorites
  let teamId = config.favorite_teams.find(
    (t) =>
      t.id === nameOrId ||
      t.name.toLowerCase().includes(nameOrId.toLowerCase()) ||
      t.slug.includes(nameOrId.toLowerCase())
  )?.id;

  // If not in favorites, search for it
  if (!teamId) {
    const searchResults = await provider.searchTeams(nameOrId);
    if (searchResults.length === 0) {
      console.log(renderWarning(`No team found for "${nameOrId}"`));
      process.exit(0);
    }
    teamId = searchResults[0].id;
  }

  // Strategy: Query league fixtures and filter by team
  // This works around the free tier "home only" limitation
  const leagueIds = config.favorite_leagues
    .map((slug) => LEAGUES[slug]?.id)
    .filter(Boolean) as string[];

  const allFixtures: Match[] = [];

  for (const leagueId of leagueIds) {
    const fixtures = await provider.getLeagueFixtures(leagueId);
    const teamFixtures = fixtures.filter(
      (m) => m.homeTeam.id === teamId || m.awayTeam.id === teamId
    );
    allFixtures.push(...teamFixtures);
  }

  // Sort by date and get next match
  allFixtures.sort((a, b) => a.timestamp - b.timestamp);
  const nextMatch = allFixtures.find((m) => m.timestamp > Date.now());

  if (!nextMatch) {
    console.log(renderWarning('No upcoming matches found.'));
    process.exit(0);
  }

  const output = matchToOutput(nextMatch, teamId);

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
  } else if (!options.quiet) {
    console.log(renderMatch(output));
  }
}

async function handleLast(
  nameOrId: string,
  provider: TheSportsDBProvider,
  config: Awaited<ReturnType<typeof loadConfig>>,
  options: TeamOptions
): Promise<void> {
  // First try to find team in favorites
  let teamId = config.favorite_teams.find(
    (t) =>
      t.id === nameOrId ||
      t.name.toLowerCase().includes(nameOrId.toLowerCase()) ||
      t.slug.includes(nameOrId.toLowerCase())
  )?.id;

  let teamName = nameOrId;

  // If not in favorites, search for it
  if (!teamId) {
    const searchResults = await provider.searchTeams(nameOrId);
    if (searchResults.length === 0) {
      console.log(renderWarning(`No team found for "${nameOrId}"`));
      process.exit(0);
    }
    teamId = searchResults[0].id;
    teamName = searchResults[0].name;
  }

  // Strategy: Query league results and filter by team
  const leagueIds = config.favorite_leagues
    .map((slug) => LEAGUES[slug]?.id)
    .filter(Boolean) as string[];

  const allResults: Match[] = [];

  for (const leagueId of leagueIds) {
    const results = await provider.getLeagueResults(leagueId);
    const teamResults = results.filter(
      (m) => m.homeTeam.id === teamId || m.awayTeam.id === teamId
    );
    allResults.push(...teamResults);
  }

  // Sort by date (most recent first)
  allResults.sort((a, b) => b.timestamp - a.timestamp);
  const lastMatch = allResults[0];

  if (!lastMatch) {
    console.log(renderWarning('No recent results found.'));
    process.exit(0);
  }

  const output: MatchOutput = matchToOutput(lastMatch, teamId);
  output.summary = generateSummary(lastMatch, teamId);

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
  } else if (!options.quiet) {
    console.log(renderMatch(output));
  }
}
