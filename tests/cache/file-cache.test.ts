import { FileCache } from '../../src/cache/file-cache.js';

describe('FileCache', () => {
  let cache: FileCache<string>;

  beforeEach(() => {
    cache = new FileCache<string>();
  });

  describe('get/set', () => {
    it('should store and retrieve values', () => {
      cache.set('/path/to/file.ts', 1000, 'parsed-result');
      expect(cache.get('/path/to/file.ts', 1000)).toBe('parsed-result');
    });

    it('should return undefined for missing entries', () => {
      expect(cache.get('/path/to/missing.ts', 1000)).toBeUndefined();
    });

    it('should invalidate on mtime change', () => {
      cache.set('/path/to/file.ts', 1000, 'old-result');
      expect(cache.get('/path/to/file.ts', 2000)).toBeUndefined();
    });

    it('should store different values for different files', () => {
      cache.set('/path/a.ts', 1000, 'result-a');
      cache.set('/path/b.ts', 1000, 'result-b');
      expect(cache.get('/path/a.ts', 1000)).toBe('result-a');
      expect(cache.get('/path/b.ts', 1000)).toBe('result-b');
    });

    it('should store different values for same file with different mtime', () => {
      cache.set('/path/a.ts', 1000, 'v1');
      cache.set('/path/a.ts', 2000, 'v2');
      expect(cache.get('/path/a.ts', 1000)).toBe('v1');
      expect(cache.get('/path/a.ts', 2000)).toBe('v2');
    });
  });

  describe('has', () => {
    it('should return true for existing entries', () => {
      cache.set('/path/to/file.ts', 1000, 'data');
      expect(cache.has('/path/to/file.ts', 1000)).toBe(true);
    });

    it('should return false for missing entries', () => {
      expect(cache.has('/path/to/missing.ts', 1000)).toBe(false);
    });

    it('should return false for stale entries', () => {
      cache.set('/path/to/file.ts', 1000, 'data');
      expect(cache.has('/path/to/file.ts', 2000)).toBe(false);
    });
  });

  describe('invalidate', () => {
    it('should remove all entries for a file path', () => {
      cache.set('/path/to/file.ts', 1000, 'v1');
      cache.set('/path/to/file.ts', 2000, 'v2');
      cache.invalidate('/path/to/file.ts');
      expect(cache.get('/path/to/file.ts', 1000)).toBeUndefined();
      expect(cache.get('/path/to/file.ts', 2000)).toBeUndefined();
    });

    it('should not affect other files', () => {
      cache.set('/path/a.ts', 1000, 'a');
      cache.set('/path/b.ts', 1000, 'b');
      cache.invalidate('/path/a.ts');
      expect(cache.get('/path/a.ts', 1000)).toBeUndefined();
      expect(cache.get('/path/b.ts', 1000)).toBe('b');
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('/path/a.ts', 1000, 'a');
      cache.set('/path/b.ts', 1000, 'b');
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get('/path/a.ts', 1000)).toBeUndefined();
    });
  });

  describe('size', () => {
    it('should track entry count', () => {
      expect(cache.size).toBe(0);
      cache.set('/a.ts', 1, 'a');
      expect(cache.size).toBe(1);
      cache.set('/b.ts', 1, 'b');
      expect(cache.size).toBe(2);
    });
  });

  describe('maxEntries', () => {
    it('should evict oldest when at capacity', () => {
      const smallCache = new FileCache<string>({ maxEntries: 2 });
      smallCache.set('/a.ts', 1, 'a');
      smallCache.set('/b.ts', 1, 'b');
      smallCache.set('/c.ts', 1, 'c');
      expect(smallCache.size).toBe(2);
      // First entry should be evicted
      expect(smallCache.get('/a.ts', 1)).toBeUndefined();
      expect(smallCache.get('/c.ts', 1)).toBe('c');
    });
  });

  describe('maxAge', () => {
    it('should expire entries after maxAge', () => {
      const shortCache = new FileCache<string>({ maxAge: 50 });
      shortCache.set('/a.ts', 1, 'a');

      // Immediately should work
      expect(shortCache.get('/a.ts', 1)).toBe('a');

      // After waiting, should expire
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(shortCache.get('/a.ts', 1)).toBeUndefined();
          resolve();
        }, 100);
      });
    });
  });
});
