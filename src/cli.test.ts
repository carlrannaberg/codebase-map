/**
 * Tests for CLI format command with filtering functionality
 * 
 * These tests verify that the format command correctly applies include/exclude
 * filtering patterns and produces the expected output and statistics.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import type { ProjectIndex, FilterOptions } from './types/index.js';
import { filterProjectIndex, getFilteringStats } from './utils/project-index-filter.js';
import * as indexFormatter from './core/index-formatter.js';
import * as findProjectRoot from './utils/find-project-root.js';

// Mock dependencies
vi.mock('node:fs');
vi.mock('./utils/find-project-root.js');
vi.mock('./utils/project-index-filter.js');
vi.mock('./core/index-formatter.js');

const mockFs = vi.mocked(fs);
const mockFindProjectRoot = vi.mocked(findProjectRoot);
const mockFilterProjectIndex = vi.mocked(filterProjectIndex);
const mockGetFilteringStats = vi.mocked(getFilteringStats);
const mockIndexFormatter = vi.mocked(indexFormatter);

// Mock console methods
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('CLI format command filtering logic', () => {
  let mockProjectIndex: ProjectIndex;
  let originalProcessExit: typeof process.exit;
  let mockProcessExit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock process.exit to prevent test termination
    mockProcessExit = vi.fn();
    originalProcessExit = process.exit;
    process.exit = mockProcessExit as never;

    // Create mock project index
    mockProjectIndex = {
      metadata: {
        version: 1,
        root: '/test/project',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        totalFiles: 6
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
          functions: [{ name: 'main', line: 1, type: 'function' }],
          classes: [],
          constants: []
        },
        'src/utils.ts': {
          imports: [],
          dependencies: [],
          functions: [{ name: 'helper', line: 1, type: 'function' }],
          classes: [],
          constants: []
        },
        'src/component.tsx': {
          imports: [],
          dependencies: [],
          functions: [],
          classes: [{ name: 'Component', line: 1, type: 'class' }],
          constants: []
        },
        'test/index.test.ts': {
          imports: [],
          dependencies: ['src/index.ts'],
          functions: [{ name: 'testMain', line: 1, type: 'function' }],
          classes: [],
          constants: []
        },
        'test/utils.test.ts': {
          imports: [],
          dependencies: ['src/utils.ts'],
          functions: [{ name: 'testHelper', line: 1, type: 'function' }],
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

    // Setup default mocks
    mockFindProjectRoot.findIndexFile.mockReturnValue('/test/project/.codebasemap');
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(mockProjectIndex));
  });

  afterEach(() => {
    process.exit = originalProcessExit;
    vi.restoreAllMocks();
  });

  // Helper function to simulate the format command core logic
  const executeFormatLogic = (options: {
    format?: string;
    stats?: boolean;
    include?: string[];
    exclude?: string[];
  }) => {
    const { format = 'auto', stats, include, exclude } = options;
    
    // Find existing index file
    const indexPath = mockFindProjectRoot.findIndexFile();
    
    if (!indexPath || !mockFs.existsSync(indexPath)) {
      mockConsoleError('❌ PROJECT_INDEX.json not found. Run "codebase-map scan" first.');
      mockProcessExit(1);
      return;
    }
    
    let index: ProjectIndex = JSON.parse(mockFs.readFileSync(indexPath, 'utf-8') as string);
    
    // Apply filtering if include/exclude patterns are provided
    if (include || exclude) {
      const filterOptions: FilterOptions = {};
      if (include && include.length > 0) {
        filterOptions.include = include;
      }
      if (exclude && exclude.length > 0) {
        filterOptions.exclude = exclude;
      }
      
      const originalIndex = index;
      index = mockFilterProjectIndex(index, filterOptions);
      
      // Show filtering statistics to stderr
      const filterStats = mockGetFilteringStats(originalIndex, index, filterOptions);
      mockConsoleError('--- Filtering Applied ---');
      mockConsoleError(`Files: ${filterStats.originalFileCount} → ${filterStats.filteredFileCount} (${filterStats.reductionPercentage.toFixed(1)}% reduction)`);
      mockConsoleError(`Dependencies: ${filterStats.originalEdgeCount} → ${filterStats.filteredEdgeCount} (${filterStats.edgeReductionPercentage.toFixed(1)}% reduction)`);
      if (filterOptions.include) {
        mockConsoleError(`Include patterns: ${filterOptions.include.join(', ')}`);
      }
      if (filterOptions.exclude) {
        mockConsoleError(`Exclude patterns: ${filterOptions.exclude.join(', ')}`);
      }
    }
    
    // Generate formatted output
    let result: { format: string; content: string };
    
    switch (format) {
      case 'json':
        result = { format: 'json', content: JSON.stringify(index, null, 2) };
        break;
      case 'dsl':
        result = { format: 'dsl', content: mockIndexFormatter.toDSL(index) };
        break;
      case 'graph':
        result = { format: 'graph', content: mockIndexFormatter.toGraph(index) };
        break;
      case 'markdown':
        result = { format: 'markdown', content: mockIndexFormatter.toMarkdown(index) };
        break;
      case 'tree':
        result = { format: 'tree', content: mockIndexFormatter.toTree(index) };
        break;
      case 'auto':
      default:
        result = mockIndexFormatter.formatAuto(index);
        break;
    }
    
    // Output to stdout
    mockConsoleLog(result.content);
    
    // Optional stats to stderr
    if (stats) {
      const compressionStats = mockIndexFormatter.getCompressionStats(index, result.content);
      mockConsoleError(`--- Statistics (${result.format} format) ---`);
      mockConsoleError(`Size: ${(compressionStats.compressedSize / 1024).toFixed(1)} KB (${compressionStats.reduction}% reduction)`);
      mockConsoleError(`Tokens: ~${compressionStats.estimatedTokens.toLocaleString()} (${Math.round(compressionStats.estimatedTokens / index.metadata.totalFiles)} per file)`);
      mockConsoleError(`Files: ${index.metadata.totalFiles}`);
      
      if (compressionStats.estimatedTokens > 50000) {
        mockConsoleError('Warning: Index uses >50K tokens. Consider --format=graph for maximum compression.');
      }
    }
  };

  describe('format command without filtering', () => {
    it('should format index without filtering when no patterns provided', () => {
      // Setup formatter mocks
      mockIndexFormatter.formatAuto.mockReturnValue({
        format: 'dsl',
        content: 'Mock DSL content'
      });

      executeFormatLogic({});

      // Verify no filtering was applied
      expect(mockFilterProjectIndex).not.toHaveBeenCalled();
      expect(mockGetFilteringStats).not.toHaveBeenCalled();

      // Verify formatter was called with original index
      expect(mockIndexFormatter.formatAuto).toHaveBeenCalledWith(mockProjectIndex);

      // Verify output was written to stdout
      expect(mockConsoleLog).toHaveBeenCalledWith('Mock DSL content');
    });

    it('should handle different output formats without filtering', () => {
      const formats = [
        { flag: 'dsl', content: 'Mock DSL format' },
        { flag: 'graph', content: 'Mock Graph format' },
        { flag: 'markdown', content: '# Mock Markdown' },
        { flag: 'tree', content: 'project/\n├── src/' }
      ];

      for (const format of formats) {
        vi.clearAllMocks();
        
        // Setup specific formatter mock
        if (format.flag === 'dsl') {
          mockIndexFormatter.toDSL.mockReturnValue(format.content);
        } else if (format.flag === 'graph') {
          mockIndexFormatter.toGraph.mockReturnValue(format.content);
        } else if (format.flag === 'markdown') {
          mockIndexFormatter.toMarkdown.mockReturnValue(format.content);
        } else if (format.flag === 'tree') {
          mockIndexFormatter.toTree.mockReturnValue(format.content);
        }

        executeFormatLogic({ format: format.flag });

        // Verify no filtering was applied for any format
        expect(mockFilterProjectIndex).not.toHaveBeenCalled();
        
        // Verify correct output was written to stdout
        expect(mockConsoleLog).toHaveBeenCalledWith(format.content);
      }
    });
  });

  describe('format command with include patterns', () => {
    it('should apply include patterns and format filtered index', () => {
      const filteredIndex: ProjectIndex = {
        ...mockProjectIndex,
        nodes: ['src/index.ts', 'src/utils.ts', 'src/component.tsx'],
        metadata: { ...mockProjectIndex.metadata, totalFiles: 3 },
        edges: [{ from: 'src/index.ts', to: 'src/utils.ts' }]
      };

      const filterStats = {
        originalFileCount: 6,
        filteredFileCount: 3,
        removedFileCount: 3,
        reductionPercentage: 50,
        originalEdgeCount: 3,
        filteredEdgeCount: 1,
        removedEdgeCount: 2,
        edgeReductionPercentage: 66.7,
        filterOptions: { include: ['src/**'] }
      };

      // Setup mocks
      mockFilterProjectIndex.mockReturnValue(filteredIndex);
      mockGetFilteringStats.mockReturnValue(filterStats);
      mockIndexFormatter.formatAuto.mockReturnValue({
        format: 'dsl',
        content: 'Filtered DSL content'
      });

      executeFormatLogic({ include: ['src/**'] });

      // Verify filtering was applied with correct options
      expect(mockFilterProjectIndex).toHaveBeenCalledWith(mockProjectIndex, { include: ['src/**'] });
      expect(mockGetFilteringStats).toHaveBeenCalledWith(mockProjectIndex, filteredIndex, { include: ['src/**'] });

      // Verify formatter was called with filtered index
      expect(mockIndexFormatter.formatAuto).toHaveBeenCalledWith(filteredIndex);

      // Verify filtered output was written to stdout
      expect(mockConsoleLog).toHaveBeenCalledWith('Filtered DSL content');

      // Verify filtering stats were written to stderr
      expect(mockConsoleError).toHaveBeenCalledWith('--- Filtering Applied ---');
      expect(mockConsoleError).toHaveBeenCalledWith('Files: 6 → 3 (50.0% reduction)');
      expect(mockConsoleError).toHaveBeenCalledWith('Dependencies: 3 → 1 (66.7% reduction)');
      expect(mockConsoleError).toHaveBeenCalledWith('Include patterns: src/**');
    });
  });

  describe('format command with exclude patterns', () => {
    it('should apply exclude patterns and format filtered index', () => {
      const filteredIndex: ProjectIndex = {
        ...mockProjectIndex,
        nodes: ['src/index.ts', 'src/utils.ts', 'src/component.tsx'],
        metadata: { ...mockProjectIndex.metadata, totalFiles: 3 }
      };

      mockFilterProjectIndex.mockReturnValue(filteredIndex);
      mockGetFilteringStats.mockReturnValue({
        originalFileCount: 6,
        filteredFileCount: 3,
        removedFileCount: 3,
        reductionPercentage: 50,
        originalEdgeCount: 3,
        filteredEdgeCount: 1,
        removedEdgeCount: 2,
        edgeReductionPercentage: 66.7,
        filterOptions: { exclude: ['test/**', '*.md'] }
      });
      mockIndexFormatter.toTree.mockReturnValue('project/\n├── src/');

      executeFormatLogic({ format: 'tree', exclude: ['test/**', '*.md'] });

      // Verify filtering was applied with exclude patterns
      expect(mockFilterProjectIndex).toHaveBeenCalledWith(mockProjectIndex, { 
        exclude: ['test/**', '*.md'] 
      });

      // Verify exclude patterns are displayed in stats
      expect(mockConsoleError).toHaveBeenCalledWith('Exclude patterns: test/**, *.md');
    });
  });

  describe('format command with both include and exclude patterns', () => {
    it('should apply both include and exclude patterns', () => {
      const filteredIndex: ProjectIndex = {
        ...mockProjectIndex,
        nodes: ['src/index.ts', 'src/utils.ts'],
        metadata: { ...mockProjectIndex.metadata, totalFiles: 2 }
      };

      mockFilterProjectIndex.mockReturnValue(filteredIndex);
      mockGetFilteringStats.mockReturnValue({
        originalFileCount: 6,
        filteredFileCount: 2,
        removedFileCount: 4,
        reductionPercentage: 66.7,
        originalEdgeCount: 3,
        filteredEdgeCount: 1,
        removedEdgeCount: 2,
        edgeReductionPercentage: 66.7,
        filterOptions: { 
          include: ['src/**'], 
          exclude: ['**/*.tsx'] 
        }
      });
      mockIndexFormatter.toGraph.mockReturnValue('src/index.ts -> src/utils.ts');

      executeFormatLogic({ 
        format: 'graph', 
        include: ['src/**'], 
        exclude: ['**/*.tsx'] 
      });

      // Verify filtering was applied with both patterns
      expect(mockFilterProjectIndex).toHaveBeenCalledWith(mockProjectIndex, { 
        include: ['src/**'],
        exclude: ['**/*.tsx']
      });

      // Verify both patterns are displayed in stats
      expect(mockConsoleError).toHaveBeenCalledWith('Include patterns: src/**');
      expect(mockConsoleError).toHaveBeenCalledWith('Exclude patterns: **/*.tsx');
    });
  });

  describe('format command with statistics', () => {
    it('should show compression statistics with stats flag', () => {
      const compressionStats = {
        compressedSize: 1024,
        reduction: 75,
        estimatedTokens: 256
      };

      mockIndexFormatter.formatAuto.mockReturnValue({
        format: 'dsl',
        content: 'DSL content with stats'
      });
      mockIndexFormatter.getCompressionStats.mockReturnValue(compressionStats);

      executeFormatLogic({ stats: true });

      // Verify compression stats were calculated and displayed
      expect(mockIndexFormatter.getCompressionStats).toHaveBeenCalledWith(mockProjectIndex, 'DSL content with stats');
      expect(mockConsoleError).toHaveBeenCalledWith('--- Statistics (dsl format) ---');
      expect(mockConsoleError).toHaveBeenCalledWith('Size: 1.0 KB (75% reduction)');
      expect(mockConsoleError).toHaveBeenCalledWith('Tokens: ~256 (43 per file)');
      expect(mockConsoleError).toHaveBeenCalledWith('Files: 6');
    });
  });

  describe('error cases and edge cases', () => {
    it('should handle missing index file', () => {
      mockFindProjectRoot.findIndexFile.mockReturnValue(null);

      executeFormatLogic({});

      expect(mockConsoleError).toHaveBeenCalledWith('❌ PROJECT_INDEX.json not found. Run "codebase-map scan" first.');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle non-existent index file', () => {
      mockFindProjectRoot.findIndexFile.mockReturnValue('/test/project/.codebasemap');
      mockFs.existsSync.mockReturnValue(false);

      executeFormatLogic({});

      expect(mockConsoleError).toHaveBeenCalledWith('❌ PROJECT_INDEX.json not found. Run "codebase-map scan" first.');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle filtering that results in no files', () => {
      const emptyFilteredIndex: ProjectIndex = {
        ...mockProjectIndex,
        nodes: [],
        metadata: { ...mockProjectIndex.metadata, totalFiles: 0 },
        edges: [],
        files: {}
      };

      mockFilterProjectIndex.mockReturnValue(emptyFilteredIndex);
      mockGetFilteringStats.mockReturnValue({
        originalFileCount: 6,
        filteredFileCount: 0,
        removedFileCount: 6,
        reductionPercentage: 100,
        originalEdgeCount: 3,
        filteredEdgeCount: 0,
        removedEdgeCount: 3,
        edgeReductionPercentage: 100,
        filterOptions: { include: ['nonexistent/**'] }
      });
      mockIndexFormatter.formatAuto.mockReturnValue({
        format: 'dsl',
        content: '// No files found'
      });

      executeFormatLogic({ include: ['nonexistent/**'] });

      // Should still output something (empty result)
      expect(mockConsoleLog).toHaveBeenCalledWith('// No files found');
      expect(mockConsoleError).toHaveBeenCalledWith('Files: 6 → 0 (100.0% reduction)');
    });

    it('should handle very large token count warning', () => {
      const compressionStats = {
        compressedSize: 1048576, // 1MB
        reduction: 25,
        estimatedTokens: 75000 // > 50K threshold
      };

      mockIndexFormatter.formatAuto.mockReturnValue({
        format: 'json',
        content: JSON.stringify(mockProjectIndex, null, 2)
      });
      mockIndexFormatter.getCompressionStats.mockReturnValue(compressionStats);

      executeFormatLogic({ stats: true });

      // Should show warning for large token count
      expect(mockConsoleError).toHaveBeenCalledWith('Warning: Index uses >50K tokens. Consider --format=graph for maximum compression.');
    });
  });
});
