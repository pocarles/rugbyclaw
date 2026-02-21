import { describe, expect, it } from 'vitest';
import { getAllowedEndpoint, isAllowedEndpoint } from '../worker/src/allowlist.ts';

describe('worker endpoint allowlist', () => {
  it('accepts exact endpoints', () => {
    expect(getAllowedEndpoint('/games')).toBe('/games');
    expect(getAllowedEndpoint('/teams')).toBe('/teams');
    expect(getAllowedEndpoint('/leagues')).toBe('/leagues');
  });

  it('rejects lookalike prefixes and subpaths', () => {
    expect(getAllowedEndpoint('/gamesXYZ')).toBeNull();
    expect(getAllowedEndpoint('/games/live')).toBeNull();
    expect(getAllowedEndpoint('/teams-v2')).toBeNull();
    expect(getAllowedEndpoint('/teams/search')).toBeNull();
    expect(getAllowedEndpoint('/leagues123')).toBeNull();
    expect(getAllowedEndpoint('/leagues/current')).toBeNull();
    expect(isAllowedEndpoint('/gamesXYZ')).toBe(false);
  });
});
