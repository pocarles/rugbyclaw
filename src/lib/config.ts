import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Config, Secrets, State, FavoriteTeam } from '../types/index.js';

const CONFIG_DIR = join(homedir(), '.config', 'rugbyclaw');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');
const SECRETS_PATH = join(CONFIG_DIR, 'secrets.json');
const STATE_PATH = join(CONFIG_DIR, 'state.json');

const CURRENT_SCHEMA_VERSION = 1;

/**
 * Default leagues for proxy mode (users without their own API key).
 * Most popular: Top 14, Premiership, URC, Champions Cup, Six Nations
 */
export const DEFAULT_PROXY_LEAGUES = ['top14', 'premiership', 'urc', 'champions_cup', 'six_nations'];

// Default config
const DEFAULT_CONFIG: Config = {
  schema_version: CURRENT_SCHEMA_VERSION,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  favorite_leagues: [],
  favorite_teams: [],
};

// Default state
const DEFAULT_STATE: State = {
  matches: {},
  last_updated: Date.now(),
};

/**
 * Ensure config directory exists.
 */
async function ensureConfigDir(): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load user configuration.
 */
export async function loadConfig(): Promise<Config> {
  try {
    const data = await readFile(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(data) as Config;

    // Migrate if needed
    if (config.schema_version < CURRENT_SCHEMA_VERSION) {
      const migrated = migrateConfig(config);
      await saveConfig(migrated);
      return migrated;
    }

    return config;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save user configuration.
 */
export async function saveConfig(config: Config): Promise<void> {
  await ensureConfigDir();
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

/**
 * Migrate config to latest schema version.
 */
function migrateConfig(config: Config): Config {
  // Add migrations here as needed
  return {
    ...DEFAULT_CONFIG,
    ...config,
    schema_version: CURRENT_SCHEMA_VERSION,
  };
}

/**
 * Load API secrets.
 */
export async function loadSecrets(): Promise<Secrets | null> {
  try {
    const data = await readFile(SECRETS_PATH, 'utf-8');
    return JSON.parse(data) as Secrets;
  } catch {
    return null;
  }
}

/**
 * Save API secrets.
 */
export async function saveSecrets(secrets: Secrets): Promise<void> {
  await ensureConfigDir();
  await writeFile(SECRETS_PATH, JSON.stringify(secrets, null, 2), { mode: 0o600 });
}

/**
 * Check if rugbyclaw is fully configured (has API key).
 */
export async function isConfigured(): Promise<boolean> {
  const secrets = await loadSecrets();
  return secrets !== null && secrets.api_key.length > 0;
}

/**
 * Check if user has customized their leagues (ran config wizard).
 */
export async function hasCustomConfig(): Promise<boolean> {
  return existsSync(CONFIG_PATH);
}

/**
 * Get effective leagues (user's favorites or defaults for proxy mode).
 */
export async function getEffectiveLeagues(): Promise<string[]> {
  const config = await loadConfig();

  // If user has configured favorite leagues, use those
  if (config.favorite_leagues.length > 0) {
    return config.favorite_leagues;
  }

  // Otherwise use default proxy leagues
  return DEFAULT_PROXY_LEAGUES;
}

/**
 * Load notification state.
 */
export async function loadState(): Promise<State> {
  try {
    const data = await readFile(STATE_PATH, 'utf-8');
    return JSON.parse(data) as State;
  } catch {
    return { ...DEFAULT_STATE };
  }
}

/**
 * Save notification state.
 */
export async function saveState(state: State): Promise<void> {
  await ensureConfigDir();
  state.last_updated = Date.now();
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2));
}

/**
 * Add a favorite team.
 */
export async function addFavoriteTeam(team: FavoriteTeam): Promise<void> {
  const config = await loadConfig();

  // Check if already exists
  if (config.favorite_teams.some((t) => t.id === team.id)) {
    return;
  }

  config.favorite_teams.push(team);
  await saveConfig(config);
}

/**
 * Remove a favorite team.
 */
export async function removeFavoriteTeam(teamId: string): Promise<void> {
  const config = await loadConfig();
  config.favorite_teams = config.favorite_teams.filter((t) => t.id !== teamId);
  await saveConfig(config);
}

/**
 * Add a favorite league.
 */
export async function addFavoriteLeague(leagueSlug: string): Promise<void> {
  const config = await loadConfig();

  if (!config.favorite_leagues.includes(leagueSlug)) {
    config.favorite_leagues.push(leagueSlug);
    await saveConfig(config);
  }
}

/**
 * Remove a favorite league.
 */
export async function removeFavoriteLeague(leagueSlug: string): Promise<void> {
  const config = await loadConfig();
  config.favorite_leagues = config.favorite_leagues.filter((l) => l !== leagueSlug);
  await saveConfig(config);
}

/**
 * Get the config directory path.
 */
export function getConfigDir(): string {
  return CONFIG_DIR;
}
