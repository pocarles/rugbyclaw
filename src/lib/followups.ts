import chalk from 'chalk';
import type { StructuredOutputOptions } from './output.js';
import { wantsStructuredOutput } from './output.js';

export interface FollowupOptions extends StructuredOutputOptions {
  quiet?: boolean;
  followups?: boolean;
}

function normalizeHints(hints: string[]): string[] {
  const cleaned = hints
    .map((hint) => hint.trim())
    .filter((hint) => hint.length > 0);
  return Array.from(new Set(cleaned)).slice(0, 3);
}

export function shouldShowFollowups(options: FollowupOptions): boolean {
  if (wantsStructuredOutput(options)) return false;
  if (options.quiet) return false;
  if (options.followups === false) return false;
  return true;
}

export function renderFollowups(hints: string[]): string {
  const normalized = normalizeHints(hints);
  if (normalized.length === 0) return '';

  const lines = [chalk.bold.cyan('Next steps:')];
  for (const hint of normalized) {
    lines.push(chalk.dim(`  • ${hint}`));
  }
  return lines.join('\n');
}

export function printFollowups(options: FollowupOptions, hints: string[]): void {
  if (!shouldShowFollowups(options)) return;
  const rendered = renderFollowups(hints);
  if (!rendered) return;
  console.log('');
  console.log(rendered);
}

export function quoteArg(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}
