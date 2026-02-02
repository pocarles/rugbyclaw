import { loadConfig, loadSecrets, loadState, saveState, isConfigured } from '../lib/config.js';
import { LEAGUES } from '../lib/leagues.js';
import { TheSportsDBProvider } from '../lib/providers/thesportsdb.js';
import { generateSummary } from '../lib/personality.js';
import { renderNotify, matchToOutput, renderError } from '../render/terminal.js';
import type {
  Match,
  MatchNotificationState,
  State,
  NotifyOutput,
  Notification,
} from '../types/index.js';

interface NotifyOptions {
  json?: boolean;
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
  provider: TheSportsDBProvider,
  config: Awaited<ReturnType<typeof loadConfig>>
): Promise<Notification[]> {
  const notifications: Notification[] = [];
  const now = Date.now();
  const weekEnd = now + 7 * DAY_MS;

  const leagueIds = config.favorite_leagues
    .map((slug) => LEAGUES[slug]?.id)
    .filter(Boolean) as string[];

  const teamIds = config.favorite_teams.map((t) => t.id);

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
      const day = date.toLocaleDateString('en-US', { weekday: 'short' });
      const time = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
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
  provider: TheSportsDBProvider,
  config: Awaited<ReturnType<typeof loadConfig>>,
  state: State
): Promise<{ notifications: Notification[]; state: State }> {
  const notifications: Notification[] = [];
  const now = Date.now();
  const tomorrow = now + DAY_MS;
  const hourFromNow = now + HOUR_MS;

  const leagueIds = config.favorite_leagues
    .map((slug) => LEAGUES[slug]?.id)
    .filter(Boolean) as string[];

  const teamIds = config.favorite_teams.map((t) => t.id);

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

      // Day before reminder
      const timeTillMatch = match.timestamp - now;
      if (
        timeTillMatch > 0 &&
        timeTillMatch <= DAY_MS &&
        timeTillMatch > 23 * HOUR_MS &&
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
        });

        notifications.push({
          type: 'day_before',
          match_id: match.id,
          message: `${match.homeTeam.name} plays tomorrow at ${time} vs ${match.awayTeam.name}${match.venue ? ` at ${match.venue}` : ''}`,
          match: matchToOutput(match),
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
          match: matchToOutput(match),
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
  provider: TheSportsDBProvider,
  config: Awaited<ReturnType<typeof loadConfig>>,
  state: State
): Promise<{ notifications: Notification[]; state: State }> {
  const notifications: Notification[] = [];
  const now = Date.now();

  const leagueIds = config.favorite_leagues
    .map((slug) => LEAGUES[slug]?.id)
    .filter(Boolean) as string[];

  const teamIds = config.favorite_teams.map((t) => t.id);

  for (const leagueId of leagueIds) {
    // Check fixtures for live matches
    const fixtures = await provider.getLeagueFixtures(leagueId);
    const results = await provider.getLeagueResults(leagueId);
    const allMatches = [...fixtures, ...results];

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
          match: matchToOutput(match),
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
          match: matchToOutput(match),
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
          match: matchToOutput(match),
        });
      }

      state.matches[match.id] = matchState;
    }
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
  // Check configuration
  if (!(await isConfigured())) {
    if (options.json) {
      console.log(JSON.stringify({ error: 'Not configured' }));
    } else {
      console.log(renderError('Not configured. Run "rugbyclaw config" first.'));
    }
    process.exit(1);
  }

  const config = await loadConfig();
  const secrets = await loadSecrets();
  let state = await loadState();

  if (!secrets) {
    if (options.json) {
      console.log(JSON.stringify({ error: 'API key not found' }));
    } else {
      console.log(renderError('API key not found. Run "rugbyclaw config" first.'));
    }
    process.exit(1);
  }

  const provider = new TheSportsDBProvider(secrets.api_key);
  let notifications: Notification[] = [];

  try {
    if (options.weekly) {
      notifications = await handleWeekly(provider, config);
    } else if (options.daily) {
      const result = await handleDaily(provider, config, state);
      notifications = result.notifications;
      state = result.state;
      await saveState(state);
    } else if (options.live) {
      const result = await handleLive(provider, config, state);
      notifications = result.notifications;
      state = result.state;
      await saveState(state);
    } else {
      // Default: run all checks
      const weeklyNotifs = await handleWeekly(provider, config);
      const dailyResult = await handleDaily(provider, config, state);
      const liveResult = await handleLive(provider, config, dailyResult.state);

      notifications = [...weeklyNotifs, ...dailyResult.notifications, ...liveResult.notifications];
      state = liveResult.state;
      await saveState(state);
    }

    const output: NotifyOutput = {
      type: options.weekly ? 'weekly' : options.daily ? 'daily' : 'live',
      notifications,
      generated_at: new Date().toISOString(),
    };

    if (options.json) {
      console.log(JSON.stringify(output, null, 2));
    } else if (!options.quiet) {
      if (notifications.length > 0) {
        console.log(renderNotify(output));
      } else {
        const mode = options.weekly ? 'weekly' : options.daily ? 'daily' : 'live';
        console.log(`No ${mode} notifications at this time.`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (options.json) {
      console.log(JSON.stringify({ error: message }));
    } else {
      console.log(renderError(message));
    }
    process.exit(1);
  }
}
