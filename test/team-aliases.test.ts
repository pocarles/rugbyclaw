import { describe, expect, it } from 'vitest';
import { getTeamQueryCandidates } from '../src/lib/team-aliases.js';

describe('team alias resolution', () => {
  it('keeps original query first and appends known alias target', () => {
    const candidates = getTeamQueryCandidates('toulouse');
    expect(candidates[0]).toBe('toulouse');
    expect(candidates).toContain('Stade Toulousain');
  });

  it('deduplicates equivalent alias values', () => {
    const candidates = getTeamQueryCandidates('Stade Toulousain');
    expect(candidates).toEqual(['Stade Toulousain']);
  });

  it('supports shorthand aliases', () => {
    const candidates = getTeamQueryCandidates('usap');
    expect(candidates).toContain('USA Perpignan');
  });
});
