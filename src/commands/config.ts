import inquirer from 'inquirer';
import chalk from 'chalk';
import {
  loadConfig,
  saveConfig,
  loadSecrets,
  saveSecrets,
  DEFAULT_PROXY_LEAGUES,
  isValidTimeZone,
} from '../lib/config.js';
import { LEAGUES } from '../lib/leagues.js';
import { ApiSportsProvider } from '../lib/providers/apisports.js';
import type { Config, Secrets, FavoriteTeam, Team } from '../types/index.js';

interface ConfigOptions {
  json?: boolean;
  quiet?: boolean;
}

function getAllTimeZones(): string[] {
  if (typeof Intl.supportedValuesOf === 'function') {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch {
      // fall through
    }
  }
  return [];
}

async function promptForTimeZone(
  existing: string | undefined,
  detected: string
): Promise<string> {
  const featured = [
    { name: 'France — Europe/Paris', value: 'Europe/Paris' },
    { name: 'England — Europe/London', value: 'Europe/London' },
    { name: 'United States (Eastern) — America/New_York', value: 'America/New_York' },
    { name: 'Australia — Australia/Sydney', value: 'Australia/Sydney' },
    { name: 'New Zealand — Pacific/Auckland', value: 'Pacific/Auckland' },
    { name: 'South Africa — Africa/Johannesburg', value: 'Africa/Johannesburg' },
  ];

  const featuredValues = new Set(featured.map((c) => c.value));
  const all = getAllTimeZones();
  const other = all.filter((tz) => !featuredValues.has(tz)).sort((a, b) => a.localeCompare(b));

  const choices = [
    ...featured,
    new inquirer.Separator('────────'),
    ...other.map((tz) => ({ name: tz, value: tz })),
  ];

  const preferred = existing && isValidTimeZone(existing) ? existing : detected;
  const defaultValue = preferred && choices.some((c) => 'value' in c && c.value === preferred)
    ? preferred
    : featured[0].value;

  const { timezone } = await inquirer.prompt<{ timezone: string }>([
    {
      type: 'list',
      name: 'timezone',
      message: `Timezone (detected: ${detected})`,
      choices,
      pageSize: 15,
      default: defaultValue,
    },
  ]);

  return timezone;
}

export async function configCommand(options: ConfigOptions): Promise<void> {
  console.log(chalk.bold('\n🏉 Rugbyclaw Setup\n'));

  const existingConfig = await loadConfig();
  const existingSecrets = await loadSecrets();

  let provider: ApiSportsProvider;
  let savedApiKey: string | null = null;
  let mode: 'direct' | 'proxy' = 'proxy';

  // Step 1: Free mode by default (no API key required)
  console.log(chalk.cyan('Step 1: Choose your mode'));
  console.log(chalk.dim('Rugbyclaw works without an API key (free mode, limited requests).'));
  console.log(chalk.dim('Add your own API key any time to unlock more leagues + higher limits.\n'));

  if (existingSecrets?.api_key) {
    const { useSavedKey } = await inquirer.prompt<{ useSavedKey: boolean }>([
      {
        type: 'confirm',
        name: 'useSavedKey',
        message: 'Use your saved API key for unlimited access?',
        default: true,
      },
    ]);

    if (useSavedKey) {
      provider = new ApiSportsProvider(existingSecrets.api_key);
      savedApiKey = existingSecrets.api_key;
      mode = 'direct';
    } else {
      console.log(chalk.dim('\nUsing free mode (no API key).\n'));
      provider = new ApiSportsProvider();
      mode = 'proxy';
    }
  } else {
    const { addKey } = await inquirer.prompt<{ addKey: boolean }>([
      {
        type: 'confirm',
        name: 'addKey',
        message: 'Add an API key now?',
        default: false,
      },
    ]);

    if (addKey) {
      console.log(chalk.dim('Sign up: https://api-sports.io/rugby\n'));

      const { apiKey } = await inquirer.prompt<{ apiKey: string }>([
        {
          type: 'input',
          name: 'apiKey',
          message: 'API-Sports API key:',
          default: '',
        },
      ]);

      if (apiKey.trim().length === 0) {
        console.log(chalk.yellow('\nNo API key entered. Using free mode.\n'));
        provider = new ApiSportsProvider();
        mode = 'proxy';
      } else {
        // Test the API key
        console.log(chalk.dim('\nTesting API key...'));
        const testProvider = new ApiSportsProvider(apiKey);

        try {
          await testProvider.getLeagueFixtures(LEAGUES.top14.id);
          console.log(chalk.green('✓ API key is valid — unlimited access enabled\n'));

          // Save secrets only after validation succeeds
          const secrets: Secrets = { api_key: apiKey, api_tier: 'premium' };
          await saveSecrets(secrets);
          savedApiKey = apiKey;
          provider = testProvider;
          mode = 'direct';
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          console.log(chalk.red(`✗ API key test failed: ${message}`));
          console.log(chalk.yellow('Continuing with free mode (no API key).\n'));

          provider = new ApiSportsProvider();
          mode = 'proxy';
        }
      }
    } else {
      console.log(chalk.dim('\nUsing free mode (no API key).\n'));
      provider = new ApiSportsProvider();
      mode = 'proxy';
    }
  }

  // Step 2: Favorite leagues
  console.log(chalk.cyan('Step 2: Favorite Leagues'));
  console.log(chalk.dim('Select the competitions you want to follow\n'));

  // Pre-select defaults if no existing config
  const availableLeagueSlugs = mode === 'direct'
    ? Object.keys(LEAGUES)
    : DEFAULT_PROXY_LEAGUES;

  const defaultCheckedRaw = existingConfig.favorite_leagues.length > 0
    ? existingConfig.favorite_leagues
    : DEFAULT_PROXY_LEAGUES;
  const defaultChecked = defaultCheckedRaw.filter((slug) => availableLeagueSlugs.includes(slug));

  if (mode === 'proxy') {
    console.log(chalk.dim('Free mode leagues are limited. Add your own API key to unlock more.\n'));
  }

  const leagueChoices = Object.entries(LEAGUES)
    .filter(([slug]) => availableLeagueSlugs.includes(slug))
    .map(([slug, league]) => ({
      name: `${league.name} (${league.country})`,
      value: slug,
      checked: defaultChecked.includes(slug),
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
  console.log(chalk.cyan('\nStep 3: Favorite Teams (Optional)'));
  console.log(chalk.dim('Select teams to follow for team-specific commands.\n'));

  const favoriteTeams: FavoriteTeam[] = [];
  const existingTeamIds = new Set(existingConfig.favorite_teams.map((t) => t.id));

  const { pickTeams } = await inquirer.prompt<{ pickTeams: boolean }>([
    {
      type: 'confirm',
      name: 'pickTeams',
      message: 'Pick favorite teams now?',
      default: false,
    },
  ]);

  if (!pickTeams) {
    console.log(chalk.dim('\nSkipping team selection. You can run "rugbyclaw config" again any time.\n'));
  }

  let warnedTeamPickerUnavailable = false;

  for (const leagueSlug of favoriteLeagues) {
    if (!pickTeams) break;
    const league = LEAGUES[leagueSlug];
    console.log(chalk.dim(`Loading ${league.name} teams...`));

    try {
      const teams = await provider.getLeagueTeams(league.id);

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

      const { selectedTeams } = await inquirer.prompt<{ selectedTeams: Team[] }>([
        {
          type: 'checkbox',
          name: 'selectedTeams',
          message: `Select ${league.name} teams (optional):`,
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
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (
        mode === 'proxy' &&
        !warnedTeamPickerUnavailable &&
        (message.startsWith('Free mode is temporarily unavailable') || message.startsWith('Daily limit reached'))
      ) {
        warnedTeamPickerUnavailable = true;
        console.log(chalk.yellow('Team picker is unavailable in free mode right now.'));
        console.log(chalk.dim('You can still:'));
        console.log(chalk.dim('- Run "rugbyclaw team search <name>" later to find a team'));
        console.log(chalk.dim('- Rerun "rugbyclaw config" and add your own API key for reliable team lists\n'));
        break;
      }

      console.log(chalk.yellow(`Could not load teams for ${league.name}: ${message}\n`));
    }
  }

  // Step 4: Timezone
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const timezone = await promptForTimeZone(existingConfig.timezone, detectedTimezone);

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
  console.log(
    chalk.dim('Mode:'),
    mode === 'direct'
      ? chalk.green('Unlimited (own API key)')
      : chalk.yellow('Free tier (50 req/day)')
  );
  console.log(chalk.dim('Leagues:'), favoriteLeagues.join(', '));
  console.log(chalk.dim('Teams:'), favoriteTeams.map((t) => t.name).join(', ') || 'None');
  console.log(chalk.dim('Timezone:'), timezone);
  console.log('');

  if (!options.quiet) {
    console.log(chalk.cyan('Next steps:'));
    console.log(`  ${chalk.white('rugbyclaw status')}            Verify your setup`);
    console.log(`  ${chalk.white('rugbyclaw scores')}            Today’s matches`);
    console.log(`  ${chalk.white('rugbyclaw fixtures')}          Upcoming fixtures`);
    console.log(`  ${chalk.white('rugbyclaw team search <name>')} Find a team`);
    console.log(`  ${chalk.white('rugbyclaw notify --live')}     Live updates (polling)`);
    console.log('');
    console.log(chalk.dim('For OpenClaw/automation, prefer JSON output: add --json to commands.'));
    console.log('');
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        { config, mode, api_key_saved: Boolean(savedApiKey) },
        null,
        2
      )
    );
  }
}
