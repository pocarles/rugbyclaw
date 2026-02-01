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

/**
 * Format a date for display.
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  if (isToday) return chalk.green('Today');
  if (isTomorrow) return chalk.yellow('Tomorrow');

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a time for display.
 */
function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':');
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
function formatMatchLine(match: MatchOutput): string {
  const status = formatStatus(match.status);
  const time = match.status === 'scheduled' ? formatTime(match.time) : '';

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
  } else if (time) {
    line += `  ${chalk.cyan(time)}`;
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
export function renderFixtures(output: FixturesOutput): string {
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

  // Group by date
  const byDate = new Map<string, MatchOutput[]>();
  for (const match of output.matches) {
    if (!byDate.has(match.date)) {
      byDate.set(match.date, []);
    }
    byDate.get(match.date)!.push(match);
  }

  for (const [date, matches] of byDate) {
    lines.push(chalk.yellow(formatDate(date)));
    for (const match of matches) {
      lines.push(formatMatchLine(match));
    }
    lines.push('');
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
export function renderMatch(match: MatchOutput): string {
  const lines: string[] = [];

  const status = formatStatus(match.status);
  const dateTime = match.status === 'scheduled'
    ? `${formatDate(match.date)} at ${formatTime(match.time)}`
    : formatDate(match.date);

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
export function matchToOutput(match: Match, teamId?: string): MatchOutput {
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
    date: match.date.toISOString().split('T')[0],
    time: match.date.toISOString().split('T')[1].slice(0, 5),
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
