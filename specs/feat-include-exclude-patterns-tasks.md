# Task Breakdown: Include/Exclude File Pattern Support

**Generated**: August 17, 2025  
**Source**: specs/feat-include-exclude-patterns.md  
**Total Tasks**: 15  
**Estimated Phases**: 3

## Overview

Add comprehensive include/exclude pattern support to codebase-map tool through CLI options and glob pattern matching. This feature extends the existing FileDiscovery class to provide fine-grained control over file selection beyond current .gitignore integration.

## Phase 1: Foundation and Types (4 tasks)

### Task 1.1: Create FilterOptions Interface and Types
**Description**: Define TypeScript interfaces and types for pattern filtering functionality
**Size**: Small  
**Priority**: High  
**Dependencies**: None  
**Can run parallel with**: None (foundation)

**Technical Requirements:**
- Create FilterOptions interface in src/types/common.ts
- Add CodeIndexerOptions interface extending FilterOptions
- Import and export from types/index.ts
- Maintain backward compatibility

**Implementation Steps:**
```typescript
// src/types/common.ts - Add these interfaces
export interface FilterOptions {
  include?: string[];
  exclude?: string[];
}

// Enhanced constructor signature for future use
export interface CodeIndexerOptions extends FilterOptions {
  // Future extension point for other options
}
```

**Export Requirements:**
```typescript
// src/types/index.ts - Add to exports
export type { FilterOptions, CodeIndexerOptions } from './common.js';
```

**Acceptance Criteria:**
- [ ] FilterOptions interface defined with optional include/exclude string arrays
- [ ] CodeIndexerOptions extends FilterOptions for future expansion
- [ ] All types properly exported from types/index.ts
- [ ] TypeScript compilation succeeds without errors
- [ ] Interfaces follow existing project naming conventions

### Task 1.2: Add Pattern Validation Utilities
**Description**: Create robust glob pattern validation functions with security checks
**Size**: Medium  
**Priority**: High  
**Dependencies**: Task 1.1  
**Can run parallel with**: Task 1.3

**Technical Requirements:**
- Pattern syntax validation using fast-glob
- Directory traversal prevention (../ and / checks)
- Helpful error messages for invalid patterns
- Performance optimization for repeated validation

**Implementation Steps:**
Create new file `src/utils/pattern-validation.ts`:

```typescript
import fastGlob from 'fast-glob';

export class PatternValidationError extends Error {
  constructor(pattern: string, reason: string) {
    super(`Invalid pattern "${pattern}": ${reason}`);
    this.name = 'PatternValidationError';
  }
}

export function validateGlobPattern(pattern: string): void {
  // Prevent directory traversal attempts
  if (pattern.includes('../') || pattern.startsWith('/')) {
    throw new PatternValidationError(pattern, 'Directory traversal not allowed');
  }
  
  // Prevent shell escape sequences
  if (pattern.includes('\\') && !pattern.match(/\\[*?[\]{}]/)) {
    throw new PatternValidationError(pattern, 'Invalid escape sequence');
  }
  
  // Validate glob syntax using fast-glob
  try {
    fastGlob.generateTasks([pattern], { onlyFiles: true });
  } catch (error) {
    throw new PatternValidationError(pattern, 'Invalid glob syntax');
  }
}

export function validatePatternArray(patterns: string[], type: 'include' | 'exclude'): void {
  if (!Array.isArray(patterns)) {
    throw new Error(`${type} patterns must be an array`);
  }
  
  patterns.forEach(pattern => {
    if (typeof pattern !== 'string' || pattern.trim() === '') {
      throw new PatternValidationError(pattern, 'Pattern must be a non-empty string');
    }
    validateGlobPattern(pattern.trim());
  });
}
```

**Security Features:**
- Directory traversal prevention
- Shell escape sequence filtering
- Input sanitization and validation
- Resource limit considerations

**Acceptance Criteria:**
- [ ] validateGlobPattern function prevents directory traversal attacks
- [ ] Pattern syntax validation uses fast-glob.generateTasks
- [ ] Custom PatternValidationError class with helpful messages
- [ ] validatePatternArray handles array validation and individual patterns
- [ ] All security checks pass (no ../, /, or dangerous escape sequences)
- [ ] Functions handle edge cases (empty strings, null, undefined)

### Task 1.3: Extend FileDiscovery Class Structure
**Description**: Add new methods to FileDiscovery class for pattern-based filtering
**Size**: Large  
**Priority**: High  
**Dependencies**: Task 1.1, Task 1.2  
**Can run parallel with**: None (core implementation)

**Technical Requirements:**
- Enhance main discoverFiles method with FilterOptions parameter
- Implement applyIncludePatterns method using fast-glob
- Implement applyExcludePatterns method using ignore library
- Maintain existing functionality as default behavior
- Apply precedence: include → exclude → gitignore

**Implementation Steps:**

1. **Update main method signature:**
```typescript
// src/core/file-discovery.ts
import type { FilterOptions } from '../types/index.js';
import { validatePatternArray } from '../utils/pattern-validation.js';

export class FileDiscovery {
  // Enhanced main discovery method
  static async discoverFiles(
    rootPath: string, 
    filterOptions: FilterOptions = {}
  ): Promise<string[]> {
    const absoluteRoot = path.resolve(rootPath);
    
    // Validate patterns first
    if (filterOptions.include) {
      validatePatternArray(filterOptions.include, 'include');
    }
    if (filterOptions.exclude) {
      validatePatternArray(filterOptions.exclude, 'exclude');
    }
    
    // Load gitignore rules (existing)
    const ignoreRules = await this.loadIgnoreRules(absoluteRoot);
    
    // Apply include patterns first
    const candidateFiles = await this.applyIncludePatterns(
      absoluteRoot, 
      filterOptions.include
    );
    
    // Apply exclude patterns
    const filteredFiles = this.applyExcludePatterns(
      candidateFiles, 
      filterOptions.exclude, 
      absoluteRoot
    );
    
    // Apply gitignore filtering (existing logic)
    return this.applyIgnoreRules(filteredFiles, ignoreRules);
  }
}
```

2. **Implement include pattern method:**
```typescript
// New: Apply include patterns using fast-glob
private static async applyIncludePatterns(
  rootPath: string, 
  includePatterns?: string[]
): Promise<string[]> {
  if (!includePatterns || includePatterns.length === 0) {
    // Default behavior: all supported file types
    return this.discoverAllSupportedFiles(rootPath);
  }
  
  // Use fast-glob with include patterns
  const globOptions = {
    cwd: rootPath,
    ignore: this.EXCLUDED_DIRS.map(dir => `${dir}/**`),
    onlyFiles: true,
    followSymbolicLinks: false,
    absolute: false,
    dot: false
  };
  
  const allFiles = await fastGlob(includePatterns, globOptions);
  
  // Filter to only supported file types
  return allFiles.filter(file => this.isSupportedFile(file));
}

// Helper method for default behavior (rename existing logic)
private static async discoverAllSupportedFiles(rootPath: string): Promise<string[]> {
  const patterns = this.SUPPORTED_EXTENSIONS.map(ext => `**/*${ext}`);
  const globOptions = {
    cwd: rootPath,
    ignore: this.EXCLUDED_DIRS.map(dir => `${dir}/**`),
    onlyFiles: true,
    followSymbolicLinks: false,
    absolute: false,
    dot: false
  };
  
  return await fastGlob(patterns, globOptions);
}
```

3. **Implement exclude pattern method:**
```typescript
// New: Apply exclude patterns
private static applyExcludePatterns(
  files: string[], 
  excludePatterns?: string[], 
  rootPath?: string
): string[] {
  if (!excludePatterns || excludePatterns.length === 0) {
    return files;
  }
  
  // Create ignore instance for exclude patterns
  const excludeIgnore = ignore().add(excludePatterns);
  
  return files.filter(file => !excludeIgnore.ignores(file));
}
```

**Pattern Precedence Rules:**
1. Include patterns applied first to determine candidate files
2. Exclude patterns filter out files from the include set  
3. Gitignore rules applied last to the final filtered set
4. Default behavior: If no include patterns, use existing discovery logic

**Acceptance Criteria:**
- [ ] discoverFiles method accepts optional FilterOptions parameter
- [ ] applyIncludePatterns uses fast-glob with provided patterns
- [ ] applyExcludePatterns uses ignore library for filtering
- [ ] Pattern validation occurs before processing
- [ ] Default behavior preserved when no patterns provided
- [ ] Precedence order: include → exclude → gitignore
- [ ] All existing tests continue to pass
- [ ] New methods handle empty/undefined pattern arrays gracefully

### Task 1.4: Update CodeIndexer Integration
**Description**: Modify CodeIndexer to accept and pass FilterOptions to FileDiscovery
**Size**: Medium  
**Priority**: High  
**Dependencies**: Task 1.1, Task 1.3  
**Can run parallel with**: None

**Technical Requirements:**
- Modify CodeIndexer constructor to accept FilterOptions
- Pass filter options to FileDiscovery.discoverFiles
- Maintain backward compatibility
- Support both positional and options-object constructor patterns

**Implementation Steps:**

1. **Update constructor signatures:**
```typescript
// src/core/indexer.ts
import type { FilterOptions } from '../types/index.js';

export class CodeIndexer {
  private filterOptions: FilterOptions;

  constructor(
    private rootPath: string, 
    filterOptions: FilterOptions = {}
  ) {
    this.filterOptions = filterOptions;
  }

  // Alternative constructor for future CodeIndexerOptions
  static create(rootPath: string, options: FilterOptions = {}): CodeIndexer {
    return new CodeIndexer(rootPath, options);
  }
}
```

2. **Update processProject method:**
```typescript
async processProject(progressCallback?: ProgressCallback): Promise<ProjectIndex> {
  if (progressCallback) {
    progressCallback({ step: 'Building tree structure', current: 1, total: 4 });
  }

  // Pass filter options to file discovery
  const files = await FileDiscovery.discoverFiles(this.rootPath, this.filterOptions);
  
  if (progressCallback) {
    progressCallback({ step: 'Parsing files', current: 2, total: 4 });
  }

  // Rest of processing remains unchanged
  const tree = TreeBuilder.buildTree(files);
  // ... continue with existing logic
}
```

3. **Update updateFile method:**
```typescript
async updateFile(filePath: string, existingIndex: ProjectIndex): Promise<ProjectIndex> {
  // Check if file would be included by current filter options
  const wouldBeIncluded = await this.wouldFileBeIncluded(filePath);
  
  if (!wouldBeIncluded) {
    // Remove file from index if it no longer matches patterns
    return this.removeFileFromIndex(filePath, existingIndex);
  }
  
  // Proceed with normal update logic
  // ... rest of existing implementation
}

private async wouldFileBeIncluded(filePath: string): Promise<boolean> {
  const testFiles = await FileDiscovery.discoverFiles(this.rootPath, this.filterOptions);
  return testFiles.includes(path.relative(this.rootPath, filePath));
}
```

**Backward Compatibility:**
- Constructor still accepts rootPath as first parameter
- FilterOptions parameter is optional with empty object default
- All existing method signatures preserved
- No breaking changes to public API

**Acceptance Criteria:**
- [ ] CodeIndexer constructor accepts optional FilterOptions parameter
- [ ] processProject passes filter options to FileDiscovery.discoverFiles
- [ ] updateFile method respects filter options for file inclusion
- [ ] Backward compatibility maintained for existing constructor usage
- [ ] All existing integration tests pass
- [ ] New filter options properly stored and used throughout indexing

## Phase 2: CLI Integration and Core Features (6 tasks)

### Task 2.1: Add CLI Pattern Options
**Description**: Extend CLI scan command with --include and --exclude options
**Size**: Medium  
**Priority**: High  
**Dependencies**: Task 1.1-1.4  
**Can run parallel with**: Task 2.2

**Technical Requirements:**
- Add --include and --exclude options to scan command  
- Support multiple patterns per option
- Integrate with existing CLI structure
- Pass options to CodeIndexer constructor
- Maintain existing CLI behavior when options not provided

**Implementation Steps:**

1. **Update scan command options:**
```typescript
// src/cli.ts
import type { FilterOptions } from './types/index.js';
import { validatePatternArray } from './utils/pattern-validation.js';

// Enhanced scan command with pattern options
program
  .command('scan')
  .description('Scan the entire project and generate index')
  .option('-r, --root <path>', 'root directory to scan')
  .option('-o, --output <path>', 'output file path', DEFAULT_INDEX_FILENAME)
  .option('-v, --verbose', 'show detailed progress')
  .option('-i, --include <patterns...>', 'include file patterns (glob syntax)')
  .option('-e, --exclude <patterns...>', 'exclude file patterns (glob syntax)')
  .action(async (options) => {
    const { output, verbose } = options;
    
    // Find project root if not specified
    const root = options.root || findProjectRoot() || process.cwd();
    if (!options.root && root !== process.cwd()) {
      console.log(`📁 Found project root: ${root}`);
    }
    
    // Validate and prepare filter options
    const filterOptions: FilterOptions = {};
    
    if (options.include) {
      try {
        validatePatternArray(options.include, 'include');
        filterOptions.include = options.include;
      } catch (error) {
        console.error(`❌ Invalid include pattern: ${error.message}`);
        process.exit(1);
      }
    }
    
    if (options.exclude) {
      try {
        validatePatternArray(options.exclude, 'exclude');
        filterOptions.exclude = options.exclude;
      } catch (error) {
        console.error(`❌ Invalid exclude pattern: ${error.message}`);
        process.exit(1);
      }
    }
    
    console.log('🔍 Scanning codebase...');
    
    // Enhanced indexer instantiation with filter options
    const indexer = new CodeIndexer(root, filterOptions);
    const startTime = Date.now();
    
    // Rest of scan logic remains the same
    // ...
  });
```

2. **Add pattern information to output:**
```typescript
// Enhanced completion message with pattern info
const duration = Date.now() - startTime;
console.log('');
console.log('✅ Scan completed successfully!');
console.log(`📁 Files processed: ${index.metadata.totalFiles}`);
console.log(`🔗 Dependencies found: ${index.edges.length}`);
console.log(`📊 Average dependencies per file: ${(index.edges.length / Math.max(index.metadata.totalFiles, 1)).toFixed(1)}`);
console.log(`⏱️  Processing time: ${(duration / 1000).toFixed(2)}s`);

// Show pattern information if used
if (filterOptions.include?.length) {
  console.log(`📥 Include patterns: ${filterOptions.include.join(', ')}`);
}
if (filterOptions.exclude?.length) {
  console.log(`📤 Exclude patterns: ${filterOptions.exclude.join(', ')}`);
}

console.log(`💾 Index saved to: ${path.resolve(output)}`);
```

3. **Update help text with examples:**
```typescript
// Add after the command definition
program
  .addHelpText('after', `
Pattern Syntax:
  **          Match any number of directories
  *           Match any number of characters except /
  ?           Match single character except /
  [abc]       Match any character in brackets
  {a,b}       Match any of the comma-separated patterns

Examples:
  $ codebase-map scan --include "src/**"                    # Only src directory
  $ codebase-map scan --exclude "**/*.test.ts"              # Exclude all tests
  $ codebase-map scan --include "src/**" --exclude "**/*.test.ts"  # Combined patterns
  $ codebase-map scan --include "packages/*/src/**"         # Monorepo pattern
`);
```

**Error Handling:**
- Invalid patterns cause immediate exit with helpful error message
- Pattern validation occurs before processing starts
- Clear error messages indicate which pattern failed and why

**Acceptance Criteria:**
- [ ] --include option accepts multiple glob patterns
- [ ] --exclude option accepts multiple glob patterns  
- [ ] Pattern validation occurs with helpful error messages
- [ ] Filter options passed correctly to CodeIndexer
- [ ] Help text includes pattern syntax and examples
- [ ] Existing CLI behavior preserved when options not used
- [ ] Pattern information shown in completion output

### Task 2.2: Implement Pattern Warning System
**Description**: Add intelligent warnings for common pattern issues and conflicts
**Size**: Small  
**Priority**: Medium  
**Dependencies**: Task 2.1  
**Can run parallel with**: Task 2.3

**Technical Requirements:**
- Detect when include patterns match no files
- Warn when exclude patterns exclude all included files
- Show statistics about pattern effectiveness
- Provide suggestions for common pattern mistakes

**Implementation Steps:**

1. **Create pattern analysis utilities:**
```typescript
// src/utils/pattern-analysis.ts
export interface PatternAnalysis {
  totalCandidateFiles: number;
  includedFiles: number;
  excludedFiles: number;
  finalFiles: number;
  warnings: string[];
  suggestions: string[];
}

export function analyzePatternEffectiveness(
  candidateFiles: string[],
  includedFiles: string[],
  finalFiles: string[],
  filterOptions: FilterOptions
): PatternAnalysis {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  
  // Check if include patterns matched no files
  if (filterOptions.include?.length && includedFiles.length === 0) {
    warnings.push('Include patterns matched 0 files');
    suggestions.push('Check pattern syntax and verify target files exist');
  }
  
  // Check if all included files were excluded
  if (includedFiles.length > 0 && finalFiles.length === 0) {
    warnings.push('All included files were excluded by exclude patterns');
    suggestions.push('Review exclude patterns for conflicts with include patterns');
  }
  
  // Check for overly broad exclude patterns
  if (filterOptions.exclude?.length) {
    const excludedCount = includedFiles.length - finalFiles.length;
    const excludeRatio = excludedCount / Math.max(includedFiles.length, 1);
    
    if (excludeRatio > 0.8) {
      warnings.push(`Exclude patterns filtered out ${Math.round(excludeRatio * 100)}% of files`);
      suggestions.push('Consider using more specific include patterns instead');
    }
  }
  
  return {
    totalCandidateFiles: candidateFiles.length,
    includedFiles: includedFiles.length,
    excludedFiles: includedFiles.length - finalFiles.length,
    finalFiles: finalFiles.length,
    warnings,
    suggestions
  };
}
```

2. **Integrate analysis into FileDiscovery:**
```typescript
// Update FileDiscovery.discoverFiles to return analysis info
static async discoverFilesWithAnalysis(
  rootPath: string, 
  filterOptions: FilterOptions = {}
): Promise<{ files: string[], analysis: PatternAnalysis }> {
  // ... existing discovery logic ...
  
  const analysis = analyzePatternEffectiveness(
    await this.discoverAllSupportedFiles(rootPath),
    candidateFiles,
    filteredFiles,
    filterOptions
  );
  
  return { files: filteredFiles, analysis };
}
```

3. **Display warnings in CLI:**
```typescript
// In scan command action
const { files, analysis } = await FileDiscovery.discoverFilesWithAnalysis(root, filterOptions);

// Show warnings and suggestions
if (analysis.warnings.length > 0) {
  console.log('');
  analysis.warnings.forEach(warning => {
    console.log(`⚠️  Warning: ${warning}`);
  });
  
  if (analysis.suggestions.length > 0) {
    console.log('💡 Suggestions:');
    analysis.suggestions.forEach(suggestion => {
      console.log(`   • ${suggestion}`);
    });
  }
}
```

**Warning Categories:**
- No files matched include patterns
- All files excluded (pattern conflict)  
- Overly broad exclusion patterns
- Performance warnings for complex patterns

**Acceptance Criteria:**
- [ ] Warns when include patterns match zero files
- [ ] Detects when exclude patterns conflict with include patterns
- [ ] Provides helpful suggestions for common pattern issues
- [ ] Analysis integrates seamlessly with existing CLI flow
- [ ] Warnings are clear and actionable
- [ ] Performance impact of analysis is minimal

### Task 2.3: Enhance Update Command Pattern Support
**Description**: Extend update command to respect filter patterns when updating single files
**Size**: Medium  
**Priority**: Medium  
**Dependencies**: Task 1.4, Task 2.1  
**Can run parallel with**: Task 2.2

**Technical Requirements:**
- Check if updated file matches current filter patterns
- Remove file from index if it no longer matches patterns
- Add file to index if it now matches patterns
- Preserve existing update behavior for non-filtered operations

**Implementation Steps:**

1. **Update command with pattern awareness:**
```typescript
// src/cli.ts - Update command enhancement
program
  .command('update <file>')
  .description('Update the index for a specific file')
  .option('-r, --root <path>', 'root directory')
  .option('-i, --include <patterns...>', 'include file patterns (must match current index patterns)')
  .option('-e, --exclude <patterns...>', 'exclude file patterns (must match current index patterns)')
  .action(async (file, options) => {
    // Find existing index file
    const indexPath = findIndexFile() || path.join(process.cwd(), DEFAULT_INDEX_FILENAME);
    
    if (!fs.existsSync(indexPath)) {
      console.error('❌ No existing index found. Run "codebase-map scan" first.');
      process.exit(1);
    }
    
    // Load existing index
    const existingIndex: ProjectIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    
    // Extract filter options from existing index metadata or CLI options
    const filterOptions: FilterOptions = {
      include: options.include || existingIndex.metadata.filterOptions?.include,
      exclude: options.exclude || existingIndex.metadata.filterOptions?.exclude
    };
    
    // Validate patterns if provided
    if (filterOptions.include) {
      validatePatternArray(filterOptions.include, 'include');
    }
    if (filterOptions.exclude) {
      validatePatternArray(filterOptions.exclude, 'exclude');
    }
    
    // Derive root from index location
    const root = options.root || path.dirname(indexPath);
    
    console.log(`🔄 Updating index for: ${file}`);
    
    const indexer = new CodeIndexer(root, filterOptions);
    const filePath = path.isAbsolute(file) ? file : path.join(root, file);
    const relativePath = path.relative(root, filePath);
    
    try {
      const updatedIndex = await indexer.updateFile(relativePath, existingIndex);
      
      // Save the updated index with filter options in metadata
      updatedIndex.metadata.filterOptions = filterOptions;
      fs.writeFileSync(indexPath, JSON.stringify(updatedIndex, null, 2));
      
      console.log('✅ Index updated successfully!');
    } catch (error) {
      console.error(`❌ Failed to update index: ${error}`);
      process.exit(1);
    }
  });
```

2. **Enhance updateFile method in CodeIndexer:**
```typescript
// src/core/indexer.ts
async updateFile(filePath: string, existingIndex: ProjectIndex): Promise<ProjectIndex> {
  const absolutePath = path.resolve(this.rootPath, filePath);
  
  // Check if file exists and matches current filter patterns
  const fileExists = fs.existsSync(absolutePath);
  const matchesPatterns = await this.fileMatchesPatterns(filePath);
  
  if (!fileExists || !matchesPatterns) {
    // Remove file from index if it doesn't exist or no longer matches patterns
    console.log(`📤 Removing ${filePath} from index (${!fileExists ? 'deleted' : 'excluded by patterns'})`);
    return this.removeFileFromIndex(filePath, existingIndex);
  }
  
  // File exists and matches patterns - proceed with update
  console.log(`📝 Updating ${filePath} in index`);
  
  // Rest of existing update logic...
  return this.performFileUpdate(filePath, existingIndex);
}

private async fileMatchesPatterns(filePath: string): Promise<boolean> {
  // Use FileDiscovery to check if file would be included
  const discoveredFiles = await FileDiscovery.discoverFiles(this.rootPath, this.filterOptions);
  return discoveredFiles.includes(filePath);
}

private removeFileFromIndex(filePath: string, index: ProjectIndex): ProjectIndex {
  return {
    ...index,
    files: index.files.filter(f => f.path !== filePath),
    edges: index.edges.filter(e => e.from !== filePath && e.to !== filePath),
    metadata: {
      ...index.metadata,
      totalFiles: index.metadata.totalFiles - 1,
      lastModified: new Date().toISOString()
    }
  };
}
```

3. **Store filter options in metadata:**
```typescript
// Update metadata to include filter options
interface ProjectMetadata {
  // ... existing fields ...
  filterOptions?: FilterOptions;
}
```

**Pattern Consistency:**
- Update command respects same patterns as original scan
- Filter options can be specified or inherited from existing index
- Clear feedback when files are added/removed due to pattern changes

**Acceptance Criteria:**
- [ ] Update command checks file against current filter patterns
- [ ] Files removed from index when they no longer match patterns
- [ ] Files added to index when they newly match patterns  
- [ ] Filter options preserved in index metadata
- [ ] Clear console output indicating add/remove/update actions
- [ ] Backward compatibility with indexes without filter metadata

### Task 2.4: Add Pattern Caching for Performance
**Description**: Implement pattern compilation caching to optimize repeated pattern operations
**Size**: Medium  
**Priority**: Medium  
**Dependencies**: Task 1.3, Task 2.1  
**Can run parallel with**: Task 2.5

**Technical Requirements:**
- Cache compiled glob patterns for reuse
- Cache ignore pattern instances  
- LRU eviction for memory management
- Thread-safe caching for concurrent operations
- Performance benchmarks before/after caching

**Implementation Steps:**

1. **Create pattern cache utility:**
```typescript
// src/utils/pattern-cache.ts
import LRU from 'lru-cache';
import ignore from 'ignore';

interface CompiledGlobPattern {
  fastGlobTasks: any[];
  createdAt: Date;
}

interface CompiledIgnorePattern {
  ignoreInstance: ReturnType<typeof ignore>;
  createdAt: Date;
}

class PatternCache {
  private globCache = new LRU<string, CompiledGlobPattern>({
    max: 100, // Cache up to 100 compiled glob patterns
    ttl: 1000 * 60 * 10, // 10 minute TTL
  });
  
  private ignoreCache = new LRU<string, CompiledIgnorePattern>({
    max: 100,
    ttl: 1000 * 60 * 10,
  });

  getCompiledGlobPattern(patterns: string[]): any[] {
    const key = JSON.stringify(patterns.sort());
    
    let cached = this.globCache.get(key);
    if (!cached) {
      cached = {
        fastGlobTasks: fastGlob.generateTasks(patterns, { onlyFiles: true }),
        createdAt: new Date()
      };
      this.globCache.set(key, cached);
    }
    
    return cached.fastGlobTasks;
  }

  getCompiledIgnorePattern(patterns: string[]): ReturnType<typeof ignore> {
    const key = JSON.stringify(patterns.sort());
    
    let cached = this.ignoreCache.get(key);
    if (!cached) {
      cached = {
        ignoreInstance: ignore().add(patterns),
        createdAt: new Date()
      };
      this.ignoreCache.set(key, cached);
    }
    
    return cached.ignoreInstance;
  }

  // Performance monitoring
  getCacheStats() {
    return {
      globCache: {
        size: this.globCache.size,
        hits: this.globCache.hits,
        misses: this.globCache.misses
      },
      ignoreCache: {
        size: this.ignoreCache.size,
        hits: this.ignoreCache.hits,
        misses: this.ignoreCache.misses
      }
    };
  }

  clearCache(): void {
    this.globCache.clear();
    this.ignoreCache.clear();
  }
}

// Singleton instance
export const patternCache = new PatternCache();
```

2. **Integrate caching into FileDiscovery:**
```typescript
// Update FileDiscovery methods to use caching
import { patternCache } from '../utils/pattern-cache.js';

// Enhanced applyIncludePatterns with caching
private static async applyIncludePatterns(
  rootPath: string, 
  includePatterns?: string[]
): Promise<string[]> {
  if (!includePatterns || includePatterns.length === 0) {
    return this.discoverAllSupportedFiles(rootPath);
  }
  
  // Use cached compiled patterns
  const compiledTasks = patternCache.getCompiledGlobPattern(includePatterns);
  
  const globOptions = {
    cwd: rootPath,
    ignore: this.EXCLUDED_DIRS.map(dir => `${dir}/**`),
    onlyFiles: true,
    followSymbolicLinks: false,
    absolute: false,
    dot: false
  };
  
  // Execute with pre-compiled tasks
  const allFiles = await fastGlob(includePatterns, {
    ...globOptions,
    // Use pre-compiled tasks for performance
    tasks: compiledTasks
  });
  
  return allFiles.filter(file => this.isSupportedFile(file));
}

// Enhanced applyExcludePatterns with caching  
private static applyExcludePatterns(
  files: string[], 
  excludePatterns?: string[], 
  rootPath?: string
): string[] {
  if (!excludePatterns || excludePatterns.length === 0) {
    return files;
  }
  
  // Use cached ignore instance
  const excludeIgnore = patternCache.getCompiledIgnorePattern(excludePatterns);
  
  return files.filter(file => !excludeIgnore.ignores(file));
}
```

3. **Add performance monitoring:**
```typescript
// Optional verbose output for cache performance
if (verbose) {
  const cacheStats = patternCache.getCacheStats();
  console.log(`📈 Pattern cache stats: ${cacheStats.globCache.hits}/${cacheStats.globCache.hits + cacheStats.globCache.misses} hits`);
}
```

**Performance Optimizations:**
- LRU cache with configurable size and TTL
- Pattern normalization for consistent cache keys
- Cache hit rate monitoring and reporting
- Memory-efficient storage of compiled patterns

**Acceptance Criteria:**
- [ ] Glob patterns cached and reused across operations
- [ ] Ignore patterns cached with LRU eviction
- [ ] Cache hit rates >80% for repeated pattern operations
- [ ] Memory usage remains bounded with LRU eviction
- [ ] Performance improvement measurable (>20% faster for repeated scans)
- [ ] Cache statistics available for debugging

### Task 2.5: Implement Comprehensive Error Handling
**Description**: Add robust error handling for all pattern-related operations with user-friendly messages
**Size**: Medium  
**Priority**: Medium  
**Dependencies**: Task 2.1, Task 2.2  
**Can run parallel with**: Task 2.4

**Technical Requirements:**
- Structured error types for different failure modes
- Context-rich error messages with file paths and patterns
- Graceful degradation for non-critical errors
- Error recovery suggestions and troubleshooting

**Implementation Steps:**

1. **Define structured error types:**
```typescript
// src/utils/pattern-errors.ts
export abstract class PatternError extends Error {
  abstract readonly code: string;
  abstract readonly recoverable: boolean;
  
  constructor(message: string, public readonly context?: any) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidPatternSyntaxError extends PatternError {
  readonly code = 'INVALID_PATTERN_SYNTAX';
  readonly recoverable = true;
  
  constructor(pattern: string, syntaxError: string) {
    super(`Invalid glob pattern "${pattern}": ${syntaxError}`);
    this.context = { pattern, syntaxError };
  }
}

export class SecurityViolationError extends PatternError {
  readonly code = 'SECURITY_VIOLATION';
  readonly recoverable = false;
  
  constructor(pattern: string, violation: string) {
    super(`Security violation in pattern "${pattern}": ${violation}`);
    this.context = { pattern, violation };
  }
}

export class PatternConflictError extends PatternError {
  readonly code = 'PATTERN_CONFLICT';
  readonly recoverable = true;
  
  constructor(includePatterns: string[], excludePatterns: string[]) {
    super('Include and exclude patterns conflict - no files match');
    this.context = { includePatterns, excludePatterns };
  }
}

export class FileSystemError extends PatternError {
  readonly code = 'FILESYSTEM_ERROR';
  readonly recoverable = false;
  
  constructor(operation: string, path: string, cause: Error) {
    super(`Filesystem error during ${operation} at "${path}": ${cause.message}`);
    this.context = { operation, path, cause };
  }
}
```

2. **Enhanced error handling in FileDiscovery:**
```typescript
// Update FileDiscovery with comprehensive error handling
static async discoverFiles(
  rootPath: string, 
  filterOptions: FilterOptions = {}
): Promise<string[]> {
  try {
    const absoluteRoot = path.resolve(rootPath);
    
    // Validate root path exists
    if (!fs.existsSync(absoluteRoot)) {
      throw new FileSystemError('path_validation', absoluteRoot, 
        new Error('Root directory does not exist'));
    }
    
    // Validate and sanitize patterns
    if (filterOptions.include) {
      try {
        validatePatternArray(filterOptions.include, 'include');
      } catch (error) {
        if (error instanceof PatternValidationError) {
          throw new InvalidPatternSyntaxError(error.pattern, error.message);
        }
        throw error;
      }
    }
    
    if (filterOptions.exclude) {
      try {
        validatePatternArray(filterOptions.exclude, 'exclude');
      } catch (error) {
        if (error instanceof PatternValidationError) {
          throw new InvalidPatternSyntaxError(error.pattern, error.message);
        }
        throw error;
      }
    }
    
    // Apply pattern filtering with error context
    const candidateFiles = await this.applyIncludePatternsWithErrorHandling(
      absoluteRoot, 
      filterOptions.include
    );
    
    const filteredFiles = this.applyExcludePatternsWithErrorHandling(
      candidateFiles, 
      filterOptions.exclude
    );
    
    // Check for pattern conflicts
    if (filterOptions.include?.length && candidateFiles.length > 0 && filteredFiles.length === 0) {
      throw new PatternConflictError(filterOptions.include, filterOptions.exclude || []);
    }
    
    // Apply gitignore with error handling
    const ignoreRules = await this.loadIgnoreRulesWithErrorHandling(absoluteRoot);
    return this.applyIgnoreRules(filteredFiles, ignoreRules);
    
  } catch (error) {
    if (error instanceof PatternError) {
      // Re-throw pattern errors as-is
      throw error;
    }
    
    // Wrap unexpected errors
    throw new FileSystemError('file_discovery', rootPath, error as Error);
  }
}
```

3. **CLI error display and recovery:**
```typescript
// Enhanced error handling in CLI commands
.action(async (options) => {
  try {
    // ... existing scan logic ...
  } catch (error) {
    if (error instanceof PatternError) {
      console.error(`❌ ${error.message}`);
      
      // Provide recovery suggestions for recoverable errors
      if (error.recoverable) {
        console.error('💡 Suggestions:');
        
        if (error instanceof InvalidPatternSyntaxError) {
          console.error('   • Check glob pattern syntax: https://github.com/mrmlnc/fast-glob#pattern-syntax');
          console.error('   • Verify file paths exist in your project');
          console.error('   • Use quotes around patterns with special characters');
        }
        
        if (error instanceof PatternConflictError) {
          console.error('   • Review exclude patterns for conflicts with include patterns');
          console.error('   • Try more specific include patterns');
          console.error('   • Use --verbose to see which files are matched');
        }
      }
      
      process.exit(1);
    } else {
      // Unexpected errors
      console.error('❌ An unexpected error occurred:');
      console.error(error.message);
      console.error('\n🐛 If this persists, please report at: https://github.com/carlrannaberg/codebase-map/issues');
      process.exit(1);
    }
  }
});
```

**Error Categories:**
- Pattern syntax errors with glob documentation links
- Security violations (directory traversal attempts)  
- Pattern conflicts (all files excluded)
- File system errors (permissions, missing directories)
- Unexpected errors with bug report guidance

**Acceptance Criteria:**
- [ ] All pattern operations wrapped in appropriate error handling
- [ ] Error messages include context (patterns, file paths, operations)
- [ ] Recoverable errors provide actionable suggestions  
- [ ] Security violations detected and blocked safely
- [ ] Unexpected errors wrapped with debugging information
- [ ] Error recovery suggestions tested and accurate

### Task 2.6: Add Verbose Pattern Information
**Description**: Enhance verbose mode to show detailed pattern matching information
**Size**: Small  
**Priority**: Low  
**Dependencies**: Task 2.1, Task 2.2  
**Can run parallel with**: Task 2.4, Task 2.5

**Technical Requirements:**
- Show pattern evaluation steps in verbose mode
- Display file matching/exclusion reasons
- Include pattern performance metrics
- Provide debugging information for complex patterns

**Implementation Steps:**

1. **Create verbose pattern logger:**
```typescript
// src/utils/pattern-logger.ts
export interface PatternMatchInfo {
  file: string;
  includeMatches: string[];
  excludeMatches: string[];
  gitignoreExcluded: boolean;
  finalResult: 'included' | 'excluded';
  reason: string;
}

export class PatternLogger {
  private matchLog: PatternMatchInfo[] = [];
  
  logFileEvaluation(
    file: string,
    includePatterns: string[],
    excludePatterns: string[],
    included: boolean,
    excluded: boolean,
    gitignored: boolean
  ): void {
    const includeMatches = includePatterns.filter(pattern => 
      this.testPatternMatch(pattern, file)
    );
    
    const excludeMatches = excludePatterns.filter(pattern => 
      this.testPatternMatch(pattern, file)
    );
    
    let finalResult: 'included' | 'excluded';
    let reason: string;
    
    if (gitignored) {
      finalResult = 'excluded';
      reason = 'excluded by .gitignore';
    } else if (excluded) {
      finalResult = 'excluded';
      reason = `excluded by patterns: ${excludeMatches.join(', ')}`;
    } else if (included) {
      finalResult = 'included';
      reason = includeMatches.length > 0 
        ? `included by patterns: ${includeMatches.join(', ')}`
        : 'included by default';
    } else {
      finalResult = 'excluded';
      reason = 'no include patterns matched';
    }
    
    this.matchLog.push({
      file,
      includeMatches,
      excludeMatches,  
      gitignoreExcluded: gitignored,
      finalResult,
      reason
    });
  }
  
  private testPatternMatch(pattern: string, file: string): boolean {
    // Use micromatch or similar for testing individual pattern matches
    return micromatch.isMatch(file, pattern);
  }
  
  getMatchLog(): PatternMatchInfo[] {
    return this.matchLog;
  }
  
  printVerboseLog(): void {
    console.log('\n📋 Pattern Matching Details:');
    
    const included = this.matchLog.filter(m => m.finalResult === 'included');
    const excluded = this.matchLog.filter(m => m.finalResult === 'excluded');
    
    console.log(`   ✅ ${included.length} files included`);
    console.log(`   ❌ ${excluded.length} files excluded`);
    
    // Show first few matches for each category
    if (included.length > 0) {
      console.log('\n   📥 Sample included files:');
      included.slice(0, 5).forEach(match => {
        console.log(`      ${match.file} - ${match.reason}`);
      });
      if (included.length > 5) {
        console.log(`      ... and ${included.length - 5} more`);
      }
    }
    
    if (excluded.length > 0) {
      console.log('\n   📤 Sample excluded files:');
      excluded.slice(0, 5).forEach(match => {
        console.log(`      ${match.file} - ${match.reason}`);
      });
      if (excluded.length > 5) {
        console.log(`      ... and ${excluded.length - 5} more`);
      }
    }
  }
}
```

2. **Integrate verbose logging into FileDiscovery:**
```typescript
// Add verbose parameter to FileDiscovery methods
static async discoverFiles(
  rootPath: string, 
  filterOptions: FilterOptions = {},
  verbose: boolean = false
): Promise<string[]> {
  const logger = verbose ? new PatternLogger() : null;
  
  // ... existing discovery logic ...
  
  // Log each file evaluation if verbose
  if (logger) {
    allCandidateFiles.forEach(file => {
      const included = candidateFiles.includes(file);
      const excluded = !filteredFiles.includes(file) && candidateFiles.includes(file);
      const gitignored = !finalFiles.includes(file) && filteredFiles.includes(file);
      
      logger.logFileEvaluation(
        file,
        filterOptions.include || [],
        filterOptions.exclude || [],
        included,
        excluded,
        gitignored
      );
    });
    
    logger.printVerboseLog();
  }
  
  return finalFiles;
}
```

3. **CLI integration for verbose pattern info:**
```typescript
// In scan command action
if (verbose) {
  console.log('\n🔍 Pattern Configuration:');
  if (filterOptions.include?.length) {
    console.log(`   📥 Include patterns (${filterOptions.include.length}):`);
    filterOptions.include.forEach(pattern => {
      console.log(`      • ${pattern}`);
    });
  } else {
    console.log('   📥 Include patterns: all supported files');
  }
  
  if (filterOptions.exclude?.length) {
    console.log(`   📤 Exclude patterns (${filterOptions.exclude.length}):`);
    filterOptions.exclude.forEach(pattern => {
      console.log(`      • ${pattern}`);
    });
  } else {
    console.log('   📤 Exclude patterns: none');
  }
}

// Pass verbose flag to file discovery
const files = await FileDiscovery.discoverFiles(root, filterOptions, verbose);
```

**Verbose Information Categories:**
- Pattern configuration summary
- File-by-file matching decisions
- Performance metrics and timing
- Cache hit rates (if caching enabled)
- Pattern conflict detection and resolution

**Acceptance Criteria:**
- [ ] Verbose mode shows pattern configuration before processing
- [ ] Individual file matching decisions logged and displayed
- [ ] Sample included/excluded files shown with reasons
- [ ] Performance metrics included in verbose output
- [ ] Verbose information helpful for debugging pattern issues
- [ ] Output remains readable and not overwhelming

## Phase 3: Testing and Documentation (5 tasks)

### Task 3.1: Implement Comprehensive Unit Tests
**Description**: Create complete unit test suite for all pattern functionality
**Size**: Large  
**Priority**: High  
**Dependencies**: All Phase 1 and 2 tasks  
**Can run parallel with**: Task 3.2

**Technical Requirements:**
- Test all new methods in FileDiscovery class
- Test CLI option parsing and validation
- Test error handling and edge cases
- Test pattern caching functionality
- Mock file system operations for consistent testing

**Implementation Steps:**

1. **FileDiscovery pattern tests:**
```typescript
// src/core/file-discovery.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';
import { FileDiscovery } from './file-discovery.js';
import type { FilterOptions } from '../types/index.js';

// Mock the file system
vi.mock('node:fs', () => require('memfs').fs);
vi.mock('node:fs/promises', () => require('memfs').fs.promises);

describe('FileDiscovery Pattern Support', () => {
  let mockRoot: string;

  beforeEach(() => {
    vol.reset();
    mockRoot = '/test-project';
    
    // Create mock file system structure
    vol.fromJSON({
      '/test-project/src/index.ts': 'export const main = () => {};',
      '/test-project/src/utils.ts': 'export const helper = () => {};',
      '/test-project/src/utils.test.ts': 'describe("utils", () => {});',
      '/test-project/lib/api.ts': 'export class API {}',
      '/test-project/lib/api.test.ts': 'describe("API", () => {});',
      '/test-project/docs/readme.md': '# Documentation',
      '/test-project/tests/integration.spec.ts': 'describe("integration", () => {});',
      '/test-project/.gitignore': 'node_modules\n*.log',
      '/test-project/package.json': '{"name": "test"}',
      '/test-project/node_modules/dep/index.js': 'module.exports = {};'
    }, mockRoot);
  });

  afterEach(() => {
    vol.reset();
  });

  describe('applyIncludePatterns', () => {
    it('should include only files matching include patterns', async () => {
      // Purpose: Validate include patterns work correctly with glob syntax
      // Can fail if: glob patterns aren't processed correctly or wrong files included
      const result = await FileDiscovery.discoverFiles(mockRoot, {
        include: ['src/**']
      });
      
      expect(result.sort()).toEqual([
        'src/index.ts', 
        'src/utils.ts', 
        'src/utils.test.ts'
      ].sort());
      
      // Should not include files outside src/
      expect(result).not.toContain('lib/api.ts');
      expect(result).not.toContain('docs/readme.md');
    });

    it('should handle multiple include patterns with OR logic', async () => {
      // Purpose: Ensure multiple patterns are properly combined (OR logic)
      // Can fail if: patterns aren't merged correctly or precedence is wrong
      const result = await FileDiscovery.discoverFiles(mockRoot, {
        include: ['src/**', 'lib/**']
      });
      
      expect(result).toContain('src/index.ts');
      expect(result).toContain('src/utils.ts');
      expect(result).toContain('lib/api.ts');
      expect(result).not.toContain('docs/readme.md');
      expect(result).not.toContain('tests/integration.spec.ts');
    });

    it('should filter to only supported file extensions', async () => {
      // Purpose: Ensure include patterns still respect supported file type filtering
      // Can fail if: pattern matching bypasses file extension validation
      const result = await FileDiscovery.discoverFiles(mockRoot, {
        include: ['**/*']
      });
      
      // Should include TypeScript files
      expect(result).toContain('src/index.ts');
      expect(result).toContain('lib/api.ts');
      
      // Should exclude non-supported extensions
      expect(result).not.toContain('docs/readme.md'); // .md not supported
      expect(result).not.toContain('package.json'); // .json not supported
    });

    it('should return empty array when patterns match no files', async () => {
      // Purpose: Verify behavior when patterns don't match any files
      // Can fail if: empty results cause errors or unexpected behavior
      const result = await FileDiscovery.discoverFiles(mockRoot, {
        include: ['nonexistent/**']
      });
      
      expect(result).toEqual([]);
    });

    it('should use default behavior when no include patterns provided', async () => {
      // Purpose: Ensure backward compatibility when include patterns empty
      // Can fail if: empty include patterns change default file discovery
      const withoutPatterns = await FileDiscovery.discoverFiles(mockRoot);
      const withEmptyInclude = await FileDiscovery.discoverFiles(mockRoot, {
        include: []
      });
      
      expect(withoutPatterns.sort()).toEqual(withEmptyInclude.sort());
    });
  });

  describe('applyExcludePatterns', () => {
    it('should exclude files matching exclude patterns', async () => {
      // Purpose: Validate exclude patterns filter out correct files
      // Can fail if: exclude logic is inverted or patterns don't match correctly
      const result = await FileDiscovery.discoverFiles(mockRoot, {
        exclude: ['**/*.test.ts']
      });
      
      expect(result).toContain('src/index.ts');
      expect(result).toContain('src/utils.ts');
      expect(result).toContain('lib/api.ts');
      expect(result).not.toContain('src/utils.test.ts');
      expect(result).not.toContain('lib/api.test.ts');
    });

    it('should apply exclude after include (correct precedence)', async () => {
      // Purpose: Ensure correct order of operations for overlapping patterns
      // Can fail if: precedence is reversed or patterns interfere with each other
      const result = await FileDiscovery.discoverFiles(mockRoot, {
        include: ['src/**'],
        exclude: ['**/*.test.ts']
      });
      
      expect(result).toContain('src/index.ts');
      expect(result).toContain('src/utils.ts');
      expect(result).not.toContain('src/utils.test.ts');
      expect(result).not.toContain('lib/api.ts'); // Excluded by include
    });

    it('should handle multiple exclude patterns', async () => {
      // Purpose: Verify multiple exclude patterns work together
      // Can fail if: multiple patterns aren't processed correctly
      const result = await FileDiscovery.discoverFiles(mockRoot, {
        exclude: ['**/*.test.ts', '**/*.spec.ts']
      });
      
      expect(result).toContain('src/index.ts');
      expect(result).toContain('lib/api.ts');
      expect(result).not.toContain('src/utils.test.ts');
      expect(result).not.toContain('tests/integration.spec.ts');
    });

    it('should return all files when no exclude patterns provided', async () => {
      // Purpose: Ensure exclude patterns don't affect behavior when empty
      // Can fail if: empty exclude patterns change file discovery
      const withoutExclude = await FileDiscovery.discoverFiles(mockRoot);
      const withEmptyExclude = await FileDiscovery.discoverFiles(mockRoot, {
        exclude: []
      });
      
      expect(withoutExclude.sort()).toEqual(withEmptyExclude.sort());
    });
  });

  describe('gitignore integration', () => {
    it('should apply gitignore after include/exclude patterns', async () => {
      // Purpose: Verify gitignore is applied last in the filtering chain
      // Can fail if: gitignore precedence is wrong or integration broken
      const result = await FileDiscovery.discoverFiles(mockRoot, {
        include: ['**/*'] // Include everything initially
      });
      
      // Should respect gitignore and exclude node_modules
      expect(result).not.toContain('node_modules/dep/index.js');
      
      // Should include normal source files
      expect(result).toContain('src/index.ts');
    });
  });

  describe('edge cases', () => {
    it('should handle empty pattern arrays gracefully', async () => {
      // Purpose: Ensure graceful handling of empty pattern arrays
      // Can fail if: empty arrays cause errors or change default behavior
      const result = await FileDiscovery.discoverFiles(mockRoot, {
        include: [],
        exclude: []
      });
      
      const defaultResult = await FileDiscovery.discoverFiles(mockRoot);
      expect(result.sort()).toEqual(defaultResult.sort());
    });

    it('should handle conflicting patterns (include then exclude everything)', async () => {
      // Purpose: Test behavior when all included files are then excluded
      // Can fail if: conflict resolution isn't handled properly
      const result = await FileDiscovery.discoverFiles(mockRoot, {
        include: ['src/**'],
        exclude: ['src/**']
      });
      
      expect(result).toEqual([]);
    });

    it('should handle patterns with special glob characters', async () => {
      // Purpose: Test complex glob patterns with special characters
      // Can fail if: special characters aren't handled correctly
      vol.fromJSON({
        '/test-project/src/[component].ts': 'export default {};',
        '/test-project/src/{utils,helpers}.ts': 'export const fn = () => {};',
      }, mockRoot);
      
      const result = await FileDiscovery.discoverFiles(mockRoot, {
        include: ['src/[component].ts', 'src/{utils,helpers}.ts']
      });
      
      expect(result).toContain('src/[component].ts');
      expect(result).toContain('src/{utils,helpers}.ts');
    });

    it('should handle deeply nested directory patterns', async () => {
      // Purpose: Test performance and correctness with deep nesting
      // Can fail if: deep patterns cause performance issues or incorrect matching
      vol.fromJSON({
        '/test-project/a/b/c/d/e/deep.ts': 'export const deep = true;',
        '/test-project/x/y/z/other.ts': 'export const other = true;',
      }, mockRoot);
      
      const result = await FileDiscovery.discoverFiles(mockRoot, {
        include: ['a/**/deep.ts']
      });
      
      expect(result).toContain('a/b/c/d/e/deep.ts');
      expect(result).not.toContain('x/y/z/other.ts');
    });
  });
});
```

2. **CLI option parsing tests:**
```typescript
// src/cli.test.ts
import { describe, it, expect } from 'vitest';
import { Command } from 'commander';

// Test helper to parse CLI arguments
function parseCliOptions(args: string[]) {
  const program = new Command();
  
  program
    .command('scan')
    .option('-i, --include <patterns...>', 'include patterns')
    .option('-e, --exclude <patterns...>', 'exclude patterns')
    .action((options) => {
      return options;
    });
  
  program.parse(['node', 'cli.js', ...args]);
  return program.commands[0].opts();
}

describe('CLI Pattern Options', () => {
  it('should parse single include pattern', () => {
    // Purpose: Validate CLI parsing handles include patterns correctly
    // Can fail if: commander.js integration is broken or options not parsed
    const options = parseCliOptions(['scan', '--include', 'src/**']);
    
    expect(options.include).toEqual(['src/**']);
  });

  it('should parse multiple include patterns', () => {
    // Purpose: Ensure multiple patterns are collected into array
    // Can fail if: commander.js doesn't handle multiple values correctly
    const options = parseCliOptions([
      'scan', 
      '--include', 'src/**', 
      '--include', 'lib/**'
    ]);
    
    expect(options.include).toEqual(['src/**', 'lib/**']);
  });

  it('should parse multiple exclude patterns', () => {
    // Purpose: Verify exclude patterns parsed correctly
    // Can fail if: exclude option parsing differs from include
    const options = parseCliOptions([
      'scan', 
      '--exclude', '**/*.test.ts',
      '--exclude', '**/*.spec.ts'
    ]);
    
    expect(options.exclude).toEqual(['**/*.test.ts', '**/*.spec.ts']);
  });

  it('should parse combined include and exclude patterns', () => {
    // Purpose: Test parsing both pattern types together
    // Can fail if: options interfere with each other
    const options = parseCliOptions([
      'scan',
      '--include', 'src/**',
      '--include', 'lib/**',
      '--exclude', '**/*.test.ts'
    ]);
    
    expect(options.include).toEqual(['src/**', 'lib/**']);
    expect(options.exclude).toEqual(['**/*.test.ts']);
  });

  it('should handle empty pattern options', () => {
    // Purpose: Ensure CLI works without pattern options
    // Can fail if: missing options cause parsing errors
    const options = parseCliOptions(['scan']);
    
    expect(options.include).toBeUndefined();
    expect(options.exclude).toBeUndefined();
  });
});
```

3. **Pattern validation tests:**
```typescript
// src/utils/pattern-validation.test.ts
import { describe, it, expect } from 'vitest';
import { 
  validateGlobPattern, 
  validatePatternArray,
  PatternValidationError 
} from './pattern-validation.js';

describe('Pattern Validation', () => {
  describe('validateGlobPattern', () => {
    it('should accept valid glob patterns', () => {
      // Purpose: Ensure valid patterns pass validation
      // Can fail if: validation is too strict or glob syntax parsing broken
      const validPatterns = [
        'src/**',
        '**/*.ts',
        'src/{utils,helpers}/**',
        'src/[abc]*.ts',
        '!(node_modules)/**'
      ];
      
      validPatterns.forEach(pattern => {
        expect(() => validateGlobPattern(pattern)).not.toThrow();
      });
    });

    it('should reject directory traversal patterns', () => {
      // Purpose: Prevent security vulnerabilities from directory traversal
      // Can fail if: security checks are bypassed or incomplete
      const dangerousPatterns = [
        '../../../etc/passwd',
        'src/../../../secrets',
        '/etc/shadow',
        'C:\\Windows\\System32'
      ];
      
      dangerousPatterns.forEach(pattern => {
        expect(() => validateGlobPattern(pattern))
          .toThrow(PatternValidationError);
      });
    });

    it('should reject invalid glob syntax', () => {
      // Purpose: Catch malformed glob patterns before processing
      // Can fail if: pattern validation doesn't catch syntax errors
      const invalidPatterns = [
        'src/[invalid',  // Unclosed bracket
        'src/[',         // Incomplete bracket
        'src/**[',       // Incomplete bracket after glob
      ];
      
      invalidPatterns.forEach(pattern => {
        expect(() => validateGlobPattern(pattern))
          .toThrow(PatternValidationError);
      });
    });

    it('should provide helpful error messages', () => {
      // Purpose: Ensure error messages help users fix pattern issues
      // Can fail if: error messages are generic or unhelpful
      try {
        validateGlobPattern('../dangerous');
      } catch (error) {
        expect(error).toBeInstanceOf(PatternValidationError);
        expect(error.message).toContain('Directory traversal not allowed');
        expect(error.message).toContain('../dangerous');
      }
    });
  });

  describe('validatePatternArray', () => {
    it('should validate array of valid patterns', () => {
      // Purpose: Ensure pattern arrays are validated correctly
      // Can fail if: array validation logic is broken
      const patterns = ['src/**', 'lib/**', '**/*.ts'];
      
      expect(() => validatePatternArray(patterns, 'include')).not.toThrow();
    });

    it('should reject non-array inputs', () => {
      // Purpose: Ensure type safety for pattern arrays
      // Can fail if: type checking is insufficient
      expect(() => validatePatternArray('not-array' as any, 'include'))
        .toThrow('include patterns must be an array');
    });

    it('should reject arrays with invalid patterns', () => {
      // Purpose: Ensure individual pattern validation within arrays
      // Can fail if: array processing doesn't validate individual patterns
      const patterns = ['src/**', '../dangerous', 'lib/**'];
      
      expect(() => validatePatternArray(patterns, 'exclude'))
        .toThrow(PatternValidationError);
    });

    it('should reject empty or whitespace-only patterns', () => {
      // Purpose: Prevent empty patterns that could cause issues
      // Can fail if: empty pattern validation is missing
      const patterns = ['src/**', '', '   ', 'lib/**'];
      
      expect(() => validatePatternArray(patterns, 'include'))
        .toThrow(PatternValidationError);
    });
  });
});
```

**Test Coverage Requirements:**
- All new public methods have comprehensive tests
- Edge cases and error conditions covered
- Pattern validation security tests
- CLI integration tests
- Mock file system for consistent testing
- Performance tests for large pattern sets

**Acceptance Criteria:**
- [ ] All FileDiscovery pattern methods have >95% test coverage
- [ ] CLI option parsing fully tested with edge cases
- [ ] Pattern validation tests cover security scenarios
- [ ] Error handling tests verify proper error types and messages
- [ ] All tests use mocked file system for consistency
- [ ] Tests run quickly (<5 seconds total) and reliably
- [ ] Test names clearly describe purpose and failure scenarios

### Task 3.2: Create Integration Test Suite
**Description**: Build end-to-end integration tests for complex pattern scenarios
**Size**: Large  
**Priority**: High  
**Dependencies**: Task 3.1, All Phase 2 tasks  
**Can run parallel with**: Task 3.1

**Technical Requirements:**
- Test complete CLI workflows with pattern options
- Test realistic project structures and pattern combinations
- Test monorepo scenarios with complex patterns
- Verify generated index file correctness with patterns
- Test performance with large codebases

**Implementation Steps:**

1. **End-to-end CLI integration tests:**
```typescript
// tests/integration/pattern-cli.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Pattern CLI Integration Tests', () => {
  let testDir: string;
  let cliPath: string;

  beforeEach(() => {
    // Create temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codebase-map-test-'));
    cliPath = path.resolve(__dirname, '../../dist/cli.js');
    
    // Ensure CLI is built
    if (!fs.existsSync(cliPath)) {
      execSync('npm run build', { cwd: path.resolve(__dirname, '../..') });
    }
  });

  afterEach(() => {
    // Clean up test directory
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should generate correct index with include patterns', async () => {
    // Purpose: Validate complete workflow from CLI to output with patterns
    // Can fail if: any part of the pipeline breaks pattern processing
    
    // Create test project structure
    const projectStructure = {
      'src/index.ts': 'export const main = () => {};',
      'src/utils.ts': 'export const helper = () => {};',
      'src/types.ts': 'export interface User {};',
      'lib/api.ts': 'export class API {};',
      'docs/readme.md': '# Documentation',
      'tests/unit.test.ts': 'describe("unit", () => {});',
      'tests/integration.spec.ts': 'describe("integration", () => {});',
      'package.json': JSON.stringify({ name: 'test-project' })
    };

    // Write files to test directory
    Object.entries(projectStructure).forEach(([filePath, content]) => {
      const fullPath = path.join(testDir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    });

    // Run CLI with include pattern
    const result = execSync(
      `node "${cliPath}" scan --include "src/**" --output test-index.json`,
      { cwd: testDir, encoding: 'utf8' }
    );

    // Verify CLI output
    expect(result).toContain('Scan completed successfully');
    expect(result).toContain('Files processed: 3'); // src files only

    // Verify generated index file
    const indexPath = path.join(testDir, 'test-index.json');
    expect(fs.existsSync(indexPath)).toBe(true);

    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    
    // Should include only src files
    expect(index.files).toHaveLength(3);
    expect(index.files.map(f => f.path)).toEqual(
      expect.arrayContaining(['src/index.ts', 'src/utils.ts', 'src/types.ts'])
    );
    
    // Should not include lib, docs, or tests files
    const filePaths = index.files.map(f => f.path);
    expect(filePaths).not.toContain('lib/api.ts');
    expect(filePaths).not.toContain('docs/readme.md');
    expect(filePaths).not.toContain('tests/unit.test.ts');
  });

  it('should handle complex monorepo patterns', async () => {
    // Purpose: Test realistic monorepo scenarios with nested patterns
    // Can fail if: complex glob patterns don't work with real file systems
    
    // Create monorepo structure
    const monorepoStructure = {
      'packages/api/src/index.ts': 'export class ApiServer {};',
      'packages/api/src/routes.ts': 'export const routes = {};',
      'packages/api/src/index.test.ts': 'describe("api", () => {});',
      'packages/ui/src/components.tsx': 'export const Button = () => {};',
      'packages/ui/src/hooks.ts': 'export const useApi = () => {};',
      'packages/ui/src/components.test.tsx': 'describe("components", () => {});',
      'packages/shared/src/types.ts': 'export interface Common {};',
      'packages/shared/src/utils.ts': 'export const shared = {};',
      'apps/web/src/app.tsx': 'export const App = () => {};',
      'apps/admin/src/dashboard.tsx': 'export const Dashboard = () => {};',
      'docs/api.md': '# API Documentation',
      'scripts/build.js': 'console.log("building");',
      'package.json': JSON.stringify({ name: 'monorepo' })
    };

    Object.entries(monorepoStructure).forEach(([filePath, content]) => {
      const fullPath = path.join(testDir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    });

    // Run CLI with complex monorepo patterns
    const result = execSync(
      `node "${cliPath}" scan --include "packages/*/src/**" --exclude "**/*.test.*" --output monorepo-index.json`,
      { cwd: testDir, encoding: 'utf8' }
    );

    const index = JSON.parse(fs.readFileSync(path.join(testDir, 'monorepo-index.json'), 'utf8'));
    const filePaths = index.files.map(f => f.path).sort();

    // Should include package source files
    expect(filePaths).toContain('packages/api/src/index.ts');
    expect(filePaths).toContain('packages/api/src/routes.ts');
    expect(filePaths).toContain('packages/ui/src/components.tsx');
    expect(filePaths).toContain('packages/ui/src/hooks.ts');
    expect(filePaths).toContain('packages/shared/src/types.ts');
    expect(filePaths).toContain('packages/shared/src/utils.ts');

    // Should exclude test files
    expect(filePaths).not.toContain('packages/api/src/index.test.ts');
    expect(filePaths).not.toContain('packages/ui/src/components.test.tsx');

    // Should exclude non-package files
    expect(filePaths).not.toContain('apps/web/src/app.tsx');
    expect(filePaths).not.toContain('docs/api.md');
    expect(filePaths).not.toContain('scripts/build.js');

    // Verify total count
    expect(index.files).toHaveLength(6); // 6 package source files
  });

  it('should respect gitignore with patterns', async () => {
    // Purpose: Verify gitignore integration works with custom patterns
    // Can fail if: gitignore processing interferes with pattern filtering
    
    const projectFiles = {
      'src/index.ts': 'export const main = () => {};',
      'src/debug.ts': 'export const debug = () => {};',
      'build/output.js': 'compiled code',
      'temp/cache.ts': 'export const cache = {};',
      '.gitignore': 'build/\ntemp/\n*.log',
      'error.log': 'error content',
      'package.json': JSON.stringify({ name: 'test' })
    };

    Object.entries(projectFiles).forEach(([filePath, content]) => {
      const fullPath = path.join(testDir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    });

    // Include everything but gitignore should still filter
    const result = execSync(
      `node "${cliPath}" scan --include "**/*" --output gitignore-test.json`,
      { cwd: testDir, encoding: 'utf8' }
    );

    const index = JSON.parse(fs.readFileSync(path.join(testDir, 'gitignore-test.json'), 'utf8'));
    const filePaths = index.files.map(f => f.path);

    // Should include source files
    expect(filePaths).toContain('src/index.ts');
    expect(filePaths).toContain('src/debug.ts');

    // Should exclude gitignored files even with broad include
    expect(filePaths).not.toContain('build/output.js'); // build/ ignored
    expect(filePaths).not.toContain('temp/cache.ts');   // temp/ ignored
    expect(filePaths).not.toContain('error.log');       // *.log ignored
  });

  it('should handle update command with patterns', async () => {
    // Purpose: Test incremental updates respect pattern filtering
    // Can fail if: update command doesn't properly handle pattern filtering
    
    // Initial project setup
    const initialFiles = {
      'src/index.ts': 'export const main = () => {};',
      'src/utils.ts': 'export const helper = () => {};',
      'tests/unit.test.ts': 'describe("test", () => {});',
      'package.json': JSON.stringify({ name: 'test' })
    };

    Object.entries(initialFiles).forEach(([filePath, content]) => {
      const fullPath = path.join(testDir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    });

    // Initial scan with pattern
    execSync(
      `node "${cliPath}" scan --include "src/**" --output pattern-update.json`,
      { cwd: testDir }
    );

    // Modify a file in included directory
    fs.writeFileSync(
      path.join(testDir, 'src/utils.ts'),
      'export const helper = () => { return "modified"; };'
    );

    // Update the modified file
    const updateResult = execSync(
      `node "${cliPath}" update src/utils.ts`,
      { cwd: testDir, encoding: 'utf8' }
    );

    expect(updateResult).toContain('Index updated successfully');

    // Add a file outside the pattern
    fs.writeFileSync(
      path.join(testDir, 'tests/new.test.ts'),
      'describe("new test", () => {});'
    );

    // Try to update file outside pattern - should be excluded
    const excludedUpdateResult = execSync(
      `node "${cliPath}" update tests/new.test.ts`,
      { cwd: testDir, encoding: 'utf8' }
    );

    // File should be excluded from index due to pattern mismatch
    const index = JSON.parse(fs.readFileSync(path.join(testDir, 'pattern-update.json'), 'utf8'));
    const filePaths = index.files.map(f => f.path);
    
    expect(filePaths).toContain('src/index.ts');
    expect(filePaths).toContain('src/utils.ts'); // Updated
    expect(filePaths).not.toContain('tests/new.test.ts'); // Excluded by pattern
  });

  it('should provide helpful error messages for invalid patterns', async () => {
    // Purpose: Verify error handling provides actionable user feedback
    // Can fail if: error messages are generic or CLI doesn't handle errors properly
    
    // Create minimal project
    fs.writeFileSync(path.join(testDir, 'index.ts'), 'export {}');

    // Test invalid glob pattern
    expect(() => {
      execSync(
        `node "${cliPath}" scan --include "src/[invalid" --output error-test.json`,
        { cwd: testDir, encoding: 'utf8' }
      );
    }).toThrow();

    // Test directory traversal attempt
    expect(() => {
      execSync(
        `node "${cliPath}" scan --include "../../../etc/passwd" --output error-test.json`,
        { cwd: testDir, encoding: 'utf8' }
      );
    }).toThrow();
  });
});
```

2. **Performance integration tests:**
```typescript
// tests/integration/pattern-performance.test.ts
import { describe, it, expect } from 'vitest';
import { FileDiscovery } from '../../src/core/file-discovery.js';
import { performance } from 'perf_hooks';

describe('Pattern Performance Integration', () => {
  it('should handle large codebases with patterns efficiently', async () => {
    // Purpose: Ensure pattern processing doesn't significantly impact performance
    // Can fail if: pattern matching creates performance bottlenecks
    
    // Create large mock project (simulate structure without actual files)
    const largeProject = await createLargeMockProject(1000);
    
    const startTime = performance.now();
    
    const files = await FileDiscovery.discoverFiles(largeProject.root, {
      include: ['src/**', 'packages/*/src/**'],
      exclude: ['**/*.test.ts', '**/*.spec.ts']
    });
    
    const duration = performance.now() - startTime;
    
    // Performance requirements based on spec
    expect(duration).toBeLessThan(500); // 500ms for <1000 files
    expect(files.length).toBeGreaterThan(0);
    expect(files.length).toBeLessThan(1000); // Some files excluded
  });

  it('should scale pattern caching effectively', async () => {
    // Purpose: Verify pattern caching improves performance for repeated operations
    // Can fail if: caching doesn't provide measurable performance benefits
    
    const testProject = await createMediumMockProject(100);
    const patterns = {
      include: ['src/**', 'lib/**'],
      exclude: ['**/*.test.ts']
    };

    // First run (cache miss)
    const start1 = performance.now();
    const files1 = await FileDiscovery.discoverFiles(testProject.root, patterns);
    const duration1 = performance.now() - start1;

    // Second run (cache hit)
    const start2 = performance.now();
    const files2 = await FileDiscovery.discoverFiles(testProject.root, patterns);
    const duration2 = performance.now() - start2;

    // Cached run should be significantly faster
    expect(duration2).toBeLessThan(duration1 * 0.8); // At least 20% improvement
    expect(files1).toEqual(files2); // Results should be identical
  });
});
```

**Integration Test Categories:**
- Complete CLI workflows with various pattern combinations
- Realistic project structures (monorepo, libraries, apps)
- Performance tests with large file counts
- Error handling and recovery scenarios
- Cross-platform compatibility tests

**Acceptance Criteria:**
- [ ] CLI integration tests cover all major pattern use cases
- [ ] Monorepo scenarios tested with complex nested patterns
- [ ] Generated index files validated for correctness with patterns
- [ ] Update command integration tested with pattern filtering
- [ ] Performance tests verify acceptable speed with large projects
- [ ] Error scenarios produce helpful user-facing messages
- [ ] All integration tests run reliably in CI environment

### Task 3.3: Add Performance Benchmarking
**Description**: Create performance benchmarks and monitoring for pattern operations
**Size**: Medium  
**Priority**: Medium  
**Dependencies**: Task 3.1, Task 3.2  
**Can run parallel with**: Task 3.4

**Technical Requirements:**
- Benchmark pattern matching performance vs baseline
- Monitor memory usage during large pattern operations
- Create performance regression tests
- Document performance characteristics and limits
- Compare cached vs non-cached performance

**Implementation Steps:**

1. **Create benchmark test suite:**
```typescript
// tests/benchmarks/pattern-performance.bench.ts
import { describe, bench, expect } from 'vitest';
import { FileDiscovery } from '../../src/core/file-discovery.js';
import { patternCache } from '../../src/utils/pattern-cache.js';
import { performance } from 'perf_hooks';

describe('Pattern Performance Benchmarks', () => {
  const testSizes = [100, 500, 1000, 2500] as const;
  
  testSizes.forEach(size => {
    describe(`${size} files`, () => {
      let testProject: MockProject;
      
      beforeEach(async () => {
        testProject = await createBenchmarkProject(size);
      });

      bench('baseline file discovery (no patterns)', async () => {
        await FileDiscovery.discoverFiles(testProject.root);
      });

      bench('simple include pattern', async () => {
        await FileDiscovery.discoverFiles(testProject.root, {
          include: ['src/**']
        });
      });

      bench('complex include patterns', async () => {
        await FileDiscovery.discoverFiles(testProject.root, {
          include: ['src/**', 'packages/*/src/**', 'libs/**']
        });
      });

      bench('include + exclude patterns', async () => {
        await FileDiscovery.discoverFiles(testProject.root, {
          include: ['**/*'],
          exclude: ['**/*.test.ts', '**/*.spec.ts', '**/fixtures/**']
        });
      });

      bench('cached pattern execution (2nd run)', async () => {
        const patterns = {
          include: ['src/**', 'lib/**'],
          exclude: ['**/*.test.ts']
        };
        
        // Prime cache
        await FileDiscovery.discoverFiles(testProject.root, patterns);
        
        // Benchmark cached execution
        await FileDiscovery.discoverFiles(testProject.root, patterns);
      });
    });
  });

  describe('Memory Usage Benchmarks', () => {
    it('should track memory usage for large pattern operations', async () => {
      // Purpose: Monitor memory consumption during pattern processing
      // Can fail if: memory usage grows unexpectedly or leaks occur
      
      const largeProject = await createBenchmarkProject(5000);
      const initialMemory = process.memoryUsage();
      
      const patterns = {
        include: ['**/*'],
        exclude: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**']
      };
      
      const files = await FileDiscovery.discoverFiles(largeProject.root, patterns);
      const finalMemory = process.memoryUsage();
      
      const memoryDelta = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryPerFile = memoryDelta / files.length;
      
      // Memory usage should be reasonable
      expect(memoryPerFile).toBeLessThan(1024); // < 1KB per file
      expect(memoryDelta).toBeLessThan(50 * 1024 * 1024); // < 50MB total
      
      console.log(`Memory usage: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB for ${files.length} files`);
      console.log(`Per file: ${memoryPerFile.toFixed(0)} bytes`);
    });
  });

  describe('Cache Performance', () => {
    it('should demonstrate cache effectiveness', async () => {
      // Purpose: Verify caching provides measurable performance benefits
      // Can fail if: cache doesn't work or benefits aren't significant
      
      const testProject = await createBenchmarkProject(1000);
      const complexPatterns = {
        include: [
          'src/**/*.ts',
          'lib/**/*.tsx', 
          'packages/*/src/**/*.ts',
          'apps/*/src/**/*.tsx'
        ],
        exclude: [
          '**/*.test.ts',
          '**/*.spec.ts',
          '**/*.d.ts',
          '**/fixtures/**',
          '**/__tests__/**'
        ]
      };

      // Clear cache to start fresh
      patternCache.clearCache();
      
      // First run (cache miss)
      const start1 = performance.now();
      const files1 = await FileDiscovery.discoverFiles(testProject.root, complexPatterns);
      const uncachedTime = performance.now() - start1;
      
      // Second run (cache hit)
      const start2 = performance.now();
      const files2 = await FileDiscovery.discoverFiles(testProject.root, complexPatterns);
      const cachedTime = performance.now() - start2;
      
      // Verify cache effectiveness
      const speedup = uncachedTime / cachedTime;
      const cacheStats = patternCache.getCacheStats();
      
      console.log(`Uncached: ${uncachedTime.toFixed(2)}ms`);
      console.log(`Cached: ${cachedTime.toFixed(2)}ms`);
      console.log(`Speedup: ${speedup.toFixed(2)}x`);
      console.log(`Cache stats:`, cacheStats);
      
      expect(speedup).toBeGreaterThan(1.5); // At least 50% faster
      expect(files1).toEqual(files2); // Results identical
      expect(cacheStats.globCache.hits).toBeGreaterThan(0);
    });
  });

  describe('Pattern Complexity Impact', () => {
    const complexityLevels = [
      { name: 'simple', patterns: ['src/**'] },
      { name: 'medium', patterns: ['src/**', 'lib/**', '**/*.test.ts'] },
      { name: 'complex', patterns: [
        'packages/*/src/**/*.{ts,tsx}',
        'apps/*/src/**/*.{ts,tsx}',
        'libs/**/src/**/*.{ts,tsx}'
      ]},
      { name: 'very_complex', patterns: [
        'packages/{api,ui,shared}/src/**/*.{ts,tsx}',
        'apps/{web,admin,mobile}/src/**/*.{ts,tsx,js,jsx}',
        'libs/**/src/**/*.{ts,tsx}',
        'tools/**/src/**/*.{ts,js}'
      ]}
    ];

    complexityLevels.forEach(level => {
      bench(`${level.name} patterns`, async () => {
        const testProject = await createBenchmarkProject(500);
        await FileDiscovery.discoverFiles(testProject.root, {
          include: level.patterns
        });
      });
    });
  });
});

// Benchmark utilities
interface MockProject {
  root: string;
  fileCount: number;
  structure: Record<string, string>;
}

async function createBenchmarkProject(fileCount: number): Promise<MockProject> {
  // Create realistic project structure for benchmarking
  const structure: Record<string, string> = {};
  const directories = ['src', 'lib', 'packages/api/src', 'packages/ui/src', 'apps/web/src'];
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  
  for (let i = 0; i < fileCount; i++) {
    const dir = directories[i % directories.length];
    const ext = extensions[i % extensions.length];
    const isTest = i % 10 === 0; // 10% test files
    const filename = `file${i}${isTest ? '.test' : ''}${ext}`;
    
    structure[`${dir}/${filename}`] = `// File ${i}\nexport const value${i} = ${i};`;
  }
  
  return {
    root: await createMockFileSystem(structure),
    fileCount,
    structure
  };
}
```

2. **Performance monitoring integration:**
```typescript
// src/utils/performance-monitor.ts
export interface PerformanceMetrics {
  operation: string;
  duration: number;
  fileCount: number;
  patternCount: number;
  cacheHitRate: number;
  memoryUsage: {
    before: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
    delta: number;
  };
}

export class PerformanceMonitor {
  private static metrics: PerformanceMetrics[] = [];
  
  static async measureOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    context: { fileCount?: number; patternCount?: number } = {}
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    const memoryBefore = process.memoryUsage();
    const startTime = performance.now();
    
    const result = await fn();
    
    const endTime = performance.now();
    const memoryAfter = process.memoryUsage();
    
    const cacheStats = patternCache.getCacheStats();
    const cacheHitRate = (cacheStats.globCache.hits + cacheStats.ignoreCache.hits) / 
      Math.max((cacheStats.globCache.hits + cacheStats.globCache.misses + 
                cacheStats.ignoreCache.hits + cacheStats.ignoreCache.misses), 1);
    
    const metrics: PerformanceMetrics = {
      operation,
      duration: endTime - startTime,
      fileCount: context.fileCount || 0,
      patternCount: context.patternCount || 0,
      cacheHitRate,
      memoryUsage: {
        before: memoryBefore,
        after: memoryAfter,
        delta: memoryAfter.heapUsed - memoryBefore.heapUsed
      }
    };
    
    this.metrics.push(metrics);
    return { result, metrics };
  }
  
  static getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }
  
  static clearMetrics(): void {
    this.metrics = [];
  }
  
  static printSummary(): void {
    if (this.metrics.length === 0) return;
    
    console.log('\n📊 Performance Summary:');
    this.metrics.forEach(metric => {
      const throughput = metric.fileCount > 0 ? 
        (metric.fileCount / metric.duration * 1000).toFixed(0) : 'N/A';
      
      console.log(`   ${metric.operation}:`);
      console.log(`     Duration: ${metric.duration.toFixed(2)}ms`);
      console.log(`     Files: ${metric.fileCount}`);
      console.log(`     Throughput: ${throughput} files/sec`);
      console.log(`     Cache hit rate: ${(metric.cacheHitRate * 100).toFixed(1)}%`);
      console.log(`     Memory delta: ${(metric.memoryUsage.delta / 1024).toFixed(1)}KB`);
    });
  }
}
```

3. **CLI performance reporting:**
```typescript
// Integrate performance monitoring into CLI commands
.action(async (options) => {
  // ... existing setup ...
  
  const { result: index, metrics } = await PerformanceMonitor.measureOperation(
    'pattern_scan',
    async () => {
      const indexer = new CodeIndexer(root, filterOptions);
      return await indexer.processProject(verbose ? progressCallback : undefined);
    },
    {
      fileCount: index?.metadata.totalFiles || 0,
      patternCount: (filterOptions.include?.length || 0) + (filterOptions.exclude?.length || 0)
    }
  );
  
  // Show performance info in verbose mode
  if (verbose) {
    console.log(`\n⚡ Performance: ${metrics.duration.toFixed(2)}ms`);
    console.log(`   Cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`);
    console.log(`   Memory used: ${(metrics.memoryUsage.delta / 1024).toFixed(1)}KB`);
    
    if (metrics.fileCount > 0) {
      const throughput = (metrics.fileCount / metrics.duration * 1000).toFixed(0);
      console.log(`   Throughput: ${throughput} files/sec`);
    }
  }
  
  // ... rest of scan logic ...
});
```

**Performance Targets (from spec):**
- Small projects (<100 files): Pattern overhead <10ms
- Medium projects (<1000 files): Pattern overhead <100ms
- Large projects (<10000 files): Pattern overhead <500ms
- Cache hit rate >80% for repeated operations
- Memory usage <1KB per file processed

**Acceptance Criteria:**
- [ ] Benchmark suite covers all major pattern operation types
- [ ] Performance targets from specification are met and monitored
- [ ] Memory usage tracking prevents memory leaks
- [ ] Cache effectiveness demonstrated with measurable speedups
- [ ] Performance regression detection in CI/CD pipeline
- [ ] Detailed performance metrics available in verbose mode

### Task 3.4: Create Comprehensive Documentation
**Description**: Write complete user and developer documentation for pattern features
**Size**: Large  
**Priority**: Medium  
**Dependencies**: All previous tasks  
**Can run parallel with**: Task 3.3, Task 3.5

**Technical Requirements:**
- Update README with pattern usage examples  
- Create detailed pattern guide documentation
- Add API documentation for new methods and interfaces
- Include troubleshooting guide for common pattern issues
- Document performance characteristics and optimization tips

**Implementation Steps:**

1. **Update main README with pattern examples:**
```markdown
<!-- Add to README.md -->
## Pattern Support

Control which files are analyzed using glob patterns:

### Include specific directories
```bash
codebase-map scan --include "src/**" --include "lib/**"
```

### Exclude test files
```bash  
codebase-map scan --exclude "**/*.test.ts" --exclude "**/*.spec.ts"
```

### Complex monorepo filtering
```bash
codebase-map scan \
  --include "packages/*/src/**" \
  --exclude "**/*.test.ts" \
  --exclude "**/fixtures/**"
```

### Common Use Cases

#### Focus on Source Code Only
```bash
# Include only source directories, exclude tests and documentation
codebase-map scan \
  --include "src/**" \
  --include "lib/**" \
  --exclude "**/*.test.*" \
  --exclude "**/*.spec.*" \
  --exclude "**/docs/**"
```

#### Analyze Specific Package in Monorepo
```bash
# Focus on a single package in a monorepo
codebase-map scan \
  --include "packages/api/src/**" \
  --exclude "**/*.test.ts" \
  --root ./monorepo
```

#### Library Development Focus
```bash
# Analyze only public API files
codebase-map scan \
  --include "src/**/*.ts" \
  --exclude "src/**/*.internal.ts" \
  --exclude "src/**/*.test.ts"
```

## Pattern Syntax

The tool uses standard glob patterns:

- `**` - Match any number of directories
- `*` - Match any number of characters except `/`
- `?` - Match single character except `/`
- `[abc]` - Match any character in brackets
- `{a,b}` - Match any of the comma-separated patterns

### Examples
- `src/**` - All files in src directory and subdirectories
- `**/*.test.ts` - All TypeScript test files
- `packages/*/src/**` - Source files in all packages
- `src/{utils,helpers}/**` - Files in utils or helpers directories
- `**/*.{ts,tsx}` - All TypeScript files (ts and tsx)

## Performance Tips

- Use specific include patterns instead of broad exclude patterns
- Pattern caching improves performance for repeated operations
- Consider file count when designing patterns for large codebases
- Use `--verbose` to see pattern matching details and performance metrics
```

2. **Create detailed pattern guide:**
```markdown
<!-- docs/patterns.md -->
# Pattern Guide

This guide covers advanced pattern usage, performance optimization, and troubleshooting for the codebase-map tool.

## Table of Contents
- [Basic Pattern Usage](#basic-pattern-usage)
- [Advanced Patterns](#advanced-patterns)  
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Basic Pattern Usage

### Include Patterns (`--include`)

Include patterns determine which files are candidates for analysis. If no include patterns are specified, all supported file types are included by default.

```bash
# Single include pattern
codebase-map scan --include "src/**"

# Multiple include patterns (OR logic)
codebase-map scan --include "src/**" --include "lib/**" --include "tools/**"
```

### Exclude Patterns (`--exclude`)

Exclude patterns filter out files from the included set. They are applied after include patterns but before gitignore rules.

```bash
# Exclude test files
codebase-map scan --exclude "**/*.test.ts"

# Multiple exclude patterns
codebase-map scan --exclude "**/*.test.ts" --exclude "**/*.spec.ts" --exclude "**/fixtures/**"
```

### Pattern Precedence

Patterns are applied in this order:
1. **Include patterns** - Determine candidate files
2. **Exclude patterns** - Filter out unwanted files  
3. **Gitignore rules** - Apply version control ignore rules
4. **File type filtering** - Ensure only supported extensions

## Advanced Patterns

### Monorepo Patterns

```bash
# All source files in all packages
codebase-map scan --include "packages/*/src/**"

# Specific packages only
codebase-map scan --include "packages/{api,ui,shared}/src/**"

# Different patterns for apps vs packages
codebase-map scan \
  --include "packages/*/src/**" \
  --include "apps/*/src/**" \
  --exclude "**/*.test.*"
```

### Library Development

```bash
# Public API surface only
codebase-map scan \
  --include "src/**" \
  --exclude "src/**/*.internal.*" \
  --exclude "src/**/*.private.*" \
  --exclude "src/**/test-utils/**"

# Include type definitions
codebase-map scan \
  --include "src/**/*.ts" \
  --include "types/**/*.d.ts" \
  --exclude "**/*.test.*"
```

### Framework-Specific Patterns

#### React Projects
```bash
# Components and hooks only
codebase-map scan \
  --include "src/components/**" \
  --include "src/hooks/**" \
  --exclude "**/*.test.*" \
  --exclude "**/*.stories.*"
```

#### Next.js Projects  
```bash
# App directory and components
codebase-map scan \
  --include "app/**" \
  --include "components/**" \
  --include "lib/**" \
  --exclude "**/layout.*" \
  --exclude "**/page.*"
```

## Performance Optimization

### Pattern Efficiency

**✅ Good Patterns:**
```bash
# Specific and targeted
codebase-map scan --include "src/components/**" --include "src/hooks/**"

# Clear exclusions
codebase-map scan --exclude "**/*.test.ts"
```

**❌ Inefficient Patterns:**
```bash
# Overly broad include with many exclusions
codebase-map scan --include "**/*" --exclude "build/**" --exclude "dist/**" --exclude "node_modules/**"
```

### Caching Benefits

Pattern caching provides significant performance benefits for repeated operations:

- First scan: Patterns compiled and cached
- Subsequent scans: Pre-compiled patterns reused
- Update operations: Existing cache entries used
- Cache hit rates >80% typical for repeated patterns

Monitor cache performance with `--verbose`:
```bash
codebase-map scan --include "src/**" --verbose
# Output includes: Cache hit rate: 85.2%
```

### Large Project Strategies

For codebases with >1000 files:

1. **Use specific include patterns**:
   ```bash
   codebase-map scan --include "packages/core/src/**" --include "packages/api/src/**"
   ```

2. **Avoid broad exclusions**:
   ```bash
   # Instead of excluding many directories
   codebase-map scan --exclude "test/**" --exclude "docs/**" --exclude "examples/**"
   
   # Use targeted includes
   codebase-map scan --include "src/**" --include "lib/**"
   ```

3. **Enable verbose monitoring**:
   ```bash
   codebase-map scan --include "src/**" --verbose
   # Monitor: Performance: 245.67ms, Throughput: 156 files/sec
   ```

## Troubleshooting

### Common Issues

#### No Files Matched
```
⚠️  Warning: Include patterns matched 0 files
```

**Causes:**
- Pattern syntax errors
- Non-existent directories
- Case sensitivity issues
- File extensions not supported

**Solutions:**
- Verify directories exist: `ls -la src/`
- Check pattern syntax: Use `--verbose` for details
- Test patterns: `ls src/**/*.ts` (if using bash)
- Review supported extensions: `.ts`, `.tsx`, `.js`, `.jsx`

#### All Files Excluded
```
⚠️  Warning: All included files were excluded by exclude patterns
```

**Causes:**
- Conflicting include/exclude patterns
- Overly broad exclude patterns

**Solutions:**
- Review pattern overlap: `--verbose` shows exclusion reasons
- Make exclude patterns more specific
- Adjust include patterns to be more targeted

#### Performance Issues
```
⚡ Performance: 2547.32ms, Cache hit rate: 12.3%
```

**Causes:**
- Complex patterns with many alternations
- Low cache hit rates
- Very large file counts

**Solutions:**
- Simplify patterns where possible
- Use include patterns instead of broad excludes
- Consider analyzing subset of codebase
- Monitor memory usage in verbose mode

### Pattern Syntax Errors

#### Invalid Bracket Patterns
```bash
# ❌ Invalid
codebase-map scan --include "src/[invalid"

# ✅ Correct
codebase-map scan --include "src/[abc]*"
```

#### Directory Traversal Blocked
```bash
# ❌ Security violation
codebase-map scan --include "../../../etc/passwd"

# ✅ Relative to project
codebase-map scan --include "src/**"
```

### Debugging Patterns

Use verbose mode to understand pattern behavior:

```bash
codebase-map scan --include "src/**" --exclude "**/*.test.ts" --verbose
```

Output includes:
- Pattern configuration summary
- File-by-file matching decisions
- Performance metrics
- Cache statistics
- Sample included/excluded files with reasons

## Best Practices

### 1. Start Simple
Begin with basic patterns and add complexity as needed:
```bash
# Start here
codebase-map scan --include "src/**"

# Then refine
codebase-map scan --include "src/**" --exclude "**/*.test.ts"

# Finally optimize
codebase-map scan --include "src/{components,hooks,utils}/**" --exclude "**/*.test.ts"
```

### 2. Use Include Over Exclude
Prefer specific include patterns over broad exclude patterns:
```bash
# ✅ Better
codebase-map scan --include "src/**" --include "lib/**"

# ❌ Less efficient  
codebase-map scan --exclude "docs/**" --exclude "test/**" --exclude "build/**"
```

### 3. Test Patterns Incrementally
Build complex patterns step by step:
```bash
# Test base pattern
codebase-map scan --include "packages/*/src/**" --verbose

# Add exclusions
codebase-map scan --include "packages/*/src/**" --exclude "**/*.test.ts" --verbose

# Refine further
codebase-map scan --include "packages/{api,ui}/src/**" --exclude "**/*.test.ts" --verbose
```

### 4. Document Project Patterns
Create npm scripts for common pattern combinations:
```json
{
  "scripts": {
    "map:src": "codebase-map scan --include 'src/**' --exclude '**/*.test.ts'",
    "map:packages": "codebase-map scan --include 'packages/*/src/**' --exclude '**/*.test.*'",
    "map:public": "codebase-map scan --include 'src/**' --exclude 'src/**/*.internal.*'"
  }
}
```

### 5. Monitor Performance
Use verbose output to optimize patterns for your codebase:
- Target >80% cache hit rate for repeated operations
- Aim for <100ms overhead on pattern processing
- Monitor memory usage with very large codebases

### 6. Version Control Integration
Add pattern-filtered index files to your development workflow:
```bash
# Generate focused maps for different purposes
codebase-map scan --include "src/**" --output .codebasemap-src
codebase-map scan --include "tests/**" --output .codebasemap-tests

# Add to .gitignore
echo ".codebasemap*" >> .gitignore
```
```

3. **API documentation updates:**
```typescript
// Add comprehensive JSDoc comments to all new public methods

/**
 * Discovers files in a project directory with optional pattern filtering.
 * 
 * @param rootPath - Absolute or relative path to project root
 * @param filterOptions - Optional include/exclude patterns
 * @param filterOptions.include - Glob patterns for files to include (OR logic)
 * @param filterOptions.exclude - Glob patterns for files to exclude 
 * @returns Promise resolving to array of relative file paths
 * 
 * @example
 * ```typescript
 * // Include only source files
 * const files = await FileDiscovery.discoverFiles('/project', {
 *   include: ['src/**', 'lib/**']
 * });
 * 
 * // Exclude test files
 * const files = await FileDiscovery.discoverFiles('/project', {
 *   exclude: ['**/*.test.ts', '**/*.spec.ts']
 * });
 * 
 * // Combine include and exclude
 * const files = await FileDiscovery.discoverFiles('/project', {
 *   include: ['src/**'],
 *   exclude: ['**/*.test.ts']
 * });
 * ```
 * 
 * @throws {PatternValidationError} When patterns contain invalid glob syntax
 * @throws {SecurityViolationError} When patterns attempt directory traversal
 * @throws {FileSystemError} When root directory doesn't exist or isn't accessible
 */
static async discoverFiles(
  rootPath: string, 
  filterOptions: FilterOptions = {}
): Promise<string[]>

/**
 * Validates an individual glob pattern for syntax and security.
 * 
 * @param pattern - Glob pattern to validate
 * @throws {PatternValidationError} When pattern is invalid or unsafe
 * 
 * @example
 * ```typescript
 * validateGlobPattern('src/**'); // OK
 * validateGlobPattern('../../../etc/passwd'); // Throws SecurityViolationError
 * validateGlobPattern('src/[invalid'); // Throws PatternValidationError
 * ```
 */
export function validateGlobPattern(pattern: string): void

/**
 * Options for controlling file discovery with include/exclude patterns.
 * 
 * @example
 * ```typescript
 * const options: FilterOptions = {
 *   include: ['src/**', 'lib/**'],
 *   exclude: ['**/*.test.ts']
 * };
 * ```
 */
export interface FilterOptions {
  /** 
   * Glob patterns for files to include. If empty, all supported files included.
   * Multiple patterns use OR logic - files matching any pattern are included.
   */
  include?: string[];
  
  /** 
   * Glob patterns for files to exclude from the included set.
   * Applied after include patterns but before gitignore rules.
   */
  exclude?: string[];
}
```

4. **CLI help enhancements:**
```typescript
// Enhanced help text with comprehensive examples
program
  .addHelpText('after', `
Pattern Syntax:
  **          Match any number of directories
  *           Match any number of characters except /
  ?           Match single character except /
  [abc]       Match any character in brackets
  {a,b}       Match any of the comma-separated patterns

Common Examples:
  # Focus on source code
  $ codebase-map scan --include "src/**" --exclude "**/*.test.ts"
  
  # Monorepo package analysis
  $ codebase-map scan --include "packages/api/src/**"
  
  # Multiple source directories
  $ codebase-map scan --include "src/**" --include "lib/**" --include "tools/**"
  
  # Exclude test and fixture files
  $ codebase-map scan --exclude "**/*.test.*" --exclude "**/*.spec.*" --exclude "**/fixtures/**"
  
  # Complex monorepo filtering
  $ codebase-map scan --include "packages/*/src/**" --exclude "**/*.test.*"

Performance Tips:
  • Use specific include patterns instead of broad exclude patterns
  • Pattern caching improves repeated scan performance
  • Use --verbose to see pattern matching details and cache statistics
  • Consider analyzing subsets of very large codebases

Pattern Precedence:
  1. Include patterns determine candidate files
  2. Exclude patterns filter the included set
  3. .gitignore rules apply to the remaining files
  4. Only supported file types (.ts, .tsx, .js, .jsx) are included

For detailed documentation, see: docs/patterns.md
`);
```

**Documentation Categories:**
- User guide with examples and common use cases
- API reference with comprehensive JSDoc comments  
- Performance guide with optimization tips
- Troubleshooting guide for common issues
- Best practices and pattern design guidelines

**Acceptance Criteria:**
- [ ] README updated with clear pattern usage examples
- [ ] Comprehensive pattern guide created in docs/patterns.md
- [ ] All new public methods have complete JSDoc documentation
- [ ] CLI help text includes syntax reference and examples
- [ ] Troubleshooting guide covers common pattern issues
- [ ] Performance optimization tips documented with benchmarks
- [ ] Documentation tested with real user scenarios

### Task 3.5: Add Migration Guide for Breaking Changes
**Description**: Create migration documentation for users upgrading from version without pattern support
**Size**: Small  
**Priority**: Low  
**Dependencies**: All other tasks  
**Can run parallel with**: Task 3.4

**Technical Requirements:**
- Document any breaking changes in pattern functionality
- Provide migration examples for common use cases
- Create upgrade checklist for existing users
- Document new behavior and backward compatibility

**Implementation Steps:**

1. **Create migration guide:**
```markdown
<!-- docs/migration-patterns.md -->
# Migration Guide: Pattern Support

This guide helps users migrate to pattern-enabled versions of codebase-map and understand any behavior changes.

## Version Compatibility

- **Pattern support added in**: v0.4.0
- **Backward compatibility**: Full - existing behavior preserved
- **Breaking changes**: None for existing users

## New Features Overview

### Before (v0.3.x and earlier)
```bash
# Only basic scanning available
codebase-map scan

# Limited control over file selection
# Relied entirely on .gitignore and hardcoded exclusions
```

### After (v0.4.0+)
```bash
# All previous functionality still works
codebase-map scan

# Plus new pattern options
codebase-map scan --include "src/**" --exclude "**/*.test.ts"
```

## Migration Scenarios

### No Action Required

Most users can upgrade without any changes:

```bash
# These commands work identically in both versions
codebase-map scan
codebase-map scan --root ./my-project
codebase-map scan --output custom-index.json --verbose
```

### Recommended Upgrades

Consider using patterns if you previously:

#### Manually Filtered Output
```bash
# Before: Generated full index, then manually filtered
codebase-map scan
# ... then manually excluded test files from analysis

# After: Use patterns for cleaner output
codebase-map scan --exclude "**/*.test.ts" --exclude "**/*.spec.ts"
```

#### Used Temporary Directories
```bash
# Before: Created temporary directories to limit scope
mkdir temp-src && cp -r src/* temp-src/
cd temp-src && codebase-map scan
cd .. && rm -rf temp-src

# After: Use include patterns
codebase-map scan --include "src/**"
```

#### Multiple Manual Runs
```bash
# Before: Multiple separate runs for different parts
codebase-map scan --root packages/api --output api-index.json
codebase-map scan --root packages/ui --output ui-index.json

# After: Single run with patterns
codebase-map scan --include "packages/*/src/**" --output combined-index.json
```

## Configuration Migration

### NPM Scripts
Update package.json scripts to use new pattern options:

```json
{
  "scripts": {
    "map": "codebase-map scan",
    "map:src": "codebase-map scan --include 'src/**'",
    "map:packages": "codebase-map scan --include 'packages/*/src/**'",
    "map:no-tests": "codebase-map scan --exclude '**/*.test.*'"
  }
}
```

### CI/CD Integration
Enhance build scripts with targeted analysis:

```yaml
# .github/workflows/analyze.yml
- name: Generate codebase map
  run: |
    # Before: Full analysis (slower, more noise)
    codebase-map scan --output analysis/full-map.json
    
    # After: Focused analysis (faster, cleaner)
    codebase-map scan \
      --include "src/**" \
      --include "lib/**" \
      --exclude "**/*.test.*" \
      --output analysis/source-map.json
```

## Behavior Changes

### File Discovery
No changes to default file discovery behavior:
- Same supported file extensions (`.ts`, `.tsx`, `.js`, `.jsx`)
- Same directory exclusions (`node_modules`, `dist`, etc.)
- Same `.gitignore` integration

### Performance Impact
Pattern support adds minimal overhead:
- No patterns: Identical performance to previous versions
- Simple patterns: <5ms overhead typically
- Complex patterns: Pattern caching minimizes impact

### Error Handling
Enhanced error messages for invalid patterns:
```bash
# New helpful error messages
$ codebase-map scan --include "src/[invalid"
❌ Invalid include pattern: "src/[invalid" - Invalid glob syntax
💡 Suggestions:
   • Check glob pattern syntax: https://github.com/mrmlnc/fast-glob#pattern-syntax
   • Verify file paths exist in your project
```

## Testing Migration

Verify your upgrade works correctly:

1. **Test default behavior**:
   ```bash
   # Should produce identical results to previous version
   codebase-map scan
   ```

2. **Test with your existing scripts**:
   ```bash
   # All existing npm scripts should work unchanged
   npm run your-existing-map-script
   ```

3. **Try new pattern features**:
   ```bash
   # Experiment with patterns for your project
   codebase-map scan --include "src/**" --verbose
   ```

## Troubleshooting

### Index File Differences
If new indexes differ from previous versions:

1. **Check pattern effect**:
   ```bash
   codebase-map scan --verbose
   # Look for "Pattern Matching Details" section
   ```

2. **Compare file lists**:
   ```bash
   # Extract file lists for comparison
   jq '.files[].path' old-index.json > old-files.txt
   jq '.files[].path' new-index.json > new-files.txt
   diff old-files.txt new-files.txt
   ```

3. **Verify expected behavior**:
   - Patterns should only affect file selection
   - File analysis and dependency resolution unchanged
   - Index format remains compatible

### Performance Differences
If you notice performance changes:

1. **Measure baseline**:
   ```bash
   time codebase-map scan  # Should match previous version performance
   ```

2. **Monitor pattern overhead**:
   ```bash
   codebase-map scan --include "**/*" --verbose
   # Check "Performance" section in output
   ```

3. **Optimize patterns**:
   - Use specific includes instead of broad excludes
   - Monitor cache hit rates in verbose output

## Getting Help

If you encounter issues during migration:

1. **Check verbose output**:
   ```bash
   codebase-map scan --verbose
   ```

2. **Review pattern guide**:
   See `docs/patterns.md` for detailed pattern documentation

3. **File issues**:
   Report problems at: https://github.com/carlrannaberg/codebase-map/issues
   Include:
   - Previous version used
   - Current version
   - Command that worked before
   - Current behavior vs expected behavior

## Rollback Instructions

If needed, rollback to previous version:

```bash
npm install codebase-map@0.3.0
```

Previous versions remain fully supported and will continue receiving security updates.
```

2. **Add migration notes to CHANGELOG:**
```markdown
<!-- CHANGELOG.md addition -->
## [0.4.0] - 2025-08-17

### Added
- **Pattern Support**: New `--include` and `--exclude` CLI options for precise file selection
- Glob pattern matching using industry-standard syntax
- Pattern validation with security checks
- Performance optimization with pattern caching
- Comprehensive pattern documentation and troubleshooting guide

### Changed
- Enhanced CLI help with pattern examples
- Improved verbose output with pattern matching details
- Performance monitoring for pattern operations

### Migration Notes
- **No breaking changes**: All existing functionality preserved
- **Backward compatible**: Existing commands work identically
- **New features**: Optional pattern support enhances existing workflow
- See `docs/migration-patterns.md` for detailed migration guide
```

3. **Update README with migration notice:**
```markdown
<!-- Add to README.md -->
## Upgrading

### From v0.3.x to v0.4.x (Pattern Support)

Pattern support is fully backward compatible - existing commands work identically.

```bash
# Existing usage continues to work
codebase-map scan                    # Same as before
codebase-map scan --root ./project  # Same as before

# New pattern options available
codebase-map scan --include "src/**"              # New feature
codebase-map scan --exclude "**/*.test.ts"        # New feature
```

For detailed migration guidance, see [Migration Guide](docs/migration-patterns.md).
```

**Migration Documentation Requirements:**
- Clear explanation of backward compatibility
- Examples showing before/after usage patterns
- Troubleshooting for common migration issues
- Performance impact documentation
- Rollback instructions if needed

**Acceptance Criteria:**
- [ ] Migration guide covers all potential user scenarios
- [ ] Backward compatibility clearly documented and tested
- [ ] CHANGELOG updated with migration notes
- [ ] README includes upgrade guidance
- [ ] No breaking changes for existing users
- [ ] Migration path clear for users wanting new pattern features
- [ ] Rollback instructions provided as safety net