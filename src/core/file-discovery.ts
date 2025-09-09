/**
 * @fileoverview File discovery and filtering with pattern support
 * 
 * Provides file discovery capabilities with include/exclude pattern filtering,
 * gitignore integration, performance optimization through caching, and
 * comprehensive pattern analysis and validation.
 * 
 * @example
 * ```typescript
 * // Basic file discovery
 * const files = await FileDiscovery.discoverFiles('/path/to/project');
 * 
 * // With include/exclude patterns
 * const filteredFiles = await FileDiscovery.discoverFiles('/path/to/project', {
 *   include: ['src/**'],
 *   exclude: ['**\/*.test.ts']
 * });
 * 
 * // With verbose logging
 * const verboseFiles = await FileDiscovery.discoverFilesWithVerbose(
 *   '/path/to/project',
 *   { include: ['src/**'] },
 *   true
 * );
 * ```
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import fastGlob from 'fast-glob';
import ignore from 'ignore';
import type { FilterOptions } from '../types/index.js';
import { validatePatternArray } from '../utils/pattern-validation.js';
import { 
  wrapUnknownError, 
  createPatternConflictFromAnalysis
} from '../utils/pattern-errors.js';
import type { PatternWarning } from '../utils/pattern-analysis.js';
import { 
  getGlobalPatternLogger, 
  type PatternMatchInfo, 
  type PatternConfiguration 
} from '../utils/index.js';
import { getGlobalPatternCache } from '../utils/pattern-cache.js';

export class FileDiscovery {
  private static readonly SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
  private static readonly EXCLUDED_DIRS = [
    'node_modules',
    'dist',
    'build',
    '.next',
    '.turbo',
    '.git',
    'coverage',
    '.nyc_output'
  ];

  /**
   * Validate filter options patterns
   * @private
   */
  private static validateFilterOptions(options: FilterOptions): void {
    if (options.include !== undefined) {
      validatePatternArray(options.include, 'include');
    }
    if (options.exclude !== undefined) {
      validatePatternArray(options.exclude, 'exclude');
    }
  }

  /**
   * Discover all TypeScript/JavaScript files in the project with analysis
   * 
   * @param rootPath - Root directory to scan (absolute or relative path)
   * @param options - Optional filtering options with include/exclude patterns
   * @param options.include - Array of glob patterns to include files (OR logic)
   * @param options.exclude - Array of glob patterns to exclude files (OR logic)
   * @returns Promise resolving to object containing file paths and pattern analysis
   * 
   * @example
   * ```typescript
   * const { files, analysis } = await FileDiscovery.discoverFilesWithAnalysis('/project', {
   *   include: ['src/**'],
   *   exclude: ['**\/*.test.ts']
   * });
   * 
   * console.log(`Found ${files.length} files`);
   * console.log(`Warnings: ${analysis.warnings.length}`);
   * ```
   * 
   * @throws {InvalidPatternSyntaxError} When glob patterns are malformed
   * @throws {SecurityViolationError} When patterns contain dangerous sequences
   * @throws {PatternConflictError} When patterns result in no files
   */
  static async discoverFilesWithAnalysis(
    rootPath: string, 
    options: FilterOptions = {}
  ): Promise<{ files: string[]; analysis: { warnings: PatternWarning[]; suggestions: string[]; stats: { totalCandidateFiles: number; includedFiles: number; finalFiles: number; excludedFiles: number } } }> {
    // Validate patterns upfront
    this.validateFilterOptions(options);

    const absoluteRoot = path.resolve(rootPath);
    
    // Step 1: Get all candidate files (before any filtering)
    const candidatePatterns = [
      '**/*.ts',
      '**/*.tsx', 
      '**/*.js',
      '**/*.jsx'
    ];
    
    const globOptions = {
      cwd: absoluteRoot,
      ignore: this.EXCLUDED_DIRS.map(dir => `**/${dir}/**`),
      onlyFiles: true,
      absolute: false,
      dot: false
    };

    // Load gitignore rules
    const ignoreRules = await this.loadIgnoreRules(absoluteRoot);
    
    // Get all candidate files
    const allCandidateFiles = await fastGlob(candidatePatterns, globOptions);
    const candidateFiles = allCandidateFiles.filter(file => 
      this.isSupportedFile(file) && !ignoreRules.ignores(file)
    );
    
    // Step 2: Apply include patterns if provided
    let afterIncludeFiles = candidateFiles;
    if (options.include && options.include.length > 0) {
      const normalizedInclude = this.normalizePatterns(options.include);
      const includeFiles = await fastGlob(normalizedInclude, globOptions);
      afterIncludeFiles = candidateFiles.filter(file => 
        includeFiles.includes(file) && this.isSupportedFile(file)
      );
    }
    
    // Step 3: Apply exclude patterns if provided  
    let finalFiles = afterIncludeFiles;
    if (options.exclude && options.exclude.length > 0) {
      const cache = getGlobalPatternCache();
      const ignoreInstance = cache.getIgnorePattern(options.exclude);
      finalFiles = afterIncludeFiles.filter(file => !ignoreInstance.ignores(file));
    }
    
    // Step 4: Generate warnings and suggestions
    const warnings: PatternWarning[] = [];
    const suggestions: string[] = [];
    
    // Check for common pattern issues
    if (options.include && options.include.length > 0) {
      const normalizedInclude = this.normalizePatterns(options.include);
      const originalCount = options.include.length;
      const normalizedCount = normalizedInclude.length;
      
      if (afterIncludeFiles.length === 0) {
        warnings.push({
          level: 'error',
          category: 'Pattern matching',
          message: `Include patterns don't match any files`,
          suggestion: 'Try broader patterns like "src/**" or check your directory structure',
          patterns: options.include
        });
      } else if (originalCount !== normalizedCount) {
        // Some patterns were normalized - inform user
        suggestions.push('Some directory patterns were automatically normalized (e.g., "src" → "src/**")');
      }
    }
    
    if (finalFiles.length === 0 && candidateFiles.length > 0) {
      warnings.push({
        level: 'error',
        category: 'Pattern conflict',
        message: `All ${candidateFiles.length} files were excluded by the current patterns`,
        suggestion: 'Review your include/exclude patterns to ensure they don\'t conflict'
      });
    }
    
    // Create analysis object
    const analysis = {
      warnings,
      suggestions,
      stats: {
        totalCandidateFiles: candidateFiles.length,
        includedFiles: afterIncludeFiles.length,
        finalFiles: finalFiles.length,
        excludedFiles: afterIncludeFiles.length - finalFiles.length
      }
    };
    
    // Throw error if no files found (to match existing behavior)
    if (finalFiles.length === 0) {
      throw createPatternConflictFromAnalysis(options, analysis.stats, 'discovery', absoluteRoot) ||
        new Error(`Pattern conflict: All files would be excluded by the current patterns in ${absoluteRoot}`);
    }
    
    return { files: finalFiles.sort(), analysis };
  }

  /**
   * Discover all TypeScript/JavaScript files in the project with verbose logging
   * 
   * @param rootPath - Root directory to scan (absolute or relative path)
   * @param options - Optional filtering options with include/exclude patterns
   * @param options.include - Array of glob patterns to include files
   * @param options.exclude - Array of glob patterns to exclude files
   * @param verbose - Enable detailed pattern matching logging to console
   * @returns Promise resolving to array of file paths relative to root
   * 
   * @example
   * ```typescript
   * // Enable verbose logging to see pattern evaluation details
   * const files = await FileDiscovery.discoverFilesWithVerbose('/project', {
   *   include: ['src/**'],
   *   exclude: ['**\/*.test.ts']
   * }, true);
   * 
   * // Logs will show individual file evaluation details
   * ```
   * 
   * @throws {InvalidPatternSyntaxError} When glob patterns are malformed
   * @throws {SecurityViolationError} When patterns contain dangerous sequences
   */
  static async discoverFilesWithVerbose(
    rootPath: string, 
    options: FilterOptions = {}, 
    verbose: boolean = false
  ): Promise<string[]> {
    if (!verbose) {
      return this.discoverFiles(rootPath, options);
    }

    const logger = getGlobalPatternLogger();
    const absoluteRoot = path.resolve(rootPath);
    
    // Set up logging configuration
    const config: PatternConfiguration = {
      includePatterns: options.include || [],
      excludePatterns: options.exclude || [],
      gitignorePath: path.join(absoluteRoot, '.gitignore'),
      supportedExtensions: this.SUPPORTED_EXTENSIONS,
      excludedDirectories: this.EXCLUDED_DIRS
    };
    
    logger.setConfiguration(config);
    logger.startEvaluation();

    // Validate patterns if provided
    this.validateFilterOptions(options);
    
    // Load gitignore rules
    const ignoreRules = await this.loadIgnoreRules(absoluteRoot);
    
    // Get all potential files first for individual evaluation
    const patterns = this.SUPPORTED_EXTENSIONS.map(ext => `**/*${ext}`);
    const globOptions = this.createGlobOptions(absoluteRoot);
    const allFiles = await fastGlob(patterns, globOptions);
    
    const finalFiles: string[] = [];

    // Evaluate each file individually with detailed logging
    for (const file of allFiles) {
      const startTime = performance.now();
      const matchInfo = await this.evaluateFileVerbose(file, options, ignoreRules, absoluteRoot, startTime);
      logger.logFileEvaluation(matchInfo);
      
      if (matchInfo.finalDecision === 'included') {
        finalFiles.push(file);
      }
    }

    logger.endEvaluation();
    logger.printVerboseLog();

    // Normalize and sort paths
    return finalFiles
      .map((file: string) => file.replace(/\\/g, '/'))
      .sort();
  }

  /**
   * Discover all TypeScript/JavaScript files in the project
   * 
   * Main method for file discovery with pattern filtering support. Applies include
   * patterns first, then exclude patterns, and finally gitignore rules.
   * 
   * @param rootPath - Root directory to scan (absolute or relative path)
   * @param options - Optional filtering options with include/exclude patterns
   * @param options.include - Array of glob patterns to include files (defaults to all supported files)
   * @param options.exclude - Array of glob patterns to exclude files (empty by default)
   * @returns Promise resolving to array of file paths relative to root, sorted alphabetically
   * 
   * @example
   * ```typescript
   * // Basic usage - all supported files
   * const allFiles = await FileDiscovery.discoverFiles('/project');
   * 
   * // With include patterns
   * const srcFiles = await FileDiscovery.discoverFiles('/project', {
   *   include: ['src/**\/*.ts', 'lib/**\/*.ts']
   * });
   * 
   * // With include and exclude patterns
   * const prodFiles = await FileDiscovery.discoverFiles('/project', {
   *   include: ['src/**'],
   *   exclude: ['**\/*.test.ts', '**\/*.spec.ts']
   * });
   * ```
   * 
   * @throws {InvalidPatternSyntaxError} When glob patterns are malformed
   * @throws {SecurityViolationError} When patterns contain dangerous sequences
   * @throws {PatternConflictError} When patterns result in no files being selected
   * @throws {FileSystemError} When file system operations fail
   */
  static async discoverFiles(rootPath: string, options: FilterOptions = {}): Promise<string[]> {
    try {
      const absoluteRoot = path.resolve(rootPath);
      
      // Validate patterns if provided
      this.validateFilterOptions(options);
      
      // Load gitignore rules
      const ignoreRules = await this.loadIgnoreRules(absoluteRoot);
      
      // Use fast-glob to find all potential files
      const patterns = this.SUPPORTED_EXTENSIONS.map(ext => `**/*${ext}`);
      const globOptions = this.createGlobOptions(absoluteRoot);
      
      const candidateFiles = await fastGlob(patterns, globOptions);
      let afterIncludeFiles = candidateFiles;
      let afterExcludeFiles = candidateFiles;
      
      // Apply include patterns if provided
      if (options.include && options.include.length > 0) {
        const cache = getGlobalPatternCache();
        const includePatterns = this.normalizePatterns(options.include);
        // Cache the glob pattern compilation (use a copy to preserve order)
        cache.getGlobPattern([...includePatterns], globOptions);
        const includeFiles = await fastGlob(includePatterns, globOptions);
        // Keep only supported files that match include patterns
        afterIncludeFiles = candidateFiles.filter(file => 
          includeFiles.includes(file) && this.isSupportedFile(file)
        );
      }
      
      // Apply exclude patterns if provided
      if (options.exclude && options.exclude.length > 0) {
        const cache = getGlobalPatternCache();
        const ignoreInstance = cache.getIgnorePattern(options.exclude);
        afterExcludeFiles = afterIncludeFiles.filter(file => !ignoreInstance.ignores(file));
      } else {
        afterExcludeFiles = afterIncludeFiles;
      }
      
      // Apply gitignore filtering
      const finalFiles = this.applyIgnoreRules(afterExcludeFiles, ignoreRules);
      
      // Check for pattern conflicts - only check if patterns significantly reduced file count
      if (options.include || options.exclude) {
        const stats = {
          totalCandidateFiles: candidateFiles.length,
          includedFiles: afterIncludeFiles.length,
          finalFiles: finalFiles.length,
          excludedFiles: afterIncludeFiles.length - afterExcludeFiles.length
        };
        
        // Only check for conflicts if the reduction rate is extremely low and result is problematic
        if (candidateFiles.length > 0) {
          const conflictError = createPatternConflictFromAnalysis(
            options,
            stats,
            'file discovery',
            absoluteRoot
          );
          
          // Only throw if it's a real problem (all files excluded), not just inefficient
          if (conflictError && (conflictError.code !== 'PATTERN_CONFLICT' || stats.finalFiles === 0)) {
            throw conflictError;
          }
        }
      }
      
      // Convert to POSIX paths and sort
      return finalFiles
        .map((file: string) => file.replace(/\\/g, '/'))
        .sort();
        
    } catch (error) {
      throw wrapUnknownError(error, 'file discovery', { rootPath, options });
    }
  }

  /**
   * Create standardized glob options for file discovery
   * @param absoluteRoot - Absolute root directory path
   * @returns Configured glob options object
   */
  private static createGlobOptions(absoluteRoot: string): {
    cwd: string;
    ignore: string[];
    onlyFiles: boolean;
    followSymbolicLinks: boolean;
    absolute: boolean;
    dot: boolean;
  } {
    return {
      cwd: absoluteRoot,
      ignore: this.EXCLUDED_DIRS.map(dir => `${dir}/**`),
      onlyFiles: true,
      followSymbolicLinks: false,
      absolute: false,
      dot: false
    };
  }

  /**
   * Load and parse .gitignore files
   * @param rootPath - Root directory path
   * @returns Ignore instance with loaded rules
   */
  private static async loadIgnoreRules(rootPath: string): Promise<ReturnType<typeof ignore>> {
    const ig = ignore();
    
    // Load .gitignore from root
    const gitignorePath = path.join(rootPath, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      try {
        const gitignoreContent = await fs.promises.readFile(gitignorePath, 'utf8');
        ig.add(gitignoreContent);
      } catch {
        // Silently continue if .gitignore cannot be read
      }
    }
    
    // Add default ignore patterns
    ig.add([
      // Common IDE and editor files
      '.vscode/',
      '.idea/',
      '*.swp',
      '*.swo',
      '*~',
      '.DS_Store',
      'Thumbs.db',
      
      // Logs
      '*.log',
      'logs/',
      
      // Runtime and temporary files
      '.env',
      '.env.local',
      '.env.*.local',
      'temp/',
      'tmp/',
      
      // Package manager files
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml'
    ]);
    
    return ig;
  }

  /**
   * Normalize glob patterns to ensure directory patterns work correctly
   * Converts bare directory names like "examples" to "examples/**"
   * Also converts directory paths like "src/core" to "src/core/**"
   * 
   * @param patterns - Array of glob patterns to normalize
   * @returns Normalized patterns that will match files
   */
  public static normalizePatterns(patterns: string[]): string[] {
    return patterns.map(pattern => {
      // Don't normalize patterns that already have glob characters or file extensions
      if (
        pattern.startsWith('!') || // negation patterns
        pattern.includes('*') || // already has wildcards
        pattern.includes('?') || // already has wildcards 
        pattern.includes('[') || // bracket expressions
        pattern.includes('{') || // brace expansion
        pattern.includes('.') || // has file extension (e.g., *.ts, package.json)
        pattern.endsWith('/') // already directory syntax
      ) {
        return pattern;
      }
      
      // Normalize bare directory names and directory paths without wildcards
      // This includes both 'examples' and 'src/core'
      return `${pattern}/**`;
    });
  }

  /**
   * Apply ignore rules to file list
   * @param files - Array of file paths
   * @param ignoreRules - Ignore instance with rules
   * @returns Filtered array of file paths
   */
  private static applyIgnoreRules(
    files: string[], 
    ignoreRules: ReturnType<typeof ignore>
  ): string[] {
    return files.filter(file => !ignoreRules.ignores(file));
  }

  /**
   * Check if a file has a supported extension
   * 
   * @param filePath - File path to check (absolute or relative)
   * @returns True if file has a supported extension (.ts, .tsx, .js, .jsx)
   * 
   * @example
   * ```typescript
   * FileDiscovery.isSupportedFile('src/app.ts');     // true
   * FileDiscovery.isSupportedFile('src/app.py');     // false
   * FileDiscovery.isSupportedFile('README.md');      // false
   * ```
   */
  static isSupportedFile(filePath: string): boolean {
    const ext = path.extname(filePath);
    return this.SUPPORTED_EXTENSIONS.includes(ext);
  }

  /**
   * Get supported file extensions
   * 
   * @returns Array of supported extensions: ['.ts', '.tsx', '.js', '.jsx']
   * 
   * @example
   * ```typescript
   * const extensions = FileDiscovery.getSupportedExtensions();
   * console.log(extensions); // ['.ts', '.tsx', '.js', '.jsx']
   * ```
   */
  static getSupportedExtensions(): string[] {
    return [...this.SUPPORTED_EXTENSIONS];
  }

  /**
   * Get pattern cache statistics for performance monitoring
   * 
   * @returns Object containing cache statistics with hit rates and sizes for different cache types
   * @returns returns.glob - Glob pattern cache statistics  
   * @returns returns.ignore - Ignore pattern cache statistics
   * @returns returns.combined - Combined cache statistics
   * 
   * @example
   * ```typescript
   * const stats = FileDiscovery.getPatternCacheStats();
   * console.log(`Glob cache hit rate: ${stats.glob.hitRate}%`);
   * console.log(`Cache size: ${stats.combined.size} entries`);
   * ```
   */
  static getPatternCacheStats(): { glob: { size: number; hitRate: number }; ignore: { size: number; hitRate: number }; combined: { size: number; hitRate: number } } {
    return getGlobalPatternCache().getStats();
  }

  /**
   * Clear pattern cache (useful for testing or memory management)
   * 
   * Clears all cached compiled glob and ignore patterns. This can be useful
   * for memory management in long-running processes or for testing.
   * 
   * @example
   * ```typescript
   * // Clear cache before running tests
   * beforeEach(() => {
   *   FileDiscovery.clearPatternCache();
   * });
   * 
   * // Clear cache in long-running process
   * if (memoryUsage > threshold) {
   *   FileDiscovery.clearPatternCache();
   * }
   * ```
   */
  static clearPatternCache(): void {
    getGlobalPatternCache().clear();
  }

  /**
   * Evaluate a single file against all patterns with detailed logging
   * @param filePath - File path to evaluate
   * @param options - Filtering options
   * @param ignoreRules - Gitignore rules
   * @param absoluteRoot - Absolute root path
   * @returns Detailed match information
   */
  private static async evaluateFileVerbose(
    filePath: string,
    options: FilterOptions,
    ignoreRules: ReturnType<typeof ignore>,
    absoluteRoot: string,
    startTime: number = performance.now()
  ): Promise<PatternMatchInfo> {
    const includeMatches: Array<{ pattern: string; matched: boolean; reason?: string }> = [];
    const excludeMatches: Array<{ pattern: string; matched: boolean; reason?: string }> = [];

    // Check include patterns
    let passesInclude = true;
    if (options.include && options.include.length > 0) {
      passesInclude = false;
      for (const pattern of options.include) {
        try {
          const globOptions = this.createGlobOptions(absoluteRoot);
          const matches = await fastGlob(pattern, { ...globOptions, absolute: false });
          const matched = matches.includes(filePath);
          includeMatches.push({
            pattern,
            matched,
            reason: matched ? 'Pattern matched file' : 'Pattern did not match file'
          });
          if (matched) {
            passesInclude = true;
          }
        } catch (error) {
          includeMatches.push({
            pattern,
            matched: false,
            reason: `Pattern error: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }
    } else {
      includeMatches.push({
        pattern: '*',
        matched: true,
        reason: 'No include patterns specified - all supported files included'
      });
    }

    // Check exclude patterns
    let passesExclude = true;
    if (options.exclude && options.exclude.length > 0) {
      const cache = getGlobalPatternCache();
      const excludeIgnore = cache.getIgnorePattern(options.exclude);
      const excluded = excludeIgnore.ignores(filePath);
      
      for (const pattern of options.exclude) {
        const singlePatternIgnore = cache.getIgnorePattern([pattern]);
        const matched = singlePatternIgnore.ignores(filePath);
        excludeMatches.push({
          pattern,
          matched,
          reason: matched ? 'Pattern excluded file' : 'Pattern did not exclude file'
        });
      }
      
      if (excluded) {
        passesExclude = false;
      }
    }

    // Check gitignore
    const gitignoreIgnored = ignoreRules.ignores(filePath);
    const gitignoreStatus = {
      ignored: gitignoreIgnored,
      reason: gitignoreIgnored ? 'File ignored by .gitignore rules' : 'File not ignored by .gitignore'
    };

    // Determine final decision
    let finalDecision: 'included' | 'excluded';
    let decisionReason: string;

    if (!passesInclude) {
      finalDecision = 'excluded';
      decisionReason = 'File did not match any include patterns';
    } else if (!passesExclude) {
      finalDecision = 'excluded';
      decisionReason = 'File matched exclude patterns';
    } else if (gitignoreIgnored) {
      finalDecision = 'excluded';
      decisionReason = 'File ignored by .gitignore';
    } else {
      finalDecision = 'included';
      decisionReason = 'File passed all pattern checks';
    }

    const endTime = performance.now();
    const evaluationTimeMs = endTime - startTime;

    return {
      filePath,
      includeMatches,
      excludeMatches,
      gitignoreStatus,
      finalDecision,
      decisionReason,
      evaluationTimeMs
    };
  }
}