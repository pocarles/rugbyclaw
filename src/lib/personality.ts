import type { Match, Score } from '../types/index.js';

type ResultType =
  | 'big_win'
  | 'close_win'
  | 'nail_biter'
  | 'draw'
  | 'close_loss'
  | 'big_loss';

interface ResultContext {
  type: ResultType;
  team: string;
  opponent: string;
  score: Score;
  margin: number;
  bonusPoint: boolean;
}

/**
 * Summaries for each result type.
 * Random selection for variety.
 */
const SUMMARIES: Record<ResultType, string[]> = {
  big_win: [
    '{team} demolished {opponent} {score}. Absolute clinic.',
    "That wasn't a match, that was a statement. {team} {score} {opponent}.",
    '{team} put on a masterclass. {score} against {opponent}.',
    'Dominant performance. {team} {score} {opponent}.',
    '{opponent} had no answer. {team} wins big, {score}.',
  ],
  close_win: [
    '{team} {score} {opponent}. Clenched the whole second half.',
    'Heart attack rugby. {team} takes it {score}.',
    '{team} edges {opponent} {score}. Closer than it should have been.',
    'Nervy finish but {team} gets it done. {score}.',
    '{team} survives against {opponent}. {score}.',
  ],
  nail_biter: [
    '{team} {score}! Converted in the final minutes. I need a drink.',
    'SCENES! {team} snatches it at the death. {score}.',
    '{team} {score}. That ending. My heart.',
    'Rugby gods smiled on {team} today. {score} against {opponent}.',
    'Last-gasp drama! {team} wins {score}.',
  ],
  draw: [
    '{team} {score} {opponent}. Nobody deserved to lose. Or win.',
    'Honors even. {team} and {opponent} share the points. {score}.',
    "A draw at {score}. Rugby's way of saying \"we'll do this again.\"",
    '{team} {score} {opponent}. Fair result.',
  ],
  close_loss: [
    '{team} {score} {opponent}. Hurts but they fought.',
    'Ugh. So close. {team} falls {score} to {opponent}.',
    '{team} comes up short against {opponent}. {score}.',
    "Margins. {team} loses by {margin}. That's rugby.",
    '{opponent} takes it {score}. {team} will be gutted.',
  ],
  big_loss: [
    "Let's not talk about it. ({team} {score})",
    'Pain. Moving on. {team} {score} {opponent}.',
    '{team} {score}. Rough day at the office.',
    'Reality check for {team}. {opponent} dominant, {score}.',
    '{opponent} ran riot. {team} {score}.',
  ],
};

const BONUS_POINT_ADDITIONS = [
  'Win + bonus point. Chef\'s kiss.',
  'Four tries secured. Bonus point in the bag.',
  'Maximum points. Bonus point earned.',
];

/**
 * Determine result type from perspective of a team.
 */
function getResultType(
  isHome: boolean,
  score: Score,
  _matchMinute?: number
): ResultType {
  const teamScore = isHome ? score.home : score.away;
  const opponentScore = isHome ? score.away : score.home;
  const margin = teamScore - opponentScore;

  if (margin === 0) {
    return 'draw';
  }

  if (margin > 0) {
    // Win
    if (margin >= 15) return 'big_win';
    if (margin <= 7) return 'close_win';
    return 'close_win'; // Default to close for 8-14 margin
  } else {
    // Loss
    if (margin <= -15) return 'big_loss';
    return 'close_loss';
  }
}

/**
 * Check if team earned a try bonus point (4+ tries).
 * Note: API-Sports doesn't provide try count, so we estimate from score.
 * 4 tries = minimum 20 points (unconverted) to 28 points (all converted)
 * This is a rough heuristic.
 */
function estimateBonusPoint(score: number): boolean {
  // Assume bonus point if score >= 28 (4 converted tries)
  // or >= 24 with likely mix
  return score >= 24;
}

/**
 * Format score string.
 */
function formatScore(score: Score, isHome: boolean): string {
  if (isHome) {
    return `${score.home}-${score.away}`;
  }
  return `${score.away}-${score.home}`;
}

/**
 * Pick a random item from an array.
 */
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a personality-driven match summary.
 *
 * @param match - The completed match
 * @param teamId - The team to generate summary for (perspective)
 * @returns A casual, opinionated summary
 */
export function generateSummary(match: Match, teamId?: string): string {
  if (!match.score || match.status !== 'finished') {
    return '';
  }

  // Determine which team we're rooting for
  const isHome = teamId ? match.homeTeam.id === teamId : true;
  const team = isHome ? match.homeTeam.name : match.awayTeam.name;
  const opponent = isHome ? match.awayTeam.name : match.homeTeam.name;
  const teamScore = isHome ? match.score.home : match.score.away;

  const resultType = getResultType(isHome, match.score);
  const bonusPoint = estimateBonusPoint(teamScore) && resultType.includes('win');

  const context: ResultContext = {
    type: resultType,
    team,
    opponent,
    score: match.score,
    margin: Math.abs(match.score.home - match.score.away),
    bonusPoint,
  };

  // Pick a random template
  const templates = SUMMARIES[resultType];
  let summary = randomChoice(templates);

  // Replace placeholders
  summary = summary
    .replace(/{team}/g, context.team)
    .replace(/{opponent}/g, context.opponent)
    .replace(/{score}/g, formatScore(context.score, isHome))
    .replace(/{margin}/g, context.margin.toString());

  // Add bonus point note for wins
  if (bonusPoint) {
    summary += ' ' + randomChoice(BONUS_POINT_ADDITIONS);
  }

  return summary;
}

/**
 * Generate a neutral match summary (no team perspective).
 */
export function generateNeutralSummary(match: Match): string {
  if (!match.score || match.status !== 'finished') {
    return `${match.homeTeam.name} vs ${match.awayTeam.name}`;
  }

  const { home, away } = match.score;
  const margin = Math.abs(home - away);

  if (home === away) {
    return `${match.homeTeam.name} ${home}-${away} ${match.awayTeam.name}. Honors even.`;
  }

  const winner = home > away ? match.homeTeam.name : match.awayTeam.name;
  const loser = home > away ? match.awayTeam.name : match.homeTeam.name;
  const winScore = Math.max(home, away);
  const loseScore = Math.min(home, away);

  if (margin >= 15) {
    return `${winner} dominates ${loser} ${winScore}-${loseScore}.`;
  } else if (margin <= 7) {
    return `${winner} edges ${loser} ${winScore}-${loseScore} in a tight one.`;
  }

  return `${winner} beats ${loser} ${winScore}-${loseScore}.`;
}
