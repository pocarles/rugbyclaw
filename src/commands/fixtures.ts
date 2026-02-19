import { writeFile } from 'node:fs/promises';
import {
  loadConfig,
  loadSecrets,
  getEffectiveLeagues,
  DEFAULT_PROXY_LEAGUES,
  getEffectiveTimeZone,
} from '../lib/config.js';
import { LEAGUES, resolveLeague } from '../lib/leagues.js';
import { ApiSportsProvider } from '../lib/providers/apisports.js';
import { getProxyQuotaLine, getProxyRateLimit, getProxyStatusIfFree } from '../lib/free-mode.js';
import { getFixturesNoMatchesExplanation } from '../lib/explain.js';
import { renderFixtures, matchToOutput, renderError, renderWarning, renderSuccess } from '../render/terminal.js';
import { matchesToICS } from '../lib/ics.js';
import type { FixturesOutput, Match } from '../types/index.js';

interface FixturesOptions {
  json?: boolean;
  quiet?: boolean;
  limit?: string;
  ics?: boolean;
  showIds?: boolean;
  explain?: boolean;
}

export async function fixturesCommand(
  leagueInput: string | undefined,
  options: FixturesOptions
): Promise<void> {
  const config = await loadConfig();
  const timeZone = getEffectiveTimeZone(config);
  // Get API key if available (otherwise use proxy mode)
  const secrets = await loadSecrets();
  const hasApiKey = Boolean(secrets?.api_key);
  const provider = new ApiSportsProvider(secrets?.api_key);
  const limit = parseInt(options.limit || '15', 10);

  let matches: Match[] = [];
  let leagueName: string | undefined;
  let selectedLeagues: Array<{ slug: string; id: string; name: string }> = [];

  try {
    if (leagueInput) {
      // Specific league
      const league = resolveLeague(leagueInput);

      if (!league) {
        console.log(renderError(`Unknown league: "${leagueInput}"`));
        console.log('Available: ' + Object.keys(LEAGUES).join(', '));
        process.exit(1);
      }

      if (!hasApiKey && !DEFAULT_PROXY_LEAGUES.includes(league.slug)) {
        console.log(renderError(`"${league.name}" is not available in free mode.`));
        console.log(renderWarning('Run "rugbyclaw config" to add your own API key to unlock more leagues.'));
        process.exit(1);
      }

      leagueName = league.name;
      selectedLeagues = [{ slug: league.slug, id: league.id, name: league.name }];
      matches = await provider.getLeagueFixtures(league.id);
    } else {
      // Get effective leagues (user's favorites or defaults)
      const favoriteLeagues = hasApiKey ? await getEffectiveLeagues() : DEFAULT_PROXY_LEAGUES;
      selectedLeagues = favoriteLeagues
        .map((slug) => ({ slug, id: LEAGUES[slug]?.id, name: LEAGUES[slug]?.name }))
        .filter((league): league is { slug: string; id: string; name: string } => Boolean(league.id && league.name));
      const leagueIds = favoriteLeagues
        .map((slug) => LEAGUES[slug]?.id)
        .filter(Boolean) as string[];

      for (const id of leagueIds) {
        const leagueMatches = await provider.getLeagueFixtures(id);
        matches.push(...leagueMatches);
      }

      // Sort by date
      matches.sort((a, b) => a.timestamp - b.timestamp);
    }

    // Apply limit
    matches = matches.slice(0, limit);

    // Export to ICS file
    if (options.ics) {
      if (matches.length === 0) {
        console.log(renderWarning('No fixtures to export.'));
        process.exit(0);
      }
      const ics = matchesToICS(matches);
      const filename = leagueName
        ? `${leagueName.toLowerCase().replace(/\s+/g, '-')}-fixtures.ics`
        : 'rugby-fixtures.ics';
      await writeFile(filename, ics);
      if (!options.quiet) {
        console.log(renderSuccess(`Exported ${matches.length} fixtures to ${filename}`));
      }
      return;
    }

    const wantProxyStatus = !hasApiKey && (options.json || !options.quiet);
    const proxyStatus = await getProxyStatusIfFree(hasApiKey, wantProxyStatus);

    const output: FixturesOutput = {
      league: leagueName,
      matches: matches.map((m) => matchToOutput(m, { timeZone })),
      generated_at: new Date().toISOString(),
      rate_limit: getProxyRateLimit(proxyStatus),
    };

    if (options.json) {
      console.log(JSON.stringify(output, null, 2));
    } else if (!options.quiet) {
      console.log(renderFixtures(output, options.showIds, timeZone));
      if (options.explain) {
        const explanation = getFixturesNoMatchesExplanation({
          mode: hasApiKey ? 'direct' : 'proxy',
          timeZone,
          leagues: selectedLeagues,
          matchCount: output.matches.length,
          limit,
        });
        if (explanation.length > 0) {
          console.log('');
          for (const line of explanation) console.log(line);
        }
      }
      const quotaLine = getProxyQuotaLine(proxyStatus, hasApiKey);
      if (quotaLine) console.log(quotaLine);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(renderError(message));
    process.exit(1);
  }
}
