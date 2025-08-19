/**
 * Tests for pattern cache functionality and performance
 */

import { setTimeout } from 'node:timers';
import { performance } from 'node:perf_hooks';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PatternCache,
  getGlobalPatternCache,
  resetGlobalPatternCache,
  configureGlobalPatternCache,
} from './pattern-cache.js';

describe('PatternCache', () => {
  let cache: PatternCache;

  beforeEach(() => {
    cache = new PatternCache({ maxSize: 10, ttlMs: 1000, enableStats: true });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('Glob Pattern Caching', () => {
    it('should cache and reuse glob patterns', () => {
      const patterns = ['**/*.ts', '**/*.js'];
      const options = { cwd: '/test' };

      // First call should be a cache miss
      const first = cache.getGlobPattern(patterns, options);
      expect(first.patterns).toEqual(patterns);
      expect(first.options).toEqual(options);

      // Second call should be a cache hit
      const second = cache.getGlobPattern(patterns, options);
      expect(second).toBe(first); // Same object reference

      const stats = cache.getStats();
      expect(stats.glob.hits).toBe(1);
      expect(stats.glob.misses).toBe(1);
      expect(stats.glob.hitRate).toBe(0.5);
    });

    it('should distinguish patterns by order but normalize for comparison', () => {
      const patterns1 = ['**/*.ts', '**/*.js'];
      const patterns2 = ['**/*.js', '**/*.ts']; // Different order
      const options = { cwd: '/test' };

      const first = cache.getGlobPattern(patterns1, options);
      const second = cache.getGlobPattern(patterns2, options);

      // Different cache keys due to different order
      expect(first.patterns).toEqual(patterns1);
      expect(second.patterns).toEqual(patterns2);
      expect(first.normalized).toBe(second.normalized);
    });

    it('should distinguish patterns with different options', () => {
      const patterns = ['**/*.ts'];
      const options1 = { cwd: '/test1' };
      const options2 = { cwd: '/test2' };

      const first = cache.getGlobPattern(patterns, options1);
      const second = cache.getGlobPattern(patterns, options2);

      expect(first).not.toBe(second);
    });
  });

  describe('Ignore Pattern Caching', () => {
    it('should cache and reuse ignore patterns', () => {
      const patterns = ['node_modules', '*.log'];

      // First call should be a cache miss
      const first = cache.getIgnorePattern(patterns);
      expect(first.ignores('node_modules/test.js')).toBe(true);
      expect(first.ignores('src/test.ts')).toBe(false);

      // Second call should be a cache hit
      const second = cache.getIgnorePattern(patterns);
      expect(second).toBe(first); // Same object reference

      const stats = cache.getStats();
      expect(stats.ignore.hits).toBe(1);
      expect(stats.ignore.misses).toBe(1);
    });

    it('should distinguish patterns by content', () => {
      const patterns1 = ['node_modules', '*.log'];
      const patterns2 = ['dist', '*.tmp'];

      const first = cache.getIgnorePattern(patterns1);
      const second = cache.getIgnorePattern(patterns2);

      expect(first).not.toBe(second);
      expect(first.ignores('node_modules/test.js')).toBe(true);
      expect(second.ignores('node_modules/test.js')).toBe(false);
    });

    it('should normalize pattern order for consistent caching', () => {
      const patterns1 = ['node_modules', '*.log'];
      const patterns2 = ['*.log', 'node_modules']; // Different order

      const first = cache.getIgnorePattern(patterns1);
      const second = cache.getIgnorePattern(patterns2);

      expect(first).toBe(second); // Should be same cached instance
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used entries when at capacity', () => {
      const smallCache = new PatternCache({ maxSize: 2, enableStats: true });

      // Fill glob cache to capacity with 2 patterns
      smallCache.getGlobPattern(['pattern1'], {});
      smallCache.getGlobPattern(['pattern2'], {});

      expect(smallCache.getStats().glob.size).toBe(2);

      // Add one more glob pattern - should evict oldest
      smallCache.getGlobPattern(['pattern3'], {});

      expect(smallCache.getStats().glob.size).toBe(2);

      // Original pattern1 should be evicted (cache miss)
      smallCache.getGlobPattern(['pattern1'], {});
      const stats = smallCache.getStats();
      expect(stats.glob.misses).toBe(4); // pattern1, pattern2, pattern3, pattern1 again

      smallCache.destroy();
    });

    it('should update LRU order on access', () => {
      const smallCache = new PatternCache({ maxSize: 2, enableStats: true });

      // Add two glob patterns
      smallCache.getGlobPattern(['pattern1'], {});
      smallCache.getGlobPattern(['pattern2'], {});

      // Access pattern1 again (should move to end of LRU)
      smallCache.getGlobPattern(['pattern1'], {});

      // Add new pattern - should evict pattern2, not pattern1
      smallCache.getGlobPattern(['pattern3'], {});

      // pattern1 should still be cached (hit)
      smallCache.getGlobPattern(['pattern1'], {});

      // pattern2 should be evicted (miss)
      smallCache.getGlobPattern(['pattern2'], {});

      const stats = smallCache.getStats();
      expect(stats.glob.hits).toBe(2); // pattern1 accessed twice
      expect(stats.glob.misses).toBe(4); // pattern1, pattern2, pattern3, pattern2 again

      smallCache.destroy();
    });
  });

  describe('TTL Expiration', () => {
    it('should expire entries after TTL', async () => {
      const shortTtlCache = new PatternCache({ ttlMs: 50, enableStats: true });

      // Add entry
      const patterns = ['**/*.ts'];
      shortTtlCache.getGlobPattern(patterns, {});

      // Should be cached
      shortTtlCache.getGlobPattern(patterns, {});
      expect(shortTtlCache.getStats().glob.hits).toBe(1);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should be expired (cache miss)
      shortTtlCache.getGlobPattern(patterns, {});
      expect(shortTtlCache.getStats().glob.misses).toBe(2); // Initial + after expiry

      shortTtlCache.destroy();
    });

    it('should cleanup expired entries', async () => {
      const shortTtlCache = new PatternCache({ ttlMs: 50, enableStats: true });

      // Add entries
      shortTtlCache.getGlobPattern(['pattern1'], {});
      shortTtlCache.getIgnorePattern(['ignore1']);
      expect(shortTtlCache.size).toBe(2);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      // Trigger cleanup
      shortTtlCache.getGlobPattern(['pattern2'], {}); // Should trigger cleanup

      // Size should be reduced after cleanup
      expect(shortTtlCache.size).toBe(1); // Only the new pattern2

      shortTtlCache.destroy();
    });
  });

  describe('Statistics', () => {
    it('should track hit rates accurately', () => {
      const patterns = ['**/*.ts'];

      // 1 miss
      cache.getGlobPattern(patterns, {});

      // 3 hits
      cache.getGlobPattern(patterns, {});
      cache.getGlobPattern(patterns, {});
      cache.getGlobPattern(patterns, {});

      const stats = cache.getStats();
      expect(stats.glob.hits).toBe(3);
      expect(stats.glob.misses).toBe(1);
      expect(stats.glob.hitRate).toBe(0.75);
    });

    it('should provide combined statistics', () => {
      // Add glob pattern
      cache.getGlobPattern(['**/*.ts'], {});
      cache.getGlobPattern(['**/*.ts'], {}); // Hit

      // Add ignore pattern
      cache.getIgnorePattern(['node_modules']);
      cache.getIgnorePattern(['node_modules']); // Hit

      const stats = cache.getStats();
      expect(stats.combined.hits).toBe(2);
      expect(stats.combined.misses).toBe(2);
      expect(stats.combined.hitRate).toBe(0.5);
      expect(stats.combined.size).toBe(2);
    });

    it('should reset stats when cache is cleared', () => {
      cache.getGlobPattern(['**/*.ts'], {});
      cache.getIgnorePattern(['node_modules']);

      let stats = cache.getStats();
      expect(stats.combined.size).toBe(2);
      expect(stats.combined.misses).toBe(2);

      cache.clear();

      stats = cache.getStats();
      expect(stats.combined.size).toBe(0);
      expect(stats.combined.hits).toBe(0);
      expect(stats.combined.misses).toBe(0);
    });
  });
});

describe('Global Pattern Cache', () => {
  afterEach(() => {
    resetGlobalPatternCache();
  });

  it('should provide a singleton cache instance', () => {
    const cache1 = getGlobalPatternCache();
    const cache2 = getGlobalPatternCache();

    expect(cache1).toBe(cache2); // Same instance
  });

  it('should allow configuration of global cache', () => {
    const cache = configureGlobalPatternCache({ maxSize: 100, ttlMs: 5000 });
    const cache2 = getGlobalPatternCache();

    expect(cache).toBe(cache2); // Same configured instance
  });

  it('should reset global cache', () => {
    const cache1 = getGlobalPatternCache();
    resetGlobalPatternCache();
    const cache2 = getGlobalPatternCache();

    expect(cache1).not.toBe(cache2); // Different instances
  });
});

describe('Performance Characteristics', () => {
  it('should demonstrate caching performance improvement', () => {
    const cache = new PatternCache({ enableStats: true });
    const patterns = ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'];
    const options = { cwd: '/test', ignore: ['node_modules/**'] };

    // Warm up cache
    cache.getGlobPattern(patterns, options);

    // Measure repeated access times
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      cache.getGlobPattern(patterns, options);
    }

    const end = performance.now();
    const avgTime = (end - start) / iterations;

    // Cached access should be very fast
    expect(avgTime).toBeLessThan(0.1); // Less than 0.1ms per access

    const stats = cache.getStats();
    expect(stats.glob.hitRate).toBeGreaterThan(0.99); // Very high hit rate after warmup

    cache.destroy();
  });

  it('should maintain bounded memory usage with LRU eviction', () => {
    const maxSize = 100;
    const cache = new PatternCache({ maxSize, enableStats: true });

    // Add more entries than max size
    for (let i = 0; i < maxSize * 2; i++) {
      cache.getGlobPattern([`pattern${i}`], {});
    }

    // Cache size should not exceed max size
    expect(cache.size).toBeLessThanOrEqual(maxSize);

    cache.destroy();
  });
});