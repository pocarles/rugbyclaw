import { renderError } from '../render/terminal.js';

export interface CliOutputOptions {
  json?: boolean;
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function exitWithJson(value: unknown, code = 0): never {
  printJson(value);
  process.exit(code);
}

export function printError(message: string, options: CliOutputOptions = {}): void {
  if (options.json) {
    printJson({ error: message });
    return;
  }

  console.log(renderError(message));
}

export function exitWithError(message: string, options: CliOutputOptions = {}, code = 1): never {
  printError(message, options);
  process.exit(code);
}
