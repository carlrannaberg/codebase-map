/**
 * Dependency resolution module - resolves relative imports to actual file paths
 */

import * as path from 'node:path';
import type { ImportInfo } from '../types/index.js';

export class DependencyResolver {
  private static readonly EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
  private static readonly INDEX_FILES = ['index.ts', 'index.tsx', 'index.js', 'index.jsx'];

  /**
   * Resolve relative imports to actual file paths
   * @param imports - Array of import info from file
   * @param currentFilePath - Path of the file containing the imports
   * @param allFiles - Array of all discovered files in the project
   * @returns Array of resolved file paths
   */
  static resolveImports(
    imports: ImportInfo[],
    currentFilePath: string,
    allFiles: string[]
  ): string[] {
    const resolved: string[] = [];
    const currentDir = path.dirname(currentFilePath);

    for (const importInfo of imports) {
      // Only resolve relative imports (starting with . or ..)
      if (!this.isRelativeImport(importInfo.from)) {
        continue;
      }

      const resolvedPath = this.resolveRelativeImport(
        importInfo.from,
        currentDir,
        allFiles
      );

      if (resolvedPath) {
        resolved.push(resolvedPath);
      }
    }

    // Remove duplicates and sort
    return [...new Set(resolved)].sort();
  }

  /**
   * Check if an import specifier is relative
   * @param specifier - Module specifier to check
   * @returns True if the specifier is relative
   */
  private static isRelativeImport(specifier: string): boolean {
    return specifier.startsWith('./') || specifier.startsWith('../');
  }

  /**
   * Resolve a single relative import to a file path
   * @param specifier - Relative module specifier
   * @param currentDir - Directory of the importing file
   * @param allFiles - Array of all discovered files
   * @returns Resolved file path or undefined if not found
   */
  private static resolveRelativeImport(
    specifier: string,
    currentDir: string,
    allFiles: string[]
  ): string | undefined {
    // Resolve the relative path, keeping it relative to the project root
    const resolvedPath = path.join(currentDir, specifier);
    const normalizedPath = path.normalize(resolvedPath).replace(/\\/g, '/');

    // Try to find the file in various ways
    const candidates = this.generateCandidates(normalizedPath);
    
    for (const candidate of candidates) {
      if (allFiles.includes(candidate)) {
        return candidate;
      }
    }

    return undefined;
  }

  /**
   * Generate candidate file paths for resolution
   * @param basePath - Base path to generate candidates from
   * @returns Array of candidate file paths
   */
  private static generateCandidates(basePath: string): string[] {
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
      for (const ext of this.EXTENSIONS) {
        candidates.push(relativePath + ext);
      }
      
      // 3. Try as directory with index files
      for (const indexFile of this.INDEX_FILES) {
        candidates.push(path.join(relativePath, indexFile).replace(/\\/g, '/'));
      }
    }

    return candidates;
  }

  /**
   * Build dependency edges from resolved imports
   * @param files - Map of file paths to their import info
   * @param allFiles - Array of all discovered files
   * @returns Array of dependency edges
   */
  static buildDependencyGraph(
    files: Record<string, ImportInfo[]>,
    allFiles: string[]
  ): Array<{ from: string; to: string }> {
    const edges: Array<{ from: string; to: string }> = [];

    for (const [filePath, imports] of Object.entries(files)) {
      const dependencies = this.resolveImports(imports, filePath, allFiles);
      
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