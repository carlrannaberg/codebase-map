/**
 * Integration tests for pattern caching in FileDiscovery
 */

import { performance } from 'node:perf_hooks';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileDiscovery } from './file-discovery.js';
import { resetGlobalPatternCache } from '../utils/pattern-cache.js';

describe('FileDiscovery Pattern Cache Integration', () => {
  beforeEach(() => {
    // Reset cache before each test
    resetGlobalPatternCache();
  });

  afterEach(() => {
    // Clean up after each test
    resetGlobalPatternCache();
  });

  it('should cache patterns between multiple discovery operations', async () => {
    const rootPath = process.cwd();
    const options = {
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts']
    };

    // First call - should populate cache
    const files1 = await FileDiscovery.discoverFiles(rootPath, options);
    
    // Get initial cache stats
    const stats1 = FileDiscovery.getPatternCacheStats();
    expect(stats1.glob.size).toBeGreaterThan(0);
    expect(stats1.ignore.size).toBeGreaterThan(0);

    // Second call with same patterns - should use cache
    const files2 = await FileDiscovery.discoverFiles(rootPath, options);
    
    // Results should be identical
    expect(files2).toEqual(files1);
    
    // Cache should show hits
    const stats2 = FileDiscovery.getPatternCacheStats();
    expect(stats2.glob.hits).toBeGreaterThan(0);
    expect(stats2.ignore.hits).toBeGreaterThan(0);
    expect(stats2.combined.hitRate).toBeGreaterThan(0);
  });

  it('should demonstrate performance improvement with repeated operations', async () => {
    const rootPath = process.cwd();
    const options = {
      include: ['src/**/*.ts', '**/*.js'],
      exclude: ['node_modules/**', 'dist/**', '**/*.test.ts']
    };

    // Warmup cache
    await FileDiscovery.discoverFiles(rootPath, options);

    // Time multiple operations
    const iterations = 5;
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      await FileDiscovery.discoverFiles(rootPath, options);
    }
    
    const end = performance.now();
    const avgTime = (end - start) / iterations;
    
    // With caching, repeated operations should be fast
    expect(avgTime).toBeLessThan(50); // Less than 50ms per operation
    
    // Cache should show high hit rate
    const stats = FileDiscovery.getPatternCacheStats();
    expect(stats.combined.hitRate).toBeGreaterThan(0.8); // At least 80% hit rate
  });

  it('should handle different pattern combinations separately', async () => {
    const rootPath = process.cwd();
    
    // Different include patterns
    const options1 = { include: ['src/**/*.ts'] };
    const options2 = { include: ['**/*.js'] };
    
    await FileDiscovery.discoverFiles(rootPath, options1);
    await FileDiscovery.discoverFiles(rootPath, options2);
    
    const stats = FileDiscovery.getPatternCacheStats();
    
    // Should have cached different patterns
    expect(stats.glob.size).toBeGreaterThanOrEqual(2);
    expect(stats.glob.misses).toBe(2); // Two different patterns
  });

  it('should cache ignore patterns from different exclude sets', async () => {
    const rootPath = process.cwd();
    
    // Different exclude patterns
    const options1 = { exclude: ['**/*.test.ts'] };
    const options2 = { exclude: ['node_modules/**'] };
    const options3 = { exclude: ['**/*.test.ts', 'node_modules/**'] }; // Combined
    
    await FileDiscovery.discoverFiles(rootPath, options1);
    await FileDiscovery.discoverFiles(rootPath, options2);
    await FileDiscovery.discoverFiles(rootPath, options3);
    
    const stats = FileDiscovery.getPatternCacheStats();
    
    // Should have cached different ignore patterns
    expect(stats.ignore.size).toBeGreaterThanOrEqual(3);
  });

  it('should allow cache clearing', async () => {
    const rootPath = process.cwd();
    const options = { include: ['src/**/*.ts'] };
    
    // Populate cache
    await FileDiscovery.discoverFiles(rootPath, options);
    
    let stats = FileDiscovery.getPatternCacheStats();
    expect(stats.combined.size).toBeGreaterThan(0);
    
    // Clear cache
    FileDiscovery.clearPatternCache();
    
    stats = FileDiscovery.getPatternCacheStats();
    expect(stats.combined.size).toBe(0);
    expect(stats.combined.hits).toBe(0);
    expect(stats.combined.misses).toBe(0);
  });

  it('should maintain cache statistics across operations', async () => {
    const rootPath = process.cwd();
    const options = { 
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts']
    };
    
    // Track cache statistics across multiple operations
    const operations = 3;
    let previousStats = FileDiscovery.getPatternCacheStats();
    
    for (let i = 0; i < operations; i++) {
      await FileDiscovery.discoverFiles(rootPath, options);
      const currentStats = FileDiscovery.getPatternCacheStats();
      
      // Stats should be cumulative
      expect(currentStats.combined.hits + currentStats.combined.misses)
        .toBeGreaterThanOrEqual(previousStats.combined.hits + previousStats.combined.misses);
      
      previousStats = currentStats;
    }
    
    // After multiple operations with same patterns, should have high hit rate
    const finalStats = FileDiscovery.getPatternCacheStats();
    expect(finalStats.combined.hitRate).toBeGreaterThan(0.6); // At least 60% hit rate
  });
});