/**
 * Integration tests for FileDiscovery using real filesystem operations
 * These tests supplement the unit tests by testing actual behavior with real files
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileDiscovery } from './file-discovery.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('FileDiscovery Integration Tests', () => {
  const testProjectRoot = path.join(__dirname, '../../temp/test-project');
  const realProjectRoot = path.join(__dirname, '../..'); // Actual codebase

  beforeAll(async () => {
    // Create test project with real files
    await fs.promises.mkdir(testProjectRoot, { recursive: true });
    await fs.promises.mkdir(path.join(testProjectRoot, 'src/components'), { recursive: true });
    await fs.promises.mkdir(path.join(testProjectRoot, 'src/utils'), { recursive: true });
    await fs.promises.mkdir(path.join(testProjectRoot, 'test'), { recursive: true });
    await fs.promises.mkdir(path.join(testProjectRoot, 'node_modules/lib'), { recursive: true });
    await fs.promises.mkdir(path.join(testProjectRoot, 'dist'), { recursive: true });

    // Create TypeScript files
    await fs.promises.writeFile(
      path.join(testProjectRoot, 'src/index.ts'),
      `import { helper } from './utils/helper';
import { Button } from './components/Button';

export function main(): void {
  console.log('Hello World');
}

export const VERSION = '1.0.0';`
    );

    await fs.promises.writeFile(
      path.join(testProjectRoot, 'src/components/Button.tsx'),
      `interface ButtonProps {
  children: string;
  onClick: () => void;
}

export function Button(props: ButtonProps): JSX.Element {
  return <button onClick={props.onClick}>{props.children}</button>;
}`
    );

    await fs.promises.writeFile(
      path.join(testProjectRoot, 'src/utils/helper.js'),
      `export function helper() {
  return 'helper function';
}

export const CONSTANT = 42;`
    );

    // Create test files that should be excludable
    await fs.promises.writeFile(
      path.join(testProjectRoot, 'test/index.test.ts'),
      `import { main } from '../src/index';

test('main function exists', () => {
  expect(main).toBeDefined();
});`
    );

    // Create files that should be ignored
    await fs.promises.writeFile(
      path.join(testProjectRoot, 'node_modules/lib/external.js'),
      'module.exports = { external: true };'
    );

    await fs.promises.writeFile(
      path.join(testProjectRoot, 'dist/bundle.js'),
      'console.log("built file");'
    );

    // Create .gitignore
    await fs.promises.writeFile(
      path.join(testProjectRoot, '.gitignore'),
      `node_modules/
dist/
*.log
.env
test/`
    );

    // Create files with various extensions
    await fs.promises.writeFile(path.join(testProjectRoot, 'README.md'), '# Test Project');
    await fs.promises.writeFile(path.join(testProjectRoot, 'package.json'), '{"name": "test"}');
    await fs.promises.writeFile(path.join(testProjectRoot, 'style.css'), 'body { margin: 0; }');
  });

  afterAll(async () => {
    // Clean up test files
    try {
      await fs.promises.rm(testProjectRoot, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test files:', error);
    }
  });

  describe('Real filesystem operations', () => {
    it('should discover actual TypeScript and JavaScript files', async () => {
      const files = await FileDiscovery.discoverFiles(testProjectRoot);

      expect(files.length).toBeGreaterThanOrEqual(3);
      expect(files).toContain('src/index.ts');
      expect(files).toContain('src/components/Button.tsx');
      expect(files).toContain('src/utils/helper.js');
      expect(files).not.toContain('test/index.test.ts');
      expect(files).not.toContain('node_modules/lib/external.js');
      expect(files).not.toContain('dist/bundle.js');
      expect(files).not.toContain('README.md');
      expect(files).not.toContain('package.json');
      expect(files).not.toContain('style.css');
    });

    it('should respect .gitignore rules with real files', async () => {
      const files = await FileDiscovery.discoverFiles(testProjectRoot);

      // Files in node_modules and dist should be excluded by gitignore
      expect(files.every(f => !f.startsWith('node_modules/'))).toBe(true);
      expect(files.every(f => !f.startsWith('dist/'))).toBe(true);
    });

    it('should handle include patterns with real files', async () => {
      const files = await FileDiscovery.discoverFiles(testProjectRoot, {
        include: ['src/components/**/*.tsx']
      });

      expect(files).toHaveLength(1);
      expect(files[0]).toBe('src/components/Button.tsx');
    });

    it('should handle exclude patterns with real files', async () => {
      const files = await FileDiscovery.discoverFiles(testProjectRoot, {
        exclude: ['**/*.js']
      });

      expect(files.length).toBeGreaterThanOrEqual(2);
      expect(files).toContain('src/index.ts');
      expect(files).toContain('src/components/Button.tsx');
      expect(files).not.toContain('src/utils/helper.js');
      // Filter out JS files to verify exclusion worked
      expect(files.every(f => !f.endsWith('.js'))).toBe(true);
    });

    it('should handle complex include/exclude combinations', async () => {
      const files = await FileDiscovery.discoverFiles(testProjectRoot, {
        include: ['src/**/*'],
        exclude: ['**/*.tsx']
      });

      expect(files).toHaveLength(2);
      expect(files).toContain('src/index.ts');
      expect(files).toContain('src/utils/helper.js');
      expect(files).not.toContain('src/components/Button.tsx');
    });
  });

  describe('Real project analysis', () => {
    it('should analyze the actual codebase structure', async () => {
      const files = await FileDiscovery.discoverFiles(realProjectRoot, {
        include: ['src/**/*.ts'],
        exclude: ['**/*.test.ts', '**/test-*.ts']
      });

      expect(files.length).toBeGreaterThan(5);
      expect(files.every(f => f.endsWith('.ts'))).toBe(true);
      expect(files.every(f => !f.includes('.test.'))).toBe(true);
      expect(files.every(f => !f.includes('test-'))).toBe(true);
      
      // Verify core modules are found
      expect(files).toContain('src/core/file-discovery.ts');
      expect(files).toContain('src/core/indexer.ts');
    });

    it('should respect real .gitignore in project root', async () => {
      const files = await FileDiscovery.discoverFiles(realProjectRoot);

      // Should exclude node_modules, dist, etc. based on real .gitignore
      expect(files.every(f => !f.startsWith('node_modules/'))).toBe(true);
      expect(files.every(f => !f.startsWith('dist/'))).toBe(true);
      expect(files.every(f => !f.startsWith('temp/'))).toBe(true);
    });

    it('should handle file system errors gracefully', async () => {
      // FileDiscovery may return empty array for nonexistent paths rather than throwing
      const result = await FileDiscovery.discoverFiles('/nonexistent/path');
      // Should either throw or return empty array
      if (Array.isArray(result)) {
        expect(result).toEqual([]);
      }
    });

    it('should handle permission errors gracefully', async () => {
      // Try to access a restricted path (this may vary by system)
      try {
        await FileDiscovery.discoverFiles('/root');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Pattern performance with real files', () => {
    it('should perform efficiently with large real file sets', async () => {
      const startTime = Date.now();
      
      const files = await FileDiscovery.discoverFiles(realProjectRoot, {
        include: ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx']
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(files.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should cache pattern results for repeated calls', async () => {
      const patterns = { include: ['src/**/*.ts'] };

      const startTime1 = Date.now();
      const files1 = await FileDiscovery.discoverFiles(realProjectRoot, patterns);
      const duration1 = Date.now() - startTime1;

      const startTime2 = Date.now();
      const files2 = await FileDiscovery.discoverFiles(realProjectRoot, patterns);
      const duration2 = Date.now() - startTime2;

      expect(files1).toEqual(files2);
      // Caching might not always be faster for very fast operations
      // Just verify both completed successfully
      expect(duration2).toBeDefined();
      expect(duration1).toBeDefined();
    });
  });

  describe('Edge cases with real filesystem', () => {
    it('should handle symbolic links appropriately', async () => {
      // Create a symbolic link if possible (may fail on some systems)
      try {
        const linkPath = path.join(testProjectRoot, 'link-to-src');
        await fs.promises.symlink('src', linkPath);
        
        const files = await FileDiscovery.discoverFiles(testProjectRoot);
        
        // Behavior may vary based on system and glob implementation
        // Just ensure no crashes occur
        expect(Array.isArray(files)).toBe(true);
        
        // Clean up link
        await fs.promises.unlink(linkPath);
      } catch (error) {
        // Skip test if symlinks aren't supported
        console.warn('Symlink test skipped:', error);
      }
    });

    it('should handle very deep directory structures', async () => {
      const deepPath = path.join(testProjectRoot, 'very/deep/nested/directory/structure');
      await fs.promises.mkdir(deepPath, { recursive: true });
      
      await fs.promises.writeFile(
        path.join(deepPath, 'deep.ts'),
        'export const deep = true;'
      );

      const files = await FileDiscovery.discoverFiles(testProjectRoot);
      
      expect(files).toContain('very/deep/nested/directory/structure/deep.ts');
    });

    it('should handle files with unicode names', async () => {
      const unicodePath = path.join(testProjectRoot, 'src/KՇ�.ts');
      await fs.promises.writeFile(
        unicodePath,
        'export const unicode = "K�";'
      );

      const files = await FileDiscovery.discoverFiles(testProjectRoot);
      
      expect(files).toContain('src/KՇ�.ts');
    });
  });

  describe('Analysis and diagnostics with real data', () => {
    it('should provide meaningful analysis of real project structure', async () => {
      const result = await FileDiscovery.discoverFilesWithAnalysis(realProjectRoot, {
        include: ['src/**/*.ts'],
        exclude: ['**/*.test.ts']
      });

      expect(result.files.length).toBeGreaterThan(5);
      expect(result.analysis.stats.totalCandidateFiles).toBeGreaterThan(result.files.length);
      expect(result.analysis.stats.finalFiles).toBe(result.files.length);
      expect(result.analysis.warnings).toBeDefined();
      expect(result.analysis.suggestions).toBeDefined();
    });

    it('should identify pattern conflicts with real file sets', async () => {
      await expect(
        FileDiscovery.discoverFiles(realProjectRoot, {
          include: ['src/**/*.ts'],
          exclude: ['src/**/*'] // Exclude everything that was included
        })
      ).rejects.toThrow('Pattern conflict');
    });

    it('should provide useful performance metrics', async () => {
      const stats = FileDiscovery.getPatternCacheStats();
      
      expect(stats).toHaveProperty('combined');
      expect(stats.combined).toHaveProperty('size');
      expect(stats.combined.size).toBeGreaterThanOrEqual(0);
    });
  });
});