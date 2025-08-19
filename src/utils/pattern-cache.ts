/**
 * Pattern compilation caching for performance optimization
 * 
 * This module provides LRU caching for compiled glob and ignore patterns
 * to optimize repeated pattern operations in file discovery.
 */

import { setInterval, clearInterval } from 'node:timers';
import ignore from 'ignore';

/**
 * Cache statistics for monitoring performance
 */
export interface CacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly size: number;
  readonly hitRate: number;
}

/**
 * Cache entry with TTL and usage tracking
 */
interface CacheEntry<T> {
  readonly value: T;
  readonly timestamp: number;
  readonly accessCount: number;
  lastAccessed: number;
}

/**
 * LRU Cache configuration options
 */
export interface CacheOptions {
  readonly maxSize: number;
  readonly ttlMs: number;
  readonly enableStats: boolean;
}

/**
 * Generic LRU cache with TTL support
 */
class LRUCache<T> {
  private readonly cache = new Map<string, CacheEntry<T>>();
  private readonly options: CacheOptions;
  private hits = 0;
  private misses = 0;

  constructor(options: Partial<CacheOptions> = {}) {
    this.options = {
      maxSize: options.maxSize ?? 1000,
      ttlMs: options.ttlMs ?? 5 * 60 * 1000, // 5 minutes default
      enableStats: options.enableStats ?? true,
    };
  }

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      if (this.options.enableStats) {
        this.misses++;
      }
      return undefined;
    }

    // Check TTL
    const now = Date.now();
    if (now - entry.timestamp > this.options.ttlMs) {
      this.cache.delete(key);
      if (this.options.enableStats) {
        this.misses++;
      }
      return undefined;
    }

    // Update access time
    entry.lastAccessed = now;
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    if (this.options.enableStats) {
      this.hits++;
    }
    
    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T): void {
    const now = Date.now();
    
    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict LRU entries if at capacity
    while (this.cache.size >= this.options.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    // Add new entry
    const entry: CacheEntry<T> = {
      value,
      timestamp: now,
      lastAccessed: now,
      accessCount: 0,
    };

    this.cache.set(key, entry);
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Clean expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.options.ttlMs) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Compiled glob pattern with normalization
 */
export interface CompiledGlobPattern {
  readonly patterns: string[];
  readonly options: object;
  readonly normalized: string;
}

/**
 * Pattern cache implementation for glob and ignore patterns
 */
export class PatternCache {
  private readonly globCache: LRUCache<CompiledGlobPattern>;
  private readonly ignoreCache: LRUCache<ReturnType<typeof ignore>>;
  private readonly cleanupInterval: ReturnType<typeof setInterval>;

  constructor(options: Partial<CacheOptions> = {}) {
    const cacheOptions = {
      maxSize: options.maxSize ?? 500,
      ttlMs: options.ttlMs ?? 10 * 60 * 1000, // 10 minutes default
      enableStats: options.enableStats ?? true,
    };

    this.globCache = new LRUCache<CompiledGlobPattern>(cacheOptions);
    this.ignoreCache = new LRUCache<ReturnType<typeof ignore>>(cacheOptions);

    // Setup periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.globCache.cleanup();
      this.ignoreCache.cleanup();
    }, cacheOptions.ttlMs / 2);

    // Prevent keeping process alive
    this.cleanupInterval.unref();
  }

  /**
   * Get or create compiled glob pattern
   */
  getGlobPattern(patterns: string[], options: object = {}): CompiledGlobPattern {
    const key = this.createGlobKey(patterns, options);
    
    let compiled = this.globCache.get(key);
    if (!compiled) {
      const normalized = this.normalizePatterns(patterns);
      compiled = {
        patterns: [...patterns],
        options: { ...options },
        normalized,
      };
      this.globCache.set(key, compiled);
    }

    return compiled;
  }

  /**
   * Get or create ignore pattern instance
   */
  getIgnorePattern(patterns: string[]): ReturnType<typeof ignore> {
    const key = this.createIgnoreKey(patterns);
    
    let ignoreInstance = this.ignoreCache.get(key);
    if (!ignoreInstance) {
      ignoreInstance = ignore();
      ignoreInstance.add(patterns);
      this.ignoreCache.set(key, ignoreInstance);
    }

    return ignoreInstance;
  }

  /**
   * Create cache key for glob patterns
   */
  private createGlobKey(patterns: string[], options: object): string {
    const patternStr = patterns.sort().join('|');
    const optionsStr = JSON.stringify(options, Object.keys(options).sort());
    return `glob:${patternStr}:${optionsStr}`;
  }

  /**
   * Create cache key for ignore patterns
   */
  private createIgnoreKey(patterns: string[]): string {
    return `ignore:${patterns.sort().join('|')}`;
  }

  /**
   * Normalize patterns for consistent caching
   */
  private normalizePatterns(patterns: string[]): string {
    return patterns
      .map(pattern => pattern.trim())
      .filter(pattern => pattern.length > 0)
      .sort()
      .join('|');
  }

  /**
   * Get combined cache statistics
   */
  getStats(): { glob: CacheStats; ignore: CacheStats; combined: CacheStats } {
    const globStats = this.globCache.getStats();
    const ignoreStats = this.ignoreCache.getStats();
    
    const totalHits = globStats.hits + ignoreStats.hits;
    const totalMisses = globStats.misses + ignoreStats.misses;
    const total = totalHits + totalMisses;

    return {
      glob: globStats,
      ignore: ignoreStats,
      combined: {
        hits: totalHits,
        misses: totalMisses,
        size: globStats.size + ignoreStats.size,
        hitRate: total > 0 ? totalHits / total : 0,
      },
    };
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.globCache.clear();
    this.ignoreCache.clear();
  }

  /**
   * Get total cache size
   */
  get size(): number {
    return this.globCache.size + this.ignoreCache.size;
  }

  /**
   * Destroy cache and cleanup resources
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.clear();
  }
}

/**
 * Global pattern cache instance
 */
let globalPatternCache: PatternCache | null = null;

/**
 * Get the global pattern cache instance
 */
export function getGlobalPatternCache(): PatternCache {
  if (!globalPatternCache) {
    globalPatternCache = new PatternCache();
  }
  return globalPatternCache;
}

/**
 * Reset the global pattern cache
 */
export function resetGlobalPatternCache(): void {
  if (globalPatternCache) {
    globalPatternCache.destroy();
    globalPatternCache = null;
  }
}

/**
 * Configure the global pattern cache
 */
export function configureGlobalPatternCache(options: Partial<CacheOptions>): PatternCache {
  resetGlobalPatternCache();
  globalPatternCache = new PatternCache(options);
  return globalPatternCache;
}