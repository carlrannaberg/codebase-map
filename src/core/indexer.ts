/**
 * Main code indexer class - orchestrates the core processing pipeline
 */

import * as path from 'node:path';
import type { ProjectIndex, FileInfo } from '../types/index.js';
import { FileDiscovery } from './file-discovery.js';
import { TreeBuilder } from './tree-builder.js';
import { ASTParser } from '../parsers/ast-parser.js';
import { DependencyResolver } from './dependency-resolver.js';

export class CodeIndexer {
  private rootPath: string;

  constructor(rootPath: string = process.cwd()) {
    this.rootPath = path.resolve(rootPath);
  }

  /**
   * Process entire project and generate complete ProjectIndex
   * @param progressCallback - Optional callback for progress updates
   * @returns Complete project index
   */
  async processProject(
    progressCallback?: (progress: { step: string; current: number; total: number }) => void
  ): Promise<ProjectIndex> {
    try {
      // Step 1: Discover files
      progressCallback?.({ step: 'Discovering files', current: 0, total: 4 });
      const files = await FileDiscovery.discoverFiles(this.rootPath);
      
      if (files.length === 0) {
        throw new Error('No TypeScript/JavaScript files found in the project');
      }

      // Step 2: Build tree structure
      progressCallback?.({ step: 'Building tree structure', current: 1, total: 4 });
      const tree = TreeBuilder.buildTree(files, path.basename(this.rootPath));

      // Step 3: Parse files in parallel for performance
      progressCallback?.({ step: 'Parsing files', current: 2, total: 4 });
      const fileInfos = await this.parseFilesInParallel(files, progressCallback);

      // Step 4: Resolve dependencies and build graph
      progressCallback?.({ step: 'Resolving dependencies', current: 3, total: 4 });
      const { edges, resolvedFiles } = this.resolveDependencies(fileInfos, files);

      const now = new Date().toISOString();

      const projectIndex: ProjectIndex = {
        metadata: {
          version: 1,
          root: this.rootPath,
          createdAt: now,
          updatedAt: now,
          totalFiles: files.length
        },
        tree,
        nodes: files,
        edges,
        files: resolvedFiles
      };

      progressCallback?.({ step: 'Complete', current: 4, total: 4 });
      return projectIndex;
    } catch (error) {
      throw new Error(`Failed to process project: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update a single file in the existing index
   * @param filePath - Relative path to the file to update
   * @param existingIndex - Existing project index
   * @returns Updated project index
   */
  async updateFile(filePath: string, existingIndex: ProjectIndex): Promise<ProjectIndex> {
    try {
      // Validate file path
      if (!FileDiscovery.isSupportedFile(filePath)) {
        throw new Error(`Unsupported file type: ${filePath}`);
      }

      // Parse the updated file
      const absolutePath = path.resolve(this.rootPath, filePath);
      const fileInfo = await ASTParser.parseFile(absolutePath);

      // Resolve dependencies for this file
      const dependencies = DependencyResolver.resolveImports(
        fileInfo.imports,
        filePath,
        existingIndex.nodes
      );
      fileInfo.dependencies = dependencies;

      // Update the index
      const updatedIndex = { ...existingIndex };
      updatedIndex.files[filePath] = fileInfo;
      updatedIndex.metadata.updatedAt = new Date().toISOString();

      // Rebuild edges that involve this file
      updatedIndex.edges = this.rebuildEdgesForFile(filePath, updatedIndex);

      return updatedIndex;
    } catch (error) {
      throw new Error(`Failed to update file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Remove a file from the existing index
   * @param filePath - Relative path to the file to remove
   * @param existingIndex - Existing project index
   * @returns Updated project index
   */
  removeFile(filePath: string, existingIndex: ProjectIndex): ProjectIndex {
    const updatedIndex = { ...existingIndex };

    // Remove from files
    delete updatedIndex.files[filePath];

    // Remove from nodes
    updatedIndex.nodes = updatedIndex.nodes.filter(node => node !== filePath);

    // Remove edges involving this file
    updatedIndex.edges = updatedIndex.edges.filter(
      edge => edge.from !== filePath && edge.to !== filePath
    );

    // Update metadata
    updatedIndex.metadata.updatedAt = new Date().toISOString();
    updatedIndex.metadata.totalFiles = updatedIndex.nodes.length;

    // Rebuild tree without this file
    updatedIndex.tree = TreeBuilder.buildTree(updatedIndex.nodes, path.basename(this.rootPath));

    return updatedIndex;
  }

  /**
   * Parse files in parallel for better performance
   * @param files - Array of file paths to parse
   * @param progressCallback - Optional progress callback
   * @returns Map of file paths to their FileInfo
   */
  private async parseFilesInParallel(
    files: string[],
    progressCallback?: (progress: { step: string; current: number; total: number }) => void
  ): Promise<Record<string, FileInfo>> {
    const BATCH_SIZE = 10; // Process files in batches to avoid overwhelming the system
    const results: Record<string, FileInfo> = {};
    
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      
      // Update progress
      progressCallback?.({ 
        step: `Parsing files (${i + 1}-${Math.min(i + BATCH_SIZE, files.length)} of ${files.length})`, 
        current: 2, 
        total: 4 
      });

      const batchPromises = batch.map(async (filePath) => {
        try {
          const absolutePath = path.resolve(this.rootPath, filePath);
          const fileInfo = await ASTParser.parseFile(absolutePath);
          return { filePath, fileInfo };
        } catch (error) {
          // Log error but continue processing other files
          console.warn(`Failed to parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
          return {
            filePath,
            fileInfo: {
              imports: [],
              dependencies: [],
              functions: [],
              classes: [],
              constants: []
            } as FileInfo
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      for (const { filePath, fileInfo } of batchResults) {
        results[filePath] = fileInfo;
      }
    }

    return results;
  }

  /**
   * Resolve dependencies and build dependency graph
   * @param fileInfos - Map of file paths to their FileInfo
   * @param allFiles - Array of all discovered files
   * @returns Object with edges and updated file infos
   */
  private resolveDependencies(
    fileInfos: Record<string, FileInfo>,
    allFiles: string[]
  ): { edges: Array<{ from: string; to: string }>; resolvedFiles: Record<string, FileInfo> } {
    // Extract imports from all files
    const importsMap: Record<string, import('../types/index.js').ImportInfo[]> = {};
    for (const [filePath, fileInfo] of Object.entries(fileInfos)) {
      importsMap[filePath] = fileInfo.imports;
    }

    // Build dependency graph
    const edges = DependencyResolver.buildDependencyGraph(importsMap, allFiles);

    // Update file infos with resolved dependencies
    const resolvedFiles: Record<string, FileInfo> = {};
    for (const [filePath, fileInfo] of Object.entries(fileInfos)) {
      const dependencies = DependencyResolver.resolveImports(
        fileInfo.imports,
        filePath,
        allFiles
      );
      
      resolvedFiles[filePath] = {
        ...fileInfo,
        dependencies
      };
    }

    return { edges, resolvedFiles };
  }

  /**
   * Rebuild dependency edges for a specific file
   * @param filePath - File path to rebuild edges for
   * @param index - Project index
   * @returns Updated edges array
   */
  private rebuildEdgesForFile(filePath: string, index: ProjectIndex): Array<{ from: string; to: string }> {
    // Remove existing edges involving this file
    const filteredEdges = index.edges.filter(
      edge => edge.from !== filePath && edge.to !== filePath
    );

    // Add new edges from this file
    const fileInfo = index.files[filePath];
    if (fileInfo) {
      for (const dependency of fileInfo.dependencies) {
        filteredEdges.push({
          from: filePath,
          to: dependency
        });
      }
    }

    // Add edges to this file from other files
    for (const [otherFilePath, otherFileInfo] of Object.entries(index.files)) {
      if (otherFilePath !== filePath && otherFileInfo.dependencies.includes(filePath)) {
        filteredEdges.push({
          from: otherFilePath,
          to: filePath
        });
      }
    }

    return filteredEdges;
  }

  /**
   * Get project statistics
   * @param index - Project index
   * @returns Statistics object
   */
  static getProjectStats(index: ProjectIndex): {
    totalFiles: number;
    totalDependencies: number;
    averageDependenciesPerFile: number;
    circularDependencies: string[][];
    entryPoints: string[];
    leafFiles: string[];
  } {
    const { dependencies } = DependencyResolver.getDependencyCounts(index.edges);
    const averageDependenciesPerFile = index.nodes.length > 0 
      ? Array.from(dependencies.values()).reduce((sum, count) => sum + count, 0) / index.nodes.length 
      : 0;

    return {
      totalFiles: index.metadata.totalFiles,
      totalDependencies: index.edges.length,
      averageDependenciesPerFile: Number(averageDependenciesPerFile.toFixed(2)),
      circularDependencies: DependencyResolver.findCircularDependencies(index.edges),
      entryPoints: DependencyResolver.findEntryPoints(index.edges, index.nodes),
      leafFiles: DependencyResolver.findLeafFiles(index.edges, index.nodes)
    };
  }
}
