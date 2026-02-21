import chalk from 'chalk';
import { fetchProxyStatus } from './providers/apisports.js';
import type { ProxyStatus } from './providers/apisports.js';

interface ProxyQuotaOptions {
  staleFallback?: boolean;
  requestUnits?: number;
  timeZone?: string;
}

function formatResetLabel(reset: string | undefined, timeZone: string): string | null {
  if (!reset) return null;

  const parsed = new Date(reset);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString('en-US', {
      timeZone,
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  return reset;
}

export async function getProxyStatusIfFree(
  hasApiKey: boolean,
  enabled: boolean
): Promise<ProxyStatus | null> {
  if (hasApiKey || !enabled) return null;
  return fetchProxyStatus();
}

export function getProxyRateLimit(status: ProxyStatus | null): ProxyStatus['rate_limit'] | undefined {
  return status?.rate_limit;
}

export function getProxyQuotaLine(
  status: ProxyStatus | null,
  hasApiKey = false,
  options: ProxyQuotaOptions = {}
): string | null {
  if (hasApiKey) {
    return null;
  }

  const requestUnits = Math.max(1, Math.floor(options.requestUnits ?? 1));
  const timeZone = options.timeZone || 'UTC';

  if (!status) {
    if (options.staleFallback) {
      return chalk.yellow('Free mode: using cached data while proxy status is temporarily unavailable.');
    }
    return chalk.yellow('Free mode: proxy status unavailable right now. Run "rugbyclaw doctor" for details.');
  }

  const day = status.rate_limit?.day;
  const minute = status.rate_limit?.minute;

  if (!day) {
    return chalk.dim('Free mode: proxy online.');
  }

  const estimatedDailyRuns = Math.max(0, Math.floor(day.remaining / requestUnits));
  const estimatedMinuteRuns = minute ? Math.max(0, Math.floor(minute.remaining / requestUnits)) : null;
  const resetLabel = formatResetLabel(day.reset, timeZone);

  let line = `Free quota: ${day.remaining}/${day.limit} today`;
  if (minute) {
    line += `, ${minute.remaining}/${minute.limit} per minute`;
  }
  line += ` · est ${estimatedDailyRuns} full run${estimatedDailyRuns === 1 ? '' : 's'} left`;
  if (estimatedMinuteRuns !== null) {
    line += ` (${estimatedMinuteRuns} right now)`;
  }
  if (resetLabel) {
    line += ` · resets ${resetLabel}`;
  }

  return chalk.dim(line);
}

export function getStaleFallbackLine(cachedAt: string | null): string {
  if (!cachedAt) {
    return chalk.yellow('Live data unavailable, showing cached snapshot.');
  }

  const ts = new Date(cachedAt);
  if (Number.isNaN(ts.getTime())) {
    return chalk.yellow('Live data unavailable, showing cached snapshot.');
  }

  return chalk.yellow(`Live data unavailable, showing cached snapshot from ${ts.toLocaleString()}.`);
}
