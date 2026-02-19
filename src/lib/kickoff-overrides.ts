import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getConfigDir } from './config.js';

export interface KickoffOverride {
  kickoffMs: number;
  source: string;
}

interface RawKickoffOverride {
  kickoff?: string;
  source?: string;
}

type RawKickoffOverrides = Record<string, RawKickoffOverride>;

function readJsonFile(path: string): RawKickoffOverrides {
  try {
    if (!existsSync(path)) return {};
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as RawKickoffOverrides;
  } catch {
    return {};
  }
}

function parseKickoffOverrides(raw: RawKickoffOverrides): Map<string, KickoffOverride> {
  const parsed = new Map<string, KickoffOverride>();

  for (const [matchId, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue;
    if (!value.kickoff) continue;
    const ms = Date.parse(value.kickoff);
    if (!Number.isFinite(ms)) continue;
    parsed.set(matchId, {
      kickoffMs: ms,
      source: value.source?.trim() || 'secondary',
    });
  }

  return parsed;
}

function getPackageRoot(): string {
  const thisFile = fileURLToPath(import.meta.url);
  return dirname(dirname(dirname(thisFile)));
}

function getBundledOverridesPath(): string {
  return join(getPackageRoot(), 'data', 'kickoff-overrides.json');
}

function getUserOverridesPath(): string {
  return join(getConfigDir(), 'kickoff-overrides.json');
}

export function loadKickoffOverrides(): Map<string, KickoffOverride> {
  const bundled = parseKickoffOverrides(readJsonFile(getBundledOverridesPath()));
  const user = parseKickoffOverrides(readJsonFile(getUserOverridesPath()));

  for (const [matchId, override] of user.entries()) {
    bundled.set(matchId, override);
  }

  return bundled;
}

export function getKickoffOverridePaths(): { bundled: string; user: string } {
  return {
    bundled: getBundledOverridesPath(),
    user: getUserOverridesPath(),
  };
}
