import { EXIT_CODES, exitLabel } from './exit-codes.js';

export interface StructuredOutputOptions {
  json?: boolean;
  agent?: boolean;
  quiet?: boolean;
}

interface SuccessMeta {
  traceId?: string | null;
}

export function wantsStructuredOutput(options: StructuredOutputOptions): boolean {
  return Boolean(options.json || options.agent);
}

export function emitCommandSuccess<T>(
  data: T,
  options: StructuredOutputOptions,
  meta: SuccessMeta = {}
): void {
  if (options.agent) {
    console.log(
      JSON.stringify({
        ok: true,
        exit_code: EXIT_CODES.OK,
        error_type: exitLabel(EXIT_CODES.OK),
        data,
        trace_id: meta.traceId ?? null,
      })
    );
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(data, null, 2));
  }
}
