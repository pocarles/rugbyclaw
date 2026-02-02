import { writeFile } from 'node:fs/promises';
import { loadConfig, loadSecrets, isConfigured } from '../lib/config.js';
import { LEAGUES, resolveLeague } from '../lib/leagues.js';
import { TheSportsDBProvider } from '../lib/providers/thesportsdb.js';
import { renderFixtures, matchToOutput, renderError, renderWarning, renderSuccess } from '../render/terminal.js';
import { matchesToICS } from '../lib/ics.js';
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
  // Check configuration
  if (!(await isConfigured())) {
    console.log(renderError('Not configured. Run "rugbyclaw config" first.'));
    process.exit(1);
  }

  const config = await loadConfig();
  const secrets = await loadSecrets();

  if (!secrets) {
    console.log(renderError('API key not found. Run "rugbyclaw config" first.'));
    process.exit(1);
  }

  const provider = new TheSportsDBProvider(secrets.api_key);
  const limit = parseInt(options.limit || '15', 10);

  let matches: Match[] = [];
  let leagueName: string | undefined;

  try {
    if (leagueInput) {
      // Specific league
      const league = resolveLeague(leagueInput);

      if (!league) {
        console.log(renderError(`Unknown league: "${leagueInput}"`));
        console.log('Available: ' + Object.keys(LEAGUES).join(', '));
        process.exit(1);
      }

      leagueName = league.name;
      matches = await provider.getLeagueFixtures(league.id);
    } else {
      // All favorite leagues
      const leagueIds = config.favorite_leagues
        .map((slug) => LEAGUES[slug]?.id)
        .filter(Boolean) as string[];

      if (leagueIds.length === 0) {
        console.log(renderWarning('No favorite leagues configured.'));
        process.exit(0);
      }

      for (const id of leagueIds) {
        const leagueMatches = await provider.getLeagueFixtures(id);
        matches.push(...leagueMatches);
      }

      // Sort by date
      matches.sort((a, b) => a.timestamp - b.timestamp);
    }

    // Apply limit
    matches = matches.slice(0, limit);

    const output: FixturesOutput = {
      league: leagueName,
      matches: matches.map((m) => matchToOutput(m)),
      generated_at: new Date().toISOString(),
    };

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

    if (options.json) {
      console.log(JSON.stringify(output, null, 2));
    } else if (!options.quiet) {
      console.log(renderFixtures(output, options.showIds));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(renderError(message));
    process.exit(1);
  }
}
