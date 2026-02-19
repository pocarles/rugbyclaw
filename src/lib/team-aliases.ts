import { normalizeText } from './fuzzy.js';

const TEAM_ALIAS_MAP: Record<string, string> = {
  toulouse: 'Stade Toulousain',
  'stade toulouse': 'Stade Toulousain',
  'sf paris': 'Stade Francais Paris',
  'stade francais': 'Stade Francais Paris',
  'la rochelle': 'Stade Rochelais',
  rochelle: 'Stade Rochelais',
  bordeaux: 'Bordeaux Begles',
  begles: 'Bordeaux Begles',
  pau: 'Section Paloise',
  bayonne: 'Aviron Bayonnais',
  toulon: 'RC Toulonnais',
  clermont: 'Clermont',
  racing: 'Racing 92',
  montauban: 'Montauban',
  usap: 'USA Perpignan',
  perpi: 'USA Perpignan',
  england: 'England',
  france: 'France',
  ireland: 'Ireland',
  scotland: 'Scotland',
  wales: 'Wales',
  italy: 'Italy',
};

export function getTeamQueryCandidates(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const normalized = normalizeText(trimmed);
  const alias = TEAM_ALIAS_MAP[normalized];

  const seen = new Set<string>();
  const result: string[] = [];

  const push = (value: string | undefined): void => {
    if (!value) return;
    const candidate = value.trim();
    if (!candidate) return;
    const key = normalizeText(candidate);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(candidate);
  };

  push(trimmed);
  push(alias);

  return result;
}
