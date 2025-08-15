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
});