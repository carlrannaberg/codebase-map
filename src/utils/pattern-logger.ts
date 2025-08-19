/**
 * Pattern evaluation logging for verbose mode
 */

import { performance } from 'node:perf_hooks';

/**
 * Information about how a file was evaluated against patterns
 */
export interface PatternMatchInfo {
  readonly filePath: string;
  readonly includeMatches: Array<{
    pattern: string;
    matched: boolean;
    reason?: string;
  }>;
  readonly excludeMatches: Array<{
    pattern: string;
    matched: boolean;
    reason?: string;
  }>;
  readonly gitignoreStatus: {
    ignored: boolean;
    reason?: string;
  };
  readonly finalDecision: 'included' | 'excluded';
  readonly decisionReason: string;
  readonly evaluationTimeMs?: number;
}

/**
 * Configuration and timing information for pattern evaluation
 */
export interface PatternConfiguration {
  readonly includePatterns: string[];
  readonly excludePatterns: string[];
  readonly gitignorePath?: string;
  readonly supportedExtensions: string[];
  readonly excludedDirectories: string[];
}

/**
 * Performance metrics for pattern evaluation
 */
export interface PatternPerformanceMetrics {
  readonly totalFiles: number;
  readonly includedFiles: number;
  readonly excludedFiles: number;
  readonly totalEvaluationTimeMs: number;
  readonly averageFileEvaluationMs: number;
  readonly patternCacheStats?: {
    globHitRate: number;
    ignoreHitRate: number;
    totalCacheQueries: number;
  };
}

/**
 * Logger for tracking and displaying pattern matching decisions
 */
export class PatternLogger {
  private fileEvaluations: PatternMatchInfo[] = [];
  private configuration?: PatternConfiguration;
  private startTime: number = 0;
  private endTime: number = 0;

  /**
   * Set the pattern configuration being used
   */
  setConfiguration(config: PatternConfiguration): void {
    this.configuration = config;
  }

  /**
   * Start timing the evaluation process
   */
  startEvaluation(): void {
    this.startTime = performance.now();
  }

  /**
   * End timing the evaluation process
   */
  endEvaluation(): void {
    this.endTime = performance.now();
  }

  /**
   * Log the evaluation of a single file
   */
  logFileEvaluation(matchInfo: PatternMatchInfo): void {
    this.fileEvaluations.push(matchInfo);
  }

  /**
   * Get performance metrics for the evaluation
   */
  getPerformanceMetrics(cacheStats?: {
    globHitRate: number;
    ignoreHitRate: number;
    totalCacheQueries: number;
  }): PatternPerformanceMetrics {
    const totalFiles = this.fileEvaluations.length;
    const includedFiles = this.fileEvaluations.filter(f => f.finalDecision === 'included').length;
    const excludedFiles = totalFiles - includedFiles;
    const totalEvaluationTimeMs = this.endTime - this.startTime;
    const averageFileEvaluationMs = totalFiles > 0 ? totalEvaluationTimeMs / totalFiles : 0;

    return {
      totalFiles,
      includedFiles,
      excludedFiles,
      totalEvaluationTimeMs,
      averageFileEvaluationMs,
      ...(cacheStats && { patternCacheStats: cacheStats })
    };
  }

  /**
   * Get sample files with their evaluation reasons
   */
  getSampleFiles(maxSamples: number = 10): {
    included: PatternMatchInfo[];
    excluded: PatternMatchInfo[];
  } {
    const includedFiles = this.fileEvaluations.filter(f => f.finalDecision === 'included');
    const excludedFiles = this.fileEvaluations.filter(f => f.finalDecision === 'excluded');

    return {
      included: includedFiles.slice(0, maxSamples),
      excluded: excludedFiles.slice(0, maxSamples)
    };
  }

  /**
   * Print a comprehensive verbose log to console
   */
  printVerboseLog(): void {
    if (!this.configuration) {
      console.error('Pattern configuration not set');
      return;
    }

    console.log('\n' + '='.repeat(80));
    console.log('PATTERN EVALUATION VERBOSE LOG');
    console.log('='.repeat(80));

    // Print configuration
    this.printConfiguration();

    // Print performance metrics
    this.printPerformanceMetrics();

    // Print sample file evaluations
    this.printSampleFileEvaluations();

    // Print conflict detection
    this.printConflictDetection();

    console.log('='.repeat(80));
  }

  /**
   * Print pattern configuration summary
   */
  private printConfiguration(): void {
    if (!this.configuration) {
      return;
    }

    console.log('\n📋 PATTERN CONFIGURATION');
    console.log('-'.repeat(40));
    
    console.log(`Include Patterns (${this.configuration.includePatterns.length}):`);
    if (this.configuration.includePatterns.length === 0) {
      console.log('  (default: all supported files)');
    } else {
      this.configuration.includePatterns.forEach(pattern => {
        console.log(`  ✅ ${pattern}`);
      });
    }

    console.log(`\nExclude Patterns (${this.configuration.excludePatterns.length}):`);
    if (this.configuration.excludePatterns.length === 0) {
      console.log('  (none specified)');
    } else {
      this.configuration.excludePatterns.forEach(pattern => {
        console.log(`  ❌ ${pattern}`);
      });
    }

    console.log(`\nSupported Extensions: ${this.configuration.supportedExtensions.join(', ')}`);
    console.log(`Excluded Directories: ${this.configuration.excludedDirectories.join(', ')}`);
    
    if (this.configuration.gitignorePath) {
      console.log(`Gitignore: ${this.configuration.gitignorePath}`);
    }
  }

  /**
   * Print performance metrics
   */
  private printPerformanceMetrics(): void {
    const metrics = this.getPerformanceMetrics();
    
    console.log('\n⚡ PERFORMANCE METRICS');
    console.log('-'.repeat(40));
    console.log(`Total Files Evaluated: ${metrics.totalFiles}`);
    console.log(`Files Included: ${metrics.includedFiles}`);
    console.log(`Files Excluded: ${metrics.excludedFiles}`);
    console.log(`Total Evaluation Time: ${metrics.totalEvaluationTimeMs.toFixed(2)}ms`);
    console.log(`Average Per File: ${metrics.averageFileEvaluationMs.toFixed(3)}ms`);

    if (metrics.patternCacheStats) {
      console.log(`\nCache Performance:`);
      console.log(`  Glob Cache Hit Rate: ${(metrics.patternCacheStats.globHitRate * 100).toFixed(1)}%`);
      console.log(`  Ignore Cache Hit Rate: ${(metrics.patternCacheStats.ignoreHitRate * 100).toFixed(1)}%`);
      console.log(`  Total Cache Queries: ${metrics.patternCacheStats.totalCacheQueries}`);
    }
  }

  /**
   * Print sample file evaluations with reasons
   */
  private printSampleFileEvaluations(): void {
    const samples = this.getSampleFiles(5);

    console.log('\n📁 SAMPLE FILE EVALUATIONS');
    console.log('-'.repeat(40));

    if (samples.included.length > 0) {
      console.log('\nIncluded Files (sample):');
      samples.included.forEach(file => {
        console.log(`  ✅ ${file.filePath}`);
        console.log(`     Reason: ${file.decisionReason}`);
        if (file.evaluationTimeMs !== undefined) {
          console.log(`     Evaluation: ${file.evaluationTimeMs.toFixed(3)}ms`);
        }
      });
    }

    if (samples.excluded.length > 0) {
      console.log('\nExcluded Files (sample):');
      samples.excluded.forEach(file => {
        console.log(`  ❌ ${file.filePath}`);
        console.log(`     Reason: ${file.decisionReason}`);
        if (file.evaluationTimeMs !== undefined) {
          console.log(`     Evaluation: ${file.evaluationTimeMs.toFixed(3)}ms`);
        }
      });
    }
  }

  /**
   * Print pattern conflict detection and resolution
   */
  private printConflictDetection(): void {
    console.log('\n⚠️  PATTERN CONFLICT ANALYSIS');
    console.log('-'.repeat(40));

    // Find files that matched both include and exclude patterns
    const conflictingFiles = this.fileEvaluations.filter(file => {
      const hasIncludeMatch = file.includeMatches.some(match => match.matched);
      const hasExcludeMatch = file.excludeMatches.some(match => match.matched);
      return hasIncludeMatch && hasExcludeMatch;
    });

    if (conflictingFiles.length === 0) {
      console.log('✅ No pattern conflicts detected');
    } else {
      console.log(`⚠️  Found ${conflictingFiles.length} files with pattern conflicts:`);
      conflictingFiles.slice(0, 5).forEach(file => {
        console.log(`  📁 ${file.filePath}`);
        console.log(`     Final Decision: ${file.finalDecision}`);
        console.log(`     Include Matches: ${file.includeMatches.filter(m => m.matched).map(m => m.pattern).join(', ')}`);
        console.log(`     Exclude Matches: ${file.excludeMatches.filter(m => m.matched).map(m => m.pattern).join(', ')}`);
      });
      
      if (conflictingFiles.length > 5) {
        console.log(`     ... and ${conflictingFiles.length - 5} more`);
      }
    }

    // Analyze pattern effectiveness
    this.analyzePatternEffectiveness();
  }

  /**
   * Analyze and report pattern effectiveness
   */
  private analyzePatternEffectiveness(): void {
    if (!this.configuration || this.fileEvaluations.length === 0) {
      return;
    }

    console.log('\n📊 PATTERN EFFECTIVENESS');
    console.log('-'.repeat(40));

    // Analyze include patterns
    this.configuration.includePatterns.forEach(pattern => {
      const matchCount = this.fileEvaluations.reduce((count, file) => {
        const matches = file.includeMatches.filter(m => m.pattern === pattern && m.matched).length;
        return count + matches;
      }, 0);
      console.log(`  Include "${pattern}": ${matchCount} matches`);
    });

    // Analyze exclude patterns
    this.configuration.excludePatterns.forEach(pattern => {
      const matchCount = this.fileEvaluations.reduce((count, file) => {
        const matches = file.excludeMatches.filter(m => m.pattern === pattern && m.matched).length;
        return count + matches;
      }, 0);
      console.log(`  Exclude "${pattern}": ${matchCount} matches`);
    });

    // Gitignore effectiveness
    const gitignoreExclusions = this.fileEvaluations.filter(f => f.gitignoreStatus.ignored).length;
    console.log(`  Gitignore exclusions: ${gitignoreExclusions} files`);
  }

  /**
   * Clear all logged data
   */
  clear(): void {
    this.fileEvaluations = [];
    delete this.configuration;
    this.startTime = 0;
    this.endTime = 0;
  }
}

/**
 * Global pattern logger instance for easy access
 */
let globalLogger: PatternLogger | null = null;

/**
 * Get or create the global pattern logger instance
 */
export function getGlobalPatternLogger(): PatternLogger {
  if (!globalLogger) {
    globalLogger = new PatternLogger();
  }
  return globalLogger;
}

/**
 * Clear the global pattern logger
 */
export function clearGlobalPatternLogger(): void {
  globalLogger = null;
}