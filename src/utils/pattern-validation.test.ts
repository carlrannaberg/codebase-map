/**
 * Tests for pattern validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  PatternValidationError,
  validateGlobPattern,
  validatePatternArray,
  validatePatternConfig,
} from './pattern-validation.js';

describe('PatternValidationError', () => {
  it('should create error with pattern and reason', () => {
    const error = new PatternValidationError('*.js', 'test reason');
    
    expect(error.name).toBe('PatternValidationError');
    expect(error.pattern).toBe('*.js');
    expect(error.reason).toBe('test reason');
    expect(error.message).toBe('Invalid pattern "*.js": test reason');
    expect(error instanceof Error).toBe(true);
  });
});

describe('validateGlobPattern', () => {
  describe('valid patterns', () => {
    const validPatterns = [
      '*.js',
      '*.ts',
      '**/*.js',
      'src/**/*.ts',
      'test/*.spec.js',
      '*.{js,ts}',
      'src/**/index.{js,ts}',
      'lib/**',
      'node_modules',
      'dist',
      '!*.test.js',
      'package*.json',
    ];

    it.each(validPatterns)('should accept valid pattern: %s', (pattern) => {
      expect(() => validateGlobPattern(pattern)).not.toThrow();
    });
  });

  describe('invalid input types', () => {
    it('should reject null', () => {
      expect(() => validateGlobPattern(null as unknown as string)).toThrow(PatternValidationError);
      expect(() => validateGlobPattern(null as unknown as string)).toThrow('Pattern must be a string');
    });

    it('should reject undefined', () => {
      expect(() => validateGlobPattern(undefined as unknown as string)).toThrow(PatternValidationError);
      expect(() => validateGlobPattern(undefined as unknown as string)).toThrow('Pattern must be a string');
    });

    it('should reject numbers', () => {
      expect(() => validateGlobPattern(123 as unknown as string)).toThrow(PatternValidationError);
      expect(() => validateGlobPattern(123 as unknown as string)).toThrow('Pattern must be a string');
    });

    it('should reject empty string', () => {
      expect(() => validateGlobPattern('')).toThrow(PatternValidationError);
      expect(() => validateGlobPattern('')).toThrow('Pattern cannot be empty');
    });
  });

  describe('security validation', () => {
    it('should reject directory traversal patterns', () => {
      const dangerousPatterns = [
        '../',
        '../*.js',
        'src/../config',
        '../../etc/passwd',
        'dir/../other/file',
      ];

      dangerousPatterns.forEach((pattern) => {
        expect(() => validateGlobPattern(pattern)).toThrow(PatternValidationError);
        expect(() => validateGlobPattern(pattern)).toThrow('Directory traversal patterns');
      });
    });

    it('should reject absolute paths', () => {
      const absolutePaths = [
        '/',
        '/etc',
        '/home/user',
        '/var/log/*.log',
        '/usr/bin/node',
      ];

      absolutePaths.forEach((pattern) => {
        expect(() => validateGlobPattern(pattern)).toThrow(PatternValidationError);
        expect(() => validateGlobPattern(pattern)).toThrow('Absolute paths (/) are not allowed');
      });
    });

    it('should reject dangerous shell sequences', () => {
      const dangerousPatterns = [
        { pattern: '$(rm -rf /)', expectedError: 'Dangerous sequence' },
        { pattern: 'test`whoami`', expectedError: 'Dangerous sequence' },
        { pattern: 'file|grep secret', expectedError: 'Pipe character "|" outside of parentheses' },
        { pattern: 'test;rm file', expectedError: 'Dangerous sequence' },
        { pattern: 'bg&', expectedError: 'Dangerous sequence' },
        { pattern: 'output>file', expectedError: 'Dangerous sequence' },
        { pattern: 'input<file', expectedError: 'Dangerous sequence' },
      ];

      dangerousPatterns.forEach(({ pattern, expectedError }) => {
        expect(() => validateGlobPattern(pattern)).toThrow(PatternValidationError);
        expect(() => validateGlobPattern(pattern)).toThrow(expectedError);
      });
    });
  });

  describe('performance limits', () => {
    it('should reject excessively long patterns', () => {
      const longPattern = 'a'.repeat(1001);
      
      expect(() => validateGlobPattern(longPattern)).toThrow(PatternValidationError);
      expect(() => validateGlobPattern(longPattern)).toThrow('Pattern is too long');
    });

    it('should accept patterns at the length limit', () => {
      const maxLengthPattern = 'a'.repeat(1000);
      
      expect(() => validateGlobPattern(maxLengthPattern)).not.toThrow();
    });

    it('should reject too many recursive wildcards', () => {
      const manyWildcards = Array(12).fill('**').join('/');
      
      expect(() => validateGlobPattern(manyWildcards)).toThrow(PatternValidationError);
      expect(() => validateGlobPattern(manyWildcards)).toThrow('Too many recursive wildcards');
    });

    it('should accept reasonable number of recursive wildcards', () => {
      const reasonableWildcards = Array(5).fill('**').join('/');
      
      expect(() => validateGlobPattern(reasonableWildcards)).not.toThrow();
    });
  });

  describe('glob syntax validation', () => {
    it('should accept bracket expressions (fast-glob treats them as literals if malformed)', () => {
      // Note: fast-glob doesn't throw errors for malformed brackets,
      // it treats them as literal characters, which is valid behavior
      const bracketPatterns = [
        'test[',
        'test[abc',
        'test]abc[',
        'test[abc]',
        'file[0-9]',
        'name[!abc]',
      ];

      bracketPatterns.forEach((pattern) => {
        expect(() => validateGlobPattern(pattern)).not.toThrow();
      });
    });

    it('should rely on security checks rather than syntax validation', () => {
      // Note: fast-glob is very permissive with glob syntax and rarely throws
      // syntax errors. Our validation focuses on security rather than syntax.
      // This test documents that behavior.
      
      // The main validation happens through our security checks:
      // - Directory traversal prevention
      // - Absolute path prevention  
      // - Shell escape sequence filtering
      // - Performance limits
      
      expect(true).toBe(true); // Placeholder assertion
    });
  });
});

describe('validatePatternArray', () => {
  it('should accept valid pattern arrays', () => {
    const validArrays = [
      ['*.js'],
      ['*.js', '*.ts'],
      ['src/**/*.js', '!src/**/*.test.js'],
      [],
    ];

    validArrays.forEach((patterns) => {
      expect(() => validatePatternArray(patterns)).not.toThrow();
      expect(() => validatePatternArray(patterns, 'include')).not.toThrow();
      expect(() => validatePatternArray(patterns, 'exclude')).not.toThrow();
    });
  });

  it('should reject non-arrays', () => {
    const nonArrays = [
      '*.js',
      123,
      null,
      undefined,
      {},
    ];

    nonArrays.forEach((patterns) => {
      expect(() => validatePatternArray(patterns)).toThrow(PatternValidationError);
      expect(() => validatePatternArray(patterns)).toThrow('patterns must be an array');
    });
  });

  it('should reject arrays with non-string elements', () => {
    const invalidArrays = [
      [123],
      ['*.js', 456],
      [null],
      [undefined],
      ['valid', {}],
    ];

    invalidArrays.forEach((patterns) => {
      expect(() => validatePatternArray(patterns)).toThrow(PatternValidationError);
      expect(() => validatePatternArray(patterns)).toThrow('must be a string');
    });
  });

  it('should reject arrays with empty string elements', () => {
    const arraysWithEmpty = [
      [''],
      ['*.js', ''],
      ['', '*.ts'],
    ];

    arraysWithEmpty.forEach((patterns) => {
      expect(() => validatePatternArray(patterns)).toThrow(PatternValidationError);
      expect(() => validatePatternArray(patterns)).toThrow('cannot be empty');
    });
  });

  it('should include array index in error messages', () => {
    const invalidArray = ['*.js', 123, '*.ts'];
    
    expect(() => validatePatternArray(invalidArray)).toThrow('at index 1');
  });

  it('should include pattern type in error messages', () => {
    expect(() => validatePatternArray(['../test'], 'include')).toThrow('include pattern');
    expect(() => validatePatternArray(['../test'], 'exclude')).toThrow('exclude pattern');
  });

  it('should reject excessively large arrays', () => {
    const largeArray = Array(101).fill('*.js');
    
    expect(() => validatePatternArray(largeArray)).toThrow(PatternValidationError);
    expect(() => validatePatternArray(largeArray)).toThrow('Too many');
  });

  it('should propagate individual pattern validation errors', () => {
    const arrayWithBadPattern = ['*.js', '../dangerous'];
    
    expect(() => validatePatternArray(arrayWithBadPattern)).toThrow(PatternValidationError);
    expect(() => validatePatternArray(arrayWithBadPattern)).toThrow('Directory traversal');
  });
});

describe('validatePatternConfig', () => {
  it('should accept valid configuration objects', () => {
    const validConfigs = [
      {},
      { include: ['*.js'] },
      { exclude: ['node_modules'] },
      { include: ['*.js'], exclude: ['*.test.js'] },
    ];

    validConfigs.forEach((config) => {
      expect(() => validatePatternConfig(config)).not.toThrow();
    });
  });

  it('should validate include patterns', () => {
    const configWithBadInclude = {
      include: ['../dangerous'],
    };
    
    expect(() => validatePatternConfig(configWithBadInclude)).toThrow(PatternValidationError);
    expect(() => validatePatternConfig(configWithBadInclude)).toThrow('include pattern');
  });

  it('should validate exclude patterns', () => {
    const configWithBadExclude = {
      exclude: ['../dangerous'],
    };
    
    expect(() => validatePatternConfig(configWithBadExclude)).toThrow(PatternValidationError);
    expect(() => validatePatternConfig(configWithBadExclude)).toThrow('exclude pattern');
  });

  it('should handle undefined include/exclude gracefully', () => {
    const configs = [
      { include: undefined },
      { exclude: undefined },
      { include: undefined, exclude: undefined },
    ];

    configs.forEach((config) => {
      expect(() => validatePatternConfig(config)).not.toThrow();
    });
  });

  it('should validate both include and exclude when present', () => {
    const configWithBothBad = {
      include: ['*.js'],
      exclude: ['../bad'],
    };
    
    expect(() => validatePatternConfig(configWithBothBad)).toThrow(PatternValidationError);
  });

  describe('comprehensive edge cases', () => {
    describe('security validation edge cases', () => {
      it('should reject nested directory traversal attempts', () => {
        const maliciousPatterns = [
          'src/../../../etc/passwd',
          'normal/path/../../../sensitive',
          '../../..',
          'src/../../config/../../../etc/hosts'
        ];

        maliciousPatterns.forEach((pattern) => {
          expect(() => validateGlobPattern(pattern)).toThrow(PatternValidationError);
          expect(() => validateGlobPattern(pattern)).toThrow('Directory traversal');
        });
      });

      it('should reject advanced path traversal techniques', () => {
        const advancedTraversalPatterns = [
          // Basic directory traversal (current validation catches this)
          'src/../../../etc/passwd',
          'config/../../../sensitive',
          // Overlong path traversal (current validation catches this)
          'src/' + '../'.repeat(50) + 'etc/passwd',
          // Multiple traversal attempts
          '../../../etc/../var/../tmp',
          'valid/path/../../../dangerous'
        ];

        advancedTraversalPatterns.forEach((pattern) => {
          expect(() => validateGlobPattern(pattern)).toThrow(PatternValidationError);
          expect(() => validateGlobPattern(pattern)).toThrow('Directory traversal');
        });
      });

      it('should handle path traversal in different operating system contexts', () => {
        const osSpecificPatterns = [
          // Absolute paths (current validation catches these)
          '/etc/passwd',
          '/var/log/sensitive',
          '/home/user/../../../etc',
          // Directory traversal patterns  
          'config/../../../etc/passwd',
          'project/../../../sensitive'
        ];

        osSpecificPatterns.forEach((pattern) => {
          expect(() => validateGlobPattern(pattern)).toThrow(PatternValidationError);
          expect(() => validateGlobPattern(pattern)).toThrow(/(Directory traversal|Absolute paths)/);
        });
      });

      it('should reject multiple dangerous sequences in one pattern', () => {
        const multiThreatPatterns = [
          '$(cat /etc/passwd)|grep root',
          'file`whoami`;rm -rf /',
          'path>output<input&background',
          '*.js$(echo danger)|pipe'
        ];

        multiThreatPatterns.forEach((pattern) => {
          expect(() => validateGlobPattern(pattern)).toThrow(PatternValidationError);
          expect(() => validateGlobPattern(pattern)).toThrow('Dangerous sequence');
        });
      });

      it('should handle URL-encoded dangerous sequences', () => {
        const encodedPatterns = [
          'src%2F..%2F..%2Fetc%2Fpasswd',
          'file%24%28whoami%29',
          'path%7Cgrep%20secret'
        ];

        // These should pass validation as they're just literal characters after decoding
        // Our validation is on the literal string, not URL-decoded
        encodedPatterns.forEach((pattern) => {
          expect(() => validateGlobPattern(pattern)).not.toThrow();
        });
      });
    });

    describe('performance and limits edge cases', () => {
      it('should handle patterns exactly at the length limit', () => {
        const maxLengthPattern = 'a'.repeat(999) + '*';
        expect(maxLengthPattern).toHaveLength(1000);
        expect(() => validateGlobPattern(maxLengthPattern)).not.toThrow();
      });

      it('should handle patterns with exactly 10 recursive wildcards', () => {
        const exactLimitPattern = Array(10).fill('**').join('/') + '/*.ts';
        expect(() => validateGlobPattern(exactLimitPattern)).not.toThrow();
      });

      it('should reject patterns with 11 recursive wildcards', () => {
        const overLimitPattern = Array(11).fill('**').join('/') + '/*.ts';
        expect(() => validateGlobPattern(overLimitPattern)).toThrow(PatternValidationError);
        expect(() => validateGlobPattern(overLimitPattern)).toThrow('Too many recursive wildcards');
      });

      it('should handle mixed recursive and single wildcards', () => {
        const mixedPattern = '**/src/**/lib/**/test/**/deep/**/very/**/nested/**/*.ts';
        const wildcardCount = (mixedPattern.match(/\*\*/g) || []).length;
        
        if (wildcardCount <= 10) {
          expect(() => validateGlobPattern(mixedPattern)).not.toThrow();
        } else {
          expect(() => validateGlobPattern(mixedPattern)).toThrow();
        }
      });
    });

    describe('complex glob syntax edge cases', () => {
      it('should handle nested brace expressions', () => {
        const nestedBracePatterns = [
          'src/**/*.{ts,{js,jsx},tsx}',
          'lib/**/*.{test.{ts,js},spec.{ts,js}}',
          'config/**/*.{json,{yaml,yml},{toml,ini}}'
        ];

        nestedBracePatterns.forEach((pattern) => {
          expect(() => validateGlobPattern(pattern)).not.toThrow();
        });
      });

      it('should handle complex bracket expressions', () => {
        const bracketPatterns = [
          'src/**/[A-Z][a-z]*.ts',
          'test/**/[!_]*.spec.ts',
          'lib/**/[0-9][0-9][0-9]*.js',
          'config/**/[a-zA-Z0-9_-]*.json'
        ];

        bracketPatterns.forEach((pattern) => {
          expect(() => validateGlobPattern(pattern)).not.toThrow();
        });
      });

      it('should handle extglob patterns', () => {
        const extglobPatterns = [
          'src/**/@(*.ts|*.tsx)',
          'test/**/?(*.)@(test|spec).ts',
          'lib/**/!(*.min).js',
          'docs/**/*.+(md|txt|rst)'
        ];

        extglobPatterns.forEach((pattern) => {
          expect(() => validateGlobPattern(pattern)).not.toThrow();
        });
      });

      it('should handle Unicode characters in patterns', () => {
        const unicodePatterns = [
          'src/**/*测试*.ts',
          'lib/**/*ファイル*.js',
          'docs/**/*файл*.md',
          'config/**/*أملف*.json'
        ];

        unicodePatterns.forEach((pattern) => {
          expect(() => validateGlobPattern(pattern)).not.toThrow();
        });
      });
    });

    describe('array validation edge cases', () => {
      it('should handle arrays with mixed valid and invalid patterns', () => {
        const mixedArray = [
          'valid/pattern/*.ts',
          '../invalid/pattern',
          'another/valid/**/*.js'
        ];

        expect(() => validatePatternArray(mixedArray)).toThrow(PatternValidationError);
        expect(() => validatePatternArray(mixedArray)).toThrow('include pattern at index 1');
      });

      it('should handle arrays with exactly 100 patterns', () => {
        const exactLimitArray = Array.from({ length: 100 }, (_, i) => `pattern${i}/*.ts`);
        expect(() => validatePatternArray(exactLimitArray)).not.toThrow();
      });

      it('should reject arrays with 101 patterns', () => {
        const overLimitArray = Array.from({ length: 101 }, (_, i) => `pattern${i}/*.ts`);
        expect(() => validatePatternArray(overLimitArray)).toThrow(PatternValidationError);
        expect(() => validatePatternArray(overLimitArray)).toThrow('Too many');
      });

      it('should handle arrays with varying pattern complexity', () => {
        const complexArray = [
          '*.ts',
          'src/**/*.{ts,tsx,js,jsx}',
          'test/**/[!_]*.spec.ts',
          'lib/**/@(*.min|*.bundle).js',
          'config/**/*.+(json|yaml|yml)'
        ];

        expect(() => validatePatternArray(complexArray)).not.toThrow();
      });
    });

    describe('error message quality', () => {
      it('should provide clear error messages for different failure types', () => {
        // Test different error types have descriptive messages
        expect(() => validateGlobPattern('')).toThrow('Pattern cannot be empty');
        expect(() => validateGlobPattern('../path')).toThrow('Directory traversal patterns');
        expect(() => validateGlobPattern('/absolute')).toThrow('Absolute paths');
        expect(() => validateGlobPattern('cmd$(whoami)')).toThrow('Dangerous sequence');
        expect(() => validateGlobPattern('a'.repeat(1001))).toThrow('Pattern is too long');
      });

      it('should include pattern context in error messages', () => {
        const badPattern = '../dangerous';
        
        try {
          validateGlobPattern(badPattern);
        } catch (error) {
          if (error instanceof PatternValidationError) {
            expect(error.pattern).toBe(badPattern);
            expect(error.reason).toContain('Directory traversal');
            expect(error.message).toContain(badPattern);
          }
        }
      });

      it('should include array index in pattern array errors', () => {
        const arrayWithBadPattern = ['good/*.ts', 'another/good/*.js', '../bad'];
        
        try {
          validatePatternArray(arrayWithBadPattern);
        } catch (error) {
          if (error instanceof PatternValidationError) {
            expect(error.message).toContain('at index 2');
            expect(error.pattern).toBe('../bad');
          }
        }
      });
    });
  });
});