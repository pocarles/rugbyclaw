import { describe, it, expect } from 'vitest';
import { DEFAULT_PROXY_LEAGUES } from '../lib/config.js';
import { LEAGUES, resolveLeague } from '../lib/leagues.js';

describe('smoke', () => {
  it('default proxy leagues exist in the registry', () => {
    for (const slug of DEFAULT_PROXY_LEAGUES) {
      expect(LEAGUES[slug]).toBeTruthy();
    }
  });

  it('resolves common league aliases', () => {
    expect(resolveLeague('top 14')?.slug).toBe('top14');
    expect(resolveLeague('prem')?.slug).toBe('premiership');
    expect(resolveLeague('heineken champions cup')?.slug).toBe('champions_cup');
    expect(resolveLeague('6 nations')?.slug).toBe('six_nations');
  });
});
