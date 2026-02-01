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
import type { Config, Secrets, FavoriteTeam } from '../types/index.js';

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

  // Step 3: Favorite teams
  console.log(chalk.cyan('\nStep 3: Favorite Teams'));
  console.log(chalk.dim('Search for teams to follow (optional)\n'));

  const favoriteTeams: FavoriteTeam[] = [...existingConfig.favorite_teams];

  let addMore = true;
  while (addMore) {
    const { searchTeam } = await inquirer.prompt<{ searchTeam: boolean }>([
      {
        type: 'confirm',
        name: 'searchTeam',
        message: favoriteTeams.length === 0
          ? 'Would you like to add a favorite team?'
          : 'Add another team?',
        default: favoriteTeams.length === 0,
      },
    ]);

    if (!searchTeam) {
      addMore = false;
      continue;
    }

    const { query } = await inquirer.prompt<{ query: string }>([
      {
        type: 'input',
        name: 'query',
        message: 'Team name to search:',
      },
    ]);

    if (!query) continue;

    console.log(chalk.dim('Searching...'));
    const teams = await provider.searchTeams(query);

    if (teams.length === 0) {
      console.log(chalk.yellow('No teams found. Try a different search.\n'));
      continue;
    }

    const teamChoices = teams.slice(0, 10).map((t) => ({
      name: `${t.name}${t.country ? ` (${t.country})` : ''}`,
      value: t,
    }));

    const { selectedTeam } = await inquirer.prompt<{ selectedTeam: typeof teams[0] | null }>([
      {
        type: 'list',
        name: 'selectedTeam',
        message: 'Select team:',
        choices: [
          ...teamChoices,
          { name: 'None of these', value: null },
        ],
      },
    ]);

    if (selectedTeam && !favoriteTeams.some((t) => t.id === selectedTeam.id)) {
      favoriteTeams.push({
        id: selectedTeam.id,
        name: selectedTeam.name,
        slug: selectedTeam.name.toLowerCase().replace(/\s+/g, '-'),
        leagueIds: favoriteLeagues.map((slug) => LEAGUES[slug].id),
      });
      console.log(chalk.green(`✓ Added ${selectedTeam.name}\n`));
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
