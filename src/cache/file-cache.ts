import type { CacheEntry, CacheOptions } from './types.js';

export class FileCache<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxAge: number;
  private maxEntries: number;

  constructor(options?: CacheOptions) {
    this.maxAge = options?.maxAge ?? 0;
    this.maxEntries = options?.maxEntries ?? 1000;
  }

  private makeKey(filePath: string, mtime: number): string {
    return `${filePath}:${mtime}`;
  }

  get(filePath: string, mtime: number): T | undefined {
    const key = this.makeKey(filePath, mtime);
    const entry = this.cache.get(key);

    if (!entry) return undefined;

    // Check staleness: if mtime changed, entry is invalid
    if (entry.mtime !== mtime) {
      this.cache.delete(key);
      return undefined;
    }

    // Check max age
    if (this.maxAge > 0 && Date.now() - entry.createdAt > this.maxAge) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(filePath: string, mtime: number, value: T): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    const key = this.makeKey(filePath, mtime);
    this.cache.set(key, {
      value,
      mtime,
      createdAt: Date.now(),
    });
  }

  has(filePath: string, mtime: number): boolean {
    return this.get(filePath, mtime) !== undefined;
  }

  invalidate(filePath: string): void {
    // Remove all entries for this file path (any mtime)
    for (const key of this.cache.keys()) {
      if (key.startsWith(filePath + ':')) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
