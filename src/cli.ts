#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import { configCommand } from './commands/config.js';
import { scoresCommand } from './commands/scores.js';
import { fixturesCommand } from './commands/fixtures.js';
import { resultsCommand } from './commands/results.js';
import { teamCommand } from './commands/team.js';
import { calendarCommand } from './commands/calendar.js';
import { notifyCommand } from './commands/notify.js';
import { statusCommand } from './commands/status.js';
import { doctorCommand } from './commands/doctor.js';
import { openclawInitCommand } from './commands/openclaw.js';
import { setConfigPathOverride, setTimeZoneOverride } from './lib/config.js';
import { exitLabel, inferExitCodeFromMessage } from './lib/exit-codes.js';
import { emitCommandSuccess, wantsStructuredOutput } from './lib/output.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version?: string };
const VERSION = pkg.version ?? '0.0.0';

const CONFIG_PATH = join(homedir(), '.config', 'rugbyclaw', 'config.json');
const SECRETS_PATH = join(homedir(), '.config', 'rugbyclaw', 'secrets.json');

/**
 * Check if this is a first run (no config exists).
 */
function isFirstRun(): boolean {
  return !existsSync(CONFIG_PATH) && !existsSync(SECRETS_PATH);
}

/**
 * Show welcome message for first-time users.
 */
function showWelcome(): void {
  console.log('');
  console.log(chalk.bold.green('Welcome to Rugbyclaw!'));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log('');
  console.log('Rugby scores, fixtures, and results from your terminal.');
  console.log(chalk.dim('Works out of the box — no API key required (free mode).'));
  console.log('');
  console.log(chalk.bold.cyan('Best next step:'));
  console.log(`  ${chalk.black.bgCyan(' rugbyclaw start ')}  ${chalk.dim('30-second setup (recommended)')}`);
  console.log('');
  console.log(chalk.bold.cyan('Or try it now:'));
  console.log(`  ${chalk.white('rugbyclaw fixtures')}   Upcoming matches`);
  console.log(`  ${chalk.white('rugbyclaw results')}    Recent results`);
  console.log(`  ${chalk.white('rugbyclaw scores')}     Today's live scores`);
  console.log('');
  console.log(chalk.dim('Free mode leagues: Top 14, Premiership, URC, Champions Cup, Six Nations'));
  console.log(chalk.dim('Run "rugbyclaw start" for quick setup, or "rugbyclaw config --guided" for full control.'));
  console.log(chalk.dim('Run "rugbyclaw status" to verify setup.'));
  console.log('');
}

async function runSafe(action: () => Promise<void>, options?: { json?: boolean; agent?: boolean }): Promise<void> {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const exitCode = inferExitCodeFromMessage(message);
    const errorType = exitLabel(exitCode);
    if (options?.agent) {
      console.log(
        JSON.stringify({
          ok: false,
          exit_code: exitCode,
          error_type: errorType,
          data: { message },
          trace_id: null,
        })
      );
    } else if (options?.json) {
      console.log(JSON.stringify({ ok: false, error: message, exit_code: exitCode, error_type: errorType }, null, 2));
    } else {
      console.error(chalk.red(`Error: ${message}`));
    }
    process.exitCode = exitCode;
  }
}

const program = new Command();

program
  .name('rugbyclaw')
  .description('Rugby scores, fixtures, and results CLI')
  .version(VERSION)
  .option('--json', 'Output as JSON')
  .option('--agent', 'Strict one-line JSON envelope for automation/OpenClaw')
  .option('--quiet', 'Minimal output')
  .option('--no-color', 'Disable color output')
  .option('--config <path>', 'Use a custom config directory or config.json path')
  .option('--tz <timezone>', 'Override timezone (IANA), e.g. America/New_York');

// Show welcome on first run with no command
program.hook('preAction', () => {
  const options = program.opts<{ config?: string; tz?: string }>();
  if (options.config) {
    setConfigPathOverride(options.config);
  }
  if (options.tz) {
    setTimeZoneOverride(options.tz);
  }
});

// Version command (alias for --version)
program
  .command('version')
  .description('Print Rugbyclaw version')
  .action(() => {
    const options = program.opts<{ json?: boolean; agent?: boolean }>();
    if (wantsStructuredOutput(options)) {
      emitCommandSuccess({ version: VERSION }, options);
      return;
    }
    console.log(VERSION);
  });

// Doctor command
program
  .command('doctor')
  .description('Diagnose proxy/API/config issues')
  .option('--strict', 'Exit non-zero when checks fail')
  .addHelpText('after', `
${chalk.cyan('Examples:')}
  ${chalk.white('rugbyclaw doctor')}          Human-friendly checks
  ${chalk.white('rugbyclaw doctor --json')}   JSON output for automation
  ${chalk.white('rugbyclaw doctor --agent')}  Strict one-line envelope output
  ${chalk.white('rugbyclaw doctor --json --strict')} Fail-fast health gate
`)
  .action(async (options) => {
    await doctorCommand({ ...program.opts(), ...options });
  });

// OpenClaw bootstrap command
const openclawCmd = program
  .command('openclaw')
  .description('OpenClaw bootstrap helpers');

openclawCmd
  .command('init')
  .description('Emit OpenClaw-ready setup, checks, and command map')
  .action(async () => {
    await openclawInitCommand(program.opts());
  });

// Start command (beginner-first onboarding)
program
  .command('start')
  .description('Beginner setup (fast, free mode by default)')
  .addHelpText('after', `
${chalk.cyan('Examples:')}
  ${chalk.white('rugbyclaw start')}             Quick setup (recommended)
  ${chalk.white('rugbyclaw start --guided')}    Full guided setup
  ${chalk.white('rugbyclaw start --yes --tz America/New_York')}  Non-interactive setup
  ${chalk.white('rugbyclaw start --yes --mode proxy --agent')}  Non-interactive strict envelope
  ${chalk.white('rugbyclaw start --yes --mode direct --api-key-env API_SPORTS_KEY')}  Direct mode from env key
`)
  .option('--guided', 'Use full guided setup instead of quick mode')
  .option('--yes', 'Non-interactive mode (accept defaults)')
  .option('--mode <mode>', 'Set mode in non-interactive mode: proxy|direct')
  .option('--api-key-env <name>', 'Env var name for API key in non-interactive direct mode', 'API_SPORTS_KEY')
  .action(async (options) => {
    const base = program.opts<{ tz?: string; json?: boolean; agent?: boolean; quiet?: boolean }>();
    await runSafe(async () => {
      await configCommand({
        ...base,
        ...options,
        quick: !options.guided,
        guided: Boolean(options.guided),
        timezone: base.tz,
      });
    }, { json: Boolean(base.json), agent: Boolean(base.agent) });
  });

// Config command
program
  .command('config')
  .description('Customize leagues, teams, or add your own API key')
  .addHelpText('after', `
${chalk.cyan('Examples:')}
  ${chalk.white('rugbyclaw config --quick')}     Fast setup with fewer prompts
  ${chalk.white('rugbyclaw config --guided')}    Full setup (mode/leagues/teams/timezone)
  ${chalk.white('rugbyclaw config --yes --mode proxy')}  Non-interactive free mode
  ${chalk.white('rugbyclaw config --yes --mode proxy --agent')}  Strict envelope output
  ${chalk.white('rugbyclaw config --yes --mode direct --api-key-env API_SPORTS_KEY')}  Non-interactive direct mode
`)
  .option('--quick', 'Force quick setup (fewer prompts)')
  .option('--guided', 'Force full guided setup')
  .option('--yes', 'Non-interactive mode (accept defaults)')
  .option('--mode <mode>', 'Set mode in non-interactive mode: proxy|direct')
  .option('--api-key-env <name>', 'Env var name for API key in non-interactive direct mode', 'API_SPORTS_KEY')
  .action(async (options) => {
    const base = program.opts<{ tz?: string; json?: boolean; agent?: boolean; quiet?: boolean }>();
    await runSafe(async () => {
      await configCommand({ ...base, ...options, timezone: base.tz });
    }, { json: Boolean(base.json), agent: Boolean(base.agent) });
  });

// Scores command
program
  .command('scores')
  .description("Today's matches across favorite leagues")
  .option('--explain', 'Explain why output is empty')
  .addHelpText('after', `
${chalk.cyan('Examples:')}
  ${chalk.white('rugbyclaw scores')}              Live scores from your leagues
  ${chalk.white('rugbyclaw scores --json')}       Output as JSON
  ${chalk.white('rugbyclaw scores --explain')}    Show context if empty
`)
  .action(async () => {
    await scoresCommand(program.opts());
  });

// Fixtures command
program
  .command('fixtures [league]')
  .description('Upcoming matches')
  .option('-n, --limit <number>', 'Number of matches to show', '15')
  .option('--ics', 'Export fixtures to .ics calendar file')
  .option('--show-ids', 'Show match IDs for calendar export')
  .option('--explain', 'Explain why output is empty')
  .addHelpText('after', `
${chalk.cyan('Examples:')}
  ${chalk.white('rugbyclaw fixtures')}            All your favorite leagues
  ${chalk.white('rugbyclaw fixtures top14')}      Top 14 only
  ${chalk.white('rugbyclaw fixtures -n 5')}       Next 5 matches
  ${chalk.white('rugbyclaw fixtures --ics')}      Export to calendar file
  ${chalk.white('rugbyclaw fixtures --show-ids')} Show match IDs for export
  ${chalk.white('rugbyclaw fixtures --explain')}  Show context if empty

${chalk.cyan('Available leagues:')}
  top14, premiership, urc, pro_d2, super_rugby,
  champions_cup, challenge_cup, six_nations
`)
  .action(async (league, options) => {
    await fixturesCommand(league, { ...program.opts(), ...options });
  });

// Results command
program
  .command('results [league]')
  .description('Recent results')
  .option('-n, --limit <number>', 'Number of matches to show', '15')
  .addHelpText('after', `
${chalk.cyan('Examples:')}
  ${chalk.white('rugbyclaw results')}             All your favorite leagues
  ${chalk.white('rugbyclaw results premiership')} Premiership only
  ${chalk.white('rugbyclaw results -n 3')}        Last 3 results
  ${chalk.white('rugbyclaw results --json')}      Output as JSON
`)
  .action(async (league, options) => {
    await resultsCommand(league, { ...program.opts(), ...options });
  });

// Team command with subcommands
const teamCmd = program
  .command('team')
  .description('Team queries')
  .addHelpText('after', `
${chalk.cyan('Examples:')}
  ${chalk.white('rugbyclaw team search toulouse')}  Find a team
  ${chalk.white('rugbyclaw team next racing')}      Next match for Racing 92
  ${chalk.white('rugbyclaw team last leinster')}    Leinster's last result
`);

teamCmd
  .command('search <query>')
  .description('Search for a team by name')
  .addHelpText('after', `
${chalk.cyan('Examples:')}
  ${chalk.white('rugbyclaw team search toulouse')}    Find Stade Toulousain
  ${chalk.white('rugbyclaw team search saracens')}    Find Saracens
  ${chalk.white('rugbyclaw team search "la rochelle"')} Search with spaces
`)
  .action(async (query) => {
    await teamCommand(query, 'search', program.opts());
  });

teamCmd
  .command('next <name>')
  .description("Team's next match")
  .option('--ics', 'Export match to .ics calendar file')
  .addHelpText('after', `
${chalk.cyan('Examples:')}
  ${chalk.white('rugbyclaw team next toulouse')}     Next Toulouse match
  ${chalk.white('rugbyclaw team next racing --ics')} Export to calendar
  ${chalk.white('rugbyclaw team next leinster --json')} Output as JSON
`)
  .action(async (name, options) => {
    await teamCommand(name, 'next', { ...program.opts(), ...options });
  });

teamCmd
  .command('last <name>')
  .description("Team's last result")
  .addHelpText('after', `
${chalk.cyan('Examples:')}
  ${chalk.white('rugbyclaw team last munster')}    Munster's last result
  ${chalk.white('rugbyclaw team last clermont')}   Clermont's last result
  ${chalk.white('rugbyclaw team last bath --json')} Output as JSON
`)
  .action(async (name) => {
    await teamCommand(name, 'last', program.opts());
  });

// Calendar command
program
  .command('calendar <matchId>')
  .description('Export match to ICS calendar file')
  .option('--stdout', 'Output to stdout instead of file')
  .option('-o, --out <file>', 'Output file path')
  .option('-f, --force', 'Overwrite output file if it exists')
  .addHelpText('after', `
${chalk.cyan('Examples:')}
  ${chalk.white('rugbyclaw calendar 49979')}         Save as match-49979.ics
  ${chalk.white('rugbyclaw calendar 49979 -o game.ics')} Custom filename
  ${chalk.white('rugbyclaw calendar 49979 -o game.ics --force')} Replace existing file
  ${chalk.white('rugbyclaw calendar 49979 --stdout')}  Output to terminal

${chalk.dim('Tip: Use "rugbyclaw fixtures --show-ids" to find match IDs')}
`)
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

// Status command
program
  .command('status')
  .description('Show current mode, timezone, and effective leagues')
  .action(async () => {
    await statusCommand(program.opts());
  });

// Handle no command - show welcome or help
if (process.argv.length === 2) {
  if (isFirstRun()) {
    showWelcome();
  } else {
    program.help();
  }
} else {
  program.parse();
}
