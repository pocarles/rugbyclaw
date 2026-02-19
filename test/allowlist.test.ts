import { describe, expect, it } from 'vitest';
import { getAllowedEndpoint, isAllowedEndpoint } from '../worker/src/allowlist';

describe('worker allowlist', () => {
  it('allows exact endpoint and subpaths only', () => {
    expect(isAllowedEndpoint('/games')).toBe(true);
    expect(isAllowedEndpoint('/games/')).toBe(true);
    expect(isAllowedEndpoint('/gamesXYZ')).toBe(false);
    expect(isAllowedEndpoint('/teams/search')).toBe(true);
    expect(isAllowedEndpoint('/te')).toBe(false);
  });

  it('resolves canonical endpoint safely', () => {
    expect(getAllowedEndpoint('/games')).toBe('/games');
    expect(getAllowedEndpoint('/games/123')).toBe('/games');
    expect(getAllowedEndpoint('/gamesXYZ')).toBeNull();
    expect(getAllowedEndpoint('/leagues/16')).toBe('/leagues');
  });
});
