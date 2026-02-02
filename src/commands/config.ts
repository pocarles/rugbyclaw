import inquirer from 'inquirer';
import chalk from 'chalk';
import {
  loadConfig,
  saveConfig,
  loadSecrets,
  saveSecrets,
  isConfigured,
} from '../lib/config.js';
import { LEAGUES, getLeagueSlugs } from '../lib/leagues.js';
import { TheSportsDBProvider } from '../lib/providers/thesportsdb.js';
import { getStaticTeams } from '../lib/teams-data.js';
import type { Config, Secrets, FavoriteTeam, Team } from '../types/index.js';

interface ConfigOptions {
  json?: boolean;
  quiet?: boolean;
}

export async function configCommand(options: ConfigOptions): Promise<void> {
  console.log(chalk.bold('\n🏉 Rugbyclaw Setup\n'));

  const existingConfig = await loadConfig();
  const existingSecrets = await loadSecrets();

  // Step 1: API Key
  console.log(chalk.cyan('Step 1: API Key'));
  console.log(chalk.dim('Get your free API key at https://www.thesportsdb.com/api.php'));
  console.log(chalk.dim('Use "123" for testing (limited to 30 req/min)\n'));

  const { apiKey } = await inquirer.prompt<{ apiKey: string }>([
    {
      type: 'input',
      name: 'apiKey',
      message: 'TheSportsDB API key:',
      default: existingSecrets?.api_key || '123',
      validate: (input: string) => input.length > 0 || 'API key is required',
    },
  ]);

  // Test the API key
  console.log(chalk.dim('\nTesting API key...'));
  const provider = new TheSportsDBProvider(apiKey);

  try {
    await provider.getLeagueFixtures(LEAGUES.top14.id);
    console.log(chalk.green('✓ API key is valid\n'));
  } catch (error) {
    console.log(chalk.red('✗ API key test failed. Continuing anyway...\n'));
  }

  const { apiTier } = await inquirer.prompt<{ apiTier: 'free' | 'premium' }>([
    {
      type: 'list',
      name: 'apiTier',
      message: 'API tier:',
      choices: [
        { name: 'Free (30 req/min, limited features)', value: 'free' },
        { name: 'Premium ($9/month, 100 req/min, live scores)', value: 'premium' },
      ],
      default: existingSecrets?.api_tier || 'free',
    },
  ]);

  // Save secrets
  const secrets: Secrets = { api_key: apiKey, api_tier: apiTier };
  await saveSecrets(secrets);

  // Step 2: Favorite leagues
  console.log(chalk.cyan('\nStep 2: Favorite Leagues'));
  console.log(chalk.dim('Select the competitions you want to follow\n'));

  const leagueChoices = Object.entries(LEAGUES).map(([slug, league]) => ({
    name: `${league.name} (${league.country})`,
    value: slug,
    checked: existingConfig.favorite_leagues.includes(slug),
  }));

  const { favoriteLeagues } = await inquirer.prompt<{ favoriteLeagues: string[] }>([
    {
      type: 'checkbox',
      name: 'favoriteLeagues',
      message: 'Select leagues:',
      choices: leagueChoices,
      validate: (input: string[]) =>
        input.length > 0 || 'Select at least one league',
    },
  ]);

  // Step 3: Favorite teams (per league selection)
  console.log(chalk.cyan('\nStep 3: Favorite Teams'));
  console.log(chalk.dim('Select teams to follow from each league\n'));

  const favoriteTeams: FavoriteTeam[] = [];
  const existingTeamIds = new Set(existingConfig.favorite_teams.map((t) => t.id));

  for (const leagueSlug of favoriteLeagues) {
    const league = LEAGUES[leagueSlug];
    console.log(chalk.dim(`Loading ${league.name} teams...`));

    try {
      let teams = await provider.getLeagueTeams(league.id, league.searchName || league.name);

      // Supplement with static data if API returns incomplete results
      const staticTeams = await getStaticTeams(leagueSlug);
      if (staticTeams.length > 0) {
        const teamIds = new Set(teams.map((t) => t.id));
        for (const staticTeam of staticTeams) {
          if (!teamIds.has(staticTeam.id)) {
            teams.push(staticTeam);
          }
        }
      }

      if (teams.length === 0) {
        console.log(chalk.yellow(`No teams found for ${league.name}\n`));
        continue;
      }

      // Sort teams alphabetically
      teams.sort((a, b) => a.name.localeCompare(b.name));

      const teamChoices = teams.map((t) => ({
        name: t.name,
        value: t,
        checked: existingTeamIds.has(t.id),
      }));

      const { selectedTeams } = await inquirer.prompt<{ selectedTeams: typeof teams }>([
        {
          type: 'checkbox',
          name: 'selectedTeams',
          message: `Select ${league.name} teams:`,
          choices: teamChoices,
          pageSize: 15,
        },
      ]);

      for (const team of selectedTeams) {
        // Check if already added from another league
        const existing = favoriteTeams.find((t) => t.id === team.id);
        if (existing) {
          // Add this league to the team's leagueIds
          if (!existing.leagueIds.includes(league.id)) {
            existing.leagueIds.push(league.id);
          }
        } else {
          favoriteTeams.push({
            id: team.id,
            name: team.name,
            slug: team.name.toLowerCase().replace(/\s+/g, '-'),
            leagueIds: [league.id],
          });
        }
      }

      if (selectedTeams.length > 0) {
        console.log(chalk.green(`✓ Selected ${selectedTeams.length} team(s)\n`));
      } else {
        console.log('');
      }
    } catch (error) {
      // Fall back to static data if API fails
      const staticTeams = await getStaticTeams(leagueSlug);
      if (staticTeams.length > 0) {
        console.log(chalk.dim(`Using cached team data for ${league.name}...`));

        const teamChoices = staticTeams
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((t) => ({
            name: t.name,
            value: t,
            checked: existingTeamIds.has(t.id),
          }));

        const { selectedTeams } = await inquirer.prompt<{ selectedTeams: Team[] }>([
          {
            type: 'checkbox',
            name: 'selectedTeams',
            message: `Select ${league.name} teams:`,
            choices: teamChoices,
            pageSize: 15,
          },
        ]);

        for (const team of selectedTeams) {
          const existing = favoriteTeams.find((t) => t.id === team.id);
          if (existing) {
            if (!existing.leagueIds.includes(league.id)) {
              existing.leagueIds.push(league.id);
            }
          } else {
            favoriteTeams.push({
              id: team.id,
              name: team.name,
              slug: team.name.toLowerCase().replace(/\s+/g, '-'),
              leagueIds: [league.id],
            });
          }
        }

        if (selectedTeams.length > 0) {
          console.log(chalk.green(`✓ Selected ${selectedTeams.length} team(s)\n`));
        } else {
          console.log('');
        }
      } else {
        console.log(chalk.yellow(`Could not load teams for ${league.name}\n`));
      }
    }
  }

  // Step 4: Timezone
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const { timezone } = await inquirer.prompt<{ timezone: string }>([
    {
      type: 'input',
      name: 'timezone',
      message: 'Timezone:',
      default: existingConfig.timezone || detectedTimezone,
    },
  ]);

  // Save config
  const config: Config = {
    schema_version: 1,
    timezone,
    favorite_leagues: favoriteLeagues,
    favorite_teams: favoriteTeams,
  };

  await saveConfig(config);

  // Summary
  console.log(chalk.bold('\n✓ Configuration saved!\n'));
  console.log(chalk.dim('Leagues:'), favoriteLeagues.join(', '));
  console.log(chalk.dim('Teams:'), favoriteTeams.map((t) => t.name).join(', ') || 'None');
  console.log(chalk.dim('Timezone:'), timezone);
  console.log('');

  if (options.json) {
    console.log(JSON.stringify({ config, secrets: { api_tier: secrets.api_tier } }, null, 2));
  }
}
