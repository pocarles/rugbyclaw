import { describe, expect, it } from 'vitest';
import { getAllowedEndpoint, isAllowedEndpoint } from '../worker/src/allowlist.ts';

describe('worker endpoint allowlist', () => {
  it('accepts exact endpoints', () => {
    expect(getAllowedEndpoint('/games')).toBe('/games');
    expect(getAllowedEndpoint('/teams')).toBe('/teams');
    expect(getAllowedEndpoint('/leagues')).toBe('/leagues');
  });

  it('accepts endpoint subpaths only', () => {
    expect(getAllowedEndpoint('/games/live')).toBe('/games');
    expect(getAllowedEndpoint('/teams/search')).toBe('/teams');
    expect(getAllowedEndpoint('/leagues/current')).toBe('/leagues');
  });

  it('rejects lookalike prefixes', () => {
    expect(getAllowedEndpoint('/gamesXYZ')).toBeNull();
    expect(getAllowedEndpoint('/teams-v2')).toBeNull();
    expect(getAllowedEndpoint('/leagues123')).toBeNull();
    expect(isAllowedEndpoint('/gamesXYZ')).toBe(false);
  });
});
