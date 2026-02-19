import chalk from 'chalk';
import type {
  MatchOutput,
  ScoresOutput,
  FixturesOutput,
  ResultsOutput,
  TeamSearchOutput,
  NotifyOutput,
  Match,
} from '../types/index.js';
import { generateNeutralSummary } from '../lib/personality.js';
import { formatDateYMD, formatTimeHM, getTodayYMD, getTomorrowYMD } from '../lib/datetime.js';

/**
 * Get the default local timezone.
 */
function getDefaultTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Format a YYYY-MM-DD date for display.
 */
function formatDate(dateYmd: string, timeZone: string): string {
  const today = getTodayYMD(timeZone);
  const tomorrow = getTomorrowYMD(timeZone);

  if (dateYmd === today) return chalk.green('Today');
  if (dateYmd === tomorrow) return chalk.yellow('Tomorrow');

  const [yearStr, monthStr, dayStr] = dateYmd.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return dateYmd;
  }

  // Use UTC for stable weekday/month/day formatting of a calendar date.
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return utcDate.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a time for display.
 */
function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  if (!hours || !minutes) return timeStr;
  return `${hours}:${minutes}`;
}

/**
 * Format match status with color.
 */
function formatStatus(status: string): string {
  switch (status) {
    case 'live':
      return chalk.red.bold('LIVE');
    case 'finished':
      return chalk.dim('FT');
    case 'scheduled':
      return '';
    case 'postponed':
      return chalk.yellow('POSTPONED');
    case 'cancelled':
      return chalk.red('CANCELLED');
    default:
      return status;
  }
}

/**
 * Format a score with team names.
 */
function formatMatchLine(match: MatchOutput, showId = false): string {
  const status = formatStatus(match.status);
  const showTbd = match.status === 'scheduled' && match.time_tbd;
  const time = match.status === 'scheduled' && !showTbd && match.time
    ? formatTime(match.time)
    : '';

  let scorePart: string;
  if (match.home.score !== undefined && match.away.score !== undefined) {
    const homeScore = match.home.score.toString().padStart(2);
    const awayScore = match.away.score.toString().padEnd(2);
    scorePart = `${homeScore} - ${awayScore}`;
  } else {
    scorePart = '   vs   ';
  }

  const homeName = (match.home.name || 'TBD').padEnd(25);
  const awayName = (match.away.name || 'TBD').padStart(25);

  let line = `  ${homeName} ${scorePart} ${awayName}`;

  if (status) {
    line += `  ${status}`;
  } else if (showTbd) {
    line += `  ${chalk.yellow('Coming Soon')}`;
  } else if (time) {
    line += `  ${chalk.cyan(time)}`;
  }

  // Show match ID for calendar export
  if (showId && match.id) {
    line += chalk.dim(`  [${match.id}]`);
  }

  return line;
}

/**
 * Render scores output.
 */
export function renderScores(output: ScoresOutput): string {
  if (output.matches.length === 0) {
    return chalk.dim('No matches today.');
  }

  const lines: string[] = [
    chalk.bold("Today's Rugby"),
    '',
  ];

  // Group by league
  const byLeague = new Map<string, MatchOutput[]>();
  for (const match of output.matches) {
    const league = match.league;
    if (!byLeague.has(league)) {
      byLeague.set(league, []);
    }
    byLeague.get(league)!.push(match);
  }

  for (const [league, matches] of byLeague) {
    lines.push(chalk.cyan.bold(league));
    for (const match of matches) {
      lines.push(formatMatchLine(match));
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Render fixtures output.
 */
export function renderFixtures(
  output: FixturesOutput,
  showIds = false,
  timeZone: string = getDefaultTimeZone()
): string {
  if (output.matches.length === 0) {
    return chalk.dim('No upcoming fixtures found.');
  }

  const title = output.league
    ? `Upcoming: ${output.league}`
    : 'Upcoming Fixtures';

  const lines: string[] = [
    chalk.bold(title),
    '',
  ];

  const pendingKickoffMatches = output.matches.filter((m) => m.status === 'scheduled' && m.time_tbd);
  const confirmedKickoffMatches = output.matches.filter((m) => !(m.status === 'scheduled' && m.time_tbd));

  if (pendingKickoffMatches.length > 0) {
    lines.push(chalk.yellow('⚠ Kickoff date/time pending from API-Sports for some fixtures (showing Coming Soon).'));
    lines.push('');
  }

  const defaultTz = getDefaultTimeZone();
  if (timeZone !== defaultTz) {
    lines.push(chalk.dim(`Times shown in ${timeZone}`));
    lines.push('');
  }

  // Group confirmed fixtures by date
  const byDate = new Map<string, MatchOutput[]>();
  for (const match of confirmedKickoffMatches) {
    if (!byDate.has(match.date)) {
      byDate.set(match.date, []);
    }
    byDate.get(match.date)!.push(match);
  }

  for (const [date, matches] of byDate) {
    lines.push(chalk.yellow(formatDate(date, timeZone)));
    for (const match of matches) {
      lines.push(formatMatchLine(match, showIds));
    }
    lines.push('');
  }

  if (pendingKickoffMatches.length > 0) {
    lines.push(chalk.yellow('Coming Soon'));
    for (const match of pendingKickoffMatches) {
      lines.push(formatMatchLine(match, showIds));
    }
    lines.push('');
  }

  if (showIds) {
    lines.push(chalk.dim('Tip: rugbyclaw calendar <id> to export to .ics'));
  }

  return lines.join('\n');
}

/**
 * Render results output.
 */
export function renderResults(output: ResultsOutput): string {
  if (output.matches.length === 0) {
    return chalk.dim('No recent results found.');
  }

  const title = output.league
    ? `Results: ${output.league}`
    : 'Recent Results';

  const lines: string[] = [
    chalk.bold(title),
    '',
  ];

  for (const match of output.matches) {
    lines.push(formatMatchLine(match));
    if (match.summary) {
      lines.push(chalk.dim(`  ${match.summary}`));
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Render team search output.
 */
export function renderTeamSearch(output: TeamSearchOutput): string {
  if (output.teams.length === 0) {
    return chalk.dim(`No teams found for "${output.query}".`);
  }

  const lines: string[] = [
    chalk.bold(`Teams matching "${output.query}"`),
    '',
  ];

  for (const team of output.teams) {
    const country = team.country ? chalk.dim(` (${team.country})`) : '';
    lines.push(`  ${chalk.cyan(team.id)}  ${team.name}${country}`);
    if (team.leagues.length > 0) {
      lines.push(chalk.dim(`         ${team.leagues.join(', ')}`));
    }
  }

  return lines.join('\n');
}

/**
 * Render a single match (for team next/last).
 */
export function renderMatch(
  match: MatchOutput,
  showCalendarHint = false,
  timeZone: string = getDefaultTimeZone()
): string {
  const lines: string[] = [];

  const status = formatStatus(match.status);
  const showTbd = match.status === 'scheduled' && match.time_tbd;
  const dateTime = match.status === 'scheduled'
    ? showTbd
      ? chalk.yellow('Coming Soon')
      : `${formatDate(match.date, timeZone)} at ${formatTime(match.time)}`
    : formatDate(match.date, timeZone);

  lines.push(chalk.bold(`${match.home.name} vs ${match.away.name}`));
  lines.push(`${chalk.dim(match.league)} · ${dateTime} ${status}`);

  if (match.home.score !== undefined && match.away.score !== undefined) {
    lines.push('');
    lines.push(chalk.bold.white(`  ${match.home.score} - ${match.away.score}`));
  }

  if (match.summary) {
    lines.push('');
    lines.push(match.summary);
  }

  if (match.venue) {
    lines.push('');
    lines.push(chalk.dim(`📍 ${match.venue}`));
  }

  // Show calendar export hint for scheduled matches
  if (showCalendarHint && match.status === 'scheduled' && match.id) {
    lines.push('');
    lines.push(chalk.dim(`📅 rugbyclaw calendar ${match.id}`));
  }

  return lines.join('\n');
}

/**
 * Render notifications output.
 */
export function renderNotify(output: NotifyOutput): string {
  if (output.notifications.length === 0) {
    return chalk.dim('No notifications.');
  }

  const lines: string[] = [];

  for (const notification of output.notifications) {
    lines.push(notification.message);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Convert a Match to MatchOutput for rendering.
 */
export function matchToOutput(match: Match, options?: { timeZone?: string }): MatchOutput {
  const timeZone = options?.timeZone ?? getDefaultTimeZone();
  const kickoff = Number.isFinite(match.timestamp) ? new Date(match.timestamp) : match.date;
  return {
    id: match.id,
    home: {
      name: match.homeTeam.name,
      score: match.score?.home,
    },
    away: {
      name: match.awayTeam.name,
      score: match.score?.away,
    },
    league: match.league.name,
    date: formatDateYMD(kickoff, timeZone),
    time: match.timeTbd ? '' : formatTimeHM(kickoff, timeZone),
    time_tbd: match.timeTbd || undefined,
    time_confidence: match.timeTbd ? 'pending' : 'exact',
    time_source: match.timeSource,
    venue: match.venue,
    status: match.status,
    summary: match.status === 'finished' ? generateNeutralSummary(match) : undefined,
  };
}

/**
 * Render an error message.
 */
export function renderError(message: string): string {
  return chalk.red(`Error: ${message}`);
}

/**
 * Render a success message.
 */
export function renderSuccess(message: string): string {
  return chalk.green(`✓ ${message}`);
}

/**
 * Render a warning message.
 */
export function renderWarning(message: string): string {
  return chalk.yellow(`⚠ ${message}`);
}

/**
 * Render a "not configured" error with helpful instructions.
 */
export function renderNotConfigured(): string {
  const lines = [
    chalk.red('Not configured yet!'),
    '',
    chalk.white('Run quick setup to get started:'),
    '',
    `  ${chalk.cyan('rugbyclaw start')}`,
    '',
    chalk.dim('No API key required for free mode.'),
    chalk.dim('Need full control? Run "rugbyclaw config --guided".'),
  ];
  return lines.join('\n');
}

/**
 * Render an "API key missing" error with helpful instructions.
 */
export function renderApiKeyMissing(): string {
  const lines = [
    chalk.red('API key not found!'),
    '',
    chalk.white('Your config exists but there is no saved API key.'),
    chalk.white('This is fine in free mode. To add a key later, run:'),
    '',
    `  ${chalk.cyan('rugbyclaw config --guided')}`,
    '',
    chalk.dim('Your API key is stored in ~/.config/rugbyclaw/secrets.json when configured.'),
  ];
  return lines.join('\n');
}
