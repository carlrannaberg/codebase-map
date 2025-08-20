/**
 * Utility functions for the code indexer
 */

export { findProjectRoot, findIndexFile } from './find-project-root.js';
export {
  PatternValidationError,
  validateGlobPattern,
  validatePatternArray,
  validatePatternConfig,
} from './pattern-validation.js';
export {
  PatternCache,
  getGlobalPatternCache,
  resetGlobalPatternCache,
  configureGlobalPatternCache,
  type CacheStats,
  type CacheOptions,
  type CompiledGlobPattern,
} from './pattern-cache.js';
export {
  PatternLogger,
  getGlobalPatternLogger,
  clearGlobalPatternLogger,
  type PatternMatchInfo,
  type PatternConfiguration,
  type PatternPerformanceMetrics,
} from './pattern-logger.js';
export {
  filterProjectIndex,
  getFilteringStats,
} from './project-index-filter.js';