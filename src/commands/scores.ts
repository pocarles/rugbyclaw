import { loadConfig, loadSecrets, isConfigured } from '../lib/config.js';
import { LEAGUES } from '../lib/leagues.js';
import { TheSportsDBProvider } from '../lib/providers/thesportsdb.js';
import { renderScores, matchToOutput, renderError } from '../render/terminal.js';
import type { ScoresOutput } from '../types/index.js';

interface ScoresOptions {
  json?: boolean;
  quiet?: boolean;
}

export async function scoresCommand(options: ScoresOptions): Promise<void> {
  // Check configuration
  if (!(await isConfigured())) {
    console.log(renderError('Not configured. Run "rugbyclaw config" first.'));
    process.exit(1);
  }

  const config = await loadConfig();
  const secrets = await loadSecrets();

  if (!secrets) {
    console.log(renderError('API key not found. Run "rugbyclaw config" first.'));
    process.exit(1);
  }

  // Get league IDs from favorites
  const leagueIds = config.favorite_leagues
    .map((slug) => LEAGUES[slug]?.id)
    .filter(Boolean) as string[];

  if (leagueIds.length === 0) {
    console.log(renderError('No favorite leagues configured. Run "rugbyclaw config" first.'));
    process.exit(1);
  }

  const provider = new TheSportsDBProvider(secrets.api_key);

  try {
    const matches = await provider.getToday(leagueIds);

    const output: ScoresOutput = {
      matches: matches.map((m) => matchToOutput(m)),
      generated_at: new Date().toISOString(),
    };

    if (options.json) {
      console.log(JSON.stringify(output, null, 2));
    } else if (!options.quiet) {
      console.log(renderScores(output));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(renderError(message));
    process.exit(1);
  }
}
