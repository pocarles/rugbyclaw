import { renderError } from '../render/terminal.js';
import { EXIT_CODES, exitLabel, inferExitCodeFromMessage, type ExitCode } from './exit-codes.js';
import { AGENT_ENVELOPE_VERSION } from './output.js';

interface ErrorOutputOptions {
  json?: boolean;
  agent?: boolean;
  quiet?: boolean;
}

interface ErrorContext {
  traceId?: string | null;
}

export function emitCommandError(
  message: string,
  options: ErrorOutputOptions,
  fallbackCode: ExitCode = EXIT_CODES.GENERAL_ERROR,
  context: ErrorContext = {}
): never {
  const exitCode = inferExitCodeFromMessage(message, fallbackCode);
  const reason = exitLabel(exitCode);

  if (options.agent) {
    console.log(
      JSON.stringify({
        schema_version: AGENT_ENVELOPE_VERSION,
        ok: false,
        exit_code: exitCode,
        error_type: reason,
        data: { message },
        trace_id: context.traceId ?? null,
      })
    );
  } else if (options.json) {
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
