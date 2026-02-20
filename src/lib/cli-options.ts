import { InvalidArgumentError } from 'commander';
import { isValidTimeZone } from './config.js';

export function parseTimeZoneOption(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new InvalidArgumentError(
      'Timezone cannot be empty. Use an IANA timezone like "America/New_York".'
    );
  }

  if (!isValidTimeZone(trimmed)) {
    throw new InvalidArgumentError(
      `Invalid timezone "${trimmed}". Use an IANA timezone like "America/New_York" or "Europe/Paris".`
    );
  }

  return trimmed;
}
