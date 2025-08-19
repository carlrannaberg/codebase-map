/**
 * Unit tests for structured pattern error types and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PatternError,
  InvalidPatternSyntaxError,
  SecurityViolationError,
  PatternConflictError,
  FileSystemError,
  UnexpectedPatternError,
  PatternPerformanceError,
  wrapUnknownError,
  createPatternConflictFromAnalysis,
  getExitCode,
  displayError,
  EXIT_CODES
} from './pattern-errors.js';

// Test interface for Node.js errors
interface TestNodeError extends Error {
  code?: string;
  path?: string;
}

describe('Pattern Error Classes', () => {
  describe('PatternError base class', () => {
    class TestPatternError extends PatternError {
      constructor(message: string) {
        super(
          message,
          'TEST_ERROR',
          { testContext: 'value' },
          ['Test suggestion'],
          ['https://test.com'],
          true
        );
      }
    }

    it('should create base error with all properties', () => {
      const error = new TestPatternError('Test message');
      
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.context).toEqual({ testContext: 'value' });
      expect(error.recoverySuggestions).toEqual(['Test suggestion']);
      expect(error.documentationLinks).toEqual(['https://test.com']);
      expect(error.isRecoverable).toBe(true);
      expect(error.name).toBe('TestPatternError');
    });

    it('should generate formatted CLI message', () => {
      const error = new TestPatternError('Test message');
      const formatted = error.getFormattedMessage();
      
      expect(formatted).toContain('❌ Test message');
      expect(formatted).toContain('Code: TEST_ERROR');
      expect(formatted).toContain('testContext: value');
      expect(formatted).toContain('💡 Recovery suggestions:');
      expect(formatted).toContain('1. Test suggestion');
      expect(formatted).toContain('📚 Documentation:');
      expect(formatted).toContain('- https://test.com');
    });

    it('should convert to JSON structure', () => {
      const error = new TestPatternError('Test message');
      const json = error.toJSON();
      
      expect(json).toEqual(expect.objectContaining({
        error: true,
        name: 'TestPatternError',
        message: 'Test message',
        code: 'TEST_ERROR',
        context: { testContext: 'value' },
        recoverySuggestions: ['Test suggestion'],
        documentationLinks: ['https://test.com'],
        isRecoverable: true
      }));
      expect(json.stack).toBeDefined();
    });
  });

  describe('InvalidPatternSyntaxError', () => {
    it('should create syntax error with pattern context', () => {
      const error = new InvalidPatternSyntaxError(
        '*.{js',
        'Unmatched brace',
        'glob validation'
      );
      
      expect(error.code).toBe('INVALID_PATTERN_SYNTAX');
      expect(error.message).toContain('Invalid pattern syntax: "*.{js" - Unmatched brace');
      expect(error.context).toEqual({
        pattern: '*.{js',
        operation: 'glob validation'
      });
      expect(error.isRecoverable).toBe(true);
    });

    it('should include file path when provided', () => {
      const error = new InvalidPatternSyntaxError(
        '*.{js',
        'Unmatched brace',
        'validation',
        '/path/to/file.ts'
      );
      
      expect(error.message).toContain('Invalid pattern syntax in /path/to/file.ts');
      expect(error.context.filePath).toBe('/path/to/file.ts');
    });

    it('should provide helpful recovery suggestions', () => {
      const error = new InvalidPatternSyntaxError('*.{js', 'Unmatched brace');
      
      expect(error.recoverySuggestions.some(s => s.includes('Check the glob pattern syntax'))).toBe(true);
      expect(error.recoverySuggestions.some(s => s.includes('Use double quotes around patterns'))).toBe(true);
    });
  });

  describe('SecurityViolationError', () => {
    it('should create security error with violation details', () => {
      const error = new SecurityViolationError(
        '../../../etc/passwd',
        'Directory traversal detected',
        'pattern validation'
      );
      
      expect(error.code).toBe('SECURITY_VIOLATION');
      expect(error.message).toContain('Security violation: "../../../etc/passwd"');
      expect(error.context).toEqual({
        pattern: '../../../etc/passwd',
        violation: 'Directory traversal detected',
        operation: 'pattern validation'
      });
      expect(error.isRecoverable).toBe(true);
    });

    it('should provide security-focused recovery suggestions', () => {
      const error = new SecurityViolationError('../path', 'Directory traversal');
      
      expect(error.recoverySuggestions.some(s => s.includes('Use relative paths'))).toBe(true);
      expect(error.recoverySuggestions.some(s => s.includes('Remove directory traversal sequences'))).toBe(true);
    });
  });

  describe('PatternConflictError', () => {
    it('should create conflict error for ALL_EXCLUDED scenario', () => {
      const includePatterns = ['src/**/*.ts'];
      const excludePatterns = ['**/*'];
      
      const error = new PatternConflictError(
        includePatterns,
        excludePatterns,
        'ALL_EXCLUDED',
        'pattern analysis'
      );
      
      expect(error.code).toBe('PATTERN_CONFLICT');
      expect(error.message).toContain('All files would be excluded');
      expect(error.context).toEqual({
        includePatterns,
        excludePatterns,
        conflictType: 'ALL_EXCLUDED',
        operation: 'pattern analysis'
      });
      expect(error.isRecoverable).toBe(true);
    });

    it('should create conflict error for CONTRADICTORY scenario', () => {
      const error = new PatternConflictError(
        ['src/**/*.ts'],
        ['src/**/*.ts'],
        'CONTRADICTORY'
      );
      
      expect(error.message).toContain('Include and exclude patterns contradict each other');
      expect(error.recoverySuggestions.some(s => s.includes('Ensure include patterns don\'t conflict'))).toBe(true);
    });

    it('should create conflict error for INEFFECTIVE scenario', () => {
      const error = new PatternConflictError(
        ['**/*'],
        [],
        'INEFFECTIVE'
      );
      
      expect(error.message).toContain('Current patterns don\'t significantly filter files');
      expect(error.recoverySuggestions.some(s => s.includes('Consider removing ineffective patterns'))).toBe(true);
    });

    it('should include file path when provided', () => {
      const error = new PatternConflictError(
        ['src/**/*.ts'],
        ['**/*'],
        'ALL_EXCLUDED',
        'analysis',
        '/path/to/config.json'
      );
      
      expect(error.message).toContain('in /path/to/config.json');
      expect(error.context.filePath).toBe('/path/to/config.json');
    });
  });

  describe('FileSystemError', () => {
    it('should create filesystem error with system context', () => {
      const systemError: TestNodeError = new Error('ENOENT: no such file or directory');
      systemError.code = 'ENOENT';
      
      const error = new FileSystemError(
        '/path/to/file',
        'file reading',
        'File not found',
        systemError
      );
      
      expect(error.code).toBe('FILESYSTEM_ERROR');
      expect(error.message).toContain('Filesystem error during file reading at "/path/to/file"');
      expect(error.context).toEqual({
        path: '/path/to/file',
        operation: 'file reading',
        cause: 'File not found',
        systemErrorCode: 'ENOENT',
        systemErrorMessage: 'ENOENT: no such file or directory'
      });
    });

    it('should provide specific suggestions for ENOENT errors', () => {
      const systemError: TestNodeError = new Error('File not found');
      systemError.code = 'ENOENT';
      
      const error = new FileSystemError('/path', 'reading', 'Not found', systemError);
      
      expect(error.recoverySuggestions.some(s => s.includes('Check that the file or directory exists'))).toBe(true);
      expect(error.isRecoverable).toBe(true);
    });

    it('should provide specific suggestions for EACCES errors', () => {
      const systemError: TestNodeError = new Error('Permission denied');
      systemError.code = 'EACCES';
      
      const error = new FileSystemError('/path', 'reading', 'No access', systemError);
      
      expect(error.recoverySuggestions.some(s => s.includes('Check file/directory permissions'))).toBe(true);
      expect(error.isRecoverable).toBe(true);
    });

    it('should provide specific suggestions for EMFILE errors', () => {
      const systemError: TestNodeError = new Error('Too many open files');
      systemError.code = 'EMFILE';
      
      const error = new FileSystemError('/path', 'reading', 'Too many files', systemError);
      
      expect(error.recoverySuggestions.some(s => s.includes('Too many open files'))).toBe(true);
      expect(error.isRecoverable).toBe(false);
    });
  });

  describe('UnexpectedPatternError', () => {
    it('should create unexpected error with original error context', () => {
      const originalError = new Error('Original error message');
      originalError.stack = 'Original stack trace';
      
      const error = new UnexpectedPatternError(
        'pattern processing',
        'Unexpected condition',
        { additionalContext: 'value' },
        originalError
      );
      
      expect(error.code).toBe('UNEXPECTED_ERROR');
      expect(error.message).toContain('Unexpected error during pattern processing');
      expect(error.context).toEqual({
        operation: 'pattern processing',
        cause: 'Unexpected condition',
        additionalContext: 'value',
        originalErrorName: 'Error',
        originalErrorMessage: 'Original error message',
        originalStack: 'Original stack trace'
      });
      expect(error.isRecoverable).toBe(false);
    });

    it('should provide bug reporting suggestions', () => {
      const error = new UnexpectedPatternError('test', 'test error');
      
      expect(error.recoverySuggestions.some(s => s.includes('Try the operation with simpler patterns'))).toBe(true);
    });
  });

  describe('PatternPerformanceError', () => {
    it('should create performance error with metrics', () => {
      const patterns = ['**/*', 'src/**/*', 'lib/**/*'];
      const metrics = {
        executionTime: 5000,
        memoryUsage: 1024000,
        patternCount: patterns.length
      };
      
      const error = new PatternPerformanceError(
        patterns,
        'Execution time exceeded threshold',
        metrics,
        'pattern matching'
      );
      
      expect(error.code).toBe('PATTERN_PERFORMANCE');
      expect(error.message).toContain('Performance issue with patterns');
      expect(error.context).toEqual({
        patterns,
        issue: 'Execution time exceeded threshold',
        metrics,
        operation: 'pattern matching'
      });
      expect(error.isRecoverable).toBe(true);
    });

    it('should provide performance optimization suggestions', () => {
      const error = new PatternPerformanceError(
        ['**/*'],
        'Slow execution',
        { time: 1000 }
      );
      
      expect(error.recoverySuggestions.some(s => s.includes('Reduce the number of patterns'))).toBe(true);
      expect(error.recoverySuggestions.some(s => s.includes('Use more specific patterns to limit'))).toBe(true);
    });
  });
});

describe('Error Utility Functions', () => {
  describe('wrapUnknownError', () => {
    it('should return PatternError as-is', () => {
      const originalError = new InvalidPatternSyntaxError('*.js', 'test');
      const wrapped = wrapUnknownError(originalError, 'test operation');
      
      expect(wrapped).toBe(originalError);
    });

    it('should wrap Node.js filesystem errors as FileSystemError', () => {
      const nodeError: TestNodeError = new Error('ENOENT: file not found');
      nodeError.code = 'ENOENT';
      nodeError.path = '/test/file.ts';
      
      const wrapped = wrapUnknownError(nodeError, 'file reading');
      
      expect(wrapped).toBeInstanceOf(FileSystemError);
      expect(wrapped.code).toBe('FILESYSTEM_ERROR');
      expect(wrapped.context.path).toBe('/test/file.ts');
    });

    it('should wrap regular errors as UnexpectedPatternError', () => {
      const regularError = new Error('Something went wrong');
      const wrapped = wrapUnknownError(regularError, 'test operation', { context: 'value' });
      
      expect(wrapped).toBeInstanceOf(UnexpectedPatternError);
      expect(wrapped.code).toBe('UNEXPECTED_ERROR');
      expect(wrapped.context).toMatchObject({
        context: 'value',
        originalErrorName: 'Error',
        originalErrorMessage: 'Something went wrong'
      });
    });

    it('should wrap unknown values as UnexpectedPatternError', () => {
      const unknownError = 'string error';
      const wrapped = wrapUnknownError(unknownError, 'test operation');
      
      expect(wrapped).toBeInstanceOf(UnexpectedPatternError);
      expect(wrapped.message).toContain('Unknown error: string error');
      expect(wrapped.context.originalError).toBe('string error');
    });
  });

  describe('createPatternConflictFromAnalysis', () => {
    it('should return null for healthy patterns', () => {
      const options = {
        include: ['src/**/*.ts'],
        exclude: ['**/*.test.*']
      };
      const stats = {
        totalCandidateFiles: 100,
        includedFiles: 80,
        finalFiles: 60,
        excludedFiles: 20
      };
      
      const conflict = createPatternConflictFromAnalysis(options, stats);
      expect(conflict).toBeNull();
    });

    it('should detect ALL_EXCLUDED conflicts', () => {
      const options = {
        include: ['src/**/*.ts'],
        exclude: ['**/*']
      };
      const stats = {
        totalCandidateFiles: 100,
        includedFiles: 50,
        finalFiles: 0,
        excludedFiles: 50
      };
      
      const conflict = createPatternConflictFromAnalysis(options, stats);
      expect(conflict).toBeInstanceOf(PatternConflictError);
      expect(conflict?.context.conflictType).toBe('ALL_EXCLUDED');
    });

    it('should detect CONTRADICTORY conflicts', () => {
      const options = {
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.ts'] // Same pattern in both
      };
      const stats = {
        totalCandidateFiles: 100,
        includedFiles: 50,
        finalFiles: 10,
        excludedFiles: 40 // 80% of included files excluded
      };
      
      const conflict = createPatternConflictFromAnalysis(options, stats);
      expect(conflict).toBeInstanceOf(PatternConflictError);
      expect(conflict?.context.conflictType).toBe('CONTRADICTORY');
    });

    it('should detect INEFFECTIVE conflicts', () => {
      const options = {
        include: ['**/*', '**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'], // 5 patterns
        exclude: []
      };
      const stats = {
        totalCandidateFiles: 1000,
        includedFiles: 990, // Very little filtering
        finalFiles: 990,
        excludedFiles: 0
      };
      
      const conflict = createPatternConflictFromAnalysis(options, stats);
      expect(conflict).toBeInstanceOf(PatternConflictError);
      expect(conflict?.context.conflictType).toBe('INEFFECTIVE');
    });

    it('should include file path when provided', () => {
      const options = { include: ['**/*'], exclude: ['**/*'] };
      const stats = {
        totalCandidateFiles: 100,
        includedFiles: 100,
        finalFiles: 0,
        excludedFiles: 100
      };
      
      const conflict = createPatternConflictFromAnalysis(
        options,
        stats,
        'test operation',
        '/config.json'
      );
      
      expect(conflict?.context.filePath).toBe('/config.json');
    });
  });

  describe('getExitCode', () => {
    it('should return correct exit codes for different error types', () => {
      const errors = [
        { error: new InvalidPatternSyntaxError('test', 'test'), code: EXIT_CODES.INVALID_PATTERN },
        { error: new SecurityViolationError('test', 'test'), code: EXIT_CODES.SECURITY_VIOLATION },
        { error: new PatternConflictError(['test'], ['test'], 'ALL_EXCLUDED'), code: EXIT_CODES.PATTERN_CONFLICT },
        { error: new FileSystemError('test', 'test', 'test'), code: EXIT_CODES.FILESYSTEM_ERROR },
        { error: new PatternPerformanceError(['test'], 'test', {}), code: EXIT_CODES.PERFORMANCE_ERROR },
        { error: new UnexpectedPatternError('test', 'test'), code: EXIT_CODES.UNEXPECTED_ERROR }
      ];
      
      errors.forEach(({ error, code }) => {
        expect(getExitCode(error)).toBe(code);
      });
    });

    it('should return UNEXPECTED_ERROR for unknown error codes', () => {
      const customError = new class extends PatternError {
        constructor() {
          super('test', 'UNKNOWN_CODE', {}, [], [], false);
        }
      }();
      
      expect(getExitCode(customError)).toBe(EXIT_CODES.UNEXPECTED_ERROR);
    });
  });

  describe('displayError', () => {
    let mockConsoleError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      mockConsoleError.mockRestore();
    });

    it('should display formatted error message', () => {
      const error = new InvalidPatternSyntaxError('*.js', 'test error');
      displayError(error);
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('❌ Invalid pattern syntax')
      );
      expect(mockConsoleError).toHaveBeenCalledWith(''); // Blank line
    });

    it('should display stack trace in verbose mode', () => {
      const error = new InvalidPatternSyntaxError('*.js', 'test error');
      error.stack = 'Test stack trace';
      
      displayError(error, true);
      
      expect(mockConsoleError).toHaveBeenCalledWith('\nStack trace:');
      expect(mockConsoleError).toHaveBeenCalledWith('Test stack trace');
    });

    it('should not display stack trace in non-verbose mode', () => {
      const error = new InvalidPatternSyntaxError('*.js', 'test error');
      error.stack = 'Test stack trace';
      
      displayError(error, false);
      
      expect(mockConsoleError).not.toHaveBeenCalledWith('\nStack trace:');
      expect(mockConsoleError).not.toHaveBeenCalledWith('Test stack trace');
    });
  });

  describe('EXIT_CODES constants', () => {
    it('should have all expected exit codes', () => {
      expect(EXIT_CODES.SUCCESS).toBe(0);
      expect(EXIT_CODES.INVALID_PATTERN).toBe(10);
      expect(EXIT_CODES.SECURITY_VIOLATION).toBe(11);
      expect(EXIT_CODES.PATTERN_CONFLICT).toBe(12);
      expect(EXIT_CODES.FILESYSTEM_ERROR).toBe(13);
      expect(EXIT_CODES.PERFORMANCE_ERROR).toBe(14);
      expect(EXIT_CODES.UNEXPECTED_ERROR).toBe(99);
    });

    it('should have unique exit codes', () => {
      const codes = Object.values(EXIT_CODES);
      const uniqueCodes = [...new Set(codes)];
      expect(codes).toHaveLength(uniqueCodes.length);
    });
  });
});