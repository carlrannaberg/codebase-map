# codebase-map Performance Optimization Guide

**Complete guide for optimizing pattern performance and reducing scan times**

## Table of Contents

1. [Performance Overview](#performance-overview)
2. [Pattern Performance Best Practices](#pattern-performance-best-practices)
3. [Caching Strategies](#caching-strategies)
4. [Large Codebase Optimization](#large-codebase-optimization)
5. [Memory Management](#memory-management)
6. [Benchmarking and Monitoring](#benchmarking-and-monitoring)
7. [Platform-Specific Optimizations](#platform-specific-optimizations)

## Performance Overview

### Current Performance Metrics

Based on internal benchmarks:

| Project Size | Files | Processing Time | Memory Usage | Tokens Generated |
|--------------|-------|----------------|--------------|------------------|
| Small | <100 files | <1s | <50MB | ~2,900 tokens |
| Medium | 100-1,000 files | 1-5s | 50-200MB | ~29,000 tokens |
| Large | 1,000-10,000 files | 5-30s | 200-500MB | ~290,000 tokens |
| Enterprise | >10,000 files | 30s-2min | 500MB-1GB | >1M tokens |

### Performance Factors

**Primary factors affecting performance:**
1. **Number of files**: Linear impact on processing time
2. **Pattern complexity**: Exponential impact with recursive wildcards
3. **File system speed**: I/O bound operations
4. **Memory available**: Affects caching and batch processing
5. **Node.js version**: Newer versions have better performance

## Pattern Performance Best Practices

### 1. Use Specific Directory Prefixes

**❌ Slow: Broad patterns**
```bash
# Searches entire project tree
--include "**/*.ts"
--include "**/*.{ts,tsx,js,jsx}"
```

**✅ Fast: Directory-specific patterns**
```bash
# Limits search scope
--include "src/**/*.ts"
--include "lib/**/*.ts"
--include "packages/*/src/**/*.ts"
```

**Performance Impact**: 3-10x faster for large projects

### 2. Minimize Recursive Wildcards

**❌ Slow: Excessive recursion**
```bash
# Too many recursive wildcards
--include "**/**/components/**/*.tsx"
--include "**/src/**/utils/**/*.ts"
```

**✅ Fast: Targeted patterns**
```bash
# More direct paths
--include "src/components/**/*.tsx"
--include "packages/*/src/utils/**/*.ts"
```

**Performance Impact**: 2-5x faster compilation time

### 3. Combine Related Patterns

**❌ Slow: Many separate patterns**
```bash
--include "src/components/**/*.ts"
--include "src/components/**/*.tsx"
--include "src/components/**/*.js"
--include "src/components/**/*.jsx"
```

**✅ Fast: Consolidated patterns**
```bash
# Single pattern with alternation
--include "src/components/**/*.{ts,tsx,js,jsx}"

# Or use built-in support for all extensions
--include "src/components/**"
```

**Performance Impact**: Reduces pattern compilation overhead

### 4. Optimize Exclude Patterns

**❌ Slow: Broad exclusions**
```bash
# Forces evaluation of many files
--exclude "**/*"
--exclude "**/*.{test,spec}.*"
```

**✅ Fast: Specific exclusions**
```bash
# More targeted
--exclude "src/**/*.test.ts"
--exclude "test/**"
--exclude "__tests__/**"
```

**Performance Impact**: Avoids unnecessary file processing

### 5. Pattern Order Optimization

```bash
# ✅ Good: Most restrictive includes first
--include "src/core/**"          # ~100 files
--include "src/utils/**"         # ~50 files  
--exclude "**/*.test.ts"         # Removes ~30 files

# Less optimal: Broad includes with many exclusions
--include "src/**"               # ~1000 files
--exclude "src/tests/**"         # Removes ~200 files
--exclude "src/docs/**"          # Removes ~100 files
--exclude "src/examples/**"      # Removes ~100 files
```

## Caching Strategies

### Built-in Pattern Caching

The tool automatically caches compiled patterns:

```typescript
// Programmatic usage - cache is automatic
const files1 = await FileDiscovery.discoverFiles(root, { include: ['src/**'] });
const files2 = await FileDiscovery.discoverFiles(root, { include: ['src/**'] }); // Uses cache

// Check cache performance
const stats = FileDiscovery.getPatternCacheStats();
console.log(`Cache hit rate: ${stats.combined.hitRate}%`);
```

### Cache Management

```typescript
// Clear cache for memory management
FileDiscovery.clearPatternCache();

// Monitor cache effectiveness
const stats = FileDiscovery.getPatternCacheStats();
if (stats.combined.hitRate < 50) {
  console.log('Consider reviewing pattern usage patterns');
}
```

### Optimal Cache Usage Patterns

**✅ Good: Consistent pattern reuse**
```bash
# Same patterns across multiple scans
scan_command="codebase-map scan --include src/** --exclude **/*.test.ts"
$scan_command
# Later...
$scan_command  # Benefits from cache
```

**❌ Poor: Constantly changing patterns**
```bash
# Each scan uses different patterns (no cache benefit)
codebase-map scan --include "src/module1/**"
codebase-map scan --include "src/module2/**"
codebase-map scan --include "src/module3/**"
```

## Large Codebase Optimization

### Incremental Processing Strategies

#### 1. Module-based Processing
```bash
# Process large monorepo in chunks
for package in packages/*/; do
  codebase-map scan --root "$package" --include "src/**"
done
```

#### 2. Selective Analysis
```bash
# Focus on changed files (CI/CD optimization)
CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD | grep -E '\.(ts|tsx|js|jsx)$')
if [ -n "$CHANGED_FILES" ]; then
  codebase-map scan --include "$CHANGED_FILES"
fi
```

#### 3. Parallel Processing
```bash
# Process multiple packages in parallel
parallel -j4 'codebase-map scan --root {} --include "src/**"' ::: packages/*/
```

### File Count Optimization

#### Exclude Common Large Directories Early
```bash
# Built-in exclusions handle most cases, but for custom setups:
--exclude "node_modules/**"
--exclude "dist/**" 
--exclude "build/**"
--exclude ".next/**"
--exclude "coverage/**"
--exclude "*.log"
```

#### Focus on Critical Code
```bash
# For documentation/analysis, exclude non-essential files
--include "src/**"
--exclude "src/**/*.test.ts"
--exclude "src/**/*.spec.ts"
--exclude "src/**/*.stories.ts"
--exclude "src/**/fixtures/**"
--exclude "src/**/mocks/**"
```

### Memory-Efficient Patterns

```bash
# ✅ Memory efficient: Specific scopes
--include "packages/core/src/**"
--include "packages/utils/src/**"

# ❌ Memory intensive: Broad scope with many exclusions
--include "packages/**"
--exclude "packages/*/node_modules/**"
--exclude "packages/*/dist/**"
--exclude "packages/*/build/**"
# ... many more exclusions
```

## Memory Management

### Understanding Memory Usage

**Memory consumption factors:**
1. **File paths array**: ~100 bytes per file path
2. **Pattern cache**: ~1KB per unique pattern
3. **AST parsing**: ~10-50KB per file during processing
4. **Dependency graph**: ~500 bytes per file relationship

### Memory Optimization Techniques

#### 1. Batch Processing for Large Projects
```typescript
// Process in smaller batches
const chunkSize = 1000;
const allPatterns = ['packages/*/src/**'];

for (let i = 0; i < largeFileList.length; i += chunkSize) {
  const chunk = largeFileList.slice(i, i + chunkSize);
  await processChunk(chunk);
  
  // Optional: Clear caches between chunks
  if (i % (chunkSize * 10) === 0) {
    FileDiscovery.clearPatternCache();
  }
}
```

#### 2. Strategic Cache Clearing
```typescript
// Monitor memory usage
const memBefore = process.memoryUsage();
await FileDiscovery.discoverFiles(root, options);
const memAfter = process.memoryUsage();

const memUsedMB = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;
if (memUsedMB > 100) {
  FileDiscovery.clearPatternCache();
}
```

#### 3. Pattern Optimization for Memory
```bash
# ✅ Low memory: Direct patterns
--include "src/main/**"
--include "src/renderer/**"

# ❌ High memory: Broad patterns with complex exclusions
--include "src/**"
--exclude "src/tests/**"
--exclude "src/fixtures/**"
--exclude "src/mocks/**"
--exclude "src/stories/**"
--exclude "src/examples/**"
```

## Benchmarking and Monitoring

### Built-in Performance Monitoring

```bash
# Enable verbose mode for timing information
codebase-map scan --include "src/**" --verbose
```

**Verbose output includes:**
- Pattern compilation time
- File discovery duration
- Total processing time
- File count statistics

### Custom Benchmarking

```bash
#!/bin/bash
# benchmark-patterns.sh

echo "Benchmarking different pattern strategies..."

echo "Strategy 1: Broad include with exclusions"
time codebase-map scan --include "**/*.ts" --exclude "**/*.test.ts"

echo "Strategy 2: Specific includes"
time codebase-map scan --include "src/**/*.ts" --include "lib/**/*.ts"

echo "Strategy 3: Directory-based"
time codebase-map scan --include "src/**" --exclude "src/test/**"
```

### Performance Monitoring Script

```javascript
// monitor-performance.js
import { performance } from 'perf_hooks';
import { FileDiscovery } from 'codebase-map';

async function benchmarkPatterns() {
  const strategies = [
    { name: 'Broad + Exclude', options: { include: ['**/*.ts'], exclude: ['**/*.test.ts'] } },
    { name: 'Specific Include', options: { include: ['src/**/*.ts', 'lib/**/*.ts'] } },
    { name: 'Directory Based', options: { include: ['src/**'], exclude: ['src/test/**'] } }
  ];

  for (const strategy of strategies) {
    const start = performance.now();
    const files = await FileDiscovery.discoverFiles('/project', strategy.options);
    const end = performance.now();
    
    console.log(`${strategy.name}: ${files.length} files in ${(end - start).toFixed(2)}ms`);
  }
}
```

### Cache Performance Monitoring

```typescript
// Monitor cache effectiveness
function monitorCachePerformance() {
  const stats = FileDiscovery.getPatternCacheStats();
  
  console.log('Cache Performance:');
  console.log(`  Glob cache: ${stats.glob.size} entries, ${stats.glob.hitRate}% hit rate`);
  console.log(`  Ignore cache: ${stats.ignore.size} entries, ${stats.ignore.hitRate}% hit rate`);
  console.log(`  Overall: ${stats.combined.size} entries, ${stats.combined.hitRate}% hit rate`);
  
  if (stats.combined.hitRate < 70) {
    console.log('⚠️  Low cache hit rate - consider optimizing pattern usage');
  }
}
```

## Platform-Specific Optimizations

### Linux Optimizations

```bash
# Use faster file system operations
export NODE_OPTIONS="--max-old-space-size=4096"

# Leverage file system caching
echo 3 > /proc/sys/vm/drop_caches  # Clear caches for benchmarking
```

### macOS Optimizations

```bash
# Disable Spotlight indexing for better I/O performance
sudo mdutil -a -i off

# Use faster disk if available
# Run from SSD rather than network drive
```

### Windows Optimizations

```bash
# Disable Windows Defender real-time scanning for project directory
# Use PowerShell instead of Command Prompt for better performance
# Consider WSL2 for Linux-like performance
```

### CI/CD Optimizations

```yaml
# GitHub Actions optimization
- name: Cache node modules
  uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}

- name: Optimize codebase scan
  run: |
    # Only scan changed files in PRs
    if [ "${{ github.event_name }}" == "pull_request" ]; then
      CHANGED_FILES=$(git diff --name-only origin/main...HEAD | grep -E '\.(ts|tsx|js|jsx)$' | tr '\n' ' ')
      codebase-map scan --include $CHANGED_FILES
    else
      codebase-map scan --include "src/**" --exclude "**/*.test.ts"
    fi
```

## Performance Troubleshooting

### Identifying Performance Bottlenecks

#### 1. Use Timing Diagnostics
```bash
# Compare different approaches
time codebase-map scan  # Baseline
time codebase-map scan --include "src/**"  # With patterns
time codebase-map scan --include "src/**" --verbose  # With detailed output
```

#### 2. Profile Pattern Complexity
```bash
# Test individual pattern components
time codebase-map scan --include "src/**"
time codebase-map scan --include "src/**/*.ts"
time codebase-map scan --include "src/**/*.{ts,tsx}"
```

#### 3. Monitor Resource Usage
```bash
# Monitor CPU and memory during scan
top -p $(pgrep -f codebase-map)

# Or use htop for better visualization
htop -p $(pgrep -f codebase-map)
```

### Common Performance Issues

#### Issue: Slow pattern compilation
**Symptoms**: Long delay before file processing starts
**Solution**: Simplify patterns, reduce recursive wildcards

#### Issue: High memory usage
**Symptoms**: Process killed by OS, swapping
**Solution**: Use more specific patterns, process in chunks

#### Issue: Slow file I/O
**Symptoms**: Even simple patterns are slow
**Solution**: Check disk performance, exclude network drives

## Quick Performance Checklist

### Before Optimization
- [ ] Measure baseline performance with `time codebase-map scan`
- [ ] Count total files with `find . -name "*.ts" -o -name "*.js" | wc -l`
- [ ] Check available memory with `free -h` (Linux) or Activity Monitor

### Pattern Optimization
- [ ] Use directory prefixes: `src/**` instead of `**`
- [ ] Combine related patterns: `*.{ts,js}` instead of separate patterns
- [ ] Limit recursive wildcards: avoid `**/**/**`
- [ ] Use specific exclusions: `src/test/**` instead of `**/test/**`

### System Optimization
- [ ] Use SSD storage when possible
- [ ] Increase Node.js memory if needed: `--max-old-space-size=4096`
- [ ] Clear pattern cache between unrelated scans
- [ ] Monitor cache hit rates for repeated operations

### Large Project Strategies
- [ ] Process in modules/packages separately
- [ ] Use incremental scanning for CI/CD
- [ ] Consider parallel processing for independent modules
- [ ] Focus on essential code paths only

---

For more information, see the [Pattern Guide](./PATTERN_GUIDE.md) and [Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md).