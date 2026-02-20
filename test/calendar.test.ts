import { describe, expect, it } from 'vitest';
import { isValidMatchId } from '../src/commands/calendar.js';

describe('calendar matchId validation', () => {
  it('accepts numeric ids up to 12 digits', () => {
    expect(isValidMatchId('1')).toBe(true);
    expect(isValidMatchId('49981')).toBe(true);
    expect(isValidMatchId('123456789012')).toBe(true);
  });

  it('rejects non-numeric or oversized ids', () => {
    expect(isValidMatchId('')).toBe(false);
    expect(isValidMatchId('toulouse')).toBe(false);
    expect(isValidMatchId('49981abc')).toBe(false);
    expect(isValidMatchId('1234567890123')).toBe(false);
    expect(isValidMatchId('-49981')).toBe(false);
  });
});
