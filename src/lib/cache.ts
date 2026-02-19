import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import type { CacheEntry, CacheOptions } from './providers/types.js';

const CACHE_DIR = join(homedir(), '.cache', 'rugbyclaw');
const MAX_CACHE_SIZE_MB = 10;
const MAX_ENTRIES = 1000;

interface CacheIndex {
  entries: Record<string, { file: string; size: number; accessed: number }>;
  total_size: number;
}

/**
 * File-based cache with stale-while-revalidate support.
 */
export class Cache {
  private indexPath: string;
  private index: CacheIndex | null = null;

  constructor() {
    this.indexPath = join(CACHE_DIR, 'index.json');
  }

  private async ensureDir(): Promise<void> {
    if (!existsSync(CACHE_DIR)) {
      await mkdir(CACHE_DIR, { recursive: true });
    }
  }

  private async loadIndex(): Promise<CacheIndex> {
    if (this.index) return this.index;

    try {
      const data = await readFile(this.indexPath, 'utf-8');
      this.index = JSON.parse(data);
      return this.index!;
    } catch {
      this.index = { entries: {}, total_size: 0 };
      return this.index;
    }
  }

  private async saveIndex(): Promise<void> {
    await this.ensureDir();
    await writeFile(this.indexPath, JSON.stringify(this.index, null, 2));
  }

  private keyToFilename(key: string): string {
    // Use SHA-256 hash for unique, collision-free filenames
    const hash = createHash('sha256').update(key).digest('hex').slice(0, 32);
    return `${hash}.json`;
  }

  /**
   * Get cached data with SWR semantics.
   * Returns { data, stale } where stale indicates if background refresh is needed.
   */
  async get<T>(key: string): Promise<{ data: T; stale: boolean; cachedAt: number } | null> {
    const index = await this.loadIndex();
    const entry = index.entries[key];

    if (!entry) return null;

    try {
      const filePath = join(CACHE_DIR, entry.file);
      const content = await readFile(filePath, 'utf-8');
      const cached: CacheEntry<T> = JSON.parse(content);

      const now = Date.now();

      // Expired completely
      if (now > cached.expires_at) {
        await this.delete(key);
        return null;
      }

      // Update access time
      index.entries[key].accessed = now;
      await this.saveIndex();

      // Return with stale indicator
      return {
        data: cached.data,
        stale: now > cached.stale_at,
        cachedAt: cached.timestamp,
      };
    } catch {
      await this.delete(key);
      return null;
    }
  }

  /**
   * Set cached data with options.
   */
  async set<T>(key: string, data: T, options: CacheOptions): Promise<void> {
    await this.ensureDir();
    const index = await this.loadIndex();

    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      stale_at: now + options.stale_after,
      expires_at: now + options.expires_after,
    };

    const filename = this.keyToFilename(key);
    const filePath = join(CACHE_DIR, filename);
    const content = JSON.stringify(entry);
    const size = Buffer.byteLength(content);

    await writeFile(filePath, content);

    // Update index
    if (index.entries[key]) {
      index.total_size -= index.entries[key].size;
    }
    index.entries[key] = { file: filename, size, accessed: now };
    index.total_size += size;

    // Evict if needed
    await this.evictIfNeeded(index);
    await this.saveIndex();
  }

  /**
   * Delete a cache entry.
   */
  async delete(key: string): Promise<void> {
    const index = await this.loadIndex();
    const entry = index.entries[key];

    if (entry) {
      try {
        const { unlink } = await import('node:fs/promises');
        await unlink(join(CACHE_DIR, entry.file));
      } catch {
        // File already gone
      }
      index.total_size -= entry.size;
      delete index.entries[key];
      await this.saveIndex();
    }
  }

  /**
   * Clear all cache entries.
   */
  async clear(): Promise<void> {
    const index = await this.loadIndex();
    const { unlink } = await import('node:fs/promises');

    for (const entry of Object.values(index.entries)) {
      try {
        await unlink(join(CACHE_DIR, entry.file));
      } catch {
        // Ignore
      }
    }

    this.index = { entries: {}, total_size: 0 };
    await this.saveIndex();
  }

  /**
   * LRU eviction when cache exceeds limits.
   */
  private async evictIfNeeded(index: CacheIndex): Promise<void> {
    const maxBytes = MAX_CACHE_SIZE_MB * 1024 * 1024;
    const entries = Object.entries(index.entries);

    if (entries.length <= MAX_ENTRIES && index.total_size <= maxBytes) {
      return;
    }

    // Sort by last accessed (oldest first)
    entries.sort((a, b) => a[1].accessed - b[1].accessed);

    const { unlink } = await import('node:fs/promises');

    while (
      (entries.length > MAX_ENTRIES || index.total_size > maxBytes) &&
      entries.length > 0
    ) {
      const [key, entry] = entries.shift()!;
      try {
        await unlink(join(CACHE_DIR, entry.file));
      } catch {
        // Ignore
      }
      index.total_size -= entry.size;
      delete index.entries[key];
    }
  }
}

// Singleton instance
let cacheInstance: Cache | null = null;

export function getCache(): Cache {
  if (!cacheInstance) {
    cacheInstance = new Cache();
  }
  return cacheInstance;
}

/**
 * Create a cache key from endpoint and params.
 */
export function cacheKey(endpoint: string, params: Record<string, string | number | undefined>): string {
  const sortedParams = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return `${endpoint}?${sortedParams}`;
}
