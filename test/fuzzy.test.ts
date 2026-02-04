import { describe, expect, it } from 'vitest';
import { normalizeText, similarityScore } from '../src/lib/fuzzy.js';

describe('fuzzy matching', () => {
  it('normalizes accents and punctuation', () => {
    expect(normalizeText('Montpellier Hérault Rugby')).toBe('montpellier herault rugby');
    expect(normalizeText('  Racing-92  ')).toBe('racing 92');
  });

  it('scores close matches reasonably high', () => {
    // Common user shorthand
    expect(similarityScore('toulouse', 'Stade Toulousain')).toBeGreaterThan(0.62);
    expect(similarityScore('racing', 'Racing 92')).toBeGreaterThan(0.8);
  });
});

