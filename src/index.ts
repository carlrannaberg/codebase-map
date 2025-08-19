/**
 * Code Map - Main Entry Point
 *
 * A comprehensive code indexing and analysis tool for large codebases.
 * 
 * This library provides fast, memory-efficient analysis of TypeScript and JavaScript
 * projects, extracting file structures, dependencies, and code signatures without
 * requiring compilation or complex toolchains.
 * 
 * ## Key Features
 * 
 * - **Fast Analysis**: Parallel processing with adaptive batch sizing
 * - **Memory Efficient**: Resource monitoring and automatic optimization
 * - **Incremental Updates**: Update individual files without full rescans
 * - **Comprehensive**: Extract functions, classes, constants, and dependencies
 * - **Flexible Filtering**: Include/exclude patterns for targeted analysis
 * - **Multiple Output Formats**: JSON, DSL, Graph, and Markdown formats
 * 
 * ## Quick Start
 * 
 * @example Basic usage
 * ```typescript
 * import { CodeIndexer } from 'code-map';
 * 
 * // Analyze current directory
 * const indexer = new CodeIndexer();
 * const index = await indexer.processProject();
 * 
 * console.log(`Found ${index.metadata.totalFiles} files`);
 * console.log(`Dependencies: ${index.edges.length}`);
 * ```
 * 
 * @example With filtering
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
 * @example Project statistics
 * ```typescript
 * import { CodeIndexer } from 'code-map';
 * 
 * const indexer = new CodeIndexer();
 * const index = await indexer.processProject();
 * const stats = CodeIndexer.getProjectStats(index);
 * 
 * console.log(`Average dependencies per file: ${stats.averageDependenciesPerFile}`);
 * if (stats.circularDependencies.length > 0) {
 *   console.warn('Circular dependencies detected!');
 * }
 * ```
 * 
 * @example Output formatting
 * ```typescript
 * import { CodeIndexer, toDSL, toMarkdown } from 'code-map';
 * 
 * const indexer = new CodeIndexer();
 * const index = await indexer.processProject();
 * 
 * // Compact DSL format for AI context
 * const dslOutput = toDSL(index);
 * 
 * // Human-readable markdown
 * const markdownOutput = toMarkdown(index);
 * ```
 * 
 * @packageDocumentation
 */

export * from './core/index.js';
export * from './parsers/index.js';
export * from './types/index.js';

// Re-export main functionality
export { CodeIndexer } from './core/indexer.js';
export { FileDiscovery } from './core/file-discovery.js';

export type * from './types/common.js';
export type * from './types/ast.js';
export type * from './types/index.js';
