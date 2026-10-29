/**
 * Lightweight in-memory cache for client-side SPA navigation.
 * Implements Stale-While-Revalidate (SWR) behavior with strict TTL
 * to guarantee instantaneous tab switches while ensuring data is always fresh.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

/** Default fresh TTL: 30 seconds */
const DEFAULT_TTL_MS = 30 * 1000;

/** Maximum stale allowable for immediate display while revalidating: 5 minutes */
const MAX_STALE_MS = 5 * 60 * 1000;

export function getClientCache<T>(
  key: string,
  ttlMs = DEFAULT_TTL_MS
): { data: T | null; isStale: boolean } {
  const entry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) {
    return { data: null, isStale: true };
  }

  const age = Date.now() - entry.timestamp;
  if (age > MAX_STALE_MS) {
    memoryCache.delete(key);
    return { data: null, isStale: true };
  }

  const isStale = age > ttlMs;
  return { data: entry.data, isStale };
}

export function setClientCache<T>(key: string, data: T): void {
  memoryCache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function invalidateClientCache(prefix?: string): void {
  if (!prefix) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
}
