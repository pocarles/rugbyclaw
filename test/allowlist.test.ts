import { describe, expect, it } from 'vitest';
import { isAllowedEndpoint } from '../worker/src/allowlist';

describe('worker allowlist', () => {
  it('allows exact endpoint and subpaths only', () => {
    expect(isAllowedEndpoint('/games')).toBe(true);
    expect(isAllowedEndpoint('/games/')).toBe(true);
    expect(isAllowedEndpoint('/gamesXYZ')).toBe(false);
    expect(isAllowedEndpoint('/teams/search')).toBe(true);
    expect(isAllowedEndpoint('/te')).toBe(false);
  });
});
