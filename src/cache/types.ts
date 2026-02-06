export interface CacheEntry<T> {
  value: T;
  mtime: number;
  createdAt: number;
}

export interface CacheOptions {
  maxAge?: number; // max age in ms (default: no expiry)
  maxEntries?: number; // max entries (default: 1000)
}
