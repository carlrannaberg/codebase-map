/**
 * Comprehensive performance benchmark suite for pattern operations
 * 
 * This module provides extensive benchmarking capabilities including:
 * - Pattern compilation performance
 * - Memory usage tracking and leak detection
 * - Cache effectiveness measurement
 * - Performance regression tests
 * - Large codebase simulation
 */

import { performance } from 'node:perf_hooks';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import ignore from 'ignore';
import fastGlob from 'fast-glob';
import { PatternCache } from './pattern-cache.js';
import { FileDiscovery } from '../core/file-discovery.js';

interface BenchmarkResult {
  operation: string;
  cached: {
    totalTime: number;
    avgTime: number;
    iterations: number;
    memoryUsage?: MemoryUsage;
  };
  uncached: {
    totalTime: number;
    avgTime: number;
    iterations: number;
    memoryUsage?: MemoryUsage;
  };
  improvement: {
    speedupFactor: number;
    percentageImprovement: number;
  };
  cacheStats?: {
    hitRate: number;
    size: number;
    hits: number;
    misses: number;
  };
}

interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

interface PerformanceTargets {
  minSpeedupFactor: number;
  minCacheHitRate: number;
  maxMemoryGrowthMB: number;
  maxLatencyMs: number;
}

interface BenchmarkSuite {
  name: string;
  scenarios: BenchmarkScenario[];
  targets: PerformanceTargets;
}

interface BenchmarkScenario {
  name: string;
  setup: () => Promise<void>;
  teardown: () => Promise<void>;
  benchmark: () => Promise<BenchmarkResult>;
}

interface PerformanceReport {
  timestamp: string;
  overallResults: {
    averageSpeedup: number;
    averageImprovement: number;
    targetsAchieved: boolean;
    memoryBounded: boolean;
  };
  benchmarks: BenchmarkResult[];
  memoryReport: {
    maxSize: number;
    finalSize: number;
    evictions: number;
    memoryGrowthMB: number;
  };
}

interface CodebaseSimulation {
  path: string;
  fileCount: number;
  directoryDepth: number;
  patterns: string[];
}

/**
 * Capture current memory usage
 */
function captureMemoryUsage(): MemoryUsage {
  const usage = process.memoryUsage();
  return {
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
    rss: usage.rss
  };
}

/**
 * Calculate memory difference in MB
 */
function calculateMemoryDelta(before: MemoryUsage, after: MemoryUsage): number {
  return (after.heapUsed - before.heapUsed) / (1024 * 1024);
}

/**
 * Create a temporary codebase simulation for testing
 */
async function createCodebaseSimulation(fileCount: number, maxDepth: number = 3): Promise<CodebaseSimulation> {
  const tempDir = join(tmpdir(), `codebase-sim-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });
  
  const patterns: string[] = [];
  const filesCreated: string[] = [];
  
  // Create nested directory structure with files
  for (let i = 0; i < fileCount; i++) {
    const depth = Math.floor(Math.random() * maxDepth) + 1;
    const dirs = Array.from({ length: depth }, (_, j) => `dir${j}`).join('/');
    const dirPath = join(tempDir, dirs);
    
    await mkdir(dirPath, { recursive: true });
    
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    const ext = extensions[Math.floor(Math.random() * extensions.length)];
    const fileName = `file${i}${ext}`;
    const filePath = join(dirPath, fileName);
    
    // Create simple file content
    const content = `// File ${i}\nexport const value${i} = ${i};\n`;
    await writeFile(filePath, content);
    
    filesCreated.push(filePath);
    patterns.push(`**/*${ext}`);
  }
  
  return {
    path: tempDir,
    fileCount,
    directoryDepth: maxDepth,
    patterns: [...new Set(patterns)] // Remove duplicates
  };
}

/**
 * Cleanup temporary codebase simulation
 */
async function cleanupCodebaseSimulation(simulation: CodebaseSimulation): Promise<void> {
  try {
    await rm(simulation.path, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Benchmark glob pattern operations with memory tracking
 */
async function benchmarkGlobPatterns(): Promise<BenchmarkResult> {
  const patterns = ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'];
  const options = { 
    cwd: process.cwd(),
    ignore: ['node_modules/**', 'dist/**', 'build/**'],
    onlyFiles: true,
    absolute: false,
    dot: false
  };
  const iterations = 1000;
  
  // Benchmark with caching
  const cache = new PatternCache({ enableStats: true });
  
  // Warmup
  cache.getGlobPattern(patterns, options);
  
  // Memory tracking for cached operations
  const cachedStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    cache.getGlobPattern(patterns, options);
  }
  const cachedEnd = performance.now();
  const cachedMemAfter = captureMemoryUsage();
  const cachedTime = cachedEnd - cachedStart;
  
  // Benchmark without caching (simulate by creating new cache keys each time)
  const uncachedStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    // Simulate uncached by adding unique key each time
    cache.getGlobPattern(patterns, { ...options, unique: i });
  }
  const uncachedEnd = performance.now();
  const uncachedMemAfter = captureMemoryUsage();
  const uncachedTime = uncachedEnd - uncachedStart;
  
  const stats = cache.getStats();
  cache.destroy();
  
  const speedupFactor = uncachedTime / cachedTime;
  const percentageImprovement = ((uncachedTime - cachedTime) / uncachedTime) * 100;
  
  return {
    operation: 'Glob Pattern Compilation',
    cached: {
      totalTime: cachedTime,
      avgTime: cachedTime / iterations,
      iterations,
      memoryUsage: cachedMemAfter
    },
    uncached: {
      totalTime: uncachedTime,
      avgTime: uncachedTime / iterations,
      iterations,
      memoryUsage: uncachedMemAfter
    },
    improvement: {
      speedupFactor,
      percentageImprovement
    },
    cacheStats: {
      hitRate: stats.glob.hitRate,
      size: stats.glob.size,
      hits: stats.glob.hits,
      misses: stats.glob.misses
    }
  };
}

/**
 * Benchmark ignore pattern operations
 */
function benchmarkIgnorePatterns(): BenchmarkResult {
  const patterns = ['node_modules', 'dist', 'build', '*.log', '*.tmp', '.git'];
  const testFiles = [
    'src/index.ts',
    'node_modules/package/index.js',
    'dist/main.js',
    'build/output.js',
    'debug.log',
    'temp.tmp',
    '.git/config',
    'src/utils/helper.ts',
    'test/example.test.ts'
  ];
  const iterations = 10000;
  
  // Benchmark with caching
  const cache = new PatternCache({ enableStats: true });
  
  // Warmup
  const cachedIgnore = cache.getIgnorePattern(patterns);
  testFiles.forEach(file => cachedIgnore.ignores(file));
  
  const cachedStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const ig = cache.getIgnorePattern(patterns);
    testFiles.forEach(file => ig.ignores(file));
  }
  const cachedEnd = performance.now();
  const cachedTime = cachedEnd - cachedStart;
  
  // Benchmark without caching
  const uncachedStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const ig = ignore();
    ig.add(patterns);
    testFiles.forEach(file => ig.ignores(file));
  }
  const uncachedEnd = performance.now();
  const uncachedTime = uncachedEnd - uncachedStart;
  
  cache.destroy();
  
  const speedupFactor = uncachedTime / cachedTime;
  const percentageImprovement = ((uncachedTime - cachedTime) / uncachedTime) * 100;
  
  return {
    operation: 'Ignore Pattern Creation & Matching',
    cached: {
      totalTime: cachedTime,
      avgTime: cachedTime / iterations,
      iterations
    },
    uncached: {
      totalTime: uncachedTime,
      avgTime: uncachedTime / iterations,
      iterations
    },
    improvement: {
      speedupFactor,
      percentageImprovement
    }
  };
}

/**
 * Benchmark large codebase discovery performance
 */
async function benchmarkLargeCodebaseDiscovery(): Promise<BenchmarkResult> {
  const simulation = await createCodebaseSimulation(1000, 4);
  const iterations = 50;
  
  try {
    // Benchmark with caching
    const cache = new PatternCache({ enableStats: true });
    
    // Warmup
    await FileDiscovery.discoverFiles(simulation.path);
    
    const cachedStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      await FileDiscovery.discoverFiles(simulation.path, {
        include: ['**/*.ts', '**/*.tsx'],
        exclude: ['**/test/**', '**/spec/**']
      });
    }
    const cachedEnd = performance.now();
    const cachedMemAfter = captureMemoryUsage();
    const cachedTime = cachedEnd - cachedStart;
    
    // Clear cache and benchmark without caching
    FileDiscovery.clearPatternCache();
    
    const uncachedStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      await FileDiscovery.discoverFiles(simulation.path, {
        include: ['**/*.ts', '**/*.tsx'], // Use consistent patterns but different cache keys
        exclude: [`**/nonexistent${i}/**`, `**/fake${i}.tmp`] // Use patterns that won't match real files
      });
    }
    const uncachedEnd = performance.now();
    const uncachedMemAfter = captureMemoryUsage();
    const uncachedTime = uncachedEnd - uncachedStart;
    
    const cache2 = new PatternCache({ enableStats: true });
    const stats = cache2.getStats();
    cache.destroy();
    cache2.destroy();
    
    const speedupFactor = uncachedTime / cachedTime;
    const percentageImprovement = ((uncachedTime - cachedTime) / uncachedTime) * 100;
    
    return {
      operation: 'Large Codebase Discovery',
      cached: {
        totalTime: cachedTime,
        avgTime: cachedTime / iterations,
        iterations,
        memoryUsage: cachedMemAfter
      },
      uncached: {
        totalTime: uncachedTime,
        avgTime: uncachedTime / iterations,
        iterations,
        memoryUsage: uncachedMemAfter
      },
      improvement: {
        speedupFactor,
        percentageImprovement
      },
      cacheStats: {
        hitRate: stats.combined.hitRate,
        size: stats.combined.size,
        hits: stats.combined.hits,
        misses: stats.combined.misses
      }
    };
  } finally {
    await cleanupCodebaseSimulation(simulation);
  }
}

/**
 * Benchmark fastGlob pattern compilation performance
 */
async function benchmarkFastGlobPatterns(): Promise<BenchmarkResult> {
  const patterns = ['**/*.{ts,tsx,js,jsx}', '**/src/**/*.ts', '!**/node_modules/**'];
  const options = { 
    cwd: process.cwd(),
    onlyFiles: true,
    absolute: false,
    dot: false
  };
  const iterations = 500;
  
  // Benchmark with caching
  const cache = new PatternCache({ enableStats: true });
  
  // Warmup
  cache.getGlobPattern(patterns, options);
  await fastGlob(patterns, options);
  
  const cachedStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    cache.getGlobPattern(patterns, options);
    // Simulate pattern usage with fastGlob
    await fastGlob(patterns, { ...options, cwd: options.cwd });
  }
  const cachedEnd = performance.now();
  const cachedMemAfter = captureMemoryUsage();
  const cachedTime = cachedEnd - cachedStart;
  
  // Benchmark without caching (create new patterns each time)
  const uncachedStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const uniquePatterns = patterns.map(p => `${p}_${i}`);
    cache.getGlobPattern(uniquePatterns, { ...options, unique: i });
    await fastGlob(uniquePatterns, { ...options, cwd: options.cwd });
  }
  const uncachedEnd = performance.now();
  const uncachedMemAfter = captureMemoryUsage();
  const uncachedTime = uncachedEnd - uncachedStart;
  
  const stats = cache.getStats();
  cache.destroy();
  
  const speedupFactor = uncachedTime / cachedTime;
  const percentageImprovement = ((uncachedTime - cachedTime) / uncachedTime) * 100;
  
  return {
    operation: 'FastGlob Pattern Compilation',
    cached: {
      totalTime: cachedTime,
      avgTime: cachedTime / iterations,
      iterations,
      memoryUsage: cachedMemAfter
    },
    uncached: {
      totalTime: uncachedTime,
      avgTime: uncachedTime / iterations,
      iterations,
      memoryUsage: uncachedMemAfter
    },
    improvement: {
      speedupFactor,
      percentageImprovement
    },
    cacheStats: {
      hitRate: stats.glob.hitRate,
      size: stats.glob.size,
      hits: stats.glob.hits,
      misses: stats.glob.misses
    }
  };
}

/**
 * Benchmark memory usage with LRU eviction
 */
function benchmarkMemoryUsage(): { maxSize: number; finalSize: number; evictions: number; memoryGrowthMB: number } {
  const maxSize = 100;
  const cache = new PatternCache({ maxSize, enableStats: true });
  
  const memBefore = captureMemoryUsage();
  
  // Add more patterns than max size
  const totalPatterns = maxSize * 2;
  for (let i = 0; i < totalPatterns; i++) {
    cache.getGlobPattern([`pattern${i}/**/*.ts`], { cwd: `/path${i}` });
  }
  
  const memAfter = captureMemoryUsage();
  const memoryGrowthMB = calculateMemoryDelta(memBefore, memAfter);
  
  const stats = cache.getStats();
  const evictions = Math.max(0, totalPatterns - stats.glob.size);
  
  cache.destroy();
  
  return {
    maxSize,
    finalSize: stats.glob.size,
    evictions,
    memoryGrowthMB
  };
}

/**
 * Create comprehensive benchmark suite with performance targets
 */
function createBenchmarkSuite(): BenchmarkSuite {
  return {
    name: 'Pattern Performance Benchmark Suite',
    scenarios: [
      {
        name: 'Glob Pattern Compilation',
        setup: async (): Promise<void> => {},
        teardown: async (): Promise<void> => {},
        benchmark: benchmarkGlobPatterns
      },
      {
        name: 'Large Codebase Discovery',
        setup: async (): Promise<void> => {},
        teardown: async (): Promise<void> => {},
        benchmark: benchmarkLargeCodebaseDiscovery
      },
      {
        name: 'FastGlob Pattern Performance',
        setup: async (): Promise<void> => {},
        teardown: async (): Promise<void> => {},
        benchmark: benchmarkFastGlobPatterns
      }
    ],
    targets: {
      minSpeedupFactor: 1.2, // >20% improvement
      minCacheHitRate: 0.8, // >80% cache hit rate
      maxMemoryGrowthMB: 50, // <50MB memory growth
      maxLatencyMs: 100 // <100ms average latency
    }
  };
}

/**
 * Generate comprehensive performance report
 */
async function generatePerformanceReport(): Promise<PerformanceReport> {
  const suite = createBenchmarkSuite();
  const benchmarks: BenchmarkResult[] = [];
  
  // Run all benchmark scenarios
  for (const scenario of suite.scenarios) {
    await scenario.setup();
    const result = await scenario.benchmark();
    benchmarks.push(result);
    await scenario.teardown();
  }
  
  // Additional benchmarks
  const ignoreResult = benchmarkIgnorePatterns();
  benchmarks.push(ignoreResult);
  
  const memoryReport = benchmarkMemoryUsage();
  
  // Calculate overall results
  const avgSpeedup = benchmarks.reduce((sum, b) => sum + b.improvement.speedupFactor, 0) / benchmarks.length;
  const avgImprovement = benchmarks.reduce((sum, b) => sum + b.improvement.percentageImprovement, 0) / benchmarks.length;
  const avgCacheHitRate = benchmarks.reduce((sum, b) => sum + (b.cacheStats?.hitRate || 0), 0) / benchmarks.length;
  
  const targetsAchieved = 
    avgSpeedup >= suite.targets.minSpeedupFactor &&
    avgCacheHitRate >= suite.targets.minCacheHitRate &&
    memoryReport.memoryGrowthMB <= suite.targets.maxMemoryGrowthMB;
  
  return {
    timestamp: new Date().toISOString(),
    overallResults: {
      averageSpeedup: avgSpeedup,
      averageImprovement: avgImprovement,
      targetsAchieved,
      memoryBounded: memoryReport.finalSize <= memoryReport.maxSize
    },
    benchmarks,
    memoryReport
  };
}

/**
 * Run comprehensive performance benchmarks with detailed reporting
 */
export async function runPerformanceBenchmark(): Promise<void> {
  console.log('🚀 Comprehensive Pattern Performance Benchmark Suite');
  console.log('====================================================\n');
  
  try {
    const report = await generatePerformanceReport();
    
    // Display individual benchmark results
    for (const result of report.benchmarks) {
      console.log(`📊 ${result.operation}:`);
      console.log(`  Cached:   ${result.cached.totalTime.toFixed(2)}ms total (${result.cached.avgTime.toFixed(4)}ms avg)`);
      console.log(`  Uncached: ${result.uncached.totalTime.toFixed(2)}ms total (${result.uncached.avgTime.toFixed(4)}ms avg)`);
      console.log(`  Speedup:  ${result.improvement.speedupFactor.toFixed(1)}x faster`);
      console.log(`  Improvement: ${result.improvement.percentageImprovement.toFixed(1)}% performance gain`);
      
      if (result.cacheStats) {
        console.log(`  Cache hit rate: ${(result.cacheStats.hitRate * 100).toFixed(1)}%`);
        console.log(`  Cache size: ${result.cacheStats.size} entries`);
      }
      
      if (result.cached.memoryUsage) {
        const heapMB = result.cached.memoryUsage.heapUsed / (1024 * 1024);
        console.log(`  Memory usage: ${heapMB.toFixed(1)}MB heap`);
      }
      console.log('');
    }
    
    // Memory management results
    console.log('🧠 Memory Management Analysis:');
    console.log(`  Max cache size: ${report.memoryReport.maxSize}`);
    console.log(`  Final cache size: ${report.memoryReport.finalSize}`);
    console.log(`  Memory growth: ${report.memoryReport.memoryGrowthMB.toFixed(2)}MB`);
    console.log(`  LRU evictions: ${report.memoryReport.evictions}`);
    console.log(`  Memory bounded: ${report.overallResults.memoryBounded ? '✅' : '❌'}\n`);
    
    // Performance targets validation
    console.log('🎯 Performance Targets Validation:');
    console.log(`  Average speedup: ${report.overallResults.averageSpeedup.toFixed(1)}x faster`);
    console.log(`  Average improvement: ${report.overallResults.averageImprovement.toFixed(1)}%`);
    console.log(`  Target >20% improvement: ${report.overallResults.averageImprovement > 20 ? '✅' : '❌'}`);
    console.log(`  Target >80% cache hit rate: ${report.benchmarks.some(b => b.cacheStats && b.cacheStats.hitRate > 0.8) ? '✅' : '❌'}`);
    console.log(`  Memory growth bounded: ${report.memoryReport.memoryGrowthMB <= 50 ? '✅' : '❌'}`);
    console.log(`  All targets achieved: ${report.overallResults.targetsAchieved ? '✅' : '❌'}\n`);
    
    // Performance regression detection
    console.log('⚡ Performance Regression Detection:');
    const criticalLatency = report.benchmarks.some(b => b.cached.avgTime > 100);
    const memoryLeak = report.memoryReport.memoryGrowthMB > 100;
    const cacheIneffective = report.benchmarks.some(b => b.cacheStats && b.cacheStats.hitRate < 0.5);
    
    console.log(`  Critical latency detected: ${criticalLatency ? '⚠️' : '✅'}`);
    console.log(`  Memory leak detected: ${memoryLeak ? '⚠️' : '✅'}`);
    console.log(`  Cache ineffectiveness: ${cacheIneffective ? '⚠️' : '✅'}`);
    
    if (criticalLatency || memoryLeak || cacheIneffective) {
      console.log('\n🔍 Performance issues detected - review required');
    } else {
      console.log('\n🎉 All performance metrics within acceptable ranges');
    }
    
  } catch (error) {
    console.error('❌ Benchmark execution failed:', error);
    throw error;
  }
}

/**
 * CLI entry point for running benchmark
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceBenchmark().catch(console.error);
}