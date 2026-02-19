import { lstat, writeFile } from 'node:fs/promises';
import { loadSecrets } from '../lib/config.js';
import { ApiSportsProvider } from '../lib/providers/apisports.js';
import { matchToICS } from '../lib/ics.js';
import { renderSuccess } from '../render/terminal.js';
import { emitCommandError } from '../lib/command-error.js';
import { EXIT_CODES } from '../lib/exit-codes.js';

interface CalendarOptions {
  json?: boolean;
  quiet?: boolean;
  stdout?: boolean;
  out?: string;
  force?: boolean;
}

function exitWithError(message: string, options: CalendarOptions): never {
  emitCommandError(message, options, EXIT_CODES.INVALID_INPUT);
}

function exitWithRuntimeError(message: string, options: CalendarOptions): never {
  emitCommandError(message, options);
}

export async function calendarCommand(
  matchId: string,
  options: CalendarOptions
): Promise<void> {
  if (options.json && options.stdout) {
    exitWithError('Cannot use --json with --stdout (would mix ICS and JSON output).', options);
  }

  const outPath = options.out || `match-${matchId}.ics`;

  if (!options.stdout) {
    try {
      const stats = await lstat(outPath);
      if (!stats.isFile()) {
        exitWithError(`Refusing to write to non-regular file: ${outPath}`, options);
      }
      if (!options.force) {
        exitWithError(`Refusing to overwrite existing file: ${outPath}. Use --force to replace it.`, options);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        throw error;
      }
    }
  }

  // Get API key if available (otherwise use proxy mode)
  const secrets = await loadSecrets();
  const provider = new ApiSportsProvider(secrets?.api_key);

  try {
    const match = await provider.getMatch(matchId);

    if (!match) {
      exitWithError(`Match not found: ${matchId}`, options);
    }

    const ics = matchToICS(match);

    if (options.stdout) {
      // Output to stdout
      process.stdout.write(ics);
      return;
    }

    await writeFile(outPath, ics, { flag: options.force ? 'w' : 'wx' });

    if (!options.quiet) {
      console.log(renderSuccess(`Calendar saved to ${outPath}`));
    }

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            match_id: matchId,
            out: outPath,
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
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EEXIST') {
      exitWithError(`Refusing to overwrite existing file: ${outPath}. Use --force to replace it.`, options);
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    exitWithRuntimeError(message, options);
  }
}
