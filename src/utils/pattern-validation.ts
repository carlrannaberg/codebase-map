/**
 * Pattern validation utilities for glob patterns with security checks
 */

import fg from 'fast-glob';

/**
 * Pattern validation limits for security and performance
 */
const LIMITS = {
  MAX_PATTERNS: 100,
  MAX_PATTERN_LENGTH: 1000,
  MAX_RECURSIVE_WILDCARDS: 10
} as const;

/**
 * Legacy error class for backward compatibility
 * @deprecated Use InvalidPatternSyntaxError or SecurityViolationError instead
 */
export class PatternValidationError extends Error {
  public readonly pattern: string;
  public readonly reason: string;

  constructor(pattern: string, reason: string) {
    super(`Invalid pattern "${pattern}": ${reason}`);
    this.name = 'PatternValidationError';
    this.pattern = pattern;
    this.reason = reason;
  }
}

/**
 * Validates a single glob pattern for security and syntax
 * @param pattern - The glob pattern to validate
 * @throws InvalidPatternSyntaxError or SecurityViolationError if pattern is invalid or unsafe
 */
export function validateGlobPattern(pattern: string): void {
  // Check for null, undefined, or non-string inputs
  if (typeof pattern !== 'string') {
    throw new PatternValidationError(
      String(pattern),
      'Pattern must be a string'
    );
  }

  // Check for empty patterns
  if (pattern.length === 0) {
    throw new PatternValidationError(pattern, 'Pattern cannot be empty');
  }

  // Security checks: prevent directory traversal attacks
  if (pattern.includes('../')) {
    throw new PatternValidationError(
      pattern,
      'Directory traversal patterns (..) are not allowed for security reasons'
    );
  }

  // Prevent absolute paths that could access system directories
  if (pattern.startsWith('/')) {
    throw new PatternValidationError(
      pattern,
      'Absolute paths (/) are not allowed for security reasons'
    );
  }

  // Filter dangerous shell escape sequences
  // Note: We allow | within parentheses for extglob patterns like @(*.ts|*.tsx)
  const dangerousSequences = [
    '$(', // Command substitution
    '`',  // Backticks for command execution
    ';',  // Command separators
    '&',  // Background operators
    '>',  // Redirection
    '<',  // Input redirection
  ];

  for (const sequence of dangerousSequences) {
    if (pattern.includes(sequence)) {
      throw new PatternValidationError(
        pattern,
        `Dangerous sequence "${sequence}" is not allowed for security reasons`
      );
    }
  }
  
  // Check for pipe character outside of parentheses (shell command piping)
  // Allow | within @(...), !(...), *(...), +(...), ?(...) for extglob patterns
  if (pattern.includes('|')) {
    // Check if all pipes are within parentheses
    let inParens = 0;
    let hasUnsafePipe = false;
    
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === '(') {
        inParens++;
      } else if (pattern[i] === ')') {
        inParens = Math.max(0, inParens - 1);
      } else if (pattern[i] === '|' && inParens === 0) {
        hasUnsafePipe = true;
        break;
      }
    }
    
    if (hasUnsafePipe) {
      throw new PatternValidationError(
        pattern,
        'Pipe character "|" outside of parentheses is not allowed for security reasons'
      );
    }
  }

  // Validate glob syntax using fast-glob
  try {
    // fg.generateTasks will throw if the pattern is syntactically invalid
    fg.generateTasks([pattern], { onlyFiles: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown syntax error';
    throw new PatternValidationError(
      pattern,
      `Invalid glob syntax: ${errorMessage}`
    );
  }

  // Additional pattern length check for performance
  if (pattern.length > LIMITS.MAX_PATTERN_LENGTH) {
    throw new PatternValidationError(
      pattern,
      `Pattern is too long (maximum ${LIMITS.MAX_PATTERN_LENGTH} characters)`
    );
  }

  // Check for excessive wildcard nesting which could cause performance issues
  const wildcardMatches = pattern.match(/\*\*/g);
  if (wildcardMatches && wildcardMatches.length > LIMITS.MAX_RECURSIVE_WILDCARDS) {
    throw new PatternValidationError(
      pattern,
      `Too many recursive wildcards (**) - maximum ${LIMITS.MAX_RECURSIVE_WILDCARDS} allowed for performance reasons`
    );
  }
}

/**
 * Validates an array of glob patterns
 * @param patterns - Array of glob patterns to validate
 * @param type - Type of patterns for error context ('include' or 'exclude')
 * @throws PatternValidationError if any pattern is invalid
 */
export function validatePatternArray(
  patterns: unknown,
  type: 'include' | 'exclude' = 'include'
): void {
  // Validate that input is an array
  if (!Array.isArray(patterns)) {
    throw new PatternValidationError(
      String(patterns),
      `${type} patterns must be an array`
    );
  }

  // Validate each pattern in the array
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    
    // Check that each element is a string
    if (typeof pattern !== 'string') {
      throw new PatternValidationError(
        String(pattern),
        `${type} pattern at index ${i} must be a string`
      );
    }

    // Check for empty strings
    if (pattern.length === 0) {
      throw new PatternValidationError(
        pattern,
        `${type} pattern at index ${i} cannot be empty`
      );
    }

    // Validate the individual pattern
    try {
      validateGlobPattern(pattern);
    } catch (error) {
      if (error instanceof PatternValidationError) {
        // Re-throw with additional context about array position and type
        throw new PatternValidationError(
          pattern,
          `${type} pattern at index ${i}: ${error.reason}`
        );
      }
      throw error;
    }
  }

  // Check for reasonable array length
  if (patterns.length > LIMITS.MAX_PATTERNS) {
    throw new PatternValidationError(
      `${patterns.length} patterns provided`,
      `Too many ${type} patterns. Maximum ${LIMITS.MAX_PATTERNS} allowed. Try using fewer, more specific patterns.`
    );
  }
}

/**
 * Validates a complete pattern configuration object
 * @param config - Configuration object with include/exclude patterns
 * @throws PatternValidationError if configuration is invalid
 */
export function validatePatternConfig(config: {
  include?: unknown;
  exclude?: unknown;
}): void {
  if (config.include !== undefined) {
    validatePatternArray(config.include, 'include');
  }

  if (config.exclude !== undefined) {
    validatePatternArray(config.exclude, 'exclude');
  }
}