/**
 * Unit tests for DependencyResolver module
 */

import { describe, it, expect } from 'vitest';
import { DependencyResolver } from './dependency-resolver.js';
import type { ImportInfo } from '../types/index.js';

describe('DependencyResolver', () => {
  describe('resolveImports', () => {
    // Note: Current implementation has issues with path resolution due to
    // mixing absolute and relative paths. These tests document current behavior.
    
    it('should ignore non-relative imports correctly', () => {
      const imports: ImportInfo[] = [
        { from: 'react', kind: 'import' },
        { from: '@types/node', kind: 'import' },
        { from: 'lodash', kind: 'import' }
      ];

      const allFiles = ['src/index.ts', 'src/utils.ts'];
      const result = DependencyResolver.resolveImports(imports, 'src/index.ts', allFiles);

      // Should ignore all non-relative imports
      expect(result).toEqual([]);
    });

    it('should handle empty imports array', () => {
      const allFiles = ['src/index.ts', 'src/utils.ts'];
      const result = DependencyResolver.resolveImports([], 'src/index.ts', allFiles);

      expect(result).toEqual([]);
    });

    it('should return empty array when no files match relative imports', () => {
      const imports: ImportInfo[] = [
        { from: './nonexistent', kind: 'import' },
        { from: '../missing', kind: 'import' }
      ];

      const allFiles = ['src/index.ts', 'src/utils.ts'];
      const result = DependencyResolver.resolveImports(imports, 'src/index.ts', allFiles);

      expect(result).toEqual([]);
    });

    it('should handle imports with different kinds consistently', () => {
      const imports: ImportInfo[] = [
        { from: './utils', kind: 'import' },
        { from: './types', kind: 'export' },
        { from: './helpers', kind: 'require' },
        { from: './async', kind: 'dynamic-import' }
      ];

      const allFiles = ['src/index.ts'];
      const result = DependencyResolver.resolveImports(imports, 'src/index.ts', allFiles);

      // All should be processed the same way (currently all fail to resolve)
      expect(result).toEqual([]);
    });

    it('should resolve .js imports to .ts files (ESM TypeScript pattern)', () => {
      const imports: ImportInfo[] = [
        { from: './utils.js', kind: 'import' },
        { from: './components/Button.js', kind: 'import' }
      ];

      const allFiles = ['src/index.ts', 'src/utils.ts', 'src/components/Button.ts'];
      const result = DependencyResolver.resolveImports(imports, 'src/index.ts', allFiles);

      expect(result).toEqual(['src/components/Button.ts', 'src/utils.ts']);
    });

    it('should resolve .jsx imports to .tsx files', () => {
      const imports: ImportInfo[] = [
        { from: './Button.jsx', kind: 'import' }
      ];

      const allFiles = ['src/Button.tsx', 'src/index.ts'];
      const result = DependencyResolver.resolveImports(imports, 'src/index.ts', allFiles);

      expect(result).toEqual(['src/Button.tsx']);
    });

    it('should fall back to actual .js files if .ts does not exist', () => {
      const imports: ImportInfo[] = [
        { from: './legacy.js', kind: 'import' }
      ];

      const allFiles = ['src/index.ts', 'src/legacy.js'];
      const result = DependencyResolver.resolveImports(imports, 'src/index.ts', allFiles);

      expect(result).toEqual(['src/legacy.js']);
    });

    it('should handle .ts imports directly', () => {
      const imports: ImportInfo[] = [
        { from: './utils.ts', kind: 'import' }
      ];

      const allFiles = ['src/index.ts', 'src/utils.ts'];
      const result = DependencyResolver.resolveImports(imports, 'src/index.ts', allFiles);

      expect(result).toEqual(['src/utils.ts']);
    });

    it('should resolve imports without extensions by trying all extensions', () => {
      const imports: ImportInfo[] = [
        { from: './utils', kind: 'import' }
      ];

      const allFiles = ['src/index.ts', 'src/utils.ts'];
      const result = DependencyResolver.resolveImports(imports, 'src/index.ts', allFiles);

      expect(result).toEqual(['src/utils.ts']);
    });

    it('should resolve index files when importing directories', () => {
      const imports: ImportInfo[] = [
        { from: './components', kind: 'import' }
      ];

      const allFiles = ['src/index.ts', 'src/components/index.ts'];
      const result = DependencyResolver.resolveImports(imports, 'src/index.ts', allFiles);

      expect(result).toEqual(['src/components/index.ts']);
    });

    it('should handle nested directory imports with .js extension', () => {
      const imports: ImportInfo[] = [
        { from: '../core/utils.js', kind: 'import' }
      ];

      const allFiles = ['src/tests/test.ts', 'src/core/utils.ts'];
      const result = DependencyResolver.resolveImports(imports, 'src/tests/test.ts', allFiles);

      expect(result).toEqual(['src/core/utils.ts']);
    });

    // TODO: Fix path resolution to handle relative imports properly
    // The current implementation has issues with path.resolve() creating absolute paths
    // that don't match the relative paths in allFiles array
  });

  describe('buildDependencyGraph', () => {
    it('should build dependency edges from import maps with .js to .ts mapping', () => {
      const files = {
        'src/index.ts': [
          { from: './utils.js', kind: 'import' as const },
          { from: './components/Button.js', kind: 'import' as const }
        ],
        'src/components/Button.ts': [
          { from: '../utils.js', kind: 'import' as const }
        ],
        'src/utils.ts': []
      };

      const allFiles = ['src/index.ts', 'src/components/Button.ts', 'src/utils.ts'];

      const result = DependencyResolver.buildDependencyGraph(files, allFiles);

      // Should now properly resolve .js imports to .ts files
      expect(result).toContainEqual({ from: 'src/index.ts', to: 'src/utils.ts' });
      expect(result).toContainEqual({ from: 'src/index.ts', to: 'src/components/Button.ts' });
      expect(result).toContainEqual({ from: 'src/components/Button.ts', to: 'src/utils.ts' });
      expect(result).toHaveLength(3);
    });

    it('should handle files with no dependencies', () => {
      const files = {
        'src/standalone.ts': [],
        'src/another.ts': []
      };

      const allFiles = ['src/standalone.ts', 'src/another.ts'];

      const result = DependencyResolver.buildDependencyGraph(files, allFiles);

      expect(result).toEqual([]);
    });

    it('should handle unresolved imports gracefully', () => {
      const files = {
        'src/index.ts': [
          { from: './nonexistent', kind: 'import' as const },
          { from: 'external-package', kind: 'import' as const }
        ]
      };

      const allFiles = ['src/index.ts'];

      const result = DependencyResolver.buildDependencyGraph(files, allFiles);

      expect(result).toEqual([]);
    });
  });

  describe('findCircularDependencies', () => {
    it('should detect simple circular dependencies', () => {
      const edges = [
        { from: 'a.ts', to: 'b.ts' },
        { from: 'b.ts', to: 'a.ts' }
      ];

      const result = DependencyResolver.findCircularDependencies(edges);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(['a.ts', 'b.ts', 'a.ts']);
    });

    it('should detect complex circular dependencies', () => {
      const edges = [
        { from: 'a.ts', to: 'b.ts' },
        { from: 'b.ts', to: 'c.ts' },
        { from: 'c.ts', to: 'd.ts' },
        { from: 'd.ts', to: 'b.ts' }
      ];

      const result = DependencyResolver.findCircularDependencies(edges);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(['b.ts', 'c.ts', 'd.ts', 'b.ts']);
    });

    it('should detect multiple separate circular dependencies', () => {
      const edges = [
        { from: 'a.ts', to: 'b.ts' },
        { from: 'b.ts', to: 'a.ts' },
        { from: 'x.ts', to: 'y.ts' },
        { from: 'y.ts', to: 'z.ts' },
        { from: 'z.ts', to: 'x.ts' }
      ];

      const result = DependencyResolver.findCircularDependencies(edges);

      expect(result).toHaveLength(2);
      // Sort results for consistent testing
      const sortedResults = result.sort((a, b) => a[0].localeCompare(b[0]));
      expect(sortedResults[0]).toEqual(['a.ts', 'b.ts', 'a.ts']);
      expect(sortedResults[1]).toEqual(['x.ts', 'y.ts', 'z.ts', 'x.ts']);
    });

    it('should return empty array when no cycles exist', () => {
      const edges = [
        { from: 'a.ts', to: 'b.ts' },
        { from: 'b.ts', to: 'c.ts' },
        { from: 'c.ts', to: 'd.ts' }
      ];

      const result = DependencyResolver.findCircularDependencies(edges);

      expect(result).toEqual([]);
    });

    it('should handle self-referencing dependencies', () => {
      const edges = [
        { from: 'a.ts', to: 'a.ts' }
      ];

      const result = DependencyResolver.findCircularDependencies(edges);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(['a.ts', 'a.ts']);
    });

    it('should handle empty dependency graph', () => {
      const result = DependencyResolver.findCircularDependencies([]);

      expect(result).toEqual([]);
    });
  });

  describe('getDependencyCounts', () => {
    it('should count dependencies and dependents correctly', () => {
      const edges = [
        { from: 'a.ts', to: 'b.ts' },
        { from: 'a.ts', to: 'c.ts' },
        { from: 'b.ts', to: 'c.ts' },
        { from: 'd.ts', to: 'a.ts' }
      ];

      const result = DependencyResolver.getDependencyCounts(edges);

      // Dependencies (outgoing edges)
      expect(result.dependencies.get('a.ts')).toBe(2);
      expect(result.dependencies.get('b.ts')).toBe(1);
      expect(result.dependencies.get('d.ts')).toBe(1);
      expect(result.dependencies.get('c.ts')).toBeUndefined();

      // Dependents (incoming edges)
      expect(result.dependents.get('a.ts')).toBe(1);
      expect(result.dependents.get('b.ts')).toBe(1);
      expect(result.dependents.get('c.ts')).toBe(2);
      expect(result.dependents.get('d.ts')).toBeUndefined();
    });

    it('should handle empty edges', () => {
      const result = DependencyResolver.getDependencyCounts([]);

      expect(result.dependencies.size).toBe(0);
      expect(result.dependents.size).toBe(0);
    });
  });

  describe('findEntryPoints', () => {
    it('should find files with no dependencies', () => {
      const edges = [
        { from: 'a.ts', to: 'b.ts' },
        { from: 'b.ts', to: 'c.ts' }
      ];
      const allFiles = ['a.ts', 'b.ts', 'c.ts', 'd.ts'];

      const result = DependencyResolver.findEntryPoints(edges, allFiles);

      expect(result).toEqual(['c.ts', 'd.ts']);
    });

    it('should return all files when no dependencies exist', () => {
      const allFiles = ['a.ts', 'b.ts', 'c.ts'];

      const result = DependencyResolver.findEntryPoints([], allFiles);

      expect(result).toEqual(['a.ts', 'b.ts', 'c.ts']);
    });

    it('should return empty array when all files have dependencies', () => {
      const edges = [
        { from: 'a.ts', to: 'b.ts' },
        { from: 'b.ts', to: 'c.ts' },
        { from: 'c.ts', to: 'a.ts' }
      ];
      const allFiles = ['a.ts', 'b.ts', 'c.ts'];

      const result = DependencyResolver.findEntryPoints(edges, allFiles);

      expect(result).toEqual([]);
    });
  });

  describe('findLeafFiles', () => {
    it('should find files that are not imported by other files', () => {
      const edges = [
        { from: 'a.ts', to: 'b.ts' },
        { from: 'b.ts', to: 'c.ts' }
      ];
      const allFiles = ['a.ts', 'b.ts', 'c.ts', 'd.ts'];

      const result = DependencyResolver.findLeafFiles(edges, allFiles);

      expect(result).toEqual(['a.ts', 'd.ts']);
    });

    it('should return all files when no imports exist', () => {
      const allFiles = ['a.ts', 'b.ts', 'c.ts'];

      const result = DependencyResolver.findLeafFiles([], allFiles);

      expect(result).toEqual(['a.ts', 'b.ts', 'c.ts']);
    });

    it('should return empty array when all files are imported', () => {
      const edges = [
        { from: 'a.ts', to: 'b.ts' },
        { from: 'b.ts', to: 'c.ts' },
        { from: 'c.ts', to: 'a.ts' }
      ];
      const allFiles = ['a.ts', 'b.ts', 'c.ts'];

      const result = DependencyResolver.findLeafFiles(edges, allFiles);

      expect(result).toEqual([]);
    });
  });

  describe('edge cases and performance', () => {
    it('should handle large dependency graphs efficiently', () => {
      // Generate a large dependency graph
      const edges = [];
      const allFiles = [];
      
      for (let i = 0; i < 1000; i++) {
        const fileName = `file${i}.ts`;
        allFiles.push(fileName);
        
        if (i > 0) {
          edges.push({
            from: fileName,
            to: `file${i - 1}.ts`
          });
        }
      }

      const startTime = Date.now();
      
      // Test various operations
      const cycles = DependencyResolver.findCircularDependencies(edges);
      const entryPoints = DependencyResolver.findEntryPoints(edges, allFiles);
      const leafFiles = DependencyResolver.findLeafFiles(edges, allFiles);
      const counts = DependencyResolver.getDependencyCounts(edges);
      
      const endTime = Date.now();

      // Should complete within reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);
      
      // Verify results
      expect(cycles).toEqual([]);
      expect(entryPoints).toEqual(['file0.ts']);
      expect(leafFiles).toEqual(['file999.ts']);
      expect(counts.dependencies.size).toBe(999);
      expect(counts.dependents.size).toBe(999);
    });

    it('should handle empty input gracefully', () => {
      const result = DependencyResolver.resolveImports([], 'any/path.ts', []);
      expect(result).toEqual([]);
    });

    it('should handle non-existent current file path', () => {
      const imports: ImportInfo[] = [
        { from: './utils', kind: 'import' }
      ];
      
      const result = DependencyResolver.resolveImports(imports, 'nonexistent/file.ts', ['src/utils.ts']);
      
      // Should still process without throwing
      expect(result).toEqual([]);
    });

    // TODO: Add proper path resolution tests once implementation is fixed
    // Current path resolution has issues with absolute vs relative paths
  });
});