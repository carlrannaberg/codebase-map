/**
 * Common type definitions for the Code Map library.
 * 
 * This module contains all the core interfaces and types used throughout
 * the code analysis pipeline. These types define the structure of parsed
 * code information, project metadata, and configuration options.
 * 
 * @module Types
 */

/**
 * Configuration options for filtering which files to include or exclude during analysis.
 * 
 * Supports glob patterns for flexible file matching. If no patterns are specified,
 * all supported files will be included by default.
 * 
 * @example Include only TypeScript files
 * ```typescript
 * const options: FilterOptions = {
 *   include: ['src/', 'lib/'],
 *   exclude: ['test/', 'node_modules/']
 * };
 * ```
 * 
 * @example Exclude test files
 * ```typescript
 * const options: FilterOptions = {
 *   exclude: ['test/', 'spec/', 'coverage/']
 * };
 * ```
 */
export interface FilterOptions {
  /** Glob patterns for files to include (if empty, includes all supported files) */
  include?: string[];
  /** Glob patterns for files to exclude */
  exclude?: string[];
}

/**
 * Configuration options for CodeIndexer constructor.
 * 
 * Currently extends FilterOptions but designed to accommodate
 * additional configuration options in future versions.
 * 
 * @see FilterOptions
 */
export type CodeIndexerOptions = FilterOptions;

/**
 * Legacy configuration interface for CLI usage.
 * 
 * @deprecated Use FilterOptions and ResourceConfig instead
 * @internal
 */
export interface CodeMapConfig {
  rootPath: string;
  outputPath: string;
  include: string[];
  exclude: string[];
  maxFileSize: number;
  verbose: boolean;
}

/**
 * Represents a node in the hierarchical file tree structure.
 * 
 * Each node can be either a file or directory, with directories
 * containing child nodes. This creates a tree representation
 * of the project structure.
 * 
 * @example Directory node
 * ```typescript
 * const dirNode: TreeNode = {
 *   name: 'src',
 *   type: 'dir',
 *   children: [
 *     { name: 'index.ts', type: 'file' },
 *     { name: 'utils.ts', type: 'file' }
 *   ]
 * };
 * ```
 */
export interface TreeNode {
  /** Name of the file or directory */
  name: string;
  /** Type of node - either directory or file */
  type: 'dir' | 'file';
  /** Child nodes (only present for directories) */
  children?: TreeNode[];
}

/**
 * Represents an import or export statement found in source code.
 * 
 * Captures all forms of module imports including ES6 imports,
 * CommonJS requires, dynamic imports, and re-exports.
 * 
 * @example ES6 named import
 * ```typescript
 * // import { foo, bar } from './utils';
 * const importInfo: ImportInfo = {
 *   from: './utils',
 *   kind: 'import',
 *   imported: ['foo', 'bar'],
 *   isDefault: false
 * };
 * ```
 * 
 * @example Default import
 * ```typescript
 * // import React from 'react';
 * const importInfo: ImportInfo = {
 *   from: 'react',
 *   kind: 'import',
 *   isDefault: true
 * };
 * ```
 */
export interface ImportInfo {
  /** Module specifier (the string after 'from') */
  from: string;
  /** Type of import/export statement */
  kind: 'import' | 'export' | 'require' | 'dynamic-import';
  /** Array of named imports (e.g., ['foo', 'bar'] from 'import { foo, bar }') */
  imported?: string[];
  /** True if this is a default import (import Foo from 'module') */
  isDefault?: boolean;
  /** True if this is a namespace import (import * as Foo from 'module') */
  isNamespace?: boolean;
}

/**
 * Represents a function signature extracted from source code.
 * 
 * Captures function metadata including parameters, return types,
 * and modifiers. Used for both standalone functions and class methods.
 * 
 * @example Async function
 * ```typescript
 * // async function processData(input: string, options?: ProcessOptions): Promise<Result>
 * const funcSig: FuncSig = {
 *   name: 'processData',
 *   params: [
 *     { name: 'input', type: 'string' },
 *     { name: 'options', type: 'ProcessOptions', optional: true }
 *   ],
 *   returnType: 'Promise<Result>',
 *   isAsync: true,
 *   isExported: true
 * };
 * ```
 */
export interface FuncSig {
  /** Function name */
  name: string;
  /** Function parameters with their types and modifiers */
  params: Array<{
    /** Parameter name */
    name: string;
    /** TypeScript type annotation (if present) */
    type?: string;
    /** True if parameter is optional (has ? or default value) */
    optional?: boolean;
    /** True if parameter is rest parameter (...args) */
    rest?: boolean;
  }>;
  /** TypeScript return type annotation (if present) */
  returnType?: string;
  /** True if function is declared as async */
  isAsync: boolean;
  /** True if function is exported from the module */
  isExported: boolean;
  /** True if function is a generator function */
  isGenerator?: boolean;
}

/**
 * Represents a class definition extracted from source code.
 * 
 * Captures class metadata including inheritance, methods, properties,
 * and access modifiers. Provides comprehensive information about
 * the class structure without requiring compilation.
 * 
 * @example Class with inheritance
 * ```typescript
 * // export class UserService extends BaseService implements IUserService {
 * //   private users: User[] = [];
 * //   public async getUser(id: string): Promise<User> { ... }
 * // }
 * const classInfo: ClassInfo = {
 *   name: 'UserService',
 *   isExported: true,
 *   extends: 'BaseService',
 *   implements: ['IUserService'],
 *   methods: [{
 *     name: 'getUser',
 *     params: [{ name: 'id', type: 'string' }],
 *     returnType: 'Promise<User>',
 *     isAsync: true
 *   }],
 *   properties: [{
 *     name: 'users',
 *     type: 'User[]',
 *     isPrivate: true
 *   }]
 * };
 * ```
 */
export interface ClassInfo {
  /** Class name */
  name: string;
  /** True if class is exported from the module */
  isExported: boolean;
  /** True if class is declared as abstract */
  isAbstract?: boolean;
  /** Name of the class this extends (if any) */
  extends?: string;
  /** Array of interface names this class implements */
  implements?: string[];
  /** Array of class methods */
  methods: Array<{
    /** Method name */
    name: string;
    /** Method parameters */
    params: Array<{
      /** Parameter name */
      name: string;
      /** Parameter type annotation */
      type?: string;
      /** True if parameter is optional */
      optional?: boolean;
      /** True if parameter is rest parameter */
      rest?: boolean;
    }>;
    /** Method return type annotation */
    returnType?: string;
    /** True if method is declared as async */
    isAsync: boolean;
    /** True if method is static */
    isStatic?: boolean;
    /** True if method is private */
    isPrivate?: boolean;
    /** True if method is protected */
    isProtected?: boolean;
    /** True if method is abstract */
    isAbstract?: boolean;
  }>;
  /** Array of class properties */
  properties: Array<{
    /** Property name */
    name: string;
    /** Property type annotation */
    type?: string;
    /** True if property is static */
    isStatic?: boolean;
    /** True if property is private */
    isPrivate?: boolean;
    /** True if property is protected */
    isProtected?: boolean;
    /** True if property is readonly */
    isReadonly?: boolean;
  }>;
}

/**
 * Represents a constant or variable declaration extracted from source code.
 * 
 * Captures variable metadata including type information and initialization
 * patterns. Helps identify what kind of values are being exported or used.
 * 
 * @example Exported constant
 * ```typescript
 * // export const API_URL = 'https://api.example.com';
 * const constInfo: ConstInfo = {
 *   name: 'API_URL',
 *   type: 'string',
 *   initKind: 'literal',
 *   isExported: true
 * };
 * ```
 * 
 * @example Function constant
 * ```typescript
 * // const handler = async (req, res) => { ... };
 * const constInfo: ConstInfo = {
 *   name: 'handler',
 *   initKind: 'function',
 *   isExported: false
 * };
 * ```
 */
export interface ConstInfo {
  /** Variable/constant name */
  name: string;
  /** TypeScript type annotation (if present) */
  type?: string;
  /** Type of initialization value */
  initKind: 'literal' | 'function' | 'class' | 'object' | 'array' | 'unknown';
  /** True if variable is exported from the module */
  isExported: boolean;
}

/**
 * Contains all extracted information for a single source file.
 * 
 * This is the main data structure that represents everything we know
 * about a file after parsing - its imports, exports, function signatures,
 * class definitions, and constants.
 * 
 * @example Complete file information
 * ```typescript
 * const fileInfo: FileInfo = {
 *   imports: [
 *     { from: 'react', kind: 'import', isDefault: true }
 *   ],
 *   dependencies: ['./utils', './types'],
 *   functions: [
 *     { name: 'processData', params: [], isAsync: true, isExported: true }
 *   ],
 *   classes: [
 *     { name: 'DataProcessor', isExported: true, methods: [], properties: [] }
 *   ],
 *   constants: [
 *     { name: 'DEFAULT_CONFIG', initKind: 'object', isExported: true }
 *   ]
 * };
 * ```
 */
export interface FileInfo {
  /** Raw import/export statements found in the file */
  imports: ImportInfo[];
  /** Resolved internal file dependencies (relative paths) */
  dependencies: string[];
  /** Top-level function declarations and expressions */
  functions: FuncSig[];
  /** Class definitions */
  classes: ClassInfo[];
  /** Top-level constant and variable declarations */
  constants: ConstInfo[];
}

/**
 * The main project index containing all analyzed information about a codebase.
 * 
 * This is the root data structure returned by CodeIndexer.processProject().
 * It contains everything needed to understand the structure, dependencies,
 * and content of a project.
 * 
 * @example Using project index
 * ```typescript
 * const indexer = new CodeIndexer('./src');
 * const index = await indexer.processProject();
 * 
 * console.log('Project root:', index.metadata.root);
 * console.log('Total files:', index.metadata.totalFiles);
 * console.log('Directory structure:', index.tree);
 * console.log('Dependencies:', index.edges.length);
 * 
 * // Access specific file info
 * const fileInfo = index.files['src/index.ts'];
 * console.log('Functions in index.ts:', fileInfo.functions.length);
 * ```
 */
export interface ProjectIndex {
  /** Project metadata and statistics */
  metadata: {
    /** Schema version for compatibility */
    version: number;
    /** Absolute path to project root */
    root: string;
    /** ISO timestamp when index was created */
    createdAt: string;
    /** ISO timestamp when index was last updated */
    updatedAt: string;
    /** Total number of files in the index */
    totalFiles: number;
  };
  /** Hierarchical directory tree structure */
  tree: TreeNode;
  /** Flat array of all file paths (relative to root) */
  nodes: string[];
  /** Dependency graph edges showing file-to-file relationships */
  edges: Array<{ from: string; to: string }>;
  /** Detailed information for each file */
  files: Record<string, FileInfo>;
}
