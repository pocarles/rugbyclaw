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
  quick?: boolean;
  guided?: boolean;
}

type SetupStyle = 'quick' | 'guided';
type AccessMode = 'direct' | 'proxy';

interface AccessModeResult {
  provider: ApiSportsProvider;
  mode: AccessMode;
  savedApiKey: string | null;
}

function renderSetupIntro(): void {
  console.log(chalk.bold('\n🏉  Rugbyclaw Setup'));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.dim('No stress — quick setup first, guided setup when you need it.\n'));
}

function renderStep(step: string, subtitle: string): void {
  console.log(chalk.bold.cyan(`◈ ${step}`));
  console.log(chalk.dim(`${subtitle}\n`));
}

function renderTip(message: string): void {
  console.log(chalk.magenta(`💡 ${message}`));
}

function renderDone(message: string): void {
  console.log(chalk.green(`✓ ${message}`));
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

function leagueLabel(slug: string): string {
  const league = LEAGUES[slug];
  return league ? `${league.name} (${league.country})` : slug;
}

function detectInitialSetup(config: Config, hasApiKey: boolean): boolean {
  return !hasApiKey && config.favorite_leagues.length === 0 && config.favorite_teams.length === 0;
}

async function promptForSetupStyle(options: ConfigOptions, isFirstSetup: boolean): Promise<SetupStyle> {
  if (options.quick && options.guided) {
    return 'quick';
  }
  if (options.quick) return 'quick';
  if (options.guided) return 'guided';

  if (isFirstSetup) {
    renderStep('Step 0: Setup style', 'First run detected — starting Quick setup automatically.');
    return 'quick';
  }

  renderStep('Step 0: Setup style', 'Quick setup is best for most people. We can always tune things later.');

  const { style } = await inquirer.prompt<{ style: SetupStyle }>([
    {
      type: 'list',
      name: 'style',
      message: 'How do you want to set up Rugbyclaw?',
      default: isFirstSetup ? 'quick' : 'guided',
      choices: [
        {
          name: 'Quick setup (recommended) — 30 seconds, free mode, default leagues',
          value: 'quick',
        },
        {
          name: 'Guided setup — choose mode, leagues, teams, timezone',
          value: 'guided',
        },
      ],
    },
  ]);

  return style;
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

  const featuredValues = new Set(featured.map((choice) => choice.value));
  const all = getAllTimeZones();
  const other = all.filter((tz) => !featuredValues.has(tz)).sort((a, b) => a.localeCompare(b));

  const choices = [
    ...featured,
    new inquirer.Separator('────────'),
    ...other.map((tz) => ({ name: tz, value: tz })),
  ];

  const preferred = existing && isValidTimeZone(existing) ? existing : detected;
  const defaultValue = preferred && choices.some((choice) => 'value' in choice && choice.value === preferred)
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

async function validateAndPersistApiKey(apiKeyInput: string): Promise<AccessModeResult> {
  const apiKey = apiKeyInput.trim();
  if (apiKey.length === 0) {
    console.log(chalk.yellow('\nNo API key entered. Staying in free mode.\n'));
    return {
      provider: new ApiSportsProvider(),
      mode: 'proxy',
      savedApiKey: null,
    };
  }

  console.log(chalk.dim('\nTesting API key...'));
  const candidateProvider = new ApiSportsProvider(apiKey);

  try {
    await candidateProvider.getLeagueFixtures(LEAGUES.top14.id);
    const secrets: Secrets = { api_key: apiKey, api_tier: 'premium' };
    await saveSecrets(secrets);
    console.log(chalk.green('✓ API key is valid — unlimited access enabled\n'));
    return {
      provider: candidateProvider,
      mode: 'direct',
      savedApiKey: apiKey,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`✗ API key test failed: ${message}`));
    console.log(chalk.yellow('Continuing with free mode (no API key).\n'));
    return {
      provider: new ApiSportsProvider(),
      mode: 'proxy',
      savedApiKey: null,
    };
  }
}

async function resolveAccessMode(existingSecrets: Secrets | null, setupStyle: SetupStyle): Promise<AccessModeResult> {
  renderStep('Step 1: Access mode', 'Free mode is enough to get started. Add API key only if you need more leagues/limits.');

  if (setupStyle === 'quick') {
    if (existingSecrets?.api_key) {
      renderTip('Quick setup keeps your saved API key.');
      console.log('');
      return {
        provider: new ApiSportsProvider(existingSecrets.api_key),
        mode: 'direct',
        savedApiKey: existingSecrets.api_key,
      };
    }

    renderTip('Quick setup uses free mode by default (no API key).');
    console.log('');
    return {
      provider: new ApiSportsProvider(),
      mode: 'proxy',
      savedApiKey: null,
    };
  }

  if (existingSecrets?.api_key) {
    const { useSavedKey } = await inquirer.prompt<{ useSavedKey: boolean }>([
      {
        type: 'confirm',
        name: 'useSavedKey',
        message: 'Use your saved API key?',
        default: true,
      },
    ]);

    if (useSavedKey) {
      return {
        provider: new ApiSportsProvider(existingSecrets.api_key),
        mode: 'direct',
        savedApiKey: existingSecrets.api_key,
      };
    }

  }

  const { addKeyNow } = await inquirer.prompt<{ addKeyNow: boolean }>([
    {
      type: 'confirm',
      name: 'addKeyNow',
      message: 'Add API key now? (optional)',
      default: false,
    },
  ]);

  if (!addKeyNow) {
    renderTip('Using free mode (no API key).');
    console.log('');
    return {
      provider: new ApiSportsProvider(),
      mode: 'proxy',
      savedApiKey: null,
    };
  }

  console.log(chalk.dim('Get a key: https://api-sports.io/rugby\n'));
  const { apiKey } = await inquirer.prompt<{ apiKey: string }>([
    {
      type: 'input',
      name: 'apiKey',
      message: 'API-Sports API key:',
      default: '',
    },
  ]);

  return validateAndPersistApiKey(apiKey);
}

function buildLeagueChoices(
  mode: AccessMode,
  existingConfig: Config
): Array<{ name: string; value: string; checked: boolean }> {
  const availableLeagueSlugs = mode === 'direct'
    ? Object.keys(LEAGUES)
    : DEFAULT_PROXY_LEAGUES;

  const defaultCheckedRaw = existingConfig.favorite_leagues.length > 0
    ? existingConfig.favorite_leagues
    : DEFAULT_PROXY_LEAGUES;
  const defaultChecked = defaultCheckedRaw.filter((slug) => availableLeagueSlugs.includes(slug));

  return Object.entries(LEAGUES)
    .filter(([slug]) => availableLeagueSlugs.includes(slug))
    .map(([slug, league]) => ({
      name: `${league.name} (${league.country})`,
      value: slug,
      checked: defaultChecked.includes(slug),
    }));
}

async function promptForFavoriteLeagues(
  mode: AccessMode,
  existingConfig: Config,
  setupStyle: SetupStyle
): Promise<string[]> {
  renderStep('Step 2: Favorite leagues', 'These decide what you see in scores and fixtures.');

  if (mode === 'proxy') {
    renderTip('Free mode uses the default league set.');
    console.log('');
  }

  const leagueChoices = buildLeagueChoices(mode, existingConfig);
  const recommended = leagueChoices.filter((choice) => choice.checked).map((choice) => choice.value);

  if (setupStyle === 'quick') {
    const quickDefault = (recommended.length > 0 ? recommended : DEFAULT_PROXY_LEAGUES)
      .filter((slug) => leagueChoices.some((choice) => choice.value === slug));
    const recommendedLabels = quickDefault
      .map((slug) => leagueLabel(slug))
      .join(', ');
    renderDone(`Quick setup selects: ${chalk.cyan(recommendedLabels)}`);
    console.log('');
    return quickDefault;
  }

  const { favoriteLeagues } = await inquirer.prompt<{ favoriteLeagues: string[] }>([
    {
      type: 'checkbox',
      name: 'favoriteLeagues',
      message: 'Select leagues:',
      choices: leagueChoices,
      validate: (input: string[]) => input.length > 0 || 'Select at least one league',
    },
  ]);

  return favoriteLeagues;
}

async function promptForFavoriteTeams(
  provider: ApiSportsProvider,
  mode: AccessMode,
  favoriteLeagues: string[],
  existingConfig: Config,
  setupStyle: SetupStyle
): Promise<FavoriteTeam[]> {
  renderStep('Step 3: Favorite teams (optional)', 'You can skip this now and still use Rugbyclaw normally.');

  if (setupStyle === 'quick') {
    if (existingConfig.favorite_teams.length > 0) {
      renderDone(`Quick setup keeps your ${existingConfig.favorite_teams.length} existing favorite team(s).`);
      console.log('');
      return existingConfig.favorite_teams;
    }

    renderTip('Quick setup skips team picking for now.');
    console.log(chalk.dim('Add teams anytime with "rugbyclaw config --guided".\n'));
    return [];
  }

  const favoriteTeams: FavoriteTeam[] = [];
  const existingTeamIds = new Set(existingConfig.favorite_teams.map((team) => team.id));

  const { pickTeams } = await inquirer.prompt<{ pickTeams: boolean }>([
    {
      type: 'confirm',
      name: 'pickTeams',
      message: 'Pick favorite teams now?',
      default: false,
    },
  ]);

  if (!pickTeams) {
    console.log(chalk.dim('\nSkipping team selection. You can rerun setup anytime.\n'));
    return favoriteTeams;
  }

  let warnedTeamPickerUnavailable = false;

  for (const leagueSlug of favoriteLeagues) {
    const league = LEAGUES[leagueSlug];
    if (!league) continue;

    console.log(chalk.dim(`Loading ${league.name} teams...`));

    try {
      const teams = await provider.getLeagueTeams(league.id);

      if (teams.length === 0) {
        console.log(chalk.yellow(`No teams found for ${league.name}\n`));
        continue;
      }

      teams.sort((a, b) => a.name.localeCompare(b.name));

      const teamChoices = teams.map((team) => ({
        name: team.name,
        value: team,
        checked: existingTeamIds.has(team.id),
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
        const existing = favoriteTeams.find((item) => item.id === team.id);
        if (existing) {
          if (!existing.leagueIds.includes(league.id)) {
            existing.leagueIds.push(league.id);
          }
          continue;
        }

        favoriteTeams.push({
          id: team.id,
          name: team.name,
          slug: team.name.toLowerCase().replace(/\s+/g, '-'),
          leagueIds: [league.id],
        });
      }

      if (selectedTeams.length > 0) {
        renderDone(`Selected ${selectedTeams.length} team(s)`);
        console.log('');
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
        console.log(chalk.dim('- Run "rugbyclaw team search <name>" later'));
        console.log(chalk.dim('- Add your own API key later for stable team lists\n'));
        break;
      }

      console.log(chalk.yellow(`Could not load teams for ${league.name}: ${message}\n`));
    }
  }

  return favoriteTeams;
}

async function promptForFinalTimeZone(existingTimezone: string, setupStyle: SetupStyle): Promise<string> {
  renderStep('Step 4: Timezone', 'We use this to show dates/times correctly for you.');

  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const preferredTimezone = isValidTimeZone(existingTimezone) ? existingTimezone : detectedTimezone;

  if (setupStyle === 'quick') {
    const { keepDetected } = await inquirer.prompt<{ keepDetected: boolean }>([
      {
        type: 'confirm',
        name: 'keepDetected',
        message: `Use ${preferredTimezone}?`,
        default: true,
      },
    ]);

    if (keepDetected) {
      return preferredTimezone;
    }
  }

  return promptForTimeZone(existingTimezone, detectedTimezone);
}

export async function configCommand(options: ConfigOptions): Promise<void> {
  renderSetupIntro();

  const existingConfig = await loadConfig();
  const existingSecrets = await loadSecrets();
  const isFirstSetup = detectInitialSetup(existingConfig, Boolean(existingSecrets?.api_key));
  const setupStyle = await promptForSetupStyle(options, isFirstSetup);

  const access = await resolveAccessMode(existingSecrets, setupStyle);
  const favoriteLeagues = await promptForFavoriteLeagues(access.mode, existingConfig, setupStyle);
  const favoriteTeams = await promptForFavoriteTeams(
    access.provider,
    access.mode,
    favoriteLeagues,
    existingConfig,
    setupStyle
  );
  const timezone = await promptForFinalTimeZone(existingConfig.timezone, setupStyle);

  const config: Config = {
    schema_version: 1,
    timezone,
    favorite_leagues: favoriteLeagues,
    favorite_teams: favoriteTeams,
  };

  await saveConfig(config);

  console.log(chalk.bold.green('\n✓ Configuration saved!\n'));
  console.log(chalk.dim('Setup style:'), setupStyle === 'quick' ? chalk.green('Quick') : chalk.cyan('Guided'));
  console.log(
    chalk.dim('Mode:'),
    access.mode === 'direct'
      ? chalk.green('Unlimited (own API key)')
      : chalk.yellow('Free tier (50 req/day)')
  );
  console.log(chalk.dim('Leagues:'), chalk.cyan(favoriteLeagues.join(', ')));
  console.log(chalk.dim('Teams:'), favoriteTeams.length > 0 ? chalk.cyan(favoriteTeams.map((team) => team.name).join(', ')) : chalk.dim('None'));
  console.log(chalk.dim('Timezone:'), chalk.cyan(timezone));
  console.log('');

  if (!options.quiet) {
    console.log(chalk.bold.cyan('Try these commands next (in order):'));
    console.log(`  ${chalk.white('1) rugbyclaw status')}                Confirm your setup`);
    console.log(`  ${chalk.white('2) rugbyclaw scores --explain')}      Today + why empty if needed`);
    console.log(`  ${chalk.white('3) rugbyclaw fixtures')}              Upcoming matches`);
    console.log(`  ${chalk.white('4) rugbyclaw team search toulouse')}  Find a team`);
    console.log(`  ${chalk.white('5) rugbyclaw doctor')}                Full health check`);
    console.log('');
    console.log(chalk.dim('Need extra help? Run "rugbyclaw config --guided" for full setup.'));
    console.log(chalk.dim('Need automation/OpenClaw? Add --json to commands for machine-readable output.'));
    console.log('');
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          config,
          mode: access.mode,
          api_key_saved: Boolean(access.savedApiKey),
          setup_style: setupStyle,
        },
        null,
        2
      )
    );
  }
}
