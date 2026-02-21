import { describe, expect, it } from 'vitest';
import { renderFollowups, shouldShowFollowups, quoteArg } from '../src/lib/followups.js';

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

describe('follow-up helpers', () => {
  it('hides followups for structured output and explicit opt-out', () => {
    expect(shouldShowFollowups({ json: true })).toBe(false);
    expect(shouldShowFollowups({ agent: true })).toBe(false);
    expect(shouldShowFollowups({ followups: false })).toBe(false);
    expect(shouldShowFollowups({ quiet: true })).toBe(false);
  });

  it('renders deduped, capped hint list', () => {
    const rendered = stripAnsi(
      renderFollowups([
        'one',
        'one',
        'two',
        'three',
        'four',
      ])
    );

    expect(rendered).toContain('Next steps:');
    expect(rendered).toContain('• one');
    expect(rendered).toContain('• two');
    expect(rendered).toContain('• three');
    expect(rendered).not.toContain('• four');
  });

  it('quotes command args safely', () => {
    expect(quoteArg('Stade Toulousain')).toBe('"Stade Toulousain"');
    expect(quoteArg('Team "A"')).toBe('"Team \\"A\\""');
  });
});
