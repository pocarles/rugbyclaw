import { describe, expect, it, vi } from 'vitest';
import { emitCommandSuccess } from '../src/lib/output.js';
import { emitCommandError } from '../src/lib/command-error.js';
import { EXIT_CODES } from '../src/lib/exit-codes.js';

function withCapturedLog(fn: () => void): string {
  const originalLog = console.log;
  let line = '';
  console.log = (value?: unknown) => {
    line = String(value ?? '');
  };
  try {
    fn();
  } finally {
    console.log = originalLog;
  }
  return line;
}

describe('agent output envelope', () => {
  it('emits strict success envelope', () => {
    const line = withCapturedLog(() => {
      emitCommandSuccess({ ping: 'pong' }, { agent: true }, { traceId: 'trace-123' });
    });

    const payload = JSON.parse(line) as Record<string, unknown>;
    expect(payload).toEqual({
      schema_version: 1,
      ok: true,
      exit_code: 0,
      error_type: 'ok',
      data: { ping: 'pong' },
      trace_id: 'trace-123',
    });
  });

  it('emits strict error envelope', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
      throw new Error(`exit:${code}`);
    }) as never);

    try {
      const line = withCapturedLog(() => {
        expect(() => {
          emitCommandError(
            'Upstream API error',
            { agent: true },
            EXIT_CODES.UPSTREAM_ERROR,
            { traceId: 'trace-456' }
          );
        }).toThrow('exit:6');
      });

      const payload = JSON.parse(line) as Record<string, unknown>;
      expect(payload).toEqual({
        schema_version: 1,
        ok: false,
        exit_code: 6,
        error_type: 'upstream_error',
        data: { message: 'Upstream API error' },
        trace_id: 'trace-456',
      });
      expect(exitSpy).toHaveBeenCalledWith(6);
    } finally {
      exitSpy.mockRestore();
    }
  });
});
