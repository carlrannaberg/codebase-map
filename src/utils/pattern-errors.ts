/**
 * Structured error types for pattern-related operations with user-friendly messages
 * and recovery suggestions
 */

import type { FilterOptions } from '../types/index.js';

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
    const message = filePath 
      ? `Invalid pattern syntax in ${filePath}: "${pattern}" - ${reason}`
      : `Invalid pattern syntax: "${pattern}" - ${reason}`;

    const context = {
      pattern,
      operation,
      ...(filePath && { filePath })
    };

    const recoverySuggestions = [
      'Check the glob pattern syntax - common issues include unmatched brackets or invalid wildcards',
      'Use double quotes around patterns containing special characters',
      'Test patterns with simple examples first before using complex expressions',
      'Remove or escape special shell characters like $, `, |, ;, &, >, <'
    ];

    const documentationLinks = [
      'Glob patterns: https://github.com/sindresorhus/globby#globbing-patterns',
      'Fast-glob syntax: https://github.com/mrmlnc/fast-glob#pattern-syntax',
      'Pattern examples: https://github.com/isaacs/minimatch#usage'
    ];

    super(message, 'INVALID_PATTERN_SYNTAX', context, recoverySuggestions, documentationLinks, true);
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
    const message = filePath
      ? `Security violation in ${filePath}: "${pattern}" - ${violation}`
      : `Security violation: "${pattern}" - ${violation}`;

    const context = {
      pattern,
      violation,
      operation,
      ...(filePath && { filePath })
    };

    const recoverySuggestions = [
      'Use relative paths only (avoid absolute paths starting with /)',
      'Remove directory traversal sequences like ../',
      'Avoid shell command injection patterns like $(), backticks, pipes',
      'Use simple glob patterns without system-level operations',
      'Consider using inclusion patterns instead of complex exclusions'
    ];

    const documentationLinks = [
      'Security best practices: https://owasp.org/www-community/attacks/Path_Traversal',
      'Safe glob patterns: https://github.com/sindresorhus/globby#security'
    ];

    super(message, 'SECURITY_VIOLATION', context, recoverySuggestions, documentationLinks, true);
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
    let message: string;
    let recoverySuggestions: string[];

    switch (conflictType) {
      case 'ALL_EXCLUDED':
        message = 'Pattern conflict: All files would be excluded by the current patterns';
        recoverySuggestions = [
          'Review exclude patterns - they may be too broad',
          'Add more specific include patterns to override exclusions',
          'Check for typos in pattern syntax',
          'Use --verbose flag to see pattern analysis'
        ];
        break;
      case 'CONTRADICTORY':
        message = 'Pattern conflict: Include and exclude patterns contradict each other';
        recoverySuggestions = [
          'Ensure include patterns don\'t conflict with exclude patterns',
          'Use more specific patterns to avoid overlaps',
          'Consider using only include OR exclude patterns, not both',
          'Test patterns with smaller directory structures first'
        ];
        break;
      case 'INEFFECTIVE':
        message = 'Pattern inefficiency: Current patterns don\'t significantly filter files';
        recoverySuggestions = [
          'Consider removing ineffective patterns to improve performance',
          'Use more specific patterns that match your actual needs',
          'Combine multiple patterns into more efficient expressions',
          'Use directory-level patterns instead of file-level when possible'
        ];
        break;
    }

    if (filePath) {
      message = `${message} in ${filePath}`;
    }

    const context = {
      includePatterns,
      excludePatterns,
      conflictType,
      operation,
      ...(filePath && { filePath })
    };

    const documentationLinks = [
      'Pattern best practices: https://github.com/sindresorhus/globby#tips',
      'Include/exclude logic: https://github.com/mrmlnc/fast-glob#how-to-exclude-directory-from-reading'
    ];

    super(message, 'PATTERN_CONFLICT', context, recoverySuggestions, documentationLinks, true);
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

    let recoverySuggestions: string[];
    const errorCode = (systemError as NodeJSError)?.code;

    switch (errorCode) {
      case 'ENOENT':
        recoverySuggestions = [
          'Check that the file or directory exists',
          'Verify the path is correct and accessible',
          'Use absolute paths to avoid relative path issues',
          'Check if the file was recently moved or deleted'
        ];
        break;
      case 'EACCES':
        recoverySuggestions = [
          'Check file/directory permissions',
          'Ensure you have read access to the target path',
          'Try running with appropriate user permissions',
          'Verify the parent directory is accessible'
        ];
        break;
      case 'EMFILE':
        recoverySuggestions = [
          'Too many open files - try processing in smaller batches',
          'Increase system file descriptor limits',
          'Check for file handle leaks in the application',
          'Use streaming or pagination for large datasets'
        ];
        break;
      case 'ENOTDIR':
        recoverySuggestions = [
          'Verify the path points to a directory when expected',
          'Check for typos in the directory path',
          'Ensure all parent directories exist',
          'Use path.dirname() to get directory paths correctly'
        ];
        break;
      default:
        recoverySuggestions = [
          'Check filesystem permissions and space availability',
          'Verify the path is valid and accessible',
          'Try the operation with a different path',
          'Check system logs for additional error details'
        ];
    }

    const documentationLinks = [
      'Node.js filesystem errors: https://nodejs.org/api/errors.html#errors_common_system_errors',
      'File permission troubleshooting: https://nodejs.org/api/fs.html#fs_file_access_constants'
    ];

    const isRecoverable = ['ENOENT', 'EACCES', 'ENOTDIR'].includes(errorCode || '');

    super(message, 'FILESYSTEM_ERROR', context, recoverySuggestions, documentationLinks, isRecoverable);
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

    const recoverySuggestions = [
      'This appears to be an unexpected error - please report it as a bug',
      'Try the operation with simpler patterns to isolate the issue',
      'Check if recent changes to patterns or configuration caused this',
      'Include the full error context when reporting the issue'
    ];

    const documentationLinks = [
      'Issue reporting: https://github.com/your-repo/issues',
      'Debug mode: Use --verbose flag for additional diagnostic information'
    ];

    super(message, 'UNEXPECTED_ERROR', errorContext, recoverySuggestions, documentationLinks, false);
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

    const recoverySuggestions = [
      'Reduce the number of patterns to improve performance',
      'Use more specific patterns to limit filesystem scanning',
      'Avoid deeply nested recursive patterns (**) when possible',
      'Consider using directory-level exclusions instead of file-level',
      'Break large pattern sets into smaller, focused groups'
    ];

    const documentationLinks = [
      'Performance optimization: https://github.com/mrmlnc/fast-glob#performance',
      'Pattern efficiency tips: https://github.com/sindresorhus/globby#performance'
    ];

    super(message, 'PATTERN_PERFORMANCE', context, recoverySuggestions, documentationLinks, true);
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