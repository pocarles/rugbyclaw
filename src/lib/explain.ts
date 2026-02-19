export interface ExplainLeague {
  slug: string;
  id: string;
  name: string;
}

interface BaseExplainInput {
  mode: 'proxy' | 'direct';
  timeZone: string;
  leagues: ExplainLeague[];
}

interface ScoresExplainInput extends BaseExplainInput {
  dateYmd: string;
  matchCount: number;
}

interface FixturesExplainInput extends BaseExplainInput {
  matchCount: number;
  limit: number;
}

function formatMode(mode: 'proxy' | 'direct'): string {
  return mode === 'proxy' ? 'Free mode (proxy)' : 'API key (direct)';
}

function formatLeagues(leagues: ExplainLeague[]): string {
  if (leagues.length === 0) return 'none';
  return leagues.map((league) => `${league.slug}(${league.id})`).join(', ');
}

export function getScoresNoMatchesExplanation(input: ScoresExplainInput): string[] {
  if (input.matchCount > 0) return [];

  return [
    'Why no matches today:',
    `- Mode: ${formatMode(input.mode)}`,
    `- Timezone: ${input.timeZone}`,
    `- Date queried: ${input.dateYmd}`,
    `- Leagues queried: ${formatLeagues(input.leagues)}`,
    '- API result count: 0',
    '- Next step: run "rugbyclaw doctor" for deeper diagnostics.',
  ];
}

export function getFixturesNoMatchesExplanation(input: FixturesExplainInput): string[] {
  if (input.matchCount > 0) return [];

  return [
    'Why no upcoming fixtures:',
    `- Mode: ${formatMode(input.mode)}`,
    `- Timezone: ${input.timeZone}`,
    `- Leagues queried: ${formatLeagues(input.leagues)}`,
    `- Match limit: ${input.limit}`,
    '- API result count: 0',
    '- Next step: run "rugbyclaw doctor" for deeper diagnostics.',
  ];
}
