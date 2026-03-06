import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseAllRugbyStandingsHtml } from '../src/lib/providers/allrugby-standings.js';
import { parsePremiershipStandingsText } from '../src/lib/providers/prem-standings.js';
import { parseUrcStandingsHtml } from '../src/lib/providers/urc-standings.js';
import { ApiSportsProvider } from '../src/lib/providers/apisports.js';
import { getCache } from '../src/lib/cache.js';

const ALL_RUGBY_SAMPLE_HTML = `
<table>
  <thead>
    <tr>
      <th>#</th><th>Team</th><th>PL</th><th>W</th><th>D</th><th>L</th><th>DIFF</th><th>BP</th><th>PF</th><th>PA</th><th>TF</th><th>TA</th><th>TB</th><th>LB</th><th>Form</th><th>PTS</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td><td>Toulouse</td><td>18</td><td>14</td><td>0</td><td>4</td><td>145</td><td>10</td><td>520</td><td>375</td><td>55</td><td>40</td><td>8</td><td>2</td><td>WWLWW</td><td>66</td>
    </tr>
  </tbody>
</table>`;

const URC_SAMPLE_HTML = `
<table>
  <thead>
    <tr>
      <th>Team</th><th>PL</th><th>W</th><th>D</th><th>L</th><th>BP</th><th>PF</th><th>PA</th><th>DIFF</th><th>TF</th><th>TA</th><th>TB</th><th>LB</th><th>PTS</th><th>FORM</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><a href="/teams/leinster">Leinster</a></td><td>12</td><td>10</td><td>0</td><td>2</td><td>8</td><td>350</td><td>200</td><td>150</td><td>45</td><td>21</td><td>7</td><td>1</td><td>49</td><td>WWWWW</td>
    </tr>
  </tbody>
</table>`;

describe('standings scrapers', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-06T12:00:00Z'));
    await getCache().clear();
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await getCache().clear();
  });

  it('parses all.rugby standings HTML', () => {
    const parsed = parseAllRugbyStandingsHtml(ALL_RUGBY_SAMPLE_HTML, 'top14');

    expect(parsed).not.toBeNull();
    expect(parsed).toHaveLength(1);
    expect(parsed?.[0]?.team.name).toBe('Toulouse');
    expect(parsed?.[0]?.played).toBe(18);
    expect(parsed?.[0]?.points).toBe(66);
    expect(parsed?.[0]?.bonus_points).toBe(10);
    expect(parsed?.[0]?.bonus_points_try).toBe(8);
    expect(parsed?.[0]?.bonus_points_losing).toBe(2);
  });

  it('parses premiership concatenated standings text', () => {
    const sample = '#TeamPWDLPDTBLBBPFormPTS1Northampton Saints10811-12034WWW432Bath Rugby10721-55116WLW40';
    const parsed = parsePremiershipStandingsText(sample);

    expect(parsed).not.toBeNull();
    expect(parsed).toHaveLength(2);
    expect(parsed?.[0]?.team.name).toBe('Northampton Saints');
    expect(parsed?.[0]?.played).toBe(10);
    expect(parsed?.[0]?.won).toBe(8);
    expect(parsed?.[0]?.points_diff).toBe(-12);
    expect(parsed?.[0]?.points).toBe(43);
    expect(parsed?.[1]?.team.name).toBe('Bath Rugby');
    expect(parsed?.[1]?.points).toBe(40);
    expect(parsed?.[1]?.points_diff).toBe(-55);
  });

  it('parses URC standings HTML table', () => {
    const parsed = parseUrcStandingsHtml(URC_SAMPLE_HTML);

    expect(parsed).not.toBeNull();
    expect(parsed).toHaveLength(1);
    expect(parsed?.[0]?.team.name).toBe('Leinster');
    expect(parsed?.[0]?.played).toBe(12);
    expect(parsed?.[0]?.tries_for).toBe(45);
    expect(parsed?.[0]?.tries_against).toBe(21);
    expect(parsed?.[0]?.points).toBe(49);
  });

  it('uses cascade fallback: official fails, all.rugby succeeds, API-Sports is skipped', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);

      if (url === 'https://www.premiershiprugby.com/competitions/gallagher-prem/standings') {
        return new Response('upstream', { status: 503 });
      }

      if (url === 'https://all.rugby/tournament/premiership-rugby/table') {
        const rows = [
          '<tr><td>1</td><td>Bath Rugby</td><td>10</td><td>8</td><td>0</td><td>2</td><td>106</td><td>9</td><td>343</td><td>237</td><td>40</td><td>28</td><td>8</td><td>1</td><td>WWW</td><td>43</td></tr>',
          '<tr><td>2</td><td>Bristol Bears</td><td>10</td><td>8</td><td>0</td><td>2</td><td>55</td><td>5</td><td>290</td><td>235</td><td>35</td><td>25</td><td>5</td><td>0</td><td>WWW</td><td>37</td></tr>',
          '<tr><td>3</td><td>Leicester Tigers</td><td>10</td><td>7</td><td>0</td><td>3</td><td>63</td><td>8</td><td>301</td><td>238</td><td>38</td><td>28</td><td>7</td><td>1</td><td>WLW</td><td>36</td></tr>',
          '<tr><td>4</td><td>Exeter Chiefs</td><td>10</td><td>6</td><td>1</td><td>3</td><td>93</td><td>9</td><td>272</td><td>179</td><td>30</td><td>20</td><td>6</td><td>3</td><td>WLL</td><td>35</td></tr>',
          '<tr><td>5</td><td>Saracens</td><td>10</td><td>5</td><td>0</td><td>5</td><td>135</td><td>12</td><td>383</td><td>248</td><td>45</td><td>30</td><td>9</td><td>3</td><td>WLW</td><td>32</td></tr>',
        ].join('\n');
        const html = '<table><thead><tr><th>#</th><th>Team</th><th>PL</th><th>W</th><th>D</th><th>L</th><th>DIFF</th><th>BP</th><th>PF</th><th>PA</th><th>TF</th><th>TA</th><th>TB</th><th>LB</th><th>Form</th><th>PTS</th></tr></thead><tbody>' + rows + '</tbody></table>';
        return new Response(html, { status: 200 });
      }

      if (url.includes('/apis/v2/sports/rugby/267979/standings')) {
        return new Response('upstream', { status: 503 });
      }

      return new Response('{}', { status: 404 });
    }));

    const provider = new ApiSportsProvider('test-key');
    const standings = await provider.getStandings('13');

    expect(standings.length).toBeGreaterThanOrEqual(4);
    expect(standings[0]?.team.name).toBe('Bath Rugby');
    expect(calls.some((url) => url.includes('/standings?league=13&season='))).toBe(false);
  });

  it('skips ESPN enrichment when games played differs by more than 2', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === 'https://all.rugby/tournament/top-14/table') {
        const rows = [
          '<tr><td>1</td><td>Toulouse</td><td>18</td><td>14</td><td>0</td><td>4</td><td>145</td><td>10</td><td>520</td><td>375</td><td>55</td><td>40</td><td>8</td><td>2</td><td>WWLWW</td><td>66</td></tr>',
          '<tr><td>2</td><td>Pau</td><td>18</td><td>12</td><td>0</td><td>6</td><td>80</td><td>8</td><td>480</td><td>400</td><td>50</td><td>42</td><td>6</td><td>2</td><td>WLWLL</td><td>56</td></tr>',
          '<tr><td>3</td><td>Montpellier</td><td>18</td><td>10</td><td>1</td><td>7</td><td>60</td><td>9</td><td>460</td><td>400</td><td>48</td><td>40</td><td>7</td><td>2</td><td>WWWLW</td><td>51</td></tr>',
          '<tr><td>4</td><td>Clermont</td><td>18</td><td>11</td><td>0</td><td>7</td><td>50</td><td>7</td><td>450</td><td>400</td><td>45</td><td>38</td><td>5</td><td>2</td><td>WWLWW</td><td>51</td></tr>',
        ].join('\n');
        const html = '<table><thead><tr><th>#</th><th>Team</th><th>PL</th><th>W</th><th>D</th><th>L</th><th>DIFF</th><th>BP</th><th>PF</th><th>PA</th><th>TF</th><th>TA</th><th>TB</th><th>LB</th><th>Form</th><th>PTS</th></tr></thead><tbody>' + rows + '</tbody></table>';
        return new Response(html, { status: 200 });
      }

      if (url.includes('/apis/v2/sports/rugby/270559/standings')) {
        return new Response(JSON.stringify({
          children: [
            {
              standings: {
                entries: [
                  {
                    team: { displayName: 'Toulouse' },
                    stats: [
                      { name: 'rank', value: 1 },
                      { name: 'gamesPlayed', value: 26 },
                      { name: 'bonusPoints', value: 99 },
                      { name: 'avgPointsFor', value: 31.2 },
                    ],
                  },
                ],
              },
            },
          ],
        }), { status: 200 });
      }

      return new Response('{}', { status: 404 });
    }));

    const provider = new ApiSportsProvider('test-key');
    const standings = await provider.getStandings('16');

    expect(standings).toHaveLength(4);
    expect(standings[0]?.played).toBe(18);
    expect(standings[0]?.bonus_points).toBe(10);
    expect(standings[0]?.avg_points_for).toBeUndefined();
  });
});
