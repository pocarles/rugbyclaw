export function formatDateYMD(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) {
    return date.toISOString().split('T')[0];
  }

  return `${year}-${month}-${day}`;
}

export function formatTimeHM(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const hour = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;

  if (!hour || !minute) {
    return date.toISOString().split('T')[1].slice(0, 5);
  }

  return `${hour}:${minute}`;
}

export function getTodayYMD(timeZone: string, now: Date = new Date()): string {
  return formatDateYMD(now, timeZone);
}

export function getTomorrowYMD(timeZone: string, now: Date = new Date()): string {
  return formatDateYMD(new Date(now.getTime() + 24 * 60 * 60 * 1000), timeZone);
}
