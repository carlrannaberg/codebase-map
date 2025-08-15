/**
 * Code Map - Main Entry Point
 *
 * A comprehensive code indexing and analysis tool for large codebases.
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
