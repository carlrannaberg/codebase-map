/**
 * Structured error types for pattern-related operations with user-friendly messages
 * and recovery suggestions
 */

import type { FilterOptions } from '../types/index.js';

// Common recovery suggestions organized by category
const COMMON_SUGGESTIONS = {
  PATTERN_SYNTAX: [
    'Check the glob pattern syntax - common issues include unmatched brackets or invalid wildcards',
    'Use double quotes around patterns containing special characters',
    'Test patterns with simple examples first before using complex expressions',
    'Remove or escape special shell characters like $, `, |, ;, &, >, <'
  ],
  SECURITY: [
    'Use relative paths only (avoid absolute paths starting with /)',
    'Remove directory traversal sequences like ../',
    'Avoid shell command injection patterns like $(), backticks, pipes',
    'Use simple glob patterns without system-level operations',
    'Consider using inclusion patterns instead of complex exclusions'
  ],
  FILESYSTEM_PERMISSION: [
    'Check file/directory permissions',
    'Ensure you have read access to the target path',
    'Try running with appropriate user permissions',
    'Verify the parent directory is accessible'
  ],
  FILESYSTEM_MISSING: [
    'Check that the file or directory exists',
    'Verify the path is correct and accessible',
    'Use absolute paths to avoid relative path issues',
    'Check if the file was recently moved or deleted'
  ],
  FILESYSTEM_RESOURCES: [
    'Too many open files - try processing in smaller batches',
    'Increase system file descriptor limits',
    'Check for file handle leaks in the application',
    'Use streaming or pagination for large datasets'
  ],
  FILESYSTEM_DIRECTORY: [
    'Verify the path points to a directory when expected',
    'Check for typos in the directory path',
    'Ensure all parent directories exist',
    'Use path.dirname() to get directory paths correctly'
  ],
  FILESYSTEM_GENERIC: [
    'Check filesystem permissions and space availability',
    'Verify the path is valid and accessible',
    'Try the operation with a different path',
    'Check system logs for additional error details'
  ],
  PATTERN_CONFLICT_ALL_EXCLUDED: [
    'Review exclude patterns - they may be too broad',
    'Add more specific include patterns to override exclusions',
    'Check for typos in pattern syntax',
    'Use --verbose flag to see pattern analysis'
  ],
  PATTERN_CONFLICT_CONTRADICTORY: [
    'Ensure include patterns don\'t conflict with exclude patterns',
    'Use more specific patterns to avoid overlaps',
    'Consider using only include OR exclude patterns, not both',
    'Test patterns with smaller directory structures first'
  ],
  PATTERN_CONFLICT_INEFFECTIVE: [
    'Consider removing ineffective patterns to improve performance',
    'Use more specific patterns that match your actual needs',
    'Combine multiple patterns into more efficient expressions',
    'Use directory-level patterns instead of file-level when possible'
  ],
  PERFORMANCE: [
    'Reduce the number of patterns to improve performance',
    'Use more specific patterns to limit filesystem scanning',
    'Avoid deeply nested recursive patterns (**) when possible',
    'Consider using directory-level exclusions instead of file-level',
    'Break large pattern sets into smaller, focused groups'
  ],
  UNEXPECTED: [
    'This appears to be an unexpected error - please report it as a bug',
    'Try the operation with simpler patterns to isolate the issue',
    'Check if recent changes to patterns or configuration caused this',
    'Include the full error context when reporting the issue'
  ]
} as const;

// Common documentation links organized by category
const COMMON_DOCS = {
  GLOB_PATTERNS: [
    'Glob patterns: https://github.com/sindresorhus/globby#globbing-patterns',
    'Fast-glob syntax: https://github.com/mrmlnc/fast-glob#pattern-syntax',
    'Pattern examples: https://github.com/isaacs/minimatch#usage'
  ],
  SECURITY: [
    'Security best practices: https://owasp.org/www-community/attacks/Path_Traversal',
    'Safe glob patterns: https://github.com/sindresorhus/globby#security'
  ],
  PATTERN_BEST_PRACTICES: [
    'Pattern best practices: https://github.com/sindresorhus/globby#tips',
    'Include/exclude logic: https://github.com/mrmlnc/fast-glob#how-to-exclude-directory-from-reading'
  ],
  FILESYSTEM: [
    'Node.js filesystem errors: https://nodejs.org/api/errors.html#errors_common_system_errors',
    'File permission troubleshooting: https://nodejs.org/api/fs.html#fs_file_access_constants'
  ],
  PERFORMANCE: [
    'Performance optimization: https://github.com/mrmlnc/fast-glob#performance',
    'Pattern efficiency tips: https://github.com/sindresorhus/globby#performance'
  ],
  BUG_REPORTING: [
    'Issue reporting: https://github.com/your-repo/issues',
    'Debug mode: Use --verbose flag for additional diagnostic information'
  ]
} as const;

// Helper function to build context with optional filePath
function buildContext(
  baseContext: Record<string, unknown>,
  filePath?: string
): Record<string, unknown> {
  return {
    ...baseContext,
    ...(filePath && { filePath })
  };
}

// Helper function to build message with optional filePath
// Maintains backward compatibility with existing message formats
function buildMessage(
  baseMessage: string,
  filePath?: string,
  pattern?: string,
  reason?: string
): string {
  // For InvalidPatternSyntaxError: "Invalid pattern syntax: "pattern" - reason"
  // For SecurityViolationError: "Security violation: "pattern" - violation"
  if (pattern && reason) {
    const fullMessage = filePath
      ? `${baseMessage} in ${filePath}: "${pattern}" - ${reason}`
      : `${baseMessage}: "${pattern}" - ${reason}`;
    return fullMessage;
  }
  
  if (filePath) {
    return pattern
      ? `${baseMessage} in ${filePath}: "${pattern}"`
      : `${baseMessage} in ${filePath}`;
  }
  return pattern
    ? `${baseMessage}: "${pattern}"`
    : baseMessage;
}

// Node.js error types
interface NodeJSError extends Error {
  code?: string;
  path?: string;
  errno?: number;
  syscall?: string;
}

/**
 * Base error class for all pattern-related errors
 */
export abstract class PatternError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;
  public readonly recoverySuggestions: string[];
  public readonly documentationLinks: string[];
  public readonly isRecoverable: boolean;

  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {},
    recoverySuggestions: string[] = [],
    documentationLinks: string[] = [],
    isRecoverable = false
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.recoverySuggestions = recoverySuggestions;
    this.documentationLinks = documentationLinks;
    this.isRecoverable = isRecoverable;

    // Capture stack trace
    Error.captureStackTrace?.(this, this.constructor);
  }

  /**
   * Get formatted error message for CLI display
   */
  getFormattedMessage(): string {
    const lines = [
      `❌ ${this.message}`,
      `   Code: ${this.code}`
    ];

    // Add context information
    if (Object.keys(this.context).length > 0) {
      lines.push('   Context:');
      for (const [key, value] of Object.entries(this.context)) {
        lines.push(`     ${key}: ${String(value)}`);
      }
    }

    // Add recovery suggestions
    if (this.recoverySuggestions.length > 0) {
      lines.push('');
      lines.push('💡 Recovery suggestions:');
      this.recoverySuggestions.forEach((suggestion, index) => {
        lines.push(`   ${index + 1}. ${suggestion}`);
      });
    }

    // Add documentation links
    if (this.documentationLinks.length > 0) {
      lines.push('');
      lines.push('📚 Documentation:');
      this.documentationLinks.forEach(link => {
        lines.push(`   - ${link}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Convert error to structured object for API responses
   */
  toJSON(): Record<string, unknown> {
    return {
      error: true,
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      recoverySuggestions: this.recoverySuggestions,
      documentationLinks: this.documentationLinks,
      isRecoverable: this.isRecoverable,
      stack: this.stack
    };
  }
}

/**
 * Error for malformed or syntactically invalid patterns
 */
export class InvalidPatternSyntaxError extends PatternError {
  constructor(
    pattern: string,
    reason: string,
    operation: string = 'pattern validation',
    filePath?: string
  ) {
    const baseMessage = 'Invalid pattern syntax';
    const message = buildMessage(baseMessage, filePath, pattern, reason);

    const context = buildContext({ pattern, operation }, filePath);

    super(
      message,
      'INVALID_PATTERN_SYNTAX',
      context,
      [...COMMON_SUGGESTIONS.PATTERN_SYNTAX], // Convert readonly to mutable
      [...COMMON_DOCS.GLOB_PATTERNS], // Convert readonly to mutable
      true
    );
  }
}

/**
 * Error for patterns that violate security policies
 */
export class SecurityViolationError extends PatternError {
  constructor(
    pattern: string,
    violation: string,
    operation: string = 'security validation',
    filePath?: string
  ) {
    const baseMessage = 'Security violation';
    const message = buildMessage(baseMessage, filePath, pattern, violation);

    const context = buildContext({ pattern, violation, operation }, filePath);

    super(
      message,
      'SECURITY_VIOLATION',
      context,
      [...COMMON_SUGGESTIONS.SECURITY], // Convert readonly to mutable
      [...COMMON_DOCS.SECURITY], // Convert readonly to mutable
      true
    );
  }
}

/**
 * Error when patterns create impossible or conflicting conditions
 */
export class PatternConflictError extends PatternError {
  constructor(
    includePatterns: string[],
    excludePatterns: string[],
    conflictType: 'ALL_EXCLUDED' | 'CONTRADICTORY' | 'INEFFECTIVE',
    operation: string = 'pattern analysis',
    filePath?: string
  ) {
    let baseMessage: string;
    let recoverySuggestions: readonly string[];

    switch (conflictType) {
      case 'ALL_EXCLUDED':
        baseMessage = 'Pattern conflict: All files would be excluded by the current patterns';
        recoverySuggestions = COMMON_SUGGESTIONS.PATTERN_CONFLICT_ALL_EXCLUDED;
        break;
      case 'CONTRADICTORY':
        baseMessage = 'Pattern conflict: Include and exclude patterns contradict each other';
        recoverySuggestions = COMMON_SUGGESTIONS.PATTERN_CONFLICT_CONTRADICTORY;
        break;
      case 'INEFFECTIVE':
        baseMessage = 'Pattern inefficiency: Current patterns don\'t significantly filter files';
        recoverySuggestions = COMMON_SUGGESTIONS.PATTERN_CONFLICT_INEFFECTIVE;
        break;
    }

    const message = filePath ? `${baseMessage} in ${filePath}` : baseMessage;

    const context = buildContext(
      { includePatterns, excludePatterns, conflictType, operation },
      filePath
    );

    super(
      message,
      'PATTERN_CONFLICT',
      context,
      [...recoverySuggestions], // Convert readonly array to mutable
      [...COMMON_DOCS.PATTERN_BEST_PRACTICES], // Convert readonly to mutable
      true
    );
  }
}

/**
 * Error for filesystem-related issues during pattern operations
 */
export class FileSystemError extends PatternError {
  constructor(
    path: string,
    operation: string,
    cause: string,
    systemError?: Error
  ) {
    const message = `Filesystem error during ${operation} at "${path}": ${cause}`;

    const context = {
      path,
      operation,
      cause,
      ...(systemError && { 
        systemErrorCode: (systemError as NodeJSError).code,
        systemErrorMessage: systemError.message 
      })
    };

    const errorCode = (systemError as NodeJSError)?.code;
    let recoverySuggestions: readonly string[];

    switch (errorCode) {
      case 'ENOENT':
        recoverySuggestions = COMMON_SUGGESTIONS.FILESYSTEM_MISSING;
        break;
      case 'EACCES':
        recoverySuggestions = COMMON_SUGGESTIONS.FILESYSTEM_PERMISSION;
        break;
      case 'EMFILE':
        recoverySuggestions = COMMON_SUGGESTIONS.FILESYSTEM_RESOURCES;
        break;
      case 'ENOTDIR':
        recoverySuggestions = COMMON_SUGGESTIONS.FILESYSTEM_DIRECTORY;
        break;
      default:
        recoverySuggestions = COMMON_SUGGESTIONS.FILESYSTEM_GENERIC;
    }

    const isRecoverable = ['ENOENT', 'EACCES', 'ENOTDIR'].includes(errorCode || '');

    super(
      message,
      'FILESYSTEM_ERROR',
      context,
      [...recoverySuggestions], // Convert readonly array to mutable
      [...COMMON_DOCS.FILESYSTEM], // Convert readonly to mutable
      isRecoverable
    );
  }
}

/**
 * Error for unexpected conditions that indicate potential bugs
 */
export class UnexpectedPatternError extends PatternError {
  constructor(
    operation: string,
    cause: string,
    context: Record<string, unknown> = {},
    originalError?: Error
  ) {
    const message = `Unexpected error during ${operation}: ${cause}`;

    const errorContext = {
      operation,
      cause,
      ...context,
      ...(originalError && { 
        originalErrorName: originalError.name,
        originalErrorMessage: originalError.message,
        originalStack: originalError.stack
      })
    };

    super(
      message,
      'UNEXPECTED_ERROR',
      errorContext,
      [...COMMON_SUGGESTIONS.UNEXPECTED], // Convert readonly array to mutable
      [...COMMON_DOCS.BUG_REPORTING], // Convert readonly to mutable
      false
    );
  }
}

/**
 * Error for performance-related issues with patterns
 */
export class PatternPerformanceError extends PatternError {
  constructor(
    patterns: string[],
    issue: string,
    metrics: Record<string, number>,
    operation: string = 'pattern processing'
  ) {
    const message = `Performance issue with patterns: ${issue}`;

    const context = {
      patterns,
      issue,
      metrics,
      operation
    };

    super(
      message,
      'PATTERN_PERFORMANCE',
      context,
      [...COMMON_SUGGESTIONS.PERFORMANCE], // Convert readonly array to mutable
      [...COMMON_DOCS.PERFORMANCE], // Convert readonly to mutable
      true
    );
  }
}

/**
 * Utility function to wrap unknown errors as PatternError instances
 */
export function wrapUnknownError(
  error: unknown,
  operation: string,
  context: Record<string, unknown> = {}
): PatternError {
  if (error instanceof PatternError) {
    return error;
  }

  if (error instanceof Error) {
    // Check for specific Node.js filesystem errors
    const nodeError = error as NodeJSError;
    if (nodeError.code && nodeError.path) {
      return new FileSystemError(
        nodeError.path,
        operation,
        nodeError.message,
        nodeError
      );
    }

    return new UnexpectedPatternError(operation, error.message, context, error);
  }

  return new UnexpectedPatternError(
    operation,
    `Unknown error: ${String(error)}`,
    { ...context, originalError: error }
  );
}

/**
 * Utility function to create pattern conflict errors from analysis results
 */
export function createPatternConflictFromAnalysis(
  options: FilterOptions,
  stats: { totalCandidateFiles: number; includedFiles: number; finalFiles: number; excludedFiles: number },
  operation: string = 'pattern analysis',
  filePath?: string
): PatternConflictError | null {
  const { include = [], exclude = [] } = options;

  // Check if all files are excluded
  if (stats.totalCandidateFiles > 0 && stats.finalFiles === 0) {
    return new PatternConflictError(include, exclude, 'ALL_EXCLUDED', operation, filePath);
  }

  // Check for contradictory patterns (high exclusion rate with specific includes)
  if (include.length > 0 && exclude.length > 0) {
    const exclusionRate = stats.excludedFiles / stats.includedFiles;
    if (exclusionRate >= 0.8) { // 80% or more of included files are then excluded
      return new PatternConflictError(include, exclude, 'CONTRADICTORY', operation, filePath);
    }
  }

  // Check for ineffective patterns (very low filtering impact)
  const totalPatterns = include.length + exclude.length;
  if (totalPatterns > 0) {
    const reductionRate = 1 - (stats.finalFiles / stats.totalCandidateFiles);
    if (reductionRate < 0.05 && totalPatterns > 4) { // Less than 5% reduction with multiple patterns
      return new PatternConflictError(include, exclude, 'INEFFECTIVE', operation, filePath);
    }
  }

  return null;
}

/**
 * Exit codes for CLI error handling
 */
export const EXIT_CODES = {
  SUCCESS: 0,
  INVALID_PATTERN: 10,
  SECURITY_VIOLATION: 11,
  PATTERN_CONFLICT: 12,
  FILESYSTEM_ERROR: 13,
  PERFORMANCE_ERROR: 14,
  UNEXPECTED_ERROR: 99
} as const;

/**
 * Get appropriate exit code for a PatternError
 */
export function getExitCode(error: PatternError): number {
  switch (error.code) {
    case 'INVALID_PATTERN_SYNTAX':
      return EXIT_CODES.INVALID_PATTERN;
    case 'SECURITY_VIOLATION':
      return EXIT_CODES.SECURITY_VIOLATION;
    case 'PATTERN_CONFLICT':
      return EXIT_CODES.PATTERN_CONFLICT;
    case 'FILESYSTEM_ERROR':
      return EXIT_CODES.FILESYSTEM_ERROR;
    case 'PATTERN_PERFORMANCE':
      return EXIT_CODES.PERFORMANCE_ERROR;
    default:
      return EXIT_CODES.UNEXPECTED_ERROR;
  }
}

/**
 * Display a PatternError to the console with appropriate formatting
 */
export function displayError(error: PatternError, verbose = false): void {
  console.error(error.getFormattedMessage());
  
  if (verbose && error.stack) {
    console.error('\nStack trace:');
    console.error(error.stack);
  }
  
  console.error(''); // Add blank line for readability
}