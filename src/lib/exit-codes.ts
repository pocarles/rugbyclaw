export const EXIT_CODES = {
  OK: 0,
  GENERAL_ERROR: 1,
  INVALID_INPUT: 2,
  CONFIG_ERROR: 3,
  AUTH_ERROR: 4,
  RATE_LIMITED: 5,
  UPSTREAM_ERROR: 6,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

const EXIT_CODE_LABELS: Record<ExitCode, string> = {
  [EXIT_CODES.OK]: 'ok',
  [EXIT_CODES.GENERAL_ERROR]: 'general_error',
  [EXIT_CODES.INVALID_INPUT]: 'invalid_input',
  [EXIT_CODES.CONFIG_ERROR]: 'config_error',
  [EXIT_CODES.AUTH_ERROR]: 'auth_error',
  [EXIT_CODES.RATE_LIMITED]: 'rate_limited',
  [EXIT_CODES.UPSTREAM_ERROR]: 'upstream_error',
};

function normalizeMessage(message: string): string {
  return message.toLowerCase();
}

export function inferExitCodeFromMessage(message: string, fallback: ExitCode = EXIT_CODES.GENERAL_ERROR): ExitCode {
  const msg = normalizeMessage(message);

  if (
    msg.includes('unknown league') ||
    msg.includes('invalid mode') ||
    msg.includes('invalid timezone') ||
    msg.includes('cannot use --json with --stdout') ||
    msg.includes('refusing to overwrite') ||
    msg.includes('non-regular file') ||
    msg.includes('use "--yes" with "--json"')
  ) {
    return EXIT_CODES.INVALID_INPUT;
  }

  if (msg.includes('not configured')) {
    return EXIT_CODES.CONFIG_ERROR;
  }

  if (msg.includes('invalid api key') || msg.includes('unauthorized')) {
    return EXIT_CODES.AUTH_ERROR;
  }

  if (msg.includes('rate limit') || msg.includes('daily limit reached')) {
    return EXIT_CODES.RATE_LIMITED;
  }

  if (
    msg.includes('temporarily unavailable') ||
    msg.includes('upstream') ||
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('api returned 5')
  ) {
    return EXIT_CODES.UPSTREAM_ERROR;
  }

  return fallback;
}

export function exitLabel(code: ExitCode): string {
  return EXIT_CODE_LABELS[code];
}

