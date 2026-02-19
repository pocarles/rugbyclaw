export interface SafeFileSlugOptions {
  fallback?: string;
  maxLength?: number;
}

/**
 * Convert arbitrary text into a conservative ASCII slug that is safe to use in filenames.
 */
export function toSafeFileSlug(value: string, options: SafeFileSlugOptions = {}): string {
  const fallback = options.fallback ?? 'rugby';
  const maxLength = options.maxLength ?? 80;

  const normalized = (value || '')
    .normalize('NFKD')
    // Strip combining diacritics (e.g. "Français" -> "Francais")
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    // Keep it boring: only a-z0-9, everything else becomes a dash.
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  const slug = normalized || fallback;
  if (slug.length <= maxLength) return slug;
  return slug.slice(0, maxLength).replace(/-+$/g, '');
}

