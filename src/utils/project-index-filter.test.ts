/**
 * Tests for project index filtering utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { filterProjectIndex, getFilteringStats } from './project-index-filter.js';
import type { ProjectIndex, FilterOptions } from '../types/index.js';

describe('filterProjectIndex', () => {
  let mockIndex: ProjectIndex;

  beforeEach(() => {
    // Create a mock ProjectIndex for testing
    mockIndex = {
      metadata: {
        version: 1,
        root: '/test/project',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        totalFiles: 6
      },
      tree: {
        name: 'root',
        type: 'dir',
        children: [
          {
            name: 'src',
            type: 'dir',
            children: [
              { name: 'index.ts', type: 'file' },
              { name: 'utils.ts', type: 'file' },
              { name: 'component.tsx', type: 'file' }
            ]
          },
          {
            name: 'test',
            type: 'dir',
            children: [
              { name: 'index.test.ts', type: 'file' },
              { name: 'utils.test.ts', type: 'file' }
            ]
          },
          { name: 'README.md', type: 'file' }
        ]
      },
      nodes: [
        'src/index.ts',
        'src/utils.ts', 
        'src/component.tsx',
        'test/index.test.ts',
        'test/utils.test.ts',
        'README.md'
      ],
      edges: [
        { from: 'src/index.ts', to: 'src/utils.ts' },
        { from: 'test/index.test.ts', to: 'src/index.ts' },
        { from: 'test/utils.test.ts', to: 'src/utils.ts' }
      ],
      files: {
        'src/index.ts': {
          imports: [],
          dependencies: ['src/utils.ts'],
          functions: [],
          classes: [],
          constants: []
        },
        'src/utils.ts': {
          imports: [],
          dependencies: [],
          functions: [],
          classes: [],
          constants: []
        },
        'src/component.tsx': {
          imports: [],
          dependencies: [],
          functions: [],
          classes: [],
          constants: []
        },
        'test/index.test.ts': {
          imports: [],
          dependencies: ['src/index.ts'],
          functions: [],
          classes: [],
          constants: []
        },
        'test/utils.test.ts': {
          imports: [],
          dependencies: ['src/utils.ts'],
          functions: [],
          classes: [],
          constants: []
        },
        'README.md': {
          imports: [],
          dependencies: [],
          functions: [],
          classes: [],
          constants: []
        }
      }
    };
  });

  it('should return a copy of the index when no filters are provided', () => {
    const result = filterProjectIndex(mockIndex, {});
    
    expect(result.nodes).toEqual(mockIndex.nodes);
    expect(result.metadata.totalFiles).toBe(6);
    expect(result.edges).toHaveLength(3);
  });

  it('should filter files using include patterns', () => {
    const options: FilterOptions = {
      include: ['src/**']
    };
    
    const result = filterProjectIndex(mockIndex, options);
    
    expect(result.nodes).toEqual(['src/component.tsx', 'src/index.ts', 'src/utils.ts']);
    expect(result.metadata.totalFiles).toBe(3);
    expect(result.files).toHaveProperty('src/index.ts');
    expect(result.files).not.toHaveProperty('test/index.test.ts');
  });

  it('should filter files using exclude patterns', () => {
    const options: FilterOptions = {
      exclude: ['test/**', '*.md']
    };
    
    const result = filterProjectIndex(mockIndex, options);
    
    expect(result.nodes).toEqual(['src/component.tsx', 'src/index.ts', 'src/utils.ts']);
    expect(result.metadata.totalFiles).toBe(3);
    expect(result.files).toHaveProperty('src/index.ts');
    expect(result.files).not.toHaveProperty('test/index.test.ts');
    expect(result.files).not.toHaveProperty('README.md');
  });

  it('should filter files using both include and exclude patterns', () => {
    const options: FilterOptions = {
      include: ['src/**', 'test/**'],
      exclude: ['test/**']
    };
    
    const result = filterProjectIndex(mockIndex, options);
    
    expect(result.nodes).toEqual(['src/component.tsx', 'src/index.ts', 'src/utils.ts']);
    expect(result.metadata.totalFiles).toBe(3);
  });

  it('should filter edges to only include relationships between filtered files', () => {
    const options: FilterOptions = {
      include: ['src/**']
    };
    
    const result = filterProjectIndex(mockIndex, options);
    
    // Should only keep the src/index.ts -> src/utils.ts edge
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toEqual({ from: 'src/index.ts', to: 'src/utils.ts' });
  });

  it('should rebuild the tree structure from filtered files', () => {
    const options: FilterOptions = {
      include: ['src/**']
    };
    
    const result = filterProjectIndex(mockIndex, options);
    
    expect(result.tree.name).toBe('root');
    expect(result.tree.children).toHaveLength(1);
    expect(result.tree.children?.[0].name).toBe('src');
    expect(result.tree.children?.[0].children).toHaveLength(3);
  });

  it('should update metadata with new file count and timestamp', () => {
    const originalUpdatedAt = mockIndex.metadata.updatedAt;
    const options: FilterOptions = {
      include: ['src/**']
    };
    
    const result = filterProjectIndex(mockIndex, options);
    
    expect(result.metadata.totalFiles).toBe(3);
    expect(result.metadata.updatedAt).not.toBe(originalUpdatedAt);
    expect(result.metadata.root).toBe(mockIndex.metadata.root);
    expect(result.metadata.version).toBe(mockIndex.metadata.version);
  });

  it('should handle empty filter results', () => {
    const options: FilterOptions = {
      include: ['nonexistent/**']
    };
    
    const result = filterProjectIndex(mockIndex, options);
    
    expect(result.nodes).toEqual([]);
    expect(result.metadata.totalFiles).toBe(0);
    expect(result.edges).toEqual([]);
    expect(result.files).toEqual({});
  });
});

describe('getFilteringStats', () => {
  let originalIndex: ProjectIndex;
  let filteredIndex: ProjectIndex;

  beforeEach(() => {
    originalIndex = {
      metadata: { version: 1, root: '/test', createdAt: '', updatedAt: '', totalFiles: 10 },
      tree: { name: 'root', type: 'dir' },
      nodes: Array.from({ length: 10 }, (_, i) => `file${i}.ts`),
      edges: Array.from({ length: 5 }, (_, i) => ({ from: `file${i}.ts`, to: `file${i+1}.ts` })),
      files: {}
    };

    filteredIndex = {
      metadata: { version: 1, root: '/test', createdAt: '', updatedAt: '', totalFiles: 3 },
      tree: { name: 'root', type: 'dir' },
      nodes: ['file0.ts', 'file1.ts', 'file2.ts'],
      edges: [{ from: 'file0.ts', to: 'file1.ts' }, { from: 'file1.ts', to: 'file2.ts' }],
      files: {}
    };
  });

  it('should calculate correct filtering statistics', () => {
    const options: FilterOptions = { include: ['src/**'] };
    const stats = getFilteringStats(originalIndex, filteredIndex, options);

    expect(stats.originalFileCount).toBe(10);
    expect(stats.filteredFileCount).toBe(3);
    expect(stats.removedFileCount).toBe(7);
    expect(stats.reductionPercentage).toBe(70);
    expect(stats.originalEdgeCount).toBe(5);
    expect(stats.filteredEdgeCount).toBe(2);
    expect(stats.removedEdgeCount).toBe(3);
    expect(stats.edgeReductionPercentage).toBe(60);
    expect(stats.filterOptions).toEqual(options);
  });

  it('should handle zero division cases', () => {
    const emptyOriginal: ProjectIndex = {
      metadata: { version: 1, root: '/test', createdAt: '', updatedAt: '', totalFiles: 0 },
      tree: { name: 'root', type: 'dir' },
      nodes: [],
      edges: [],
      files: {}
    };

    const emptyFiltered: ProjectIndex = {
      metadata: { version: 1, root: '/test', createdAt: '', updatedAt: '', totalFiles: 0 },
      tree: { name: 'root', type: 'dir' },
      nodes: [],
      edges: [],
      files: {}
    };

    const stats = getFilteringStats(emptyOriginal, emptyFiltered, {});

    expect(stats.reductionPercentage).toBe(0);
    expect(stats.edgeReductionPercentage).toBe(0);
  });
});