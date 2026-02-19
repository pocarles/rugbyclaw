import {
  loadConfig,
  loadSecrets,
  loadState,
  saveState,
  DEFAULT_PROXY_LEAGUES,
  getEffectiveTimeZone,
} from '../lib/config.js';
import { LEAGUES } from '../lib/leagues.js';
import { ApiSportsProvider } from '../lib/providers/apisports.js';
import { generateSummary } from '../lib/personality.js';
import { renderNotify, matchToOutput } from '../render/terminal.js';
import { formatDateYMD, getTodayYMD, getTomorrowYMD } from '../lib/datetime.js';
import type {
  Match,
  MatchNotificationState,
  State,
  NotifyOutput,
  Notification,
} from '../types/index.js';
import { emitCommandError } from '../lib/command-error.js';
import { emitCommandSuccess, wantsStructuredOutput } from '../lib/output.js';
import { getStaleFallbackLine } from '../lib/free-mode.js';

interface NotifyOptions {
  json?: boolean;
  agent?: boolean;
  quiet?: boolean;
  weekly?: boolean;
  daily?: boolean;
  live?: boolean;
}

const DEBOUNCE_MS = 90 * 1000; // 90 seconds
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Generate a hash for match score to detect changes.
 */
function scoreHash(match: Match): string {
  if (!match.score) return 'no-score';
  return `${match.score.home}-${match.score.away}-${match.status}`;
}

/**
 * Check if enough time has passed since last notification.
 */
function canNotify(state: MatchNotificationState | undefined, now: number): boolean {
  if (!state) return true;
  return now - state.last_notified_at > DEBOUNCE_MS;
}

/**
 * Weekly digest: list all matches for favorite teams this week.
 */
async function handleWeekly(
  provider: ApiSportsProvider,
  leagueIds: string[],
  teamIds: string[],
  timeZone: string
): Promise<Notification[]> {
  const notifications: Notification[] = [];
  const now = Date.now();
  const weekEnd = now + 7 * DAY_MS;

  const allFixtures: Match[] = [];

  for (const leagueId of leagueIds) {
    const fixtures = await provider.getLeagueFixtures(leagueId);
    const relevant = fixtures.filter(
      (m) =>
        m.timestamp >= now &&
        m.timestamp <= weekEnd &&
        (teamIds.length === 0 ||
          teamIds.includes(m.homeTeam.id) ||
          teamIds.includes(m.awayTeam.id))
    );
    allFixtures.push(...relevant);
  }

  if (allFixtures.length === 0) {
    return [];
  }

  // Sort by date
  allFixtures.sort((a, b) => a.timestamp - b.timestamp);

  // Format weekly digest
  const matchList = allFixtures
    .map((m) => {
      const date = new Date(m.date);
      const day = date.toLocaleDateString('en-US', { weekday: 'short', timeZone });
      const time = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone,
      });
      return `${m.homeTeam.name} vs ${m.awayTeam.name} (${day} ${time})`;
    })
    .join(', ');

  notifications.push({
    type: 'weekly_digest',
    match_id: 'weekly',
    message: `This week's rugby: ${matchList}`,
  });

  return notifications;
}

/**
 * Daily check: day-before and hour-before reminders.
 */
async function handleDaily(
  provider: ApiSportsProvider,
  leagueIds: string[],
  teamIds: string[],
  timeZone: string,
  state: State
): Promise<{ notifications: Notification[]; state: State }> {
  const notifications: Notification[] = [];
  const now = Date.now();
  const nowDate = new Date(now);
  const tomorrowYmd = getTomorrowYMD(timeZone, nowDate);

  for (const leagueId of leagueIds) {
    const fixtures = await provider.getLeagueFixtures(leagueId);

    for (const match of fixtures) {
      const isTracked =
        teamIds.length === 0 ||
        teamIds.includes(match.homeTeam.id) ||
        teamIds.includes(match.awayTeam.id);

      if (!isTracked) continue;

      const matchState = state.matches[match.id] || {
        match_id: match.id,
        status: match.status,
        last_score_hash: scoreHash(match),
        last_notified_at: 0,
        notified: {
          day_before: false,
          hour_before: false,
          kickoff: false,
          halftime: false,
          fulltime: false,
        },
      };

      const matchYmd = formatDateYMD(new Date(match.timestamp), timeZone);

      // Day before reminder
      const timeTillMatch = match.timestamp - now;
      if (
        timeTillMatch > 0 &&
        // Use calendar dates in the user's timezone instead of a narrow 23-24h window.
        // This makes `notify --daily` useful no matter what time it runs.
        matchYmd === tomorrowYmd &&
        !matchState.notified.day_before
      ) {
        // Write state first (idempotent)
        matchState.notified.day_before = true;
        matchState.last_notified_at = now;
        state.matches[match.id] = matchState;

        const date = new Date(match.date);
        const time = date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone,
        });

        notifications.push({
          type: 'day_before',
          match_id: match.id,
          message: `${match.homeTeam.name} plays tomorrow at ${time} vs ${match.awayTeam.name}${match.venue ? ` at ${match.venue}` : ''}`,
          match: matchToOutput(match, { timeZone }),
        });
      }

      // Hour before reminder
      if (
        timeTillMatch > 0 &&
        timeTillMatch <= HOUR_MS &&
        !matchState.notified.hour_before &&
        canNotify(matchState, now)
      ) {
        matchState.notified.hour_before = true;
        matchState.last_notified_at = now;
        state.matches[match.id] = matchState;

        notifications.push({
          type: 'hour_before',
          match_id: match.id,
          message: `${match.homeTeam.name} kicks off in ~1 hour vs ${match.awayTeam.name}`,
          match: matchToOutput(match, { timeZone }),
        });
      }

      state.matches[match.id] = matchState;
    }
  }

  return { notifications, state };
}

/**
 * Live polling: score updates during matches.
 */
async function handleLive(
  provider: ApiSportsProvider,
  leagueIds: string[],
  teamIds: string[],
  timeZone: string,
  state: State
): Promise<{ notifications: Notification[]; state: State }> {
  const notifications: Notification[] = [];
  const now = Date.now();
  // Use the cheaper "today" query path (one request per league, cached) instead of
  // fetching full season fixtures + results on every poll.
  const allMatches = await provider.getToday(leagueIds, { dateYmd: getTodayYMD(timeZone) });

  for (const match of allMatches) {
    const isTracked =
      teamIds.length === 0 ||
      teamIds.includes(match.homeTeam.id) ||
      teamIds.includes(match.awayTeam.id);

    if (!isTracked) continue;

    const matchState = state.matches[match.id] || {
      match_id: match.id,
      status: 'scheduled' as const,
      last_score_hash: '',
      last_notified_at: 0,
      notified: {
        day_before: false,
        hour_before: false,
        kickoff: false,
        halftime: false,
        fulltime: false,
      },
    };

    const currentHash = scoreHash(match);
    const previousStatus = matchState.status;

    // Kickoff detection
    if (
      match.status === 'live' &&
      previousStatus === 'scheduled' &&
      !matchState.notified.kickoff &&
      canNotify(matchState, now)
    ) {
      matchState.status = 'live';
      matchState.notified.kickoff = true;
      matchState.last_notified_at = now;
      matchState.last_score_hash = currentHash;
      state.matches[match.id] = matchState;

      notifications.push({
        type: 'kickoff',
        match_id: match.id,
        message: `🏉 Kickoff! ${match.homeTeam.name} vs ${match.awayTeam.name}`,
        match: matchToOutput(match, { timeZone }),
      });
      continue;
    }

    // Score change detection
    if (
      match.status === 'live' &&
      currentHash !== matchState.last_score_hash &&
      canNotify(matchState, now)
    ) {
      matchState.status = 'live';
      matchState.last_score_hash = currentHash;
      matchState.last_notified_at = now;
      state.matches[match.id] = matchState;

      const score = match.score
        ? `${match.score.home}-${match.score.away}`
        : 'Score update';

      notifications.push({
        type: 'score_update',
        match_id: match.id,
        message: `🏉 ${match.homeTeam.name} ${score} ${match.awayTeam.name}`,
        match: matchToOutput(match, { timeZone }),
      });
      continue;
    }

    // Fulltime detection
    if (
      match.status === 'finished' &&
      previousStatus !== 'finished' &&
      !matchState.notified.fulltime &&
      canNotify(matchState, now)
    ) {
      matchState.status = 'finished';
      matchState.notified.fulltime = true;
      matchState.last_notified_at = now;
      matchState.last_score_hash = currentHash;
      state.matches[match.id] = matchState;

      const teamId =
        teamIds.find(
          (id) => id === match.homeTeam.id || id === match.awayTeam.id
        ) || undefined;
      const summary = generateSummary(match, teamId);

      notifications.push({
        type: 'fulltime',
        match_id: match.id,
        message: summary || `FT: ${match.homeTeam.name} ${match.score?.home}-${match.score?.away} ${match.awayTeam.name}`,
        match: matchToOutput(match, { timeZone }),
      });
    }

    state.matches[match.id] = matchState;
  }

  // Prune old matches (older than 7 days)
  const weekAgo = now - 7 * DAY_MS;
  for (const [matchId, matchState] of Object.entries(state.matches)) {
    if (matchState.last_notified_at < weekAgo && matchState.status === 'finished') {
      delete state.matches[matchId];
    }
  }

  return { notifications, state };
}

export async function notifyCommand(options: NotifyOptions): Promise<void> {
  const config = await loadConfig();
  const secrets = await loadSecrets();
  let state = await loadState();
  const timeZone = getEffectiveTimeZone(config);

  const hasApiKey = Boolean(secrets?.api_key);
  const leagueSlugs = hasApiKey
    ? (config.favorite_leagues.length > 0 ? config.favorite_leagues : DEFAULT_PROXY_LEAGUES)
    : DEFAULT_PROXY_LEAGUES;
  const leagueIds = leagueSlugs
    .map((slug) => LEAGUES[slug]?.id)
    .filter(Boolean) as string[];
  const teamIds = config.favorite_teams.map((t) => t.id);

  const provider = new ApiSportsProvider(secrets?.api_key);
  let notifications: Notification[] = [];

  try {
    if (options.weekly) {
      notifications = await handleWeekly(provider, leagueIds, teamIds, timeZone);
    } else if (options.daily) {
      const result = await handleDaily(provider, leagueIds, teamIds, timeZone, state);
      notifications = result.notifications;
      state = result.state;
      await saveState(state);
    } else if (options.live) {
      const result = await handleLive(provider, leagueIds, teamIds, timeZone, state);
      notifications = result.notifications;
      state = result.state;
      await saveState(state);
    } else {
      // Default: run all checks
      const weeklyNotifs = await handleWeekly(provider, leagueIds, teamIds, timeZone);
      const dailyResult = await handleDaily(provider, leagueIds, teamIds, timeZone, state);
      const liveResult = await handleLive(provider, leagueIds, teamIds, timeZone, dailyResult.state);

      notifications = [...weeklyNotifs, ...dailyResult.notifications, ...liveResult.notifications];
      state = liveResult.state;
      await saveState(state);
    }

    const runtime = provider.consumeRuntimeMeta();
    const output: NotifyOutput = {
      type: options.weekly ? 'weekly' : options.daily ? 'daily' : 'live',
      notifications,
      generated_at: new Date().toISOString(),
      trace_id: runtime.traceId || undefined,
      stale: runtime.staleFallback || undefined,
      cached_at: runtime.cachedAt || undefined,
    };

    if (wantsStructuredOutput(options)) {
      emitCommandSuccess(output, options, { traceId: runtime.traceId });
    } else if (!options.quiet) {
      if (notifications.length > 0) {
        console.log(renderNotify(output));
      } else {
        const mode = options.weekly ? 'weekly' : options.daily ? 'daily' : 'live';
        console.log(`No ${mode} notifications at this time.`);
      }
      if (runtime.staleFallback) {
        console.log(getStaleFallbackLine(runtime.cachedAt));
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const runtime = provider.consumeRuntimeMeta();
    emitCommandError(message, options, undefined, { traceId: runtime.traceId });
  }
}
