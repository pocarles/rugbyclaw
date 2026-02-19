import chalk from 'chalk';
import { fetchProxyStatus } from './providers/apisports.js';
import type { ProxyStatus } from './providers/apisports.js';

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

export function getProxyQuotaLine(status: ProxyStatus | null, hasApiKey = false): string | null {
  if (hasApiKey) {
    return null;
  }

  if (!status) {
    return chalk.yellow('Free mode: proxy unavailable right now.');
  }

  const day = status.rate_limit?.day;
  const minute = status.rate_limit?.minute;

  if (!day) {
    return chalk.dim('Free mode: proxy online.');
  }

  let line = `Free quota: ${day.remaining}/${day.limit} today`;
  if (minute) {
    line += `, ${minute.remaining}/${minute.limit} per minute`;
  }
  return chalk.dim(line);
}
