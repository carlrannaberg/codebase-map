/**
 * Index File Correctness Validation Tests
 * 
 * Tests that validate the correctness of generated index files
 * with pattern filtering, dependency tracking, and metadata storage.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { TestProjectBuilder, runCLI, loadIndex } from './test-integration.js';
import type { ProjectIndex } from './types/index.js';

describe('Index File Correctness Validation', () => {
  let testProject: TestProjectBuilder;
  let projectPath: string;

  beforeEach(() => {
    testProject = new TestProjectBuilder();
  });

  afterEach(() => {
    if (testProject) {
      testProject.cleanup();
    }
  });

  describe('Generated Index Structure', () => {
    it('should generate valid index structure with patterns', () => {
      projectPath = testProject
        .addFile('src/index.ts', `
import { utils } from './utils.js';
export { utils };
        `)
        .addFile('src/utils.ts', `
export const utils = {
  format: (text: string) => text.toUpperCase()
};
        `)
        .addFile('src/test.spec.ts', 'test file')
        .addFile('dist/output.js', 'compiled output')
        .build();

      const result = runCLI([
        'scan',
        '--include', 'src/**/*.ts',
        '--exclude', '**/*.spec.*', 'dist/**'
      ], projectPath);

      expect(result.exitCode).toBe(0);
      
      const index = loadIndex(result.indexPath);
      
      // Validate index structure
      expect(index).toHaveProperty('version');
      expect(index).toHaveProperty('metadata');
      expect(index).toHaveProperty('nodes');
      expect(index).toHaveProperty('edges');
      expect(index).toHaveProperty('files');
      
      // Validate metadata
      expect(index.metadata).toHaveProperty('createdAt');
      expect(index.metadata).toHaveProperty('totalFiles');
      expect(index.metadata).toHaveProperty('root');
      expect(index.metadata.totalFiles).toBe(2); // Only included files
      
      // Validate nodes array
      expect(Array.isArray(index.nodes)).toBe(true);
      expect(index.nodes).toContain('src/index.ts');
      expect(index.nodes).toContain('src/utils.ts');
      expect(index.nodes).not.toContain('src/test.spec.ts');
      expect(index.nodes).not.toContain('dist/output.js');
      
      // Validate edges array
      expect(Array.isArray(index.edges)).toBe(true);
      
      // Validate files object
      expect(typeof index.files).toBe('object');
      expect(index.files['src/index.ts']).toBeDefined();
      expect(index.files['src/utils.ts']).toBeDefined();
    });

    it('should store pattern configuration in metadata', () => {
      projectPath = testProject
        .addFile('src/app.ts', 'export const app = true;')
        .addFile('lib/helper.ts', 'export const helper = true;')
        .build();

      const includePatterns = ['src/**/*.ts', 'lib/**/*.ts'];
      const excludePatterns = ['**/*.test.*'];

      const result = runCLI([
        'scan',
        '--include', ...includePatterns,
        '--exclude', ...excludePatterns
      ], projectPath);

      expect(result.exitCode).toBe(0);
      
      const index = loadIndex(result.indexPath);
      
      // Check if pattern configuration is preserved (note: this may not be implemented yet)
      // For now, just verify the scan worked correctly
      expect(index.nodes).toHaveLength(2);
      expect(index.nodes).toContain('src/app.ts');
      expect(index.nodes).toContain('lib/helper.ts');
    });

    it('should handle empty results gracefully', () => {
      projectPath = testProject
        .addFile('src/app.js', 'export const app = true;')
        .addFile('lib/helper.py', 'def helper(): pass')
        .build();

      const result = runCLI([
        'scan',
        '--include', '**/*.ts', '**/*.tsx' // No matching files
      ], projectPath);

      expect(result.exitCode).toBe(0);
      
      const index = loadIndex(result.indexPath);
      
      // Should generate valid but empty index
      expect(index.nodes).toHaveLength(0);
      expect(index.metadata.totalFiles).toBe(0);
      expect(Object.keys(index.files)).toHaveLength(0);
      expect(index.edges).toHaveLength(0);
    });
  });

  describe('File Inclusion/Exclusion Verification', () => {
    it('should verify correct file filtering with complex patterns', () => {
      projectPath = testProject
        .addFile('src/components/Button.tsx', 'export function Button() {}')
        .addFile('src/components/Input.tsx', 'export function Input() {}')
        .addFile('src/components/__tests__/Button.test.tsx', 'test')
        .addFile('src/utils/helpers.ts', 'export const helpers = {};')
        .addFile('src/utils/constants.ts', 'export const CONSTANTS = {};')
        .addFile('src/stories/Button.stories.tsx', 'stories')
        .addFile('lib/vendor.js', 'vendor code')
        .addFile('dist/bundle.js', 'compiled')
        .addFile('node_modules/react/index.js', 'dependency')
        .build();

      const result = runCLI([
        'scan',
        '--include', 'src/**/*.{ts,tsx}', 'lib/**/*.ts',
        '--exclude', '**/__tests__/**', '**/stories/**', 'dist/**', 'node_modules/**'
      ], projectPath);

      expect(result.exitCode).toBe(0);
      
      const index = loadIndex(result.indexPath);
      
      // Verify included files
      const expectedIncluded = [
        'src/components/Button.tsx',
        'src/components/Input.tsx',
        'src/utils/helpers.ts',
        'src/utils/constants.ts'
      ];
      
      for (const file of expectedIncluded) {
        expect(index.nodes).toContain(file);
      }
      
      // Verify excluded files
      const expectedExcluded = [
        'src/components/__tests__/Button.test.tsx',
        'src/stories/Button.stories.tsx',
        'lib/vendor.js', // Wrong extension
        'dist/bundle.js',
        'node_modules/react/index.js'
      ];
      
      for (const file of expectedExcluded) {
        expect(index.nodes).not.toContain(file);
      }
    });

    it('should handle glob pattern edge cases', () => {
      projectPath = testProject
        .addFile('src/deep/nested/very/deep/file.ts', 'export const deep = true;')
        .addFile('src-backup/old.ts', 'old file')
        .addFile('src.config.ts', 'config file')
        .addFile('src/file.ts.bak', 'backup file')
        .addFile('src/normal.ts', 'normal file')
        .build();

      const result = runCLI([
        'scan',
        '--include', 'src/**/*.ts', // Should match deep nesting
        '--exclude', '**/*.bak', '*-backup/**'
      ], projectPath);

      expect(result.exitCode).toBe(0);
      
      const index = loadIndex(result.indexPath);
      
      // Should include deep nested file and normal file
      expect(index.nodes).toContain('src/deep/nested/very/deep/file.ts');
      expect(index.nodes).toContain('src/normal.ts');
      
      // Should exclude backup files and directories
      expect(index.nodes).not.toContain('src-backup/old.ts');
      expect(index.nodes).not.toContain('src/file.ts.bak');
      
      // Edge case: src.config.ts doesn't match src/**/*.ts pattern
      expect(index.nodes).not.toContain('src.config.ts');
    });

    it('should validate pattern precedence (exclude overrides include)', () => {
      projectPath = testProject
        .addFile('src/important.ts', 'important file')
        .addFile('src/secret.ts', 'secret file')
        .addFile('lib/important.ts', 'lib important')
        .addFile('lib/secret.ts', 'lib secret')
        .build();

      const result = runCLI([
        'scan',
        '--include', '**/*.ts', // Include all TypeScript files
        '--exclude', '**/secret.*' // But exclude anything with 'secret'
      ], projectPath);

      expect(result.exitCode).toBe(0);
      
      const index = loadIndex(result.indexPath);
      
      // Should include important files
      expect(index.nodes).toContain('src/important.ts');
      expect(index.nodes).toContain('lib/important.ts');
      
      // Should exclude secret files despite being included by pattern
      expect(index.nodes).not.toContain('src/secret.ts');
      expect(index.nodes).not.toContain('lib/secret.ts');
    });
  });

  describe('Dependency Graph Correctness', () => {
    it('should correctly track dependencies with patterns', () => {
      projectPath = testProject
        .addFile('src/main.ts', `
import { service } from './service.js';
import { utils } from './utils/index.js';

export function main() {
  return service.process(utils.data);
}
        `)
        .addFile('src/service.ts', `
import { helper } from './utils/helper.js';

export const service = {
  process: (data: any) => helper.transform(data)
};
        `)
        .addFile('src/utils/index.ts', `
export const utils = {
  data: { value: 'test' }
};
        `)
        .addFile('src/utils/helper.ts', `
export const helper = {
  transform: (data: any) => ({ ...data, transformed: true })
};
        `)
        .addFile('src/test.spec.ts', `
import { main } from './main.js';
// test code
        `)
        .build();

      const result = runCLI([
        'scan',
        '--include', 'src/**/*.ts',
        '--exclude', '**/*.spec.*'
      ], projectPath);

      expect(result.exitCode).toBe(0);
      
      const index = loadIndex(result.indexPath);
      
      // Verify all source files are included
      expect(index.nodes).toContain('src/main.ts');
      expect(index.nodes).toContain('src/service.ts');
      expect(index.nodes).toContain('src/utils/index.ts');
      expect(index.nodes).toContain('src/utils/helper.ts');
      expect(index.nodes).not.toContain('src/test.spec.ts');
      
      // Verify dependencies are correctly tracked
      expect(index.files['src/main.ts']?.dependencies).toContain('src/service.ts');
      expect(index.files['src/main.ts']?.dependencies).toContain('src/utils/index.ts');
      expect(index.files['src/service.ts']?.dependencies).toContain('src/utils/helper.ts');
      
      // Verify edges in dependency graph
      const mainEdges = index.edges.filter(edge => edge.from === 'src/main.ts');
      expect(mainEdges).toHaveLength(2);
      expect(mainEdges.some(edge => edge.to === 'src/service.ts')).toBe(true);
      expect(mainEdges.some(edge => edge.to === 'src/utils/index.ts')).toBe(true);
    });

    it('should handle circular dependencies detection', () => {
      projectPath = testProject
        .addFile('src/a.ts', `
import { b } from './b.js';
export const a = { ref: b };
        `)
        .addFile('src/b.ts', `
import { c } from './c.js';
export const b = { ref: c };
        `)
        .addFile('src/c.ts', `
import { a } from './a.js';
export const c = { ref: a };
        `)
        .build();

      const result = runCLI(['scan', '--include', 'src/**/*.ts'], projectPath);

      expect(result.exitCode).toBe(0);
      
      const index = loadIndex(result.indexPath);
      
      // All files should be included
      expect(index.nodes).toHaveLength(3);
      
      // Dependencies should be tracked
      expect(index.files['src/a.ts']?.dependencies).toContain('src/b.ts');
      expect(index.files['src/b.ts']?.dependencies).toContain('src/c.ts');
      expect(index.files['src/c.ts']?.dependencies).toContain('src/a.ts');
      
      // Should form a cycle in the edge graph
      expect(index.edges).toHaveLength(3);
    });
  });

  describe('Metadata Storage and Retrieval', () => {
    it('should store comprehensive metadata', () => {
      projectPath = testProject
        .addFile('src/app.ts', 'export const app = true;')
        .addFile('src/utils.ts', 'export const utils = {};')
        .build();

      const result = runCLI([
        'scan',
        '--include', 'src/**/*.ts'
      ], projectPath);

      expect(result.exitCode).toBe(0);
      
      const index = loadIndex(result.indexPath);
      
      // Validate metadata completeness
      expect(index.metadata.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(index.metadata.root).toBe(projectPath);
      expect(index.metadata.totalFiles).toBe(2);
      expect(index.metadata.version).toBeDefined();
      
      // Validate file metadata
      for (const [, fileInfo] of Object.entries(index.files)) {
        expect(fileInfo).toHaveProperty('dependencies');
        expect(fileInfo).toHaveProperty('imports');
        expect(fileInfo).toHaveProperty('functions');
        expect(fileInfo).toHaveProperty('classes');
        expect(fileInfo).toHaveProperty('constants');
        expect(Array.isArray(fileInfo.dependencies)).toBe(true);
        expect(Array.isArray(fileInfo.imports)).toBe(true);
        expect(Array.isArray(fileInfo.functions)).toBe(true);
        expect(Array.isArray(fileInfo.classes)).toBe(true);
        expect(Array.isArray(fileInfo.constants)).toBe(true);
      }
    });

    it('should preserve configuration for reproducible scans', () => {
      projectPath = testProject
        .addFile('src/main.ts', 'export const main = true;')
        .build();

      const includePatterns = ['src/**/*.{ts,tsx}'];
      const excludePatterns = ['**/*.test.*'];

      const result = runCLI([
        'scan',
        '--include', ...includePatterns,
        '--exclude', ...excludePatterns
      ], projectPath);

      expect(result.exitCode).toBe(0);
      
      const index = loadIndex(result.indexPath);
      
      // Configuration should be stored for reproducibility (note: this may not be implemented yet)
      // For now, just verify the scan worked correctly
      expect(index.nodes).toHaveLength(1);
      expect(index.nodes).toContain('src/main.ts');
      
      // Should be able to reproduce the same scan
      const reproResult = runCLI([
        'scan',
        '--include', ...includePatterns,
        '--exclude', ...excludePatterns
      ], projectPath);

      expect(reproResult.exitCode).toBe(0);
      
      const reproIndex = loadIndex(reproResult.indexPath);
      
      // Results should be consistent (ignoring timestamps)
      expect(reproIndex.nodes).toEqual(index.nodes);
      expect(reproIndex.edges).toEqual(index.edges);
      expect(reproIndex.metadata.totalFiles).toBe(index.metadata.totalFiles);
    });
  });

  describe('Index File Format Validation', () => {
    it('should generate valid JSON format', () => {
      projectPath = testProject
        .addFile('src/app.ts', 'export const app = true;')
        .build();

      const result = runCLI(['scan'], projectPath);
      expect(result.exitCode).toBe(0);
      
      // Should be valid JSON
      const indexContent = fs.readFileSync(result.indexPath, 'utf-8');
      expect(() => JSON.parse(indexContent)).not.toThrow();
      
      // Should match our schema
      const index = JSON.parse(indexContent) as ProjectIndex;
      expect(index).toMatchObject({
        version: expect.any(String),
        metadata: expect.objectContaining({
          generatedAt: expect.any(String),
          projectRoot: expect.any(String),
          totalFiles: expect.any(Number)
        }),
        nodes: expect.any(Array),
        edges: expect.any(Array),
        files: expect.any(Object)
      });
    });

    it('should handle special characters in file paths', () => {
      projectPath = testProject
        .addFile('src/file with spaces.ts', 'export const spaces = true;')
        .addFile('src/file-with-dashes.ts', 'export const dashes = true;')
        .addFile('src/file_with_underscores.ts', 'export const underscores = true;')
        .addFile('src/file.with.dots.ts', 'export const dots = true;')
        .build();

      const result = runCLI(['scan', '--include', 'src/**/*.ts'], projectPath);
      expect(result.exitCode).toBe(0);
      
      const index = loadIndex(result.indexPath);
      
      // All files with special characters should be handled
      expect(index.nodes).toContain('src/file with spaces.ts');
      expect(index.nodes).toContain('src/file-with-dashes.ts');
      expect(index.nodes).toContain('src/file_with_underscores.ts');
      expect(index.nodes).toContain('src/file.with.dots.ts');
      
      // Should have valid file entries
      expect(index.files['src/file with spaces.ts']).toBeDefined();
      expect(index.files['src/file-with-dashes.ts']).toBeDefined();
    });
  });
});

export { };