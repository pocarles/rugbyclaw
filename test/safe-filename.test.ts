import { describe, expect, it } from 'vitest';
import { toSafeFileSlug } from '../src/lib/safe-filename.js';

describe('toSafeFileSlug', () => {
  it('produces a lowercase hyphen slug', () => {
    expect(toSafeFileSlug('Stade Toulousain')).toBe('stade-toulousain');
  });

  it('strips accents and punctuation', () => {
    expect(toSafeFileSlug('Stade Français Paris')).toBe('stade-francais-paris');
    expect(toSafeFileSlug('Leinster / Munster')).toBe('leinster-munster');
  });

  it('falls back for empty/invalid input', () => {
    expect(toSafeFileSlug('')).toBe('rugby');
    expect(toSafeFileSlug('---')).toBe('rugby');
  });
});

