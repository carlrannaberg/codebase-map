/**
 * Main code indexer class that orchestrates the complete code analysis pipeline.
 * 
 * The CodeIndexer provides comprehensive analysis of TypeScript/JavaScript codebases,
 * extracting file structures, dependencies, and code signatures. It supports both
 * full project scanning and incremental updates for large projects.
 * 
 * Features:
 * - Adaptive batch processing for memory efficiency
 * - Resource monitoring and automatic optimization
 * - Incremental file updates
 * - Comprehensive dependency resolution
 * - Project statistics and circular dependency detection
 * 
 * @example Basic usage
 * ```typescript
 * import { CodeIndexer } from 'code-map';
 * 
 * // Create indexer for current directory
 * const indexer = new CodeIndexer();
 * 
 * // Process entire project
 * const index = await indexer.processProject();
 * console.log(`Indexed ${index.metadata.totalFiles} files`);
 * ```
 * 
 * @example With filtering and progress tracking
 * ```typescript
 * import { CodeIndexer } from 'code-map';
 * 
 * const indexer = new CodeIndexer('./src', {
 *   include: ['src/components/', 'src/utils/'],
 *   exclude: ['test/', 'node_modules/']
 * });
 * 
 * const index = await indexer.processProject((progress) => {
 *   console.log(`${progress.step}: ${progress.current}/${progress.total}`);
 * });
 * ```
 * 
 * @example Incremental updates
 * ```typescript
 * // Update a single file in existing index
 * const updatedIndex = await indexer.updateFile('src/utils.ts', existingIndex);
 * 
 * // Remove a file from index
 * const cleanedIndex = indexer.removeFile('src/old-file.ts', existingIndex);
 * ```
 */

import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import type { ProjectIndex, FileInfo, FilterOptions } from '../types/index.js';
import { FileDiscovery } from './file-discovery.js';
import { TreeBuilder } from './tree-builder.js';
import { ASTParser } from '../parsers/ast-parser.js';
import { DependencyResolver } from './dependency-resolver.js';

/**
 * Configuration options for resource monitoring during batch processing.
 * 
 * The indexer uses adaptive batch processing to optimize performance while
 * preventing memory exhaustion on large projects. These settings control
 * how the batch size adapts based on available system resources.
 * 
 * @example Custom resource configuration
 * ```typescript
 * const indexer = new CodeIndexer('./src', {}, {
 *   maxMemoryThresholdMB: 256,  // Reduce batch size above 256MB
 *   maxBatchSize: 20,          // Never process more than 20 files at once
 *   yieldInterval: 10          // Yield control every 10 files
 * });
 * ```
 */
export interface ResourceConfig {
  /** Maximum memory usage threshold (MB) before reducing batch size */
  maxMemoryThresholdMB?: number;
  /** Minimum batch size to maintain processing efficiency */
  minBatchSize?: number;
  /** Maximum batch size to prevent resource exhaustion */
  maxBatchSize?: number;
  /** Number of processed files before yielding control */
  yieldInterval?: number;
  /** Factor to reduce batch size when memory threshold is exceeded */
  batchReductionFactor?: number;
  /** Factor to increase batch size when memory usage is low */
  batchIncreaseFactor?: number;
}

/**
 * Real-time resource monitoring information during batch processing.
 * 
 * This interface provides insights into current system resource usage
 * and processing performance, allowing for informed decisions about
 * batch size adjustments.
 */
export interface ResourceMonitor {
  /** Current memory usage in MB */
  memoryUsageMB: number;
  /** Memory usage as percentage of total system memory */
  memoryPercentage: number;
  /** Current batch size being used */
  currentBatchSize: number;
  /** Number of batches processed so far */
  batchesProcessed: number;
  /** Average processing time per file in milliseconds */
  avgProcessingTimeMs: number;
}

/**
 * Main code indexer class that orchestrates the complete code analysis pipeline.
 * 
 * @example Create indexer with default settings
 * ```typescript
 * const indexer = new CodeIndexer();
 * ```
 * 
 * @example Create indexer with custom root and filters
 * ```typescript
 * const indexer = new CodeIndexer('./packages', {
 *   include: ['src/'],
 *   exclude: ['test/']
 * });
 * ```
 */
export class CodeIndexer {
  private rootPath: string;
  private filterOptions: FilterOptions;
  private resourceConfig: Required<ResourceConfig>;
  private totalSystemMemoryMB: number;
  private cpuCount: number;

  /**
   * Create a new CodeIndexer instance.
   * 
   * @param rootPath - Root directory to analyze (defaults to current working directory)
   * @param filterOptions - File filtering options for inclusion/exclusion patterns
   * @param resourceConfig - Configuration for adaptive batch processing and resource management
   * 
   * @example Basic usage
   * ```typescript
   * const indexer = new CodeIndexer();
   * ```
   * 
   * @example With filtering
   * ```typescript
   * const indexer = new CodeIndexer('./src', {
   *   include: ['src/'],
   *   exclude: ['test/', 'node_modules/']
   * });
   * ```
   * 
   * @example With resource limits
   * ```typescript
   * const indexer = new CodeIndexer('./src', {}, {
   *   maxMemoryThresholdMB: 512,
   *   maxBatchSize: 25
   * });
   * ```
   */
  constructor(
    rootPath: string = process.cwd(), 
    filterOptions: FilterOptions = {},
    resourceConfig: ResourceConfig = {}
  ) {
    this.rootPath = path.resolve(rootPath);
    this.filterOptions = filterOptions;
    
    // Initialize resource monitoring
    this.totalSystemMemoryMB = Math.round(os.totalmem() / 1024 / 1024);
    this.cpuCount = os.cpus().length;
    
    // Set default resource configuration based on system capabilities
    this.resourceConfig = {
      maxMemoryThresholdMB: resourceConfig.maxMemoryThresholdMB ?? Math.min(512, this.totalSystemMemoryMB * 0.1),
      minBatchSize: resourceConfig.minBatchSize ?? Math.max(1, Math.floor(this.cpuCount / 2)),
      maxBatchSize: resourceConfig.maxBatchSize ?? Math.min(50, this.cpuCount * 4),
      yieldInterval: resourceConfig.yieldInterval ?? 25,
      batchReductionFactor: resourceConfig.batchReductionFactor ?? 0.7,
      batchIncreaseFactor: resourceConfig.batchIncreaseFactor ?? 1.2
    };
  }

  /**
   * Factory method to create a new CodeIndexer instance.
   * 
   * This method provides the same functionality as the constructor but with
   * a more explicit interface. Useful for dependency injection or when you
   * prefer factory patterns.
   * 
   * @param rootPath - Root directory to analyze (defaults to current working directory)
   * @param filterOptions - File filtering options for inclusion/exclusion patterns
   * @param resourceConfig - Configuration for adaptive batch processing
   * @returns New CodeIndexer instance
   * 
   * @example
   * ```typescript
   * const indexer = CodeIndexer.create('./src', {
   *   include: ['src/'],
   *   exclude: ['test/']
   * });
   * ```
   */
  static create(
    rootPath: string = process.cwd(), 
    filterOptions: FilterOptions = {},
    resourceConfig: ResourceConfig = {}
  ): CodeIndexer {
    return new CodeIndexer(rootPath, filterOptions, resourceConfig);
  }

  /**
   * Process the entire project and generate a complete ProjectIndex.
   * 
   * This is the main method for analyzing a codebase. It discovers all matching
   * files, builds the directory tree, parses each file for code signatures,
   * and resolves all dependencies between files.
   * 
   * The process is optimized with:
   * - Parallel file processing with adaptive batch sizes
   * - Memory monitoring and automatic resource management
   * - Progress callbacks for long-running operations
   * - Graceful error handling for individual files
   * 
   * @param progressCallback - Optional callback to receive progress updates during processing
   * @returns Promise resolving to the complete project index
   * 
   * @throws {Error} When no supported files are found or processing fails
   * 
   * @example Basic project analysis
   * ```typescript
   * const indexer = new CodeIndexer('./src');
   * const index = await indexer.processProject();
   * 
   * console.log(`Found ${index.metadata.totalFiles} files`);
   * console.log(`Dependencies: ${index.edges.length}`);
   * ```
   * 
   * @example With progress tracking
   * ```typescript
   * const index = await indexer.processProject((progress) => {
   *   console.log(`${progress.step}: ${progress.current}/${progress.total}`);
   * });
   * ```
   * 
   * @example Error handling
   * ```typescript
   * try {
   *   const index = await indexer.processProject();
   *   // Process successful index...
   * } catch (error) {
   *   console.error('Failed to process project:', error.message);
   * }
   * ```
   */
  async processProject(
    progressCallback?: (progress: { step: string; current: number; total: number }) => void
  ): Promise<ProjectIndex> {
    try {
      // Step 1: Discover files
      progressCallback?.({ step: 'Discovering files', current: 0, total: 4 });
      const files = await FileDiscovery.discoverFiles(this.rootPath, this.filterOptions);
      
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
   * Update a single file in an existing project index.
   * 
   * This method provides efficient incremental updates without requiring
   * a full project rescan. It's ideal for file watchers, IDE integrations,
   * or any scenario where you need to keep an index up-to-date as files change.
   * 
   * The update process:
   * 1. Validates the file path and type
   * 2. Checks if file matches current filter patterns
   * 3. Parses the updated file for new signatures
   * 4. Resolves dependencies for the updated file
   * 5. Rebuilds dependency edges involving this file
   * 6. Updates metadata timestamps
   * 
   * @param filePath - Relative path to the file to update (relative to root path)
   * @param existingIndex - The existing project index to update
   * @returns Promise resolving to the updated project index
   * 
   * @throws {Error} When file type is unsupported or parsing fails
   * 
   * @example Update a file after changes
   * ```typescript
   * // Initial index
   * const index = await indexer.processProject();
   * 
   * // File changed - update just that file
   * const updatedIndex = await indexer.updateFile('src/utils.ts', index);
   * 
   * console.log('Index updated at:', updatedIndex.metadata.updatedAt);
   * ```
   * 
   * @example File watcher integration
   * ```typescript
   * let currentIndex = await indexer.processProject();
   * 
   * fileWatcher.on('change', async (filePath) => {
   *   try {
   *     currentIndex = await indexer.updateFile(filePath, currentIndex);
   *     console.log(`Updated ${filePath} in index`);
   *   } catch (error) {
   *     console.warn(`Failed to update ${filePath}:`, error.message);
   *   }
   * });
   * ```
   */
  async updateFile(filePath: string, existingIndex: ProjectIndex): Promise<ProjectIndex> {
    try {
      // Validate file path
      if (!FileDiscovery.isSupportedFile(filePath)) {
        throw new Error(`Unsupported file type: ${filePath}`);
      }

      // Check if file would be included with current filter options
      if (!this.wouldFileBeIncluded(filePath)) {
        // File no longer matches patterns, remove it from index
        return this.removeFileFromIndex(filePath, existingIndex);
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
   * Remove a file from an existing project index.
   * 
   * This method efficiently removes a file and all its associated data
   * from the index without requiring a full rescan. It's useful for
   * handling file deletions or when files no longer match filter patterns.
   * 
   * The removal process:
   * 1. Removes file from the files map
   * 2. Removes file from the nodes array
   * 3. Removes all dependency edges involving the file
   * 4. Updates metadata and file counts
   * 5. Rebuilds the directory tree structure
   * 
   * @param filePath - Relative path to the file to remove (relative to root path)
   * @param existingIndex - The existing project index to update
   * @returns Updated project index with the file removed
   * 
   * @example Remove a deleted file
   * ```typescript
   * // File was deleted - remove from index
   * const updatedIndex = indexer.removeFile('src/old-utils.ts', currentIndex);
   * 
   * console.log(`Removed file. New total: ${updatedIndex.metadata.totalFiles}`);
   * ```
   * 
   * @example File watcher deletion handling
   * ```typescript
   * fileWatcher.on('delete', (filePath) => {
   *   currentIndex = indexer.removeFile(filePath, currentIndex);
   *   console.log(`Removed ${filePath} from index`);
   * });
   * ```
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
   * Parse files in parallel with adaptive batch processing for better performance and resource management
   * @param files - Array of file paths to parse
   * @param progressCallback - Optional progress callback
   * @returns Map of file paths to their FileInfo
   */
  private async parseFilesInParallel(
    files: string[],
    progressCallback?: (progress: { step: string; current: number; total: number }) => void
  ): Promise<Record<string, FileInfo>> {
    const results: Record<string, FileInfo> = {};
    let processedFiles = 0;
    let batchesProcessed = 0;
    let processingTimes: number[] = [];
    
    // Calculate initial batch size based on system resources
    let currentBatchSize = await this.calculateInitialBatchSize(files);
    
    for (let i = 0; i < files.length; ) {
      const batchStartTime = Date.now();
      const thisBatchSize = currentBatchSize; // Store the batch size for this iteration
      const batch = files.slice(i, i + thisBatchSize);
      batchesProcessed++;
      
      // Monitor resources before processing batch
      const resourceMonitor = await this.getResourceMonitor(batchesProcessed, processingTimes, thisBatchSize);
      
      // Update progress with resource information
      progressCallback?.({ 
        step: `Parsing files (${i + 1}-${Math.min(i + thisBatchSize, files.length)} of ${files.length}) [Batch: ${thisBatchSize}, Memory: ${Math.round(resourceMonitor.memoryUsageMB)}MB]`, 
        current: 2, 
        total: 4 
      });

      const batchPromises = batch.map(async (filePath, index) => {
        try {
          // Yield control periodically to prevent event loop blocking
          if ((processedFiles + index) % this.resourceConfig.yieldInterval === 0) {
            await this.yieldControl();
          }
          
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
      const batchEndTime = Date.now();
      const batchProcessingTime = batchEndTime - batchStartTime;
      processingTimes.push(batchProcessingTime / batch.length); // Average per file
      
      // Keep only recent processing times for adaptive calculation
      if (processingTimes.length > 10) {
        processingTimes = processingTimes.slice(-10);
      }
      
      for (const { filePath, fileInfo } of batchResults) {
        results[filePath] = fileInfo;
      }
      
      processedFiles += batch.length;
      i += thisBatchSize; // Use the batch size that was actually used for this iteration
      
      // Adapt batch size based on current resource usage for the NEXT iteration
      const newBatchSize = await this.adaptBatchSize(currentBatchSize, resourceMonitor);
      if (newBatchSize !== currentBatchSize) {
        currentBatchSize = newBatchSize;
      }
      
      // Yield control after each batch to prevent blocking
      await this.yieldControl();
    }

    return results;
  }
  
  /**
   * Calculate initial batch size based on system resources and file characteristics
   * @param files - Array of files to be processed
   * @returns Initial batch size
   */
  private async calculateInitialBatchSize(files: string[]): Promise<number> {
    // Start with a conservative batch size based on CPU cores
    let batchSize = Math.max(this.resourceConfig.minBatchSize, Math.floor(this.cpuCount * 1.5));
    
    // Sample a few files to estimate average file size if we have many files
    if (files.length > 100) {
      const sampleSize = Math.min(10, files.length);
      const sampleFiles = files.slice(0, sampleSize);
      let totalSize = 0;
      let validSamples = 0;
      
      for (const filePath of sampleFiles) {
        try {
          const absolutePath = path.resolve(this.rootPath, filePath);
          const stats = await fs.stat(absolutePath);
          totalSize += stats.size;
          validSamples++;
        } catch {
          // Ignore files we can't stat
        }
      }
      
      if (validSamples > 0) {
        const avgFileSize = totalSize / validSamples;
        // Reduce batch size for larger files (assuming larger files take more time to parse)
        if (avgFileSize > 50 * 1024) { // > 50KB
          batchSize = Math.floor(batchSize * 0.6);
        } else if (avgFileSize > 20 * 1024) { // > 20KB
          batchSize = Math.floor(batchSize * 0.8);
        }
      }
    }
    
    return Math.max(this.resourceConfig.minBatchSize, Math.min(batchSize, this.resourceConfig.maxBatchSize));
  }
  
  /**
   * Get current resource monitoring information
   * @param batchesProcessed - Number of batches processed so far
   * @param processingTimes - Array of recent processing times per file
   * @param currentBatchSize - Current batch size being used
   * @returns Resource monitor information
   */
  private async getResourceMonitor(batchesProcessed: number, processingTimes: number[], currentBatchSize: number): Promise<ResourceMonitor> {
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const memoryPercentage = (memoryUsageMB / this.totalSystemMemoryMB) * 100;
    const avgProcessingTimeMs = processingTimes.length > 0 
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length 
      : 0;
    
    return {
      memoryUsageMB,
      memoryPercentage,
      currentBatchSize,
      batchesProcessed,
      avgProcessingTimeMs
    };
  }
  
  /**
   * Adapt batch size based on current resource usage
   * @param currentBatchSize - Current batch size
   * @param resourceMonitor - Current resource monitoring information
   * @returns New batch size
   */
  private async adaptBatchSize(currentBatchSize: number, resourceMonitor: ResourceMonitor): Promise<number> {
    let newBatchSize = currentBatchSize;
    
    // Check memory pressure
    if (resourceMonitor.memoryUsageMB > this.resourceConfig.maxMemoryThresholdMB) {
      // Reduce batch size if memory usage is high
      newBatchSize = Math.floor(currentBatchSize * this.resourceConfig.batchReductionFactor);
    } else if (resourceMonitor.memoryUsageMB < this.resourceConfig.maxMemoryThresholdMB * 0.5) {
      // Increase batch size if memory usage is low and we can afford it
      const potentialIncrease = Math.floor(currentBatchSize * this.resourceConfig.batchIncreaseFactor);
      if (potentialIncrease <= this.resourceConfig.maxBatchSize) {
        newBatchSize = potentialIncrease;
      }
    }
    
    // Check processing time - if files are taking too long individually, reduce batch size
    if (resourceMonitor.avgProcessingTimeMs > 500) { // If average file takes more than 500ms
      newBatchSize = Math.floor(newBatchSize * 0.8);
    }
    
    // Ensure batch size stays within configured bounds
    newBatchSize = Math.max(this.resourceConfig.minBatchSize, Math.min(newBatchSize, this.resourceConfig.maxBatchSize));
    
    return newBatchSize;
  }
  
  /**
   * Yield control to prevent blocking the event loop
   * @returns Promise that resolves on next tick
   */
  private async yieldControl(): Promise<void> {
    return new Promise(resolve => {
      if (typeof globalThis.setImmediate !== 'undefined') {
        globalThis.setImmediate(resolve);
      } else {
        globalThis.setTimeout(resolve, 0);
      }
    });
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
   * Check if a file would be included with current filter options
   * @param filePath - Relative file path to check
   * @returns True if file would be included
   */
  private wouldFileBeIncluded(filePath: string): boolean {
    // If no filter options, include all supported files
    if (!this.filterOptions.include && !this.filterOptions.exclude) {
      return true;
    }

    // Check include patterns first
    if (this.filterOptions.include && this.filterOptions.include.length > 0) {
      // For include patterns, file must match at least one pattern
      const included = this.filterOptions.include.some(pattern => {
        return this.matchesGlobPattern(filePath, pattern);
      });
      if (!included) {
        return false;
      }
    }

    // Check exclude patterns
    if (this.filterOptions.exclude && this.filterOptions.exclude.length > 0) {
      const excluded = this.filterOptions.exclude.some(pattern => {
        return this.matchesGlobPattern(filePath, pattern);
      });
      if (excluded) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a file path matches a glob pattern
   * @param filePath - File path to test
   * @param pattern - Glob pattern
   * @returns True if file matches pattern
   */
  private matchesGlobPattern(filePath: string, pattern: string): boolean {
    // Simple glob matching for common patterns
    // Handle the most common cases: **, *, and literal strings
    
    // Escape special regex characters except * and ?
    let regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex chars except * and ?
      .replace(/\*\*/g, '___DOUBLESTAR___')   // Placeholder for **
      .replace(/\*/g, '[^/]*')                // * matches any chars except /
      .replace(/___DOUBLESTAR___/g, '.*')     // ** matches any chars including /
      .replace(/\?/g, '[^/]');                // ? matches single char except /

    // Anchor the pattern
    regexPattern = '^' + regexPattern + '$';

    try {
      const regex = new RegExp(regexPattern);
      return regex.test(filePath);
    } catch {
      // If regex compilation fails, fall back to exact match
      return filePath === pattern;
    }
  }

  /**
   * Remove a file from the index (helper method)
   * @param filePath - Relative path to the file to remove
   * @param existingIndex - Existing project index
   * @returns Updated project index
   */
  private removeFileFromIndex(filePath: string, existingIndex: ProjectIndex): ProjectIndex {
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
   * Calculate comprehensive statistics for a project index.
   * 
   * This static method analyzes the project structure to provide insights
   * into code organization, dependency patterns, and potential issues.
   * 
   * Statistics include:
   * - File and dependency counts
   * - Average dependencies per file
   * - Circular dependency detection
   * - Entry points (files with no dependencies)
   * - Leaf files (files that nothing depends on)
   * 
   * @param index - The project index to analyze
   * @returns Statistics object with comprehensive project metrics
   * 
   * @example Basic project statistics
   * ```typescript
   * const index = await indexer.processProject();
   * const stats = CodeIndexer.getProjectStats(index);
   * 
   * console.log(`Total files: ${stats.totalFiles}`);
   * console.log(`Total dependencies: ${stats.totalDependencies}`);
   * console.log(`Average dependencies per file: ${stats.averageDependenciesPerFile}`);
   * ```
   * 
   * @example Detect circular dependencies
   * ```typescript
   * const stats = CodeIndexer.getProjectStats(index);
   * 
   * if (stats.circularDependencies.length > 0) {
   *   console.warn('Circular dependencies detected:');
   *   stats.circularDependencies.forEach((cycle, i) => {
   *     console.log(`  Cycle ${i + 1}: ${cycle.join(' → ')}`);
   *   });
   * }
   * ```
   * 
   * @example Identify entry points and leaf files
   * ```typescript
   * const stats = CodeIndexer.getProjectStats(index);
   * 
   * console.log('Entry points (no dependencies):', stats.entryPoints);
   * console.log('Leaf files (nothing depends on them):', stats.leafFiles);
   * ```
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
