/**
 * @fileoverview Project index filtering utilities
 * 
 * Provides efficient filtering of existing ProjectIndex instances based on
 * include/exclude patterns without requiring file system access. Reuses
 * existing pattern matching infrastructure for consistency and performance.
 * 
 * @example
 * // Filter to only TypeScript files
 * const filtered = filterProjectIndex(index, {
 *   include: ['src/**']
 * });
 * 
 * // Exclude test files
 * const prodIndex = filterProjectIndex(index, {
 *   exclude: ['test/**']
 * });
 */

import type { ProjectIndex, FilterOptions, TreeNode, FileInfo } from '../types/index.js';
import { TreeBuilder } from '../core/tree-builder.js';
import { validatePatternArray } from './pattern-validation.js';
import { minimatch } from 'minimatch';

/**
 * Filter an existing ProjectIndex based on include/exclude patterns
 * 
 * This function operates entirely in memory and is designed to be 10-1000x faster
 * than re-scanning the file system. It filters all data structures within the index:
 * - nodes array (file paths)
 * - files object (detailed file info)
 * - edges array (dependencies - keeps only if both source and target are included)
 * - tree structure (rebuilt from filtered files)
 * - metadata (updated to reflect filtered counts)
 * 
 * @param index - The ProjectIndex to filter
 * @param options - Filter options with include/exclude patterns
 * @param options.include - Array of glob patterns to include files (OR logic)
 * @param options.exclude - Array of glob patterns to exclude files (OR logic)
 * @returns New filtered ProjectIndex with updated metadata
 * 
 * @example Basic filtering
 * const index = await indexer.processProject();
 * 
 * // Filter to only source files
 * const srcIndex = filterProjectIndex(index, {
 *   include: ['src/**']
 * });
 * 
 * // Exclude test files
 * const prodIndex = filterProjectIndex(index, {
 *   exclude: ['test/**']
 * });
 * 
 * @example Complex filtering
 * // Filter to specific components excluding tests
 * const componentIndex = filterProjectIndex(index, {
 *   include: ['src/components/**', 'src/ui/**'],
 *   exclude: ['test/**', 'stories/**']
 * });
 * 
 * console.log('Filtered files from', index.metadata.totalFiles, 'to', componentIndex.metadata.totalFiles);
 * 
 * @throws {PatternValidationError} When glob patterns are malformed
 * @throws {SecurityViolationError} When patterns contain dangerous sequences
 */
export function filterProjectIndex(
  index: ProjectIndex,
  options: FilterOptions = {}
): ProjectIndex {
  // Validate patterns using existing infrastructure
  if (options.include !== undefined) {
    validatePatternArray(options.include, 'include');
  }
  if (options.exclude !== undefined) {
    validatePatternArray(options.exclude, 'exclude');
  }

  // If no filtering options provided, return a deep copy
  if (!options.include && !options.exclude) {
    return cloneProjectIndex(index);
  }

  // Get all file paths from the index
  const allFiles = index.nodes;
  
  // Apply pattern filtering to get final file list
  const filteredFiles = applyPatternFiltering(allFiles, options);

  // Create filtered data structures
  const filteredNodes = filteredFiles;
  const filteredFilesObject = createFilteredFilesObject(index.files, filteredFiles);
  const filteredEdges = createFilteredEdges(index.edges, filteredFiles);
  const filteredTree = TreeBuilder.buildTree(filteredFiles, 'root');

  // Create updated metadata
  const filteredMetadata = {
    ...index.metadata,
    updatedAt: new Date().toISOString(),
    totalFiles: filteredFiles.length
  };

  return {
    metadata: filteredMetadata,
    tree: filteredTree,
    nodes: filteredNodes,
    edges: filteredEdges,
    files: filteredFilesObject
  };
}

/**
 * Apply include/exclude pattern filtering to file list
 * 
 * Uses the same pattern matching logic as FileDiscovery for consistency.
 * Applies include patterns first (if provided), then exclude patterns.
 * 
 * @param files - Array of file paths to filter
 * @param options - Filter options with patterns
 * @returns Filtered array of file paths
 */
function applyPatternFiltering(files: string[], options: FilterOptions): string[] {
  let filteredFiles = files;

  // Apply include patterns if provided
  if (options.include && options.include.length > 0) {
    filteredFiles = applyIncludePatterns(filteredFiles, options.include);
  }

  // Apply exclude patterns if provided
  if (options.exclude && options.exclude.length > 0) {
    filteredFiles = applyExcludePatterns(filteredFiles, options.exclude);
  }

  return filteredFiles.sort();
}

/**
 * Apply include patterns to file list
 * 
 * A file is included if it matches ANY of the include patterns (OR logic).
 * Uses minimatch for glob pattern matching.
 * 
 * @param files - Files to filter
 * @param includePatterns - Include patterns
 * @returns Files that match include patterns
 */
function applyIncludePatterns(files: string[], includePatterns: string[]): string[] {
  const matchingFiles = new Set<string>();
  
  for (const file of files) {
    for (const pattern of includePatterns) {
      if (minimatch(file, pattern)) {
        matchingFiles.add(file);
        break; // No need to check other patterns for this file
      }
    }
  }
  
  return Array.from(matchingFiles);
}

/**
 * Apply exclude patterns to file list
 * 
 * A file is excluded if it matches ANY of the exclude patterns (OR logic).
 * Uses minimatch for glob pattern matching.
 * 
 * @param files - Files to filter
 * @param excludePatterns - Exclude patterns
 * @returns Files that don't match exclude patterns
 */
function applyExcludePatterns(files: string[], excludePatterns: string[]): string[] {
  return files.filter(file => {
    for (const pattern of excludePatterns) {
      if (minimatch(file, pattern)) {
        return false; // Exclude this file
      }
    }
    return true; // Keep this file
  });
}

/**
 * Create filtered files object containing only included files
 * 
 * @param originalFiles - Original files object from index
 * @param includedFiles - Array of file paths to include
 * @returns New files object with only included files
 */
function createFilteredFilesObject(
  originalFiles: Record<string, FileInfo>,
  includedFiles: string[]
): Record<string, FileInfo> {
  const filteredFiles: Record<string, FileInfo> = {};
  
  for (const filePath of includedFiles) {
    if (originalFiles[filePath]) {
      filteredFiles[filePath] = originalFiles[filePath];
    }
  }
  
  return filteredFiles;
}

/**
 * Create filtered edges array containing only edges between included files
 * 
 * An edge is included only if both the source and target files are in the
 * filtered file list. This ensures the dependency graph remains consistent.
 * 
 * @param originalEdges - Original edges from index
 * @param includedFiles - Set of included file paths
 * @returns Filtered edges array
 */
function createFilteredEdges(
  originalEdges: Array<{ from: string; to: string }>,
  includedFiles: string[]
): Array<{ from: string; to: string }> {
  const includedFilesSet = new Set(includedFiles);
  
  return originalEdges.filter(edge => 
    includedFilesSet.has(edge.from) && includedFilesSet.has(edge.to)
  );
}

/**
 * Create a deep copy of a ProjectIndex
 * 
 * Used when no filtering is applied to ensure the returned index
 * is independent of the original.
 * 
 * @param index - Original ProjectIndex
 * @returns Deep copy of the index
 */
function cloneProjectIndex(index: ProjectIndex): ProjectIndex {
  return {
    metadata: { ...index.metadata },
    tree: cloneTreeNode(index.tree),
    nodes: [...index.nodes],
    edges: index.edges.map(edge => ({ ...edge })),
    files: JSON.parse(JSON.stringify(index.files)) // Deep clone for file objects
  };
}

/**
 * Deep clone a tree node recursively
 * 
 * @param node - Tree node to clone
 * @returns Deep copy of the tree node
 */
function cloneTreeNode(node: TreeNode): TreeNode {
  const cloned: TreeNode = {
    name: node.name,
    type: node.type
  };
  
  if (node.children) {
    cloned.children = node.children.map(child => cloneTreeNode(child));
  }
  
  return cloned;
}

/**
 * Get filtering statistics for analysis
 * 
 * Provides detailed information about how filtering affected the project index,
 * useful for understanding the impact of different filter patterns.
 * 
 * @param originalIndex - Original ProjectIndex before filtering
 * @param filteredIndex - Filtered ProjectIndex after filtering
 * @param options - Filter options that were applied
 * @returns Statistics about the filtering operation
 * 
 * @example
 * ```typescript
 * const original = await indexer.processProject();
 * const filtered = filterProjectIndex(original, { include: ['src/**'] });
 * const stats = getFilteringStats(original, filtered, { include: ['src/**'] });
 * 
 * console.log(`Reduced files from ${stats.originalFileCount} to ${stats.filteredFileCount}`);
 * console.log(`Reduction: ${stats.reductionPercentage.toFixed(1)}%`);
 * console.log(`Removed ${stats.removedEdgeCount} dependency edges`);
 * ```
 */
export function getFilteringStats(
  originalIndex: ProjectIndex,
  filteredIndex: ProjectIndex,
  options: FilterOptions
): {
  originalFileCount: number;
  filteredFileCount: number;
  reductionPercentage: number;
  removedFileCount: number;
  originalEdgeCount: number;
  filteredEdgeCount: number;
  removedEdgeCount: number;
  edgeReductionPercentage: number;
  filterOptions: FilterOptions;
} {
  const originalFileCount = originalIndex.metadata.totalFiles;
  const filteredFileCount = filteredIndex.metadata.totalFiles;
  const removedFileCount = originalFileCount - filteredFileCount;
  const reductionPercentage = originalFileCount > 0 
    ? (removedFileCount / originalFileCount) * 100 
    : 0;

  const originalEdgeCount = originalIndex.edges.length;
  const filteredEdgeCount = filteredIndex.edges.length;
  const removedEdgeCount = originalEdgeCount - filteredEdgeCount;
  const edgeReductionPercentage = originalEdgeCount > 0
    ? (removedEdgeCount / originalEdgeCount) * 100
    : 0;

  return {
    originalFileCount,
    filteredFileCount,
    reductionPercentage,
    removedFileCount,
    originalEdgeCount,
    filteredEdgeCount,
    removedEdgeCount,
    edgeReductionPercentage,
    filterOptions: { ...options }
  };
}