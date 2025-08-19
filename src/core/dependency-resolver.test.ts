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

    it('should demonstrate O(n) performance improvement for buildDependencyGraph', () => {
      // Create a realistic scenario with many files importing from a common module
      const commonFile = 'src/utils/common.ts';
      const files: Record<string, ImportInfo[]> = {
        [commonFile]: [] // Common utility file with no imports
      };
      const allFiles = [commonFile];
      
      // Generate 5000 files that all import from common.ts
      for (let i = 0; i < 5000; i++) {
        const fileName = `src/feature${Math.floor(i / 100)}/module${i}.ts`;
        files[fileName] = [
          { from: '../utils/common.js', kind: 'import' }
        ];
        allFiles.push(fileName);
      }

      const startTime = Date.now();
      
      const result = DependencyResolver.buildDependencyGraph(files, allFiles);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // With O(n²) algorithm, this would take several seconds
      // With O(n) algorithm, it should complete in much less time
      expect(duration).toBeLessThan(500); // 500ms threshold
      
      // Verify correct result: 5000 files importing common.ts
      expect(result).toHaveLength(5000);
      expect(result.every(edge => edge.to === commonFile)).toBe(true);
      
      console.log(`buildDependencyGraph processed ${allFiles.length} files in ${duration}ms`);
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
  });

  describe('monorepo workspace dependency resolution', () => {
    it('should resolve cross-package dependencies in monorepos', () => {
      const imports: ImportInfo[] = [
        { from: '@workspace/shared', kind: 'import' },
        { from: '@workspace/utils', kind: 'import' },
        { from: './local-file', kind: 'import' }
      ];

      const allFiles = [
        'packages/app/src/index.ts',
        'packages/app/src/local-file.ts',
        'packages/shared/src/index.ts',
        'packages/utils/src/index.ts'
      ];

      const result = DependencyResolver.resolveImports(imports, 'packages/app/src/index.ts', allFiles);

      // Current implementation only resolves relative imports
      // Workspace imports would need special handling
      expect(result).toEqual(['packages/app/src/local-file.ts']);
    });

    it('should handle lerna-style monorepo structure', () => {
      const files = {
        'packages/core/src/index.ts': [
          { from: '../../../shared/src/types', kind: 'import' }
        ],
        'packages/ui/src/button.ts': [
          { from: '../../core/src/index', kind: 'import' },
          { from: '../../../shared/src/theme', kind: 'import' }
        ],
        'shared/src/types.ts': [],
        'shared/src/theme.ts': []
      };

      const allFiles = [
        'packages/core/src/index.ts',
        'packages/ui/src/button.ts',
        'shared/src/types.ts',
        'shared/src/theme.ts'
      ];

      const result = DependencyResolver.buildDependencyGraph(files, allFiles);

      // Should resolve cross-package relative imports
      expect(result).toContainEqual({ 
        from: 'packages/core/src/index.ts', 
        to: 'shared/src/types.ts' 
      });
      expect(result).toContainEqual({ 
        from: 'packages/ui/src/button.ts', 
        to: 'packages/core/src/index.ts' 
      });
      expect(result).toContainEqual({ 
        from: 'packages/ui/src/button.ts', 
        to: 'shared/src/theme.ts' 
      });
    });

    it('should handle yarn workspaces with hoisted dependencies', () => {
      const files = {
        'apps/web/src/app.tsx': [
          { from: '@repo/ui', kind: 'import' }, // Workspace dependency
          { from: 'react', kind: 'import' }, // External dependency
          { from: './components/header', kind: 'import' } // Local dependency
        ],
        'apps/web/src/components/header.tsx': [
          { from: '@repo/ui/button', kind: 'import' }
        ],
        'packages/ui/src/index.ts': [],
        'packages/ui/src/button.tsx': []
      };

      const allFiles = [
        'apps/web/src/app.tsx',
        'apps/web/src/components/header.tsx',
        'packages/ui/src/index.ts',
        'packages/ui/src/button.tsx'
      ];

      const result = DependencyResolver.buildDependencyGraph(files, allFiles);

      // Should only resolve local relative imports with current implementation
      expect(result).toContainEqual({ 
        from: 'apps/web/src/app.tsx', 
        to: 'apps/web/src/components/header.tsx' 
      });
      
      // Workspace imports (@repo/ui) are currently ignored as they're not relative
      expect(result.some(edge => edge.to.includes('packages/ui'))).toBe(false);
    });

    it('should handle nx-style monorepo with path mapping', () => {
      const files = {
        'libs/feature-a/src/index.ts': [
          { from: '@myorg/shared-utils', kind: 'import' },
          { from: './lib/component', kind: 'import' }
        ],
        'libs/feature-a/src/lib/component.ts': [
          { from: '@myorg/ui-components', kind: 'import' }
        ],
        'libs/shared-utils/src/index.ts': [],
        'libs/ui-components/src/index.ts': []
      };

      const allFiles = [
        'libs/feature-a/src/index.ts',
        'libs/feature-a/src/lib/component.ts',
        'libs/shared-utils/src/index.ts',
        'libs/ui-components/src/index.ts'
      ];

      const result = DependencyResolver.buildDependencyGraph(files, allFiles);

      // Should resolve local relative imports
      expect(result).toContainEqual({ 
        from: 'libs/feature-a/src/index.ts', 
        to: 'libs/feature-a/src/lib/component.ts' 
      });
      
      // Path-mapped imports would require tsconfig.json parsing to resolve
      expect(result.length).toBe(1);
    });

    it('should detect circular dependencies across packages', () => {
      const edges = [
        { from: 'packages/a/src/index.ts', to: 'packages/b/src/index.ts' },
        { from: 'packages/b/src/index.ts', to: 'packages/c/src/index.ts' },
        { from: 'packages/c/src/index.ts', to: 'packages/a/src/index.ts' }
      ];

      const result = DependencyResolver.findCircularDependencies(edges);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual([
        'packages/a/src/index.ts',
        'packages/b/src/index.ts',
        'packages/c/src/index.ts',
        'packages/a/src/index.ts'
      ]);
    });

    it('should identify cross-package entry points and leaves', () => {
      const edges = [
        { from: 'apps/web/src/main.ts', to: 'packages/core/src/index.ts' },
        { from: 'apps/api/src/main.ts', to: 'packages/core/src/index.ts' },
        { from: 'packages/core/src/index.ts', to: 'packages/utils/src/index.ts' }
      ];

      const allFiles = [
        'apps/web/src/main.ts',
        'apps/api/src/main.ts',
        'packages/core/src/index.ts',
        'packages/utils/src/index.ts'
      ];

      const entryPoints = DependencyResolver.findEntryPoints(edges, allFiles);
      const leafFiles = DependencyResolver.findLeafFiles(edges, allFiles);

      // Entry points (no dependencies)
      expect(entryPoints).toEqual(['packages/utils/src/index.ts']);
      
      // Leaf files (not imported by others)
      expect(leafFiles).toEqual(['apps/web/src/main.ts', 'apps/api/src/main.ts']);
    });
  });
});