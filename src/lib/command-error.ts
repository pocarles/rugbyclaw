import { renderError } from '../render/terminal.js';
import { EXIT_CODES, exitLabel, inferExitCodeFromMessage, type ExitCode } from './exit-codes.js';

interface ErrorOutputOptions {
  json?: boolean;
  quiet?: boolean;
}

export function emitCommandError(
  message: string,
  options: ErrorOutputOptions,
  fallbackCode: ExitCode = EXIT_CODES.GENERAL_ERROR
): never {
  const exitCode = inferExitCodeFromMessage(message, fallbackCode);
  const reason = exitLabel(exitCode);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          error: message,
          exit_code: exitCode,
          error_type: reason,
        },
        null,
        2
      )
    );
  } else if (!options.quiet) {
    console.log(renderError(message));
  } else {
    console.error(message);
  }

  process.exit(exitCode);
}

