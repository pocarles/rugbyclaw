export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const aLen = a.length;
  const bLen = b.length;

  const prev = new Array<number>(bLen + 1);
  const curr = new Array<number>(bLen + 1);

  for (let j = 0; j <= bLen; j++) prev[j] = j;

  for (let i = 1; i <= aLen; i++) {
    curr[0] = i;
    const aChar = a.charCodeAt(i - 1);
    for (let j = 1; j <= bLen; j++) {
      const cost = aChar === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= bLen; j++) prev[j] = curr[j];
  }

  return prev[bLen];
}

export function similarityScore(queryRaw: string, candidateRaw: string): number {
  const query = normalizeText(queryRaw);
  const candidate = normalizeText(candidateRaw);

  if (!query || !candidate) return 0;
  if (query === candidate) return 1;

  if (candidate.includes(query)) {
    // Prefer earlier matches slightly.
    const idx = candidate.indexOf(query);
    return 0.92 - Math.min(0.1, idx / 200);
  }

  const queryTokens = query.split(' ');
  const candTokens = candidate.split(' ');

  // Compare against each token and full candidate.
  let best = 0;
  const compareSet = [candidate, ...candTokens];

  for (const item of compareSet) {
    const maxLen = Math.max(query.length, item.length);
    if (maxLen === 0) continue;
    const dist = levenshtein(query, item);
    const score = 1 - dist / maxLen;
    if (score > best) best = score;
  }

  // Token overlap boost.
  const candTokenSet = new Set(candTokens);
  const overlap = queryTokens.filter((t) => candTokenSet.has(t)).length;
  if (overlap > 0) {
    best = Math.max(best, 0.75 + Math.min(0.15, overlap * 0.05));
  }

  return Math.max(0, Math.min(1, best));
}

