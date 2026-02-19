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
import { renderFixtures, matchToOutput, renderError, renderWarning, renderSuccess } from '../render/terminal.js';
import { exitWithError, exitWithJson, printJson } from '../lib/cli-output.js';
import { matchesToICS } from '../lib/ics.js';
import { toSafeFileSlug } from '../lib/safe-filename.js';
import type { FixturesOutput, Match } from '../types/index.js';

interface FixturesOptions {
  json?: boolean;
  quiet?: boolean;
  limit?: string;
  ics?: boolean;
  showIds?: boolean;
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
  const limitRaw = options.limit || '15';
  const limit = Number.parseInt(limitRaw, 10);
  if (!Number.isFinite(limit) || limit <= 0) {
    exitWithError(`Invalid --limit "${limitRaw}" (expected a positive integer).`, options);
  }

  let matches: Match[] = [];
  let leagueName: string | undefined;

  try {
    if (leagueInput) {
      // Specific league
      const league = resolveLeague(leagueInput);

      if (!league) {
        const available = Object.keys(LEAGUES);
        if (options.json) {
          exitWithJson({ error: `Unknown league: "${leagueInput}"`, available_leagues: available }, 1);
        }
        console.log(renderError(`Unknown league: "${leagueInput}"`));
        console.log('Available: ' + available.join(', '));
        process.exit(1);
      }

      if (!hasApiKey && !DEFAULT_PROXY_LEAGUES.includes(league.slug)) {
        if (options.json) {
          exitWithJson(
            {
              error: `"${league.name}" is not available in free mode.`,
              hint: 'Run "rugbyclaw config" to add your own API key to unlock more leagues.',
            },
            1
          );
        }
        console.log(renderError(`"${league.name}" is not available in free mode.`));
        console.log(renderWarning('Run "rugbyclaw config" to add your own API key to unlock more leagues.'));
        process.exit(1);
      }

      leagueName = league.name;
      matches = await provider.getLeagueFixtures(league.id);
    } else {
      // Get effective leagues (user's favorites or defaults)
      const favoriteLeagues = hasApiKey ? await getEffectiveLeagues() : DEFAULT_PROXY_LEAGUES;
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
        if (options.json) {
          printJson({ exported: 0, out: null, warning: 'No fixtures to export.' });
          return;
        }
        if (!options.quiet) {
          console.log(renderWarning('No fixtures to export.'));
        }
        return;
      }
      const ics = matchesToICS(matches);
      const filename = leagueName
        ? `${toSafeFileSlug(leagueName)}-fixtures.ics`
        : 'rugby-fixtures.ics';
      await writeFile(filename, ics);
      if (options.json) {
        printJson({ exported: matches.length, out: filename, generated_at: new Date().toISOString() });
        return;
      }
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
      const quotaLine = getProxyQuotaLine(proxyStatus);
      if (quotaLine) console.log(quotaLine);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    exitWithError(message, options);
  }
}
