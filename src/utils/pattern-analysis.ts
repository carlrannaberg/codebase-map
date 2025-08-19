/**
 * Pattern analysis utilities for warning about common pattern issues and conflicts
 */

import * as path from 'node:path';
import fastGlob from 'fast-glob';
import ignore from 'ignore';

/**
 * Warning levels for pattern analysis
 */
export type WarningLevel = 'info' | 'warning' | 'error';

/**
 * Pattern warning information
 */
export interface PatternWarning {
  level: WarningLevel;
  category: string;
  message: string;
  suggestion?: string;
  patterns?: string[];
}

/**
 * Statistics about pattern effectiveness
 */
export interface PatternStats {
  totalCandidateFiles: number;
  includedFiles: number;
  excludedFiles: number;
  finalFiles: number;
  includePatternMatches: Record<string, number>;
  excludePatternMatches: Record<string, number>;
}

/**
 * Complete pattern analysis result
 */
export interface PatternAnalysis {
  stats: PatternStats;
  warnings: PatternWarning[];
  suggestions: string[];
}

/**
 * Analyze pattern effectiveness and generate warnings
 * @param absoluteRoot - Absolute root directory path
 * @param includePatterns - Array of include glob patterns (empty means include all)
 * @param excludePatterns - Array of exclude glob patterns
 * @returns Analysis with warnings and suggestions
 */
export async function analyzePatternEffectiveness(
  absoluteRoot: string,
  includePatterns: string[] = [],
  excludePatterns: string[] = []
): Promise<PatternAnalysis> {
  const warnings: PatternWarning[] = [];
  const suggestions: string[] = [];
  
  // Default supported extensions from FileDiscovery
  const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
  const EXCLUDED_DIRS = [
    'node_modules',
    'dist',
    'build',
    '.next',
    '.turbo',
    '.git',
    'coverage',
    '.nyc_output'
  ];
  
  // Create glob options similar to FileDiscovery
  const globOptions = {
    cwd: absoluteRoot,
    ignore: EXCLUDED_DIRS.map(dir => `${dir}/**`),
    onlyFiles: true,
    followSymbolicLinks: false,
    absolute: false,
    dot: false
  };
  
  // Step 1: Get all candidate files (what would be found without any patterns)
  const allSupportedPatterns = SUPPORTED_EXTENSIONS.map(ext => `**/*${ext}`);
  const allCandidateFiles = await fastGlob(allSupportedPatterns, globOptions);
  
  // Step 2: Apply include patterns and track matches
  let includedFiles: string[];
  const includePatternMatches: Record<string, number> = {};
  
  if (includePatterns.length > 0) {
    includedFiles = await fastGlob(includePatterns, globOptions);
    // Filter to only supported file types
    includedFiles = includedFiles.filter(file => isSupportedFile(file));
    
    // Track matches per include pattern
    for (const pattern of includePatterns) {
      const matches = await fastGlob([pattern], globOptions);
      const supportedMatches = matches.filter(file => isSupportedFile(file));
      includePatternMatches[pattern] = supportedMatches.length;
    }
  } else {
    includedFiles = allCandidateFiles;
  }
  
  // Step 3: Apply exclude patterns and track matches
  let finalFiles: string[];
  const excludePatternMatches: Record<string, number> = {};
  
  if (excludePatterns.length > 0) {
    const ig = ignore();
    ig.add(excludePatterns);
    finalFiles = includedFiles.filter(file => !ig.ignores(file));
    
    // Track how many files each exclude pattern would exclude
    for (const pattern of excludePatterns) {
      const excludeIg = ignore();
      excludeIg.add([pattern]);
      const wouldExclude = includedFiles.filter(file => excludeIg.ignores(file));
      excludePatternMatches[pattern] = wouldExclude.length;
    }
  } else {
    finalFiles = includedFiles;
  }
  
  const excludedFiles = includedFiles.length - finalFiles.length;
  
  // Build statistics
  const stats: PatternStats = {
    totalCandidateFiles: allCandidateFiles.length,
    includedFiles: includedFiles.length,
    excludedFiles: excludedFiles,
    finalFiles: finalFiles.length,
    includePatternMatches,
    excludePatternMatches
  };
  
  // Generate warnings based on analysis
  generatePatternWarnings(
    warnings,
    suggestions,
    stats,
    includePatterns,
    excludePatterns
  );
  
  return {
    stats,
    warnings,
    suggestions
  };
}

/**
 * Generate warnings and suggestions based on pattern analysis
 * @param warnings - Array to populate with warnings
 * @param suggestions - Array to populate with suggestions
 * @param stats - Pattern effectiveness statistics
 * @param includePatterns - Include patterns used
 * @param excludePatterns - Exclude patterns used
 */
function generatePatternWarnings(
  warnings: PatternWarning[],
  suggestions: string[],
  stats: PatternStats,
  includePatterns: string[],
  excludePatterns: string[]
): void {
  
  // Warning 1: Include patterns with zero matches
  if (includePatterns.length > 0) {
    const emptyPatterns = includePatterns.filter(
      pattern => stats.includePatternMatches[pattern] === 0
    );
    
    if (emptyPatterns.length > 0) {
      warnings.push({
        level: 'warning',
        category: 'No files matched',
        message: `${emptyPatterns.length} include pattern${emptyPatterns.length === 1 ? '' : 's'} matched no files`,
        suggestion: `Check if these patterns are correct: ${emptyPatterns.join(', ')}`,
        patterns: emptyPatterns
      });
      
      suggestions.push(
        `Consider removing or fixing patterns that match no files: ${emptyPatterns.join(', ')}`
      );
    }
  }
  
  // Warning 2: All files excluded (pattern conflict)
  if (stats.finalFiles === 0 && stats.includedFiles > 0) {
    warnings.push({
      level: 'error',
      category: 'Pattern conflict',
      message: `All ${stats.includedFiles} included files were excluded by exclude patterns`,
      suggestion: 'Review your exclude patterns - they may be too broad',
      patterns: excludePatterns
    });
    
    suggestions.push('Your exclude patterns are excluding all files that match your include patterns');
  }
  
  // Warning 3: Very few files selected compared to candidates
  if (includePatterns.length > 0 && stats.finalFiles > 0) {
    const selectionRatio = stats.finalFiles / stats.totalCandidateFiles;
    if (selectionRatio < 0.1) {
      warnings.push({
        level: 'info',
        category: 'Narrow selection',
        message: `Only ${stats.finalFiles} out of ${stats.totalCandidateFiles} candidate files selected (${(selectionRatio * 100).toFixed(1)}%)`,
        suggestion: 'Verify your include patterns are not too restrictive'
      });
    }
  }
  
  // Warning 4: Overly broad exclusion patterns
  if (excludePatterns.length > 0) {
    const overlyBroadPatterns = excludePatterns.filter(
      pattern => {
        const matchCount = stats.excludePatternMatches[pattern];
        if (matchCount === undefined) return false;
        const exclusionRatio = matchCount / stats.includedFiles;
        return exclusionRatio > 0.5;
      }
    );
    
    if (overlyBroadPatterns.length > 0) {
      warnings.push({
        level: 'warning',
        category: 'Overly broad exclusion',
        message: `${overlyBroadPatterns.length} exclude pattern${overlyBroadPatterns.length === 1 ? '' : 's'} exclude more than 50% of included files`,
        suggestion: 'Consider making exclude patterns more specific',
        patterns: overlyBroadPatterns
      });
      
      suggestions.push(
        `These exclude patterns may be too broad: ${overlyBroadPatterns.join(', ')}`
      );
    }
  }
  
  // Warning 5: Performance warnings for complex patterns
  const complexPatterns = [...includePatterns, ...excludePatterns].filter(
    pattern => (pattern.match(/\*\*/g) || []).length > 3
  );
  
  if (complexPatterns.length > 0) {
    warnings.push({
      level: 'info',
      category: 'Performance',
      message: `${complexPatterns.length} pattern${complexPatterns.length === 1 ? '' : 's'} may impact performance due to complexity`,
      suggestion: 'Consider simplifying patterns with many recursive wildcards (**)',
      patterns: complexPatterns
    });
  }
  
  // Suggestion: When no patterns are provided
  if (includePatterns.length === 0 && excludePatterns.length === 0) {
    suggestions.push(
      `Scanning all ${stats.finalFiles} supported files. Use --include or --exclude patterns to refine selection.`
    );
  }
  
  // Suggestion: When very effective filtering
  if (stats.finalFiles > 0 && stats.finalFiles < stats.totalCandidateFiles * 0.8) {
    suggestions.push(
      `Pattern filtering reduced files from ${stats.totalCandidateFiles} to ${stats.finalFiles} (${((1 - stats.finalFiles / stats.totalCandidateFiles) * 100).toFixed(1)}% reduction)`
    );
  }
}

/**
 * Check if a file has a supported extension (mirrors FileDiscovery logic)
 * @param filePath - File path to check
 * @returns True if file is supported
 */
function isSupportedFile(filePath: string): boolean {
  const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
  const ext = path.extname(filePath);
  return SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Format warnings for display in CLI
 * @param warnings - Array of warnings to format
 * @returns Formatted warning messages
 */
export function formatWarningsForCLI(warnings: PatternWarning[]): string[] {
  return warnings.map(warning => {
    const icon = warning.level === 'error' ? '❌' : 
                 warning.level === 'warning' ? '⚠️ ' : 'ℹ️ ';
    
    let message = `${icon} ${warning.message}`;
    
    if (warning.suggestion) {
      message += `\n   💡 ${warning.suggestion}`;
    }
    
    return message;
  });
}

/**
 * Format suggestions for display in CLI
 * @param suggestions - Array of suggestions to format
 * @returns Formatted suggestion messages
 */
export function formatSuggestionsForCLI(suggestions: string[]): string[] {
  return suggestions.map(suggestion => `💡 ${suggestion}`);
}