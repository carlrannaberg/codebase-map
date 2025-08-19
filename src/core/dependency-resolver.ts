/**
 * Dependency resolution module - resolves relative imports to actual file paths
 * 
 * PERFORMANCE OPTIMIZATION: This module is optimized for O(n) complexity when processing
 * large codebases (10,000+ files). Key optimizations:
 * 1. Pre-built lookup structures to avoid O(n²) array searches
 * 2. File path Set for O(1) existence checks
 * 3. Basename and extension maps for efficient candidate matching
 * 4. Cached directory structures for directory-based imports
 */

import * as path from 'node:path';
import type { ImportInfo } from '../types/index.js';

/**
 * Performance-optimized file lookup structures
 * These are built once and reused for all import resolution operations
 */
interface FileLookupStructures {
  /** Set of all file paths for O(1) existence checks */
  fileSet: Set<string>;
  
  /** Map from basename (without extension) to array of full file paths */
  basenameMap: Map<string, string[]>;
  
  /** Map from directory path to array of index files in that directory */
  directoryIndexMap: Map<string, string[]>;
  
  /** Map from file extension to array of files with that extension */
  extensionMap: Map<string, string[]>;
}

export class DependencyResolver {
  private static readonly EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
  private static readonly INDEX_FILES = ['index.ts', 'index.tsx', 'index.js', 'index.jsx'];

  /**
   * Build optimized lookup structures from file array
   * Time Complexity: O(n) where n is number of files
   * Space Complexity: O(n) for lookup structures
   * 
   * This is the key performance optimization - we build these structures once
   * and use O(1) lookups instead of O(n) array searches
   */
  private static buildLookupStructures(allFiles: string[]): FileLookupStructures {
    const fileSet = new Set<string>();
    const basenameMap = new Map<string, string[]>();
    const directoryIndexMap = new Map<string, string[]>();
    const extensionMap = new Map<string, string[]>();

    // Validate input
    if (!Array.isArray(allFiles)) {
      console.warn('buildLookupStructures: allFiles is not an array, returning empty structures');
      return { fileSet, basenameMap, directoryIndexMap, extensionMap };
    }

    for (const filePath of allFiles) {
      // Add to file set for O(1) existence checks
      fileSet.add(filePath);

      // Extract path components
      const dir = path.dirname(filePath);
      const ext = path.extname(filePath);
      const basename = path.basename(filePath, ext);
      const filename = path.basename(filePath);

      // Build basename map for extension-less imports
      if (!basenameMap.has(basename)) {
        basenameMap.set(basename, []);
      }
      const basenameFiles = basenameMap.get(basename);
      if (basenameFiles) {
        basenameFiles.push(filePath);
      }

      // Build directory index map for directory imports
      if (this.INDEX_FILES.includes(filename)) {
        if (!directoryIndexMap.has(dir)) {
          directoryIndexMap.set(dir, []);
        }
        const dirIndexFiles = directoryIndexMap.get(dir);
        if (dirIndexFiles) {
          dirIndexFiles.push(filePath);
        }
      }

      // Build extension map for extension-based lookups
      if (ext) {
        if (!extensionMap.has(ext)) {
          extensionMap.set(ext, []);
        }
        const extFiles = extensionMap.get(ext);
        if (extFiles) {
          extFiles.push(filePath);
        }
      }
    }

    return { fileSet, basenameMap, directoryIndexMap, extensionMap };
  }

  /**
   * Resolve relative imports to actual file paths using optimized lookup structures
   * Time Complexity: O(1) per import (average case), O(k) worst case where k is number of candidates
   * 
   * @param imports - Array of import info from file
   * @param currentFilePath - Path of the file containing the imports
   * @param lookupStructures - Pre-built lookup structures for O(1) file resolution
   * @returns Array of resolved file paths
   */
  static resolveImportsOptimized(
    imports: ImportInfo[],
    currentFilePath: string,
    lookupStructures: FileLookupStructures
  ): string[] {
    const resolved: string[] = [];
    const currentDir = path.dirname(currentFilePath);

    for (const importInfo of imports) {
      // Only resolve relative imports (starting with . or ..)
      if (!this.isRelativeImport(importInfo.from)) {
        continue;
      }

      const resolvedPath = this.resolveRelativeImportOptimized(
        importInfo.from,
        currentDir,
        lookupStructures
      );

      if (resolvedPath) {
        resolved.push(resolvedPath);
      }
    }

    // Remove duplicates and sort
    return [...new Set(resolved)].sort();
  }

  /**
   * Legacy method for backwards compatibility
   * PERFORMANCE WARNING: This method has O(n²) complexity and should be avoided for large codebases
   * Use resolveImportsOptimized instead for better performance
   * 
   * @deprecated Use resolveImportsOptimized with pre-built lookup structures
   */
  static resolveImports(
    imports: ImportInfo[],
    currentFilePath: string,
    allFiles: string[]
  ): string[] {
    // Build lookup structures for this single operation
    // Note: This is inefficient for repeated calls but maintains compatibility
    const lookupStructures = this.buildLookupStructures(allFiles);
    return this.resolveImportsOptimized(imports, currentFilePath, lookupStructures);
  }

  /**
   * Resolve a single relative import using optimized lookup structures
   * Time Complexity: O(1) average case, O(k) worst case where k is number of candidates
   * 
   * @param specifier - Relative module specifier
   * @param currentDir - Directory of the importing file
   * @param lookupStructures - Pre-built lookup structures for O(1) file resolution
   * @returns Resolved file path or undefined if not found
   */
  private static resolveRelativeImportOptimized(
    specifier: string,
    currentDir: string,
    lookupStructures: FileLookupStructures
  ): string | undefined {
    // Resolve the relative path, keeping it relative to the project root
    const resolvedPath = path.join(currentDir, specifier);
    const normalizedPath = path.normalize(resolvedPath).replace(/\\/g, '/');

    // Generate candidates using optimized structures
    const candidates = this.generateCandidatesOptimized(normalizedPath, lookupStructures);
    
    // Use Set lookup for O(1) existence checks instead of array.includes()
    for (const candidate of candidates) {
      if (lookupStructures.fileSet.has(candidate)) {
        return candidate;
      }
    }

    return undefined;
  }

  /**
   * Generate candidate file paths using optimized lookup structures
   * Time Complexity: O(1) for most cases, O(k) where k is number of files with same basename
   * 
   * @param basePath - Base path to generate candidates from
   * @param lookupStructures - Pre-built lookup structures
   * @returns Array of candidate file paths
   */
  private static generateCandidatesOptimized(
    basePath: string,
    lookupStructures: FileLookupStructures
  ): string[] {
    const candidates: string[] = [];
    
    // Make path relative to project root (remove leading slash if present)
    const relativePath = basePath.startsWith('/') ? basePath.slice(1) : basePath;
    
    // 1. Handle files with extensions
    if (path.extname(relativePath)) {
      const ext = path.extname(relativePath);
      const baseName = relativePath.slice(0, -ext.length);
      
      // For .js/.jsx imports, prioritize .ts/.tsx equivalents (ESM TypeScript pattern)
      if (ext === '.js') {
        candidates.push(baseName + '.ts');  // Try .ts first
        candidates.push(relativePath);      // Then try actual .js
      } else if (ext === '.jsx') {
        candidates.push(baseName + '.tsx'); // Try .tsx first
        candidates.push(relativePath);      // Then try actual .jsx
      } else {
        // For other extensions (.ts, .tsx, etc.), try exact match first
        candidates.push(relativePath);
      }
    } else {
      // 2. Try adding supported extensions (no extension provided)
      // Use basename lookup for more efficient matching
      const basename = path.basename(relativePath);
      const basenameFiles = lookupStructures.basenameMap.get(basename);
      
      if (basenameFiles) {
        // Filter to files in the correct directory
        const expectedDir = path.dirname(relativePath);
        for (const file of basenameFiles) {
          if (path.dirname(file) === expectedDir) {
            candidates.push(file);
          }
        }
      } else {
        // Fallback: try adding each extension
        for (const ext of this.EXTENSIONS) {
          candidates.push(relativePath + ext);
        }
      }
      
      // 3. Try as directory with index files
      const indexFiles = lookupStructures.directoryIndexMap.get(relativePath);
      if (indexFiles) {
        candidates.push(...indexFiles);
      } else {
        // Fallback: try each index file pattern
        for (const indexFile of this.INDEX_FILES) {
          candidates.push(path.join(relativePath, indexFile).replace(/\\/g, '/'));
        }
      }
    }

    return candidates;
  }

  /**
   * Check if an import specifier is relative
   * @param specifier - Module specifier to check
   * @returns True if the specifier is relative
   */
  private static isRelativeImport(specifier: string): boolean {
    if (!specifier || typeof specifier !== 'string') {
      return false;
    }
    return specifier.startsWith('./') || specifier.startsWith('../');
  }


  /**
   * Build dependency edges from resolved imports using optimized O(n) algorithm
   * 
   * PERFORMANCE OPTIMIZATION: This method now has O(n) complexity instead of O(n²)
   * Key optimization: Pre-build lookup structures once and reuse for all files
   * 
   * @param files - Map of file paths to their import info
   * @param allFiles - Array of all discovered files
   * @returns Array of dependency edges
   */
  static buildDependencyGraph(
    files: Record<string, ImportInfo[]>,
    allFiles: string[]
  ): Array<{ from: string; to: string }> {
    const edges: Array<{ from: string; to: string }> = [];

    // BUILD LOOKUP STRUCTURES ONCE - O(n) operation
    // This is the key performance optimization that eliminates O(n²) complexity
    const lookupStructures = this.buildLookupStructures(allFiles);

    // RESOLVE IMPORTS FOR ALL FILES - O(n) total using O(1) lookups
    for (const [filePath, imports] of Object.entries(files)) {
      const dependencies = this.resolveImportsOptimized(imports, filePath, lookupStructures);
      
      for (const dependency of dependencies) {
        edges.push({
          from: filePath,
          to: dependency
        });
      }
    }

    return edges;
  }

  /**
   * Find circular dependencies in the dependency graph
   * @param edges - Array of dependency edges
   * @returns Array of circular dependency chains
   */
  static findCircularDependencies(
    edges: Array<{ from: string; to: string }>
  ): string[][] {
    const graph = new Map<string, string[]>();
    const cycles: string[][] = [];

    // Build adjacency list
    for (const edge of edges) {
      if (!graph.has(edge.from)) {
        graph.set(edge.from, []);
      }
      const neighbors = graph.get(edge.from);
      if (neighbors) {
        neighbors.push(edge.to);
      }
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): boolean => {
      if (recursionStack.has(node)) {
        // Found a cycle, extract it from the path
        const cycleStart = path.indexOf(node);
        if (cycleStart >= 0) {
          cycles.push([...path.slice(cycleStart), node]);
        }
        return true;
      }

      if (visited.has(node)) {
        return false;
      }

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (dfs(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(node);
      path.pop();
      return false;
    };

    // Check all nodes for cycles
    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }

  /**
   * Get dependency count for each file
   * @param edges - Array of dependency edges
   * @returns Map of file paths to dependency counts
   */
  static getDependencyCounts(
    edges: Array<{ from: string; to: string }>
  ): { dependencies: Map<string, number>; dependents: Map<string, number> } {
    const dependencies = new Map<string, number>();
    const dependents = new Map<string, number>();

    for (const edge of edges) {
      // Count outgoing dependencies (what this file imports)
      dependencies.set(edge.from, (dependencies.get(edge.from) || 0) + 1);
      
      // Count incoming dependents (what files import this file)
      dependents.set(edge.to, (dependents.get(edge.to) || 0) + 1);
    }

    return { dependencies, dependents };
  }

  /**
   * Find files with no dependencies (entry points)
   * @param edges - Array of dependency edges
   * @param allFiles - Array of all files
   * @returns Array of entry point file paths
   */
  static findEntryPoints(
    edges: Array<{ from: string; to: string }>,
    allFiles: string[]
  ): string[] {
    const filesWithDependencies = new Set(edges.map(edge => edge.from));
    return allFiles.filter(file => !filesWithDependencies.has(file));
  }

  /**
   * Find leaf files (files that no other files import)
   * @param edges - Array of dependency edges
   * @param allFiles - Array of all files
   * @returns Array of leaf file paths
   */
  static findLeafFiles(
    edges: Array<{ from: string; to: string }>,
    allFiles: string[]
  ): string[] {
    const importedFiles = new Set(edges.map(edge => edge.to));
    return allFiles.filter(file => !importedFiles.has(file));
  }
}