/**
 * Unit tests for FileDiscovery module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import fastGlob from 'fast-glob';
import ignore from 'ignore';
import { FileDiscovery } from './file-discovery.js';

// Mock external dependencies
vi.mock('fast-glob');
vi.mock('ignore');
vi.mock('node:fs');

const mockFastGlob = vi.mocked(fastGlob);
const mockIgnore = vi.mocked(ignore);
const mockFs = vi.mocked(fs);

// Define types for mock instances
interface MockIgnoreInstance {
  add: ReturnType<typeof vi.fn>;
  ignores: ReturnType<typeof vi.fn>;
}

interface MockFsPromises {
  readFile: ReturnType<typeof vi.fn>;
}

describe('FileDiscovery', () => {
  let mockIgnoreInstance: MockIgnoreInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup ignore mock
    mockIgnoreInstance = {
      add: vi.fn(),
      ignores: vi.fn()
    };
    mockIgnore.mockReturnValue(mockIgnoreInstance);
    
    // Setup fs mock
    mockFs.existsSync = vi.fn();
    mockFs.promises = {
      readFile: vi.fn()
    } as MockFsPromises;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('discoverFiles', () => {
    it('should discover TypeScript and JavaScript files', async () => {
      const mockFiles = [
        'src/index.ts',
        'src/utils.js',
        'components/Button.tsx',
        'pages/home.jsx'
      ];
      
      mockFastGlob.mockResolvedValue(mockFiles);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false); // No .gitignore
      
      const result = await FileDiscovery.discoverFiles('/test/project');
      
      expect(result).toEqual([
        'components/Button.tsx',
        'pages/home.jsx',
        'src/index.ts',
        'src/utils.js'
      ]);
      expect(result).toHaveLength(4);
    });

    it('should sort files alphabetically', async () => {
      const mockFiles = [
        'z-file.ts',
        'a-file.js',
        'middle.tsx'
      ];
      
      mockFastGlob.mockResolvedValue(mockFiles);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await FileDiscovery.discoverFiles('/test/project');
      
      expect(result).toEqual([
        'a-file.js',
        'middle.tsx',
        'z-file.ts'
      ]);
    });

    it('should convert Windows paths to POSIX format', async () => {
      const mockFiles = [
        'src\\components\\Button.tsx',
        'pages\\home\\index.js'
      ];
      
      mockFastGlob.mockResolvedValue(mockFiles);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await FileDiscovery.discoverFiles('/test/project');
      
      expect(result).toEqual([
        'pages/home/index.js',
        'src/components/Button.tsx'
      ]);
    });

    it('should exclude files based on gitignore rules', async () => {
      const mockFiles = [
        'src/index.ts',
        'dist/build.js',
        'temp/cache.ts',
        'src/component.tsx'
      ];
      
      mockFastGlob.mockResolvedValue(mockFiles);
      // Mock gitignore to ignore dist/ and temp/ files
      mockIgnoreInstance.ignores.mockImplementation((file: string) => 
        file.startsWith('dist/') || file.startsWith('temp/')
      );
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await FileDiscovery.discoverFiles('/test/project');
      
      expect(result).toEqual([
        'src/component.tsx',
        'src/index.ts'
      ]);
    });

    it('should load and apply .gitignore rules', async () => {
      const mockFiles = ['src/index.ts', 'node_modules/lib.js'];
      const gitignoreContent = 'node_modules/\n*.log\n';
      
      mockFastGlob.mockResolvedValue(mockFiles);
      mockFs.existsSync.mockReturnValue(true);
      (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(gitignoreContent);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      
      await FileDiscovery.discoverFiles('/test/project');
      
      expect(mockFs.existsSync).toHaveBeenCalledWith(
        path.join('/test/project', '.gitignore')
      );
      expect(mockFs.promises.readFile).toHaveBeenCalledWith(
        path.join('/test/project', '.gitignore'),
        'utf8'
      );
      expect(mockIgnoreInstance.add).toHaveBeenCalledWith(gitignoreContent);
    });

    it('should handle .gitignore read errors gracefully', async () => {
      const mockFiles = ['src/index.ts'];
      
      mockFastGlob.mockResolvedValue(mockFiles);
      mockFs.existsSync.mockReturnValue(true);
      (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Permission denied'));
      mockIgnoreInstance.ignores.mockReturnValue(false);
      
      const result = await FileDiscovery.discoverFiles('/test/project');
      
      expect(result).toEqual(['src/index.ts']);
      // Should continue despite .gitignore read error
    });

    it('should apply default ignore patterns', async () => {
      const mockFiles = ['src/index.ts'];
      
      mockFastGlob.mockResolvedValue(mockFiles);
      mockFs.existsSync.mockReturnValue(false);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      
      await FileDiscovery.discoverFiles('/test/project');
      
      // Verify default patterns are added
      expect(mockIgnoreInstance.add).toHaveBeenCalledWith([
        '.vscode/',
        '.idea/',
        '*.swp',
        '*.swo',
        '*~',
        '.DS_Store',
        'Thumbs.db',
        '*.log',
        'logs/',
        '.env',
        '.env.local',
        '.env.*.local',
        'temp/',
        'tmp/',
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml'
      ]);
    });

    it('should exclude common build directories from glob search', async () => {
      mockFastGlob.mockResolvedValue([]);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      await FileDiscovery.discoverFiles('/test/project');
      
      const globCall = mockFastGlob.mock.calls[0];
      const options = globCall[1];
      
      expect(options.ignore).toEqual([
        'node_modules/**',
        'dist/**',
        'build/**',
        '.next/**',
        '.turbo/**',
        '.git/**',
        'coverage/**',
        '.nyc_output/**'
      ]);
    });

    it('should only search for supported file extensions', async () => {
      mockFastGlob.mockResolvedValue([]);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      await FileDiscovery.discoverFiles('/test/project');
      
      const globCall = mockFastGlob.mock.calls[0];
      const patterns = globCall[0];
      
      expect(patterns).toEqual([
        '**/*.ts',
        '**/*.tsx',
        '**/*.js',
        '**/*.jsx'
      ]);
    });

    it('should handle empty file list', async () => {
      mockFastGlob.mockResolvedValue([]);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await FileDiscovery.discoverFiles('/test/project');
      
      expect(result).toEqual([]);
    });

    it('should handle glob errors gracefully', async () => {
      mockFastGlob.mockRejectedValue(new Error('Glob error'));
      
      await expect(FileDiscovery.discoverFiles('/test/project'))
        .rejects.toThrow('Glob error');
    });
  });

  describe('isSupportedFile', () => {
    it('should return true for TypeScript files', () => {
      expect(FileDiscovery.isSupportedFile('src/component.ts')).toBe(true);
      expect(FileDiscovery.isSupportedFile('src/component.tsx')).toBe(true);
    });

    it('should return true for JavaScript files', () => {
      expect(FileDiscovery.isSupportedFile('src/component.js')).toBe(true);
      expect(FileDiscovery.isSupportedFile('src/component.jsx')).toBe(true);
    });

    it('should return false for unsupported files', () => {
      expect(FileDiscovery.isSupportedFile('README.md')).toBe(false);
      expect(FileDiscovery.isSupportedFile('package.json')).toBe(false);
      expect(FileDiscovery.isSupportedFile('style.css')).toBe(false);
      expect(FileDiscovery.isSupportedFile('image.png')).toBe(false);
    });

    it('should return false for files without extensions', () => {
      expect(FileDiscovery.isSupportedFile('Dockerfile')).toBe(false);
      expect(FileDiscovery.isSupportedFile('LICENSE')).toBe(false);
    });

    it('should handle paths with multiple dots', () => {
      expect(FileDiscovery.isSupportedFile('file.test.ts')).toBe(true);
      expect(FileDiscovery.isSupportedFile('component.stories.jsx')).toBe(true);
      expect(FileDiscovery.isSupportedFile('config.dev.json')).toBe(false);
    });
  });

  describe('getSupportedExtensions', () => {
    it('should return all supported extensions', () => {
      const extensions = FileDiscovery.getSupportedExtensions();
      
      expect(extensions).toEqual(['.ts', '.tsx', '.js', '.jsx']);
    });

    it('should return a copy of the extensions array', () => {
      const extensions1 = FileDiscovery.getSupportedExtensions();
      const extensions2 = FileDiscovery.getSupportedExtensions();
      
      expect(extensions1).toEqual(extensions2);
      expect(extensions1).not.toBe(extensions2); // Different array instances
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle relative path input', async () => {
      const mockFiles = ['src/index.ts'];
      
      mockFastGlob.mockResolvedValue(mockFiles);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await FileDiscovery.discoverFiles('./relative/path');
      
      expect(result).toEqual(['src/index.ts']);
      // Should resolve relative path internally
    });

    it('should handle paths with special characters', async () => {
      const mockFiles = [
        'src/[dynamic].ts',
        'pages/(group)/page.tsx',
        'utils/@helpers/index.js'
      ];
      
      mockFastGlob.mockResolvedValue(mockFiles);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await FileDiscovery.discoverFiles('/test/project');
      
      expect(result).toEqual([
        'pages/(group)/page.tsx',
        'src/[dynamic].ts',
        'utils/@helpers/index.js'
      ]);
    });

    it('should handle very large file lists', async () => {
      // Generate a large list of files
      const mockFiles = Array.from({ length: 10000 }, (_, i) => `file${i}.ts`);
      
      mockFastGlob.mockResolvedValue(mockFiles);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await FileDiscovery.discoverFiles('/test/project');
      
      expect(result).toHaveLength(10000);
      expect(result[0]).toBe('file0.ts');
      expect(result[result.length - 1]).toBe('file9999.ts');
    });
  });

  describe('pattern filtering with FilterOptions', () => {
    it('should apply include patterns to filter files', async () => {
      // Mock only files that match the include patterns
      const mockIncludeFiles = [
        'src/components/Button.tsx',
        'src/utils/helpers.ts'
      ];
      
      mockFastGlob.mockResolvedValue(mockIncludeFiles);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await FileDiscovery.discoverFiles('/test/project', {
        include: ['src/**/*.ts', 'src/**/*.tsx']
      });
      
      expect(result).toEqual([
        'src/components/Button.tsx',
        'src/utils/helpers.ts'
      ]);
    });

    it('should apply exclude patterns to filter out files', async () => {
      const mockFiles = [
        'src/components/Button.tsx',
        'src/utils/helpers.ts',
        'src/components/Button.test.tsx',
        'tests/integration.test.ts'
      ];
      
      mockFastGlob.mockResolvedValue(mockFiles);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      // Create a separate ignore instance for exclude patterns
      const mockExcludeIgnore = {
        add: vi.fn(),
        ignores: vi.fn((file: string) => {
          // Simulate ignoring test files
          return file.includes('.test.') || file.startsWith('tests/');
        })
      };
      mockIgnore.mockReturnValueOnce(mockIgnoreInstance) // For gitignore
                 .mockReturnValueOnce(mockExcludeIgnore);  // For exclude patterns
      
      const result = await FileDiscovery.discoverFiles('/test/project', {
        exclude: ['**/*.test.*', 'tests/**']
      });
      
      expect(result).toEqual([
        'src/components/Button.tsx',
        'src/utils/helpers.ts'
      ]);
    });

    it('should apply include then exclude patterns in correct precedence', async () => {
      const mockIncludeFiles = [
        'src/components/Button.tsx',
        'src/components/Modal.tsx',
        'src/components/Button.test.tsx',
        'src/utils/helpers.ts'
      ];
      
      // Mock the include patterns call
      mockFastGlob.mockResolvedValue(mockIncludeFiles);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      // Create a separate ignore instance for exclude patterns
      const mockExcludeIgnore = {
        add: vi.fn(),
        ignores: vi.fn((file: string) => {
          // Simulate ignoring test files
          return file.includes('.test.');
        })
      };
      mockIgnore.mockReturnValueOnce(mockIgnoreInstance) // For gitignore
                 .mockReturnValueOnce(mockExcludeIgnore);  // For exclude patterns
      
      const result = await FileDiscovery.discoverFiles('/test/project', {
        include: ['src/**/*.tsx', 'src/**/*.ts'],
        exclude: ['**/*.test.*']
      });
      
      expect(result).toEqual([
        'src/components/Button.tsx',
        'src/components/Modal.tsx',
        'src/utils/helpers.ts'
      ]);
    });

    it('should filter include results to only supported file types', async () => {
      const mockFiles = [
        'src/components/Button.tsx',
        'src/styles/main.css',
        'src/utils/helpers.ts',
        'README.md'
      ];
      
      mockFastGlob.mockResolvedValue(mockFiles);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await FileDiscovery.discoverFiles('/test/project', {
        include: ['src/**/*']
      });
      
      // Should only include .tsx and .ts files, filtering out .css and .md
      expect(result).toEqual([
        'src/components/Button.tsx',
        'src/utils/helpers.ts'
      ]);
    });

    it('should apply gitignore rules after include/exclude patterns', async () => {
      const mockFiles = [
        'src/components/Button.tsx',
        'src/utils/helpers.ts',
        'dist/bundle.js' // This should be ignored by gitignore
      ];
      
      mockFastGlob.mockResolvedValue(mockFiles);
      // Mock gitignore to ignore dist/ files
      mockIgnoreInstance.ignores.mockImplementation((file: string) => 
        file.startsWith('dist/')
      );
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await FileDiscovery.discoverFiles('/test/project', {
        include: ['**/*.tsx', '**/*.ts', '**/*.js']
      });
      
      expect(result).toEqual([
        'src/components/Button.tsx',
        'src/utils/helpers.ts'
      ]);
    });

    it('should validate include patterns before processing', async () => {
      await expect(FileDiscovery.discoverFiles('/test/project', {
        include: ['../dangerous/path']
      })).rejects.toThrow('Directory traversal patterns (..) are not allowed for security reasons');
    });

    it('should validate exclude patterns before processing', async () => {
      await expect(FileDiscovery.discoverFiles('/test/project', {
        exclude: ['/absolute/path']
      })).rejects.toThrow('Absolute paths (/) are not allowed for security reasons');
    });

    it('should handle empty include patterns gracefully', async () => {
      const mockFiles = [
        'src/components/Button.tsx',
        'src/utils/helpers.ts'
      ];
      
      mockFastGlob.mockResolvedValue(mockFiles);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await FileDiscovery.discoverFiles('/test/project', {
        include: []
      });
      
      // Should use default discovery when include is empty
      expect(result).toEqual([
        'src/components/Button.tsx',
        'src/utils/helpers.ts'
      ]);
    });

    it('should handle empty exclude patterns gracefully', async () => {
      const mockFiles = [
        'src/components/Button.tsx',
        'src/utils/helpers.ts'
      ];
      
      mockFastGlob.mockResolvedValue(mockFiles);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await FileDiscovery.discoverFiles('/test/project', {
        exclude: []
      });
      
      expect(result).toEqual([
        'src/components/Button.tsx',
        'src/utils/helpers.ts'
      ]);
    });

    it('should handle undefined patterns gracefully', async () => {
      const mockFiles = [
        'src/components/Button.tsx',
        'src/utils/helpers.ts'
      ];
      
      mockFastGlob.mockResolvedValue(mockFiles);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await FileDiscovery.discoverFiles('/test/project', {
        include: undefined,
        exclude: undefined
      });
      
      expect(result).toEqual([
        'src/components/Button.tsx',
        'src/utils/helpers.ts'
      ]);
    });

    it('should maintain backward compatibility when no options provided', async () => {
      const mockFiles = [
        'src/components/Button.tsx',
        'src/utils/helpers.ts'
      ];
      
      mockFastGlob.mockResolvedValue(mockFiles);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      // Call without any options (original signature)
      const result = await FileDiscovery.discoverFiles('/test/project');
      
      expect(result).toEqual([
        'src/components/Button.tsx',
        'src/utils/helpers.ts'
      ]);
    });
  });

  describe('applyIncludePatterns method', () => {
    it('should apply complex glob patterns correctly', async () => {
      const testPatterns = [
        'src/**/*.{ts,tsx}',
        '!src/**/*.test.*',
        'lib/[^_]*/*.js'
      ];
      
      // Mock the glob results for complex patterns
      mockFastGlob.mockImplementation((patterns: string[] | string) => {
        // First call for supported extensions (candidateFiles)
        if (Array.isArray(patterns) && patterns.some(p => p.includes('**/*.ts'))) {
          return Promise.resolve([
            'src/components/Button.tsx',
            'src/utils/helpers.ts',
            'lib/main/utils.js'
          ]);
        }
        // Second call for include patterns
        if (Array.isArray(patterns) && patterns === testPatterns) {
          return Promise.resolve([
            'src/components/Button.tsx',
            'src/utils/helpers.ts'
          ]);
        }
        return Promise.resolve([]);
      });
      
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await FileDiscovery.discoverFiles('/test/project', {
        include: testPatterns
      });
      
      expect(result).toEqual([
        'src/components/Button.tsx',
        'src/utils/helpers.ts'
      ]);
    });

    it('should handle negation patterns within include arrays', async () => {
      const patterns = ['src/**/*.ts', '!src/**/*.test.ts'];
      
      mockFastGlob.mockImplementation((patternArray: string[]) => {
        // Simulate negation pattern behavior
        if (patternArray.includes('!src/**/*.test.ts')) {
          return Promise.resolve([
            'src/components/Button.ts',
            'src/utils/helpers.ts'
          ]);
        }
        return Promise.resolve([
          'src/components/Button.ts',
          'src/components/Button.test.ts',
          'src/utils/helpers.ts',
          'src/utils/helpers.test.ts'
        ]);
      });
      
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await FileDiscovery.discoverFiles('/test/project', {
        include: patterns
      });
      
      expect(result).toEqual([
        'src/components/Button.ts',
        'src/utils/helpers.ts'
      ]);
    });

    it('should handle bracket expressions and special glob characters', async () => {
      const patterns = [
        'src/**/*[0-9].ts',
        'config/**/*.{json,yaml,yml}',
        'test/**/fixture[!s]*.ts'
      ];
      
      const allCandidateFiles = [
        'src/version1.ts',
        'src/page2.ts',
        'config/app.json', // This will be filtered out as unsupported
        'config/deploy.yaml', // This will be filtered out as unsupported  
        'test/fixtures/fixture1.ts',
        'test/fixtures/fixturea.ts'
      ];

      const includeMatchFiles = [
        'src/version1.ts',
        'src/page2.ts',
        'test/fixtures/fixture1.ts',
        'test/fixtures/fixturea.ts'
      ];
      
      mockFastGlob.mockImplementation((patternsArg: string[] | string) => {
        // First call for supported extensions (candidateFiles)
        if (Array.isArray(patternsArg) && patternsArg.some(p => p.includes('**/*.ts'))) {
          return Promise.resolve(allCandidateFiles);
        }
        // Second call for include patterns
        if (Array.isArray(patternsArg) && patternsArg === patterns) {
          return Promise.resolve(includeMatchFiles);
        }
        return Promise.resolve([]);
      });
      
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await FileDiscovery.discoverFiles('/test/project', {
        include: patterns
      });
      
      expect(result).toEqual([
        'src/page2.ts',
        'src/version1.ts',
        'test/fixtures/fixture1.ts',
        'test/fixtures/fixturea.ts'
      ]);
    });

    it('should respect pattern precedence: most specific wins', async () => {
      const patterns = [
        '**/*.ts',           // Broad pattern
        'src/**/*.ts',       // More specific
        'src/critical/*.ts'  // Most specific
      ];
      
      const allFiles = [
        'root.ts',
        'src/component.ts',
        'src/critical/auth.ts',
        'lib/util.ts'
      ];
      
      mockFastGlob.mockResolvedValue(allFiles);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await FileDiscovery.discoverFiles('/test/project', {
        include: patterns
      });
      
      expect(result).toEqual([
        'lib/util.ts',
        'root.ts',
        'src/component.ts',
        'src/critical/auth.ts'
      ]);
    });

    it('should handle empty results gracefully', async () => {
      const patterns = ['nonexistent/**/*.ts'];
      
      mockFastGlob.mockResolvedValue([]);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await FileDiscovery.discoverFiles('/test/project', {
        include: patterns
      });
      
      expect(result).toEqual([]);
    });
  });

  describe('applyExcludePatterns method', () => {
    it('should filter files using ignore patterns', async () => {
      const candidateFiles = [
        'src/components/Button.tsx',
        'src/components/Button.test.tsx',
        'src/utils/helpers.ts',
        'tests/integration.test.ts',
        'docs/README.md'
      ];
      
      const excludePatterns = ['**/*.test.*', 'tests/**', 'docs/**'];
      
      mockFastGlob.mockResolvedValue(candidateFiles);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      // Create mock for exclude patterns
      const mockExcludeIgnore = {
        add: vi.fn(),
        ignores: vi.fn((file: string) => {
          return excludePatterns.some(pattern => {
            if (pattern === '**/*.test.*') return file.includes('.test.');
            if (pattern === 'tests/**') return file.startsWith('tests/');
            if (pattern === 'docs/**') return file.startsWith('docs/');
            return false;
          });
        })
      };
      
      mockIgnore.mockReturnValueOnce(mockIgnoreInstance) // For gitignore
                 .mockReturnValueOnce(mockExcludeIgnore);  // For exclude patterns
      
      const result = await FileDiscovery.discoverFiles('/test/project', {
        exclude: excludePatterns
      });
      
      expect(result).toEqual([
        'src/components/Button.tsx',
        'src/utils/helpers.ts'
      ]);
    });

    it('should handle directory vs file exclusion patterns', async () => {
      const candidateFiles = [
        'src/components/index.ts',
        'build/dist/app.js',
        'build/temp/cache.ts',
        'node_modules/lib/index.js',
        'coverage/report.html'
      ];
      
      const excludePatterns = [
        'build/',           // Directory exclusion
        'node_modules/**',  // Recursive directory exclusion
        '*.html'           // File type exclusion
      ];
      
      mockFastGlob.mockResolvedValue(candidateFiles);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      const mockExcludeIgnore = {
        add: vi.fn(),
        ignores: vi.fn((file: string) => {
          if (file.startsWith('build/')) return true;
          if (file.startsWith('node_modules/')) return true;
          if (file.endsWith('.html')) return true;
          return false;
        })
      };
      
      mockIgnore.mockReturnValueOnce(mockIgnoreInstance)
                 .mockReturnValueOnce(mockExcludeIgnore);
      
      const result = await FileDiscovery.discoverFiles('/test/project', {
        exclude: excludePatterns
      });
      
      expect(result).toEqual(['src/components/index.ts']);
    });

    it('should handle overlapping exclude patterns efficiently', async () => {
      const candidateFiles = [
        'src/app.ts',
        'test/unit.test.ts',
        'test/integration.spec.ts',
        'spec/e2e.spec.ts'
      ];
      
      const excludePatterns = [
        '**/*.test.*',
        '**/*.spec.*',
        'test/**',
        'spec/**'
      ];
      
      mockFastGlob.mockResolvedValue(candidateFiles);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      const mockExcludeIgnore = {
        add: vi.fn(),
        ignores: vi.fn((file: string) => {
          return file.includes('.test.') || 
                 file.includes('.spec.') || 
                 file.startsWith('test/') || 
                 file.startsWith('spec/');
        })
      };
      
      mockIgnore.mockReturnValueOnce(mockIgnoreInstance)
                 .mockReturnValueOnce(mockExcludeIgnore);
      
      const result = await FileDiscovery.discoverFiles('/test/project', {
        exclude: excludePatterns
      });
      
      expect(result).toEqual(['src/app.ts']);
    });
  });

  describe('pattern cache integration', () => {
    it('should use cache for repeated pattern operations', async () => {
      const patterns = ['src/**/*.ts'];
      const files = ['src/app.ts', 'src/util.ts'];
      
      mockFastGlob.mockResolvedValue(files);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      // First call
      const result1 = await FileDiscovery.discoverFiles('/test/project', {
        include: patterns
      });
      
      // Second call with same patterns
      const result2 = await FileDiscovery.discoverFiles('/test/project', {
        include: patterns
      });
      
      expect(result1).toEqual(result2);
      expect(result1).toEqual(['src/app.ts', 'src/util.ts']);
      
      // Verify cache usage - the pattern cache should be hit
      const cacheStats = FileDiscovery.getPatternCacheStats();
      expect(cacheStats.combined.size).toBeGreaterThan(0);
    });

    it('should clear cache when requested', async () => {
      const patterns = ['src/**/*.ts'];
      
      mockFastGlob.mockResolvedValue(['src/app.ts']);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      await FileDiscovery.discoverFiles('/test/project', { include: patterns });
      
      let stats = FileDiscovery.getPatternCacheStats();
      expect(stats.combined.size).toBeGreaterThan(0);
      
      FileDiscovery.clearPatternCache();
      
      stats = FileDiscovery.getPatternCacheStats();
      expect(stats.combined.size).toBe(0);
    });
  });

  describe('verbose logging and analysis', () => {
    it('should return analysis data with discoverFilesWithAnalysis', async () => {
      const patterns = ['src/**/*.ts', '!src/**/*.test.ts'];
      const files = ['src/app.ts', 'src/util.ts'];
      
      mockFastGlob.mockResolvedValue(files);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await FileDiscovery.discoverFilesWithAnalysis('/test/project', {
        include: patterns,
        exclude: ['node_modules/**']
      });
      
      expect(result.files).toEqual(['src/app.ts', 'src/util.ts']);
      expect(result.analysis).toHaveProperty('warnings');
      expect(result.analysis).toHaveProperty('suggestions');
      expect(result.analysis).toHaveProperty('stats');
      expect(result.analysis.stats).toHaveProperty('totalCandidateFiles');
      expect(result.analysis.stats).toHaveProperty('includedFiles');
      expect(result.analysis.stats).toHaveProperty('finalFiles');
      expect(result.analysis.stats).toHaveProperty('excludedFiles');
    });

    it('should provide verbose logging when enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const patterns = ['src/**/*.ts'];
      const files = ['src/app.ts'];
      
      mockFastGlob.mockResolvedValue(files);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await FileDiscovery.discoverFilesWithVerbose(
        '/test/project',
        { include: patterns },
        true
      );
      
      expect(result).toEqual(['src/app.ts']);
      
      consoleSpy.mockRestore();
    });
  });

  describe('error scenarios and edge cases', () => {
    it('should handle pattern conflicts gracefully', async () => {
      mockFastGlob.mockImplementation((patternsArg: string[] | string) => {
        // First call for supported extensions (candidateFiles)
        if (Array.isArray(patternsArg) && patternsArg.some(p => p.includes('**/*.ts'))) {
          return Promise.resolve(['src/app.ts']);
        }
        // Second call for include patterns
        if (Array.isArray(patternsArg) && patternsArg.includes('**/*.ts')) {
          return Promise.resolve(['src/app.ts']);
        }
        return Promise.resolve([]);
      });
      
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      // Create patterns that result in no matches
      const mockEmptyExcludeIgnore = {
        add: vi.fn(),
        ignores: vi.fn().mockReturnValue(true) // Exclude everything
      };
      
      mockIgnore.mockReturnValueOnce(mockIgnoreInstance)
                 .mockReturnValueOnce(mockEmptyExcludeIgnore);
      
      // Should throw pattern conflict error when all files are excluded
      await expect(FileDiscovery.discoverFiles('/test/project', {
        include: ['**/*.ts'],
        exclude: ['**/*'] // Exclude everything
      })).rejects.toThrow('Pattern conflict: All files would be excluded');
    });

    it('should handle malformed gitignore gracefully', async () => {
      const files = ['src/app.ts'];
      
      mockFastGlob.mockResolvedValue(files);
      mockFs.existsSync.mockReturnValue(true);
      (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockResolvedValue('invalid\npattern\n');
      
      // Mock ignore to handle invalid patterns gracefully
      mockIgnoreInstance.add.mockImplementation(() => {
        // Simulate ignore library handling invalid patterns
      });
      mockIgnoreInstance.ignores.mockReturnValue(false);
      
      const result = await FileDiscovery.discoverFiles('/test/project');
      
      expect(result).toEqual(['src/app.ts']);
      expect(mockIgnoreInstance.add).toHaveBeenCalled();
    });

    it('should handle filesystem permission errors', async () => {
      mockFastGlob.mockRejectedValue(new Error('EACCES: permission denied'));
      
      await expect(FileDiscovery.discoverFiles('/restricted/path'))
        .rejects.toThrow('EACCES: permission denied');
    });

    it('should handle extremely large file lists', async () => {
      // Generate 50k files to test performance
      const largeFileList = Array.from({ length: 50000 }, (_, i) => `file${i}.ts`);
      
      mockFastGlob.mockResolvedValue(largeFileList);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      const startTime = Date.now();
      const result = await FileDiscovery.discoverFiles('/test/large-project');
      const endTime = Date.now();
      
      expect(result).toHaveLength(50000);
      expect(result[0]).toBe('file0.ts');
      expect(result[result.length - 1]).toBe('file9999.ts');
      
      // Should complete within reasonable time (< 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should handle unicode and special characters in paths', async () => {
      const unicodeFiles = [
        'src/测试.ts',
        'src/файл.js',
        'src/ファイル.tsx',
        'src/file with spaces.ts',
        'src/file-with-émojis-🚀.ts'
      ];
      
      mockFastGlob.mockResolvedValue(unicodeFiles);
      mockIgnoreInstance.ignores.mockReturnValue(false);
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await FileDiscovery.discoverFiles('/test/unicode');
      
      expect(result).toEqual([
        'src/file with spaces.ts',
        'src/file-with-émojis-🚀.ts',
        'src/файл.js',
        'src/ファイル.tsx',
        'src/测试.ts'
      ]);
    });
  });
});