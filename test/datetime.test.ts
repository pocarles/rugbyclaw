import { describe, expect, it } from 'vitest';
import { formatDateYMD, formatTimeHM } from '../src/lib/datetime.js';

describe('datetime formatting', () => {
  it('formats date/time in a specific timezone', () => {
    const date = new Date('2026-02-03T01:30:00Z');

    expect(formatDateYMD(date, 'America/Los_Angeles')).toBe('2026-02-02');
    expect(formatTimeHM(date, 'America/Los_Angeles')).toBe('17:30');

    expect(formatDateYMD(date, 'UTC')).toBe('2026-02-03');
    expect(formatTimeHM(date, 'UTC')).toBe('01:30');
  });
});

