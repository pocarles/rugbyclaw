import { describe, expect, it } from 'vitest';
import { validateQuery, validateRequestSize, validateUserAgent } from '../worker/src/index';
import { getAllowedEndpoint, isAllowedEndpoint } from '../worker/src/allowlist';

describe('worker request validation', () => {
  const allowed = new Set(['16', '13', '51']);

  it('accepts valid games league+season query', () => {
    const params = new URLSearchParams({ league: '16', season: '2025' });
    const result = validateQuery('/games', params, allowed);
    expect(result.ok).toBe(true);
  });

  it('rejects games query without season/date', () => {
    const params = new URLSearchParams({ league: '16' });
    const result = validateQuery('/games', params, allowed);
    expect(result).toEqual({
      ok: false,
      message: 'season or date is required for /games queries',
      status: 400,
    });
  });

  it('rejects invalid date format', () => {
    const params = new URLSearchParams({ league: '16', date: '2026/02/19' });
    const result = validateQuery('/games', params, allowed);
    expect(result).toEqual({
      ok: false,
      message: 'Invalid date parameter (expected YYYY-MM-DD)',
      status: 400,
    });
  });

  it('rejects duplicate query params', () => {
    const params = new URLSearchParams('league=16&season=2025&season=2026');
    const result = validateQuery('/games', params, allowed);
    expect(result).toEqual({
      ok: false,
      message: 'Duplicate query parameter not allowed: season',
      status: 400,
    });
  });

  it('rejects invalid teams query combination', () => {
    const params = new URLSearchParams({ search: 'toulouse', season: '2025' });
    const result = validateQuery('/teams', params, allowed);
    expect(result).toEqual({
      ok: false,
      message: 'For /teams search, only search is allowed',
      status: 400,
    });
  });

  it('rejects oversized query string', () => {
    const longSearch = 'a'.repeat(1200);
    const url = new URL(`https://example.com/games?search=${longSearch}`);
    const result = validateRequestSize(url);
    expect(result).toEqual({
      ok: false,
      message: 'Query string too long',
      status: 400,
    });
  });

  it('allows exact endpoints and nested subpaths', () => {
    expect(isAllowedEndpoint('/games')).toBe(true);
    expect(isAllowedEndpoint('/games/123')).toBe(true);
    expect(getAllowedEndpoint('/teams/123')).toBe('/teams');
  });

  it('rejects lookalike endpoints', () => {
    expect(isAllowedEndpoint('/gamesXYZ')).toBe(false);
    expect(isAllowedEndpoint('/team')).toBe(false);
    expect(getAllowedEndpoint('/leaguesx')).toBeNull();
  });

  it('accepts normal user-agent and blocks scanners', () => {
    expect(validateUserAgent('rugbyclaw/0.1.6')).toEqual({ ok: true });
    expect(validateUserAgent('sqlmap/1.7')).toEqual({
      ok: false,
      message: 'Client not allowed',
      status: 403,
    });
  });

  it('requires a non-empty user-agent', () => {
    expect(validateUserAgent(null)).toEqual({
      ok: false,
      message: 'User-Agent header is required',
      status: 400,
    });
  });
});
