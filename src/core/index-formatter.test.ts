/**
 * Tests for the toTree function in index-formatter module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { toTree, getCompressionStats, formatAuto } from './index-formatter.js';
import type { ProjectIndex, TreeNode, FileInfo } from '../types/index.js';

describe('Index Formatter - Tree Format', () => {
  let sampleIndex: ProjectIndex;
  let emptyIndex: ProjectIndex;
  let singleFileIndex: ProjectIndex;
  let deepNestedIndex: ProjectIndex;

  beforeEach(() => {
    // Basic sample index with typical project structure
    sampleIndex = {
      metadata: {
        version: 1,
        root: '/test/project',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        totalFiles: 5
      },
      tree: {
        name: 'project',
        type: 'dir',
        children: [
          {
            name: 'src',
            type: 'dir', 
            children: [
              { name: 'index.ts', type: 'file' },
              { name: 'utils.ts', type: 'file' },
              {
                name: 'components',
                type: 'dir',
                children: [
                  { name: 'Button.tsx', type: 'file' }
                ]
              }
            ]
          },
          {
            name: 'test',
            type: 'dir',
            children: [
              { name: 'index.test.ts', type: 'file' }
            ]
          },
          { name: 'package.json', type: 'file' }
        ]
      },
      nodes: ['src/index.ts', 'src/utils.ts', 'src/components/Button.tsx', 'test/index.test.ts', 'package.json'],
      edges: [
        { from: 'src/index.ts', to: 'src/utils.ts' },
        { from: 'src/index.ts', to: 'src/components/Button.tsx' }
      ],
      files: {
        'src/index.ts': createMockFileInfo(),
        'src/utils.ts': createMockFileInfo(),
        'src/components/Button.tsx': createMockFileInfo(),
        'test/index.test.ts': createMockFileInfo(),
        'package.json': createMockFileInfo()
      }
    };

    // Empty project index
    emptyIndex = {
      metadata: {
        version: 1,
        root: '/empty/project',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        totalFiles: 0
      },
      tree: { name: 'project', type: 'dir', children: [] },
      nodes: [],
      edges: [],
      files: {}
    };

    // Single file project
    singleFileIndex = {
      metadata: {
        version: 1,
        root: '/single/project',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        totalFiles: 1
      },
      tree: {
        name: 'project',
        type: 'dir',
        children: [
          { name: 'index.ts', type: 'file' }
        ]
      },
      nodes: ['index.ts'],
      edges: [],
      files: {
        'index.ts': createMockFileInfo()
      }
    };

    // Deep nested structure (5+ levels)
    deepNestedIndex = {
      metadata: {
        version: 1,
        root: '/deep/project',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        totalFiles: 3
      },
      tree: {
        name: 'project',
        type: 'dir',
        children: [
          {
            name: 'src',
            type: 'dir',
            children: [
              {
                name: 'modules',
                type: 'dir',
                children: [
                  {
                    name: 'auth',
                    type: 'dir',
                    children: [
                      {
                        name: 'providers',
                        type: 'dir',
                        children: [
                          {
                            name: 'oauth',
                            type: 'dir',
                            children: [
                              { name: 'google.ts', type: 'file' },
                              { name: 'github.ts', type: 'file' }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          { name: 'config.ts', type: 'file' }
        ]
      },
      nodes: ['src/modules/auth/providers/oauth/google.ts', 'src/modules/auth/providers/oauth/github.ts', 'config.ts'],
      edges: [],
      files: {
        'src/modules/auth/providers/oauth/google.ts': createMockFileInfo(),
        'src/modules/auth/providers/oauth/github.ts': createMockFileInfo(),
        'config.ts': createMockFileInfo()
      }
    };
  });

  describe('toTree function', () => {
    describe('Basic functionality', () => {
      it('should render basic tree structure with ASCII art', () => {
        const result = toTree(sampleIndex);

        expect(result).toContain('project/');
        expect(result).toContain('├── src/');
        expect(result).toContain('├── test/');
        expect(result).toContain('└── package.json');
        expect(result).toContain('│   ├── components/');
        expect(result).toContain('│   ├── index.ts');
        expect(result).toContain('│   └── utils.ts');
        expect(result).toContain('│   │   └── Button.tsx');
        expect(result).toContain('│   └── index.test.ts');
      });

      it('should use proper ASCII tree characters', () => {
        const result = toTree(sampleIndex);

        // Check for proper tree drawing characters
        expect(result).toContain("├──"); // Branch connector
        expect(result).toContain("└──"); // Last branch connector
        expect(result).toContain("│");   // Vertical line
      });

      it('should show directories with trailing slash', () => {
        const result = toTree(sampleIndex);

        expect(result).toContain('project/');
        expect(result).toContain('src/');
        expect(result).toContain('components/');
        expect(result).toContain('test/');
      });

      it('should show files without trailing slash', () => {
        const result = toTree(sampleIndex);

        expect(result).toContain('index.ts');
        expect(result).toContain('utils.ts');
        expect(result).toContain('package.json');
        expect(result).not.toContain('index.ts/');
        expect(result).not.toContain('utils.ts/');
        expect(result).not.toContain('package.json/');
      });
    });

    describe('Edge cases', () => {
      it('should handle empty project gracefully', () => {
        const result = toTree(emptyIndex);
        expect(result).toBe('project/\n(empty)');
      });

      it('should handle single file project', () => {
        const result = toTree(singleFileIndex);

        expect(result).toContain('project/');
        expect(result).toContain('└── index.ts');
      });

      it('should handle corrupted tree structure gracefully', () => {
        const corruptedIndex: ProjectIndex = {
          ...sampleIndex,
          tree: null as unknown as TreeNode
        };

        const result = toTree(corruptedIndex);
        
        expect(result).toContain('error: corrupted tree structure');
      });
    });

    describe('Deep nested structures', () => {
      it('should handle deeply nested directories (5+ levels)', () => {
        const result = toTree(deepNestedIndex);

        expect(result).toContain('project/');
        expect(result).toContain('├── src/');
        expect(result).toContain('└── config.ts');
        expect(result).toContain('│   └── modules/');
        expect(result).toContain('│       └── auth/');
        expect(result).toContain('│           └── providers/');
        expect(result).toContain('│               └── oauth/');
        expect(result).toContain('│                   ├── github.ts');
        expect(result).toContain('│                   └── google.ts');
      });
    });

    describe('Sorting and ordering', () => {
      it('should sort directories before files at each level', () => {
        const result = toTree(sampleIndex);

        const lines = result.split('\n');
        const srcIndex = lines.findIndex(line => line.includes('src/'));
        const testIndex = lines.findIndex(line => line.includes('test/'));
        const packageIndex = lines.findIndex(line => line.includes('package.json'));

        // Directories should come before files
        expect(srcIndex).toBeLessThan(packageIndex);
        expect(testIndex).toBeLessThan(packageIndex);
      });

      it('should sort items alphabetically within same type', () => {
        const result = toTree(sampleIndex);

        const lines = result.split('\n');
        
        // Check that src comes before test (both directories)
        const srcIndex = lines.findIndex(line => line.includes('src/'));
        const testIndex = lines.findIndex(line => line.includes('test/'));
        
        expect(srcIndex).toBeLessThan(testIndex);
      });
    });

    describe('Output format validation', () => {
      it('should return a string', () => {
        const result = toTree(singleFileIndex);
        
        expect(typeof result).toBe('string');
      });

      it('should not contain tab characters (use spaces for indentation)', () => {
        const result = toTree(sampleIndex);
        
        expect(result).not.toContain('\t');
      });

      it('should end with a newline or not have trailing whitespace', () => {
        const result = toTree(singleFileIndex);
        
        // Should not have trailing spaces on any line
        const lines = result.split('\n');
        lines.forEach(line => {
          expect(line).not.toMatch(/\s+$/);
        });
      });
    });
  });

  describe('Integration with other formatters', () => {
    it('should be available as a format option alongside existing formats', () => {
      // Test that tree format can be used with existing formatter infrastructure
      const formats: Array<{ name: string, type: string }> = [
        { name: 'JSON', type: 'json' },
        { name: 'DSL', type: 'dsl' },
        { name: 'Graph', type: 'graph' },
        { name: 'Markdown', type: 'markdown' },
        { name: 'Tree', type: 'tree' }
      ];

      const treeFormat = formats.find(f => f.type === 'tree');
      expect(treeFormat).toBeDefined();
      expect(treeFormat?.name).toBe('Tree');
    });

    it('should work with compression stats analysis', () => {
      const treeOutput = toTree(sampleIndex);
      const stats = getCompressionStats(sampleIndex, treeOutput);

      expect(stats).toBeDefined();
      expect(stats.compressedSize).toBeGreaterThan(0);
      expect(stats.reduction).toBeGreaterThanOrEqual(0);
      expect(stats.estimatedTokens).toBeGreaterThan(0);
    });

    it('should not be selected by formatAuto (manual selection only)', () => {
      // Tree format is for structure visualization, not auto-selected for AI context
      const { format } = formatAuto(singleFileIndex);
      
      // formatAuto should only choose between dsl and graph formats
      expect(['dsl', 'graph']).toContain(format);
      expect(format).not.toBe('tree');
    });
  });

  describe('Performance characteristics', () => {
    it('should handle large projects efficiently', () => {
      const largeIndex = createLargeProjectIndex(100);
      
      const start = Date.now();
      toTree(largeIndex);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should have reasonable memory usage', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      toTree(sampleIndex);
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Should not consume excessive memory (less than 10MB increase)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});

/**
 * Helper function to create mock FileInfo for testing
 */
function createMockFileInfo(): FileInfo {
  return {
    imports: [],
    dependencies: [],
    functions: [],
    classes: [],
    constants: []
  };
}

/**
 * Helper function to create a large project index for performance testing
 */
function createLargeProjectIndex(fileCount: number): ProjectIndex {
  const nodes: string[] = [];
  const files: Record<string, FileInfo> = {};
  
  for (let i = 0; i < fileCount; i++) {
    const path = `src/file${i}.ts`;
    nodes.push(path);
    files[path] = createMockFileInfo();
  }

  return {
    metadata: {
      version: 1,
      root: `/large/project`,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      totalFiles: fileCount
    },
    tree: {
      name: 'project',
      type: 'dir',
      children: [
        {
          name: 'src',
          type: 'dir',
          children: Array.from({ length: fileCount }, (_, i) => ({
            name: `file${i}.ts`,
            type: 'file' as const
          }))
        }
      ]
    },
    nodes,
    edges: [],
    files
  };
}