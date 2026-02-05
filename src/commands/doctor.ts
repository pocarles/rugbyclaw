import chalk from 'chalk';
import { createRequire } from 'node:module';
import { getConfigDir, getEffectiveTimeZone, isValidTimeZone, loadConfig, loadSecrets } from '../lib/config.js';
import { API_SPORTS_BASE_URL, PROXY_URL } from '../lib/providers/apisports.js';

interface DoctorOptions {
  json?: boolean;
  quiet?: boolean;
}

type CheckResult = {
  ok: boolean;
  ms?: number;
  status?: number;
  error?: string;
  details?: unknown;
};

function formatMs(ms?: number): string {
  if (!Number.isFinite(ms)) return '';
  if (ms! < 1000) return `${ms}ms`;
  return `${(ms! / 1000).toFixed(1)}s`;
}

function formatCheck(label: string, result: CheckResult): string {
  const dur = result.ms !== undefined ? chalk.dim(` (${formatMs(result.ms)})`) : '';
  if (result.ok) return `${chalk.green('✓')} ${label}${dur}`;

  const status = result.status ? chalk.dim(` [${result.status}]`) : '';
  const err = result.error ? chalk.dim(` ${result.error}`) : '';
  return `${chalk.red('✗')} ${label}${dur}${status}${err}`;
}

async function fetchJsonWithTimeout(
  url: string,
  options: { headers?: Record<string, string> } = {},
  timeoutMs = 5000
): Promise<{ status: number; ok: boolean; ms: number; json?: unknown; text?: string; headers?: Record<string, string> } | { error: string; ms: number }> {
  const controller = new AbortController();
  const start = Date.now();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', ...(options.headers || {}) },
      signal: controller.signal,
    });
    const ms = Date.now() - start;
    const text = await res.text();

    let json: unknown = undefined;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      // keep raw text
    }

    const headers: Record<string, string> = {};
    for (const [k, v] of res.headers.entries()) headers[k] = v;

    return { status: res.status, ok: res.ok, ms, json, text, headers };
  } catch (e) {
    const ms = Date.now() - start;
    const message = e instanceof Error ? e.message : String(e);
    const error = message.includes('aborted') ? 'timeout' : message;
    return { error, ms };
  } finally {
    clearTimeout(timeout);
  }
}

function toCheckResult(res: Awaited<ReturnType<typeof fetchJsonWithTimeout>>): CheckResult {
  if ('error' in res) {
    return { ok: false, ms: res.ms, error: res.error };
  }
  return { ok: res.ok, ms: res.ms, status: res.status, details: res.json };
}

function pickApiSportsSampleSeason(): number {
  // Six Nations uses a calendar year season.
  return new Date().getFullYear();
}

export async function doctorCommand(options: DoctorOptions): Promise<void> {
  const require = createRequire(import.meta.url);
  const pkg = require('../../package.json') as { version?: string };
  const version = pkg.version ?? '0.0.0';

  const config = await loadConfig();
  const secrets = await loadSecrets();
  const hasApiKey = Boolean(secrets?.api_key);
  const mode: 'direct' | 'proxy' = hasApiKey ? 'direct' : 'proxy';
  const timeZone = getEffectiveTimeZone(config);

  const checks: Record<string, CheckResult> = {};

  // Proxy checks (always useful, even if user has an API key).
  const proxyHealthRes = await fetchJsonWithTimeout(`${PROXY_URL}/health`);
  const proxyHealth = toCheckResult(proxyHealthRes);
  checks.proxy_health = proxyHealth;

  const proxyStatusRes = await fetchJsonWithTimeout(`${PROXY_URL}/status`);
  const proxyStatus = toCheckResult(proxyStatusRes);
  checks.proxy_status = proxyStatus;

  const season = pickApiSportsSampleSeason();
  const proxyLeagueSampleRes = await fetchJsonWithTimeout(
    `${PROXY_URL}/leagues?id=51&season=${season}`
  );
  const proxyLeagueSample = toCheckResult(proxyLeagueSampleRes);
  checks.proxy_sample = proxyLeagueSample;

  // Direct API check (only if API key present).
  if (hasApiKey && secrets?.api_key) {
    const directRes = await fetchJsonWithTimeout(
      `${API_SPORTS_BASE_URL}/leagues?id=51&season=${season}`,
      { headers: { 'x-apisports-key': secrets.api_key } }
    );
    checks.api_direct = toCheckResult(directRes);
  }

  const proxyCoreOk = checks.proxy_health.ok && checks.proxy_sample.ok;
  const directOk = hasApiKey ? Boolean(checks.api_direct?.ok) : true;
  const ok = mode === 'proxy' ? proxyCoreOk : directOk;

  const output = {
    ok,
    version,
    node: process.version,
    mode,
    timezone: timeZone,
    timezone_valid: isValidTimeZone(timeZone),
    config_dir: getConfigDir(),
    proxy_url: PROXY_URL,
    proxy_url_override: process.env.RUGBYCLAW_PROXY_URL || null,
    checks,
    generated_at: new Date().toISOString(),
  };

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
    if (!output.ok) process.exit(1);
    return;
  }

  if (options.quiet) {
    if (!output.ok) process.exit(1);
    return;
  }

  const lines: string[] = [];
  lines.push(chalk.bold('Rugbyclaw Doctor'));
  lines.push('');
  lines.push(`${chalk.dim('Version:')} ${version}`);
  lines.push(`${chalk.dim('Node:')} ${process.version}`);
  lines.push(`${chalk.dim('Mode:')} ${mode === 'proxy' ? chalk.yellow('Free (no API key)') : chalk.green('API key')}`);
  lines.push(`${chalk.dim('Timezone:')} ${timeZone}${output.timezone_valid ? '' : chalk.yellow(' (invalid)')}`);
  lines.push(`${chalk.dim('Config dir:')} ${getConfigDir()}`);
  lines.push(`${chalk.dim('Proxy URL:')} ${PROXY_URL}`);
  if (process.env.RUGBYCLAW_PROXY_URL) {
    lines.push(chalk.dim(`Proxy override set via RUGBYCLAW_PROXY_URL`));
  }
  lines.push('');
  lines.push(chalk.bold('Checks'));
  lines.push(formatCheck('Proxy /health', checks.proxy_health));
  lines.push(formatCheck('Proxy /status', checks.proxy_status));
  lines.push(formatCheck('Proxy sample (leagues)', checks.proxy_sample));
  if (checks.api_direct) {
    lines.push(formatCheck('API-Sports direct (leagues)', checks.api_direct));
  } else {
    lines.push(chalk.dim('- API-Sports direct skipped (no API key)'));
  }

  if (!checks.proxy_status.ok && checks.proxy_health.ok) {
    lines.push('');
    lines.push(chalk.yellow('Proxy is reachable but /status failed.'));
    lines.push(chalk.dim('Tip: redeploy the Worker, or check if you are using a proxy URL override.'));
  }

  console.log(lines.join('\n'));

  if (!output.ok) process.exit(1);
}
