import { writeFile } from 'node:fs/promises';
import { loadSecrets } from '../lib/config.js';
import { ApiSportsProvider } from '../lib/providers/apisports.js';
import { matchToICS } from '../lib/ics.js';
import { renderError, renderSuccess } from '../render/terminal.js';

interface CalendarOptions {
  json?: boolean;
  quiet?: boolean;
  stdout?: boolean;
  out?: string;
}

export async function calendarCommand(
  matchId: string,
  options: CalendarOptions
): Promise<void> {
  // Get API key if available (otherwise use proxy mode)
  const secrets = await loadSecrets();
  const provider = new ApiSportsProvider(secrets?.api_key);

  try {
    const match = await provider.getMatch(matchId);

    if (!match) {
      console.log(renderError(`Match not found: ${matchId}`));
      process.exit(1);
    }

    const ics = matchToICS(match);

    if (options.stdout) {
      // Output to stdout
      process.stdout.write(ics);
    } else if (options.out) {
      // Write to specified file
      await writeFile(options.out, ics);
      if (!options.quiet) {
        console.log(renderSuccess(`Calendar saved to ${options.out}`));
      }
    } else {
      // Default: create file with match ID
      const filename = `match-${matchId}.ics`;
      await writeFile(filename, ics);
      if (!options.quiet) {
        console.log(renderSuccess(`Calendar saved to ${filename}`));
      }
    }

    if (options.json && !options.stdout) {
      console.log(
        JSON.stringify(
          {
            match_id: matchId,
            home: match.homeTeam.name,
            away: match.awayTeam.name,
            date: match.date.toISOString(),
            venue: match.venue,
          },
          null,
          2
        )
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(renderError(message));
    process.exit(1);
  }
}
