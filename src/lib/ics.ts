import type { Match, CalendarEvent } from '../types/index.js';

/**
 * Generate a UID for an ICS event.
 */
function generateUID(matchId: string): string {
  return `${matchId}@rugbyclaw`;
}

/**
 * Format a date for ICS (YYYYMMDDTHHMMSSZ format).
 */
function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Escape text for ICS format.
 */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Fold long lines according to ICS spec (max 75 chars).
 */
function foldLine(line: string): string {
  const maxLen = 75;
  if (line.length <= maxLen) return line;

  const result: string[] = [];
  let remaining = line;

  while (remaining.length > maxLen) {
    result.push(remaining.slice(0, maxLen));
    remaining = ' ' + remaining.slice(maxLen); // Continuation lines start with space
  }
  result.push(remaining);

  return result.join('\r\n');
}

/**
 * Create a calendar event from a match.
 */
export function matchToCalendarEvent(match: Match): CalendarEvent {
  const summary = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
  const description = [
    `${match.league.name}`,
    match.round ? `Round ${match.round}` : '',
    match.venue ? `Venue: ${match.venue}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const startDate = new Date(match.timestamp);

  // Rugby matches are typically 80 minutes + halftime
  const endDate = new Date(startDate.getTime() + 100 * 60 * 1000);

  return {
    uid: generateUID(match.id),
    summary,
    description,
    location: match.venue,
    start: startDate,
    end: endDate,
  };
}

/**
 * Generate ICS content for a single event.
 */
export function generateICS(event: CalendarEvent): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rugbyclaw//Rugby Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeICS(event.uid)}`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `DTSTART:${formatICSDate(event.start)}`,
    `DTEND:${formatICSDate(event.end)}`,
    `SUMMARY:${escapeICS(event.summary)}`,
  ];

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeICS(event.location)}`);
  }

  if (event.url) {
    lines.push(`URL:${escapeICS(event.url)}`);
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');

  // Fold long lines and join with CRLF
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/**
 * Generate ICS content for multiple events.
 */
export function generateMultiEventICS(events: CalendarEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rugbyclaw//Rugby Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeICS(event.uid)}`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(event.start)}`,
      `DTEND:${formatICSDate(event.end)}`,
      `SUMMARY:${escapeICS(event.summary)}`
    );

    if (event.description) {
      lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
    }

    if (event.location) {
      lines.push(`LOCATION:${escapeICS(event.location)}`);
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/**
 * Generate ICS from a match.
 */
export function matchToICS(match: Match): string {
  const event = matchToCalendarEvent(match);
  return generateICS(event);
}

/**
 * Generate ICS from multiple matches.
 */
export function matchesToICS(matches: Match[]): string {
  const events = matches.map(matchToCalendarEvent);
  return generateMultiEventICS(events);
}
