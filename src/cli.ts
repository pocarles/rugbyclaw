#!/usr/bin/env node

import { Command } from 'commander';
import { configCommand } from './commands/config.js';
import { scoresCommand } from './commands/scores.js';
import { fixturesCommand } from './commands/fixtures.js';
import { resultsCommand } from './commands/results.js';
import { teamCommand } from './commands/team.js';
import { calendarCommand } from './commands/calendar.js';
import { notifyCommand } from './commands/notify.js';

const program = new Command();

program
  .name('rugbyclaw')
  .description('Rugby scores, fixtures, and results CLI')
  .version('0.1.0')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Minimal output')
  .option('--no-color', 'Disable color output');

// Config command
program
  .command('config')
  .description('Configure API key and preferences')
  .action(async () => {
    await configCommand(program.opts());
  });

// Scores command
program
  .command('scores')
  .description("Today's matches across favorite leagues")
  .action(async () => {
    await scoresCommand(program.opts());
  });

// Fixtures command
program
  .command('fixtures [league]')
  .description('Upcoming matches')
  .option('-n, --limit <number>', 'Number of matches to show', '15')
  .action(async (league, options) => {
    await fixturesCommand(league, { ...program.opts(), ...options });
  });

// Results command
program
  .command('results [league]')
  .description('Recent results')
  .option('-n, --limit <number>', 'Number of matches to show', '15')
  .action(async (league, options) => {
    await resultsCommand(league, { ...program.opts(), ...options });
  });

// Team command with subcommands
const teamCmd = program
  .command('team')
  .description('Team queries');

teamCmd
  .command('search <query>')
  .description('Search for a team by name')
  .action(async (query) => {
    await teamCommand(query, 'search', program.opts());
  });

teamCmd
  .command('next <name>')
  .description("Team's next match")
  .action(async (name) => {
    await teamCommand(name, 'next', program.opts());
  });

teamCmd
  .command('last <name>')
  .description("Team's last result")
  .action(async (name) => {
    await teamCommand(name, 'last', program.opts());
  });

// Calendar command
program
  .command('calendar <matchId>')
  .description('Export match to ICS calendar file')
  .option('--stdout', 'Output to stdout instead of file')
  .option('-o, --out <file>', 'Output file path')
  .action(async (matchId, options) => {
    await calendarCommand(matchId, { ...program.opts(), ...options });
  });

// Notify command
program
  .command('notify')
  .description('Proactive notifications (for cron/OpenClaw)')
  .option('--weekly', 'Generate weekly digest')
  .option('--daily', 'Check for daily reminders')
  .option('--live', 'Poll for live score updates')
  .action(async (options) => {
    await notifyCommand({ ...program.opts(), ...options });
  });

program.parse();
