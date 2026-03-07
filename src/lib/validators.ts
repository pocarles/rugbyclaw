import type { StandingsEntry } from '../types/index.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasDoubledSubstring(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  if (trimmed.length % 2 === 0) {
    const half = trimmed.length / 2;
    if (trimmed.slice(0, half) === trimmed.slice(half)) {
      return true;
    }
  }

  const words = trimmed.split(/\s+/);
  if (words.length % 2 === 0 && words.length > 0) {
    const half = words.length / 2;
    const firstHalf = words.slice(0, half).join(' ');
    const secondHalf = words.slice(half).join(' ');
    if (firstHalf === secondHalf) {
      return true;
    }
  }

  return false;
}

function validateOptionalNonNegative(
  entry: StandingsEntry,
  key: keyof StandingsEntry,
  errors: string[]
): void {
  const value = entry[key];
  if (value === undefined) return;
  if (!isFiniteNumber(value) || value < 0) {
    errors.push(`${String(key)} must be >= 0 when present`);
  }
}

export function validateStandingsEntry(entry: StandingsEntry): ValidationResult {
  const errors: string[] = [];

  if (entry.played !== entry.won + entry.drawn + entry.lost) {
    errors.push('played must equal won + drawn + lost');
  }

  if (entry.points < 0) errors.push('points must be >= 0');
  if (entry.played < 0) errors.push('played must be >= 0');
  if (entry.won < 0) errors.push('won must be >= 0');
  if (entry.drawn < 0) errors.push('drawn must be >= 0');
  if (entry.lost < 0) errors.push('lost must be >= 0');
  if (entry.position < 1) errors.push('position must be >= 1');

  const teamName = entry.team?.name?.trim() || '';
  if (!teamName) {
    errors.push('team.name must be non-empty');
  } else if (hasDoubledSubstring(teamName)) {
    errors.push('team.name contains duplicated substring');
  }

  if (!entry.team?.id?.trim()) {
    errors.push('team.id must be non-empty');
  }

  const expectedDiff = entry.points_for - entry.points_against;
  if (Math.abs(entry.points_diff - expectedDiff) > 1) {
    errors.push('points_diff must equal points_for - points_against (±1)');
  }

  validateOptionalNonNegative(entry, 'bonus_points', errors);
  validateOptionalNonNegative(entry, 'tries_for', errors);
  validateOptionalNonNegative(entry, 'tries_against', errors);
  validateOptionalNonNegative(entry, 'bonus_points_try', errors);
  validateOptionalNonNegative(entry, 'bonus_points_losing', errors);
  validateOptionalNonNegative(entry, 'win_percent', errors);
  validateOptionalNonNegative(entry, 'avg_points_for', errors);
  validateOptionalNonNegative(entry, 'avg_points_against', errors);

  return { valid: errors.length === 0, errors };
}

export function validateStandings(
  entries: StandingsEntry[],
  expectedTeamRange?: [number, number]
): ValidationResult {
  const errors: string[] = [];

  if (expectedTeamRange) {
    const [minTeams, maxTeams] = expectedTeamRange;
    if (entries.length < minTeams || entries.length > maxTeams) {
      errors.push(`team count ${entries.length} is outside expected range ${minTeams}-${maxTeams}`);
    }
  }

  const seenNames = new Set<string>();
  for (const entry of entries) {
    const result = validateStandingsEntry(entry);
    if (!result.valid) {
      for (const message of result.errors) {
        errors.push(`position ${entry.position} (${entry.team?.name || 'unknown'}): ${message}`);
      }
    }

    const normalizedName = (entry.team?.name || '').trim().toLowerCase();
    if (normalizedName) {
      if (seenNames.has(normalizedName)) {
        errors.push(`duplicate team name: ${entry.team.name}`);
      }
      seenNames.add(normalizedName);
    }
  }

  for (let i = 0; i < entries.length; i++) {
    const expectedPosition = i + 1;
    if (entries[i].position !== expectedPosition) {
      errors.push(`positions should be sequential from 1 (expected ${expectedPosition}, got ${entries[i].position})`);
    }
  }

  return { valid: errors.length === 0, errors };
}
