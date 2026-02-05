import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import type { Config, Secrets, State, FavoriteTeam } from '../types/index.js';

const DEFAULT_CONFIG_DIR = join(homedir(), '.config', 'rugbyclaw');

let configDir = DEFAULT_CONFIG_DIR;
let configPath = join(configDir, 'config.json');
let secretsPath = join(configDir, 'secrets.json');
let statePath = join(configDir, 'state.json');

let timeZoneOverride: string | null = null;

export interface ConfigPaths {
  configDir: string;
  configPath: string;
  secretsPath: string;
  statePath: string;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function expandHome(path: string): string {
  if (path === '~') return homedir();
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(homedir(), path.slice(2));
  return path;
}

/**
 * Override the default config directory and files.
 *
 * Accepts either:
 * - a directory path (then files are {dir}/config.json, {dir}/secrets.json, {dir}/state.json)
 * - a config file path ending with .json (then secrets/state are stored next to it)
 */
export function setConfigPathOverride(pathLike: string): ConfigPaths {
  const trimmed = pathLike.trim();
  if (trimmed.length === 0) return getConfigPaths();

  const expanded = expandHome(trimmed);
  const absolute = resolve(expanded);

  if (absolute.toLowerCase().endsWith('.json')) {
    configPath = absolute;
    configDir = dirname(absolute);
  } else {
    configDir = absolute;
    configPath = join(configDir, 'config.json');
  }

  secretsPath = join(configDir, 'secrets.json');
  statePath = join(configDir, 'state.json');

  return getConfigPaths();
}

export function setTimeZoneOverride(timeZone: string | null): void {
  if (!timeZone) {
    timeZoneOverride = null;
    return;
  }

  const trimmed = timeZone.trim();
  if (trimmed.length === 0) {
    timeZoneOverride = null;
    return;
  }

  if (!isValidTimeZone(trimmed)) {
    throw new RangeError(
      `Invalid timezone "${trimmed}". Use an IANA timezone like "America/New_York" or "Europe/Paris".`
    );
  }

  timeZoneOverride = trimmed;
}

export function getTimeZoneOverride(): string | null {
  return timeZoneOverride;
}

export function getEffectiveTimeZone(config?: Pick<Config, 'timezone'>): string {
  const override = timeZoneOverride || process.env.RUGBYCLAW_TZ || process.env.RUGBYCLAW_TIMEZONE;
  if (override) {
    setTimeZoneOverride(override);
    return override.trim();
  }

  if (config?.timezone && isValidTimeZone(config.timezone)) {
    return config.timezone;
  }

  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function getConfigPaths(): ConfigPaths {
  return {
    configDir,
    configPath,
    secretsPath,
    statePath,
  };
}

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
  if (!existsSync(configDir)) {
    await mkdir(configDir, { recursive: true });
  }
}

/**
 * Load user configuration.
 */
export async function loadConfig(): Promise<Config> {
  try {
    const data = await readFile(configPath, 'utf-8');
    const config = JSON.parse(data) as Config;

    if (!isValidTimeZone(config.timezone)) {
      config.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

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
  await writeFile(configPath, JSON.stringify(config, null, 2));
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
    const data = await readFile(secretsPath, 'utf-8');
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
  await writeFile(secretsPath, JSON.stringify(secrets, null, 2), { mode: 0o600 });
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
  return existsSync(configPath);
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
    const data = await readFile(statePath, 'utf-8');
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
  await writeFile(statePath, JSON.stringify(state, null, 2));
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
  return configDir;
}
