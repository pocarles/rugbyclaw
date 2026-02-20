import { describe, expect, it } from 'vitest';
import { InvalidArgumentError } from 'commander';
import { parseTimeZoneOption } from '../src/lib/cli-options.js';

describe('cli timezone option parser', () => {
  it('accepts a valid IANA timezone', () => {
    expect(parseTimeZoneOption('America/New_York')).toBe('America/New_York');
  });

  it('rejects invalid timezone values with commander error', () => {
    expect(() => parseTimeZoneOption('newyork')).toThrow(InvalidArgumentError);
    expect(() => parseTimeZoneOption('newyork')).toThrow('Invalid timezone "newyork"');
  });

  it('rejects empty timezone values', () => {
    expect(() => parseTimeZoneOption('   ')).toThrow(InvalidArgumentError);
  });
});
