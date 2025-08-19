/**
 * Common type definitions
 */

/**
 * Pattern filtering options for file inclusion/exclusion
 */
export interface FilterOptions {
  include?: string[];
  exclude?: string[];
}

/**
 * Enhanced constructor signature for future use
 */
export type CodeIndexerOptions = FilterOptions;

export interface CodeMapConfig {
  rootPath: string;
  outputPath: string;
  include: string[];
  exclude: string[];
  maxFileSize: number;
  verbose: boolean;
}

/**
 * Tree node representing a file or directory
 */
export interface TreeNode {
  name: string;
  type: 'dir' | 'file';
  children?: TreeNode[];
}

/**
 * Import information from source code
 */
export interface ImportInfo {
  from: string;           // Module specifier
  kind: 'import' | 'export' | 'require' | 'dynamic-import';
  imported?: string[];    // Named imports
  isDefault?: boolean;    // Default import
  isNamespace?: boolean;  // Namespace import
}

/**
 * Function signature information
 */
export interface FuncSig {
  name: string;
  params: Array<{
    name: string;
    type?: string;
    optional?: boolean;
    rest?: boolean;
  }>;
  returnType?: string;
  isAsync: boolean;
  isExported: boolean;
  isGenerator?: boolean;
}

/**
 * Class definition information
 */
export interface ClassInfo {
  name: string;
  isExported: boolean;
  isAbstract?: boolean;
  extends?: string;
  implements?: string[];
  methods: Array<{
    name: string;
    params: Array<{
      name: string;
      type?: string;
      optional?: boolean;
      rest?: boolean;
    }>;
    returnType?: string;
    isAsync: boolean;
    isStatic?: boolean;
    isPrivate?: boolean;
    isProtected?: boolean;
    isAbstract?: boolean;
  }>;
  properties: Array<{
    name: string;
    type?: string;
    isStatic?: boolean;
    isPrivate?: boolean;
    isProtected?: boolean;
    isReadonly?: boolean;
  }>;
}

/**
 * Constant/variable information
 */
export interface ConstInfo {
  name: string;
  type?: string;
  initKind: 'literal' | 'function' | 'class' | 'object' | 'array' | 'unknown';
  isExported: boolean;
}

/**
 * Per-file information
 */
export interface FileInfo {
  imports: ImportInfo[];      // Raw import statements
  dependencies: string[];     // Resolved internal files
  functions: FuncSig[];      // Top-level functions
  classes: ClassInfo[];      // Class definitions
  constants: ConstInfo[];    // Top-level constants
}

/**
 * Main project index structure
 */
export interface ProjectIndex {
  metadata: {
    version: number;
    root: string;
    createdAt: string;
    updatedAt: string;
    totalFiles: number;
  };
  tree: TreeNode;                        // Hierarchical file tree
  nodes: string[];                      // Flat list of files
  edges: Array<{ from: string; to: string }>; // Dependency graph
  files: Record<string, FileInfo>;      // Per-file metadata
}
