/**
 * Ultra-compact formatters for optimizing project indexes for AI context usage.
 * 
 * This module provides multiple output formats for project indexes, each optimized
 * for different use cases. The formats prioritize token efficiency while maintaining
 * readability and essential information.
 * 
 * ## Available Formats
 * 
 * - **DSL**: Custom domain-specific language (90% token reduction)
 * - **Graph**: Dependency graph with signatures (92% token reduction)
 * - **Markdown**: Human-readable documentation format (93% token reduction)
 * - **Tree**: ASCII art visualization (97% token reduction)
 * - **Auto**: Automatically selects the best format based on project size
 * 
 * ## Token Efficiency
 * 
 * All formats are designed to fit within AI context windows efficiently:
 * - DSL format: Best balance of readability and compression (90% reduction)
 * - 1000 files ≈ 21K tokens (DSL format, 90% reduction)
 * - 2000 files ≈ 42K tokens (recommended maximum)
 * - 5000+ files automatically uses Graph format (92% reduction)
 * - Tree format: Manual choice for visualizing project structure
 * 
 * @example Basic formatting
 * ```typescript
 * import { toDSL, toTree, toMarkdown } from 'code-map';
 * 
 * const index = await indexer.processProject();
 * 
 * // Visual tree structure for any size project
 * const treeOutput = toTree(index);
 * 
 * // Ultra-compact for AI context
 * const dslOutput = toDSL(index);
 * 
 * // Human-readable documentation
 * const markdownOutput = toMarkdown(index);
 * ```
 * 
 * @example Auto-format selection
 * ```typescript
 * import { formatAuto } from 'code-map';
 * 
 * const { format, content } = formatAuto(index);
 * console.log(`Selected ${format} format for ${index.metadata.totalFiles} files`);
 * ```
 * 
 * @module Formatters
 */

import type { ProjectIndex, TreeNode } from '../types/index.js';

/**
 * Supported output format types for project indexes.
 * 
 * Each format optimizes for different use cases:
 * - `json`: Raw structured data
 * - `dsl`: Ultra-compact custom syntax
 * - `graph`: Dependency-focused representation
 * - `markdown`: Human-readable documentation
 */
export type FormatType = 'json' | 'dsl' | 'graph' | 'markdown' | 'tree';

/**
 * Helper function to shorten file paths for more compact output.
 * 
 * Removes common prefixes and file extensions to reduce token usage
 * while maintaining path readability.
 * 
 * @param path - File path to shorten
 * @param removePrefix - Whether to remove 'src/' prefix
 * @returns Shortened path without extension
 * 
 * @example
 * ```typescript
 * shortenPath('src/components/Button.tsx'); // 'components/Button'
 * shortenPath('src/utils/helpers.ts', false); // 'src/utils/helpers'
 * ```
 * 
 * @internal
 */
function shortenPath(path: string, removePrefix = true): string {
  let result = path;
  if (removePrefix) {
    result = result.replace(/^src\//, '');
  }
  return result.replace(/\.(ts|tsx|js|jsx)$/, '');
}

/**
 * Convert project index to ultra-compact DSL (Domain Specific Language) format.
 * 
 * This format provides the best balance of readability and token efficiency,
 * achieving 90% token reduction compared to compact JSON. Perfect for AI
 * context usage while remaining human-readable.
 * 
 * ## Format Structure
 * ```
 * # Legend: fn=function cl=class cn=constant m=methods p=properties
 * 
 * filepath > dependency1,dependency2
 *   fn functionName(param:type):returnType async
 *   cl ClassName(2m,3p) extends BaseClass
 *   cn CONSTANT_NAME:string
 * ```
 * 
 * @param index - Project index to format
 * @returns DSL-formatted string representation
 * 
 * @example
 * ```typescript
 * const index = await indexer.processProject();
 * const dslOutput = toDSL(index);
 * 
 * console.log(dslOutput);
 * // src/utils.ts > 
 * //   fn processData(input:string):Promise<Result> async
 * //   cn API_URL:string
 * ```
 */
export function toDSL(index: ProjectIndex): string {
  const lines: string[] = [
    '# Legend: fn=function cl=class cn=constant m=methods p=properties',
    ''
  ];
  
  for (const [path, info] of Object.entries(index.files)) {
    // Skip empty files
    if (!info.functions.length && !info.classes.length && 
        !info.constants.length && !info.dependencies.length) {
      continue;
    }
    
    // File header with dependencies
    const deps = info.dependencies.map(d => shortenPath(d, false)).join(',');
    lines.push(`${path} > ${deps}`);
    
    // Functions
    for (const fn of info.functions) {
      const async = fn.isAsync ? ' async' : '';
      const params = fn.params?.map(p => `${p.name}:${p.type || '?'}`).join(',') || '';
      lines.push(`  fn ${fn.name}(${params}):${fn.returnType || 'void'}${async}`);
    }
    
    // Classes
    for (const cl of info.classes) {
      const mc = `${cl.methods?.length || 0}m,${cl.properties?.length || 0}p`;
      const ext = cl.extends ? ` extends ${cl.extends}` : '';
      lines.push(`  cl ${cl.name}(${mc})${ext}`);
    }
    
    // Constants
    for (const c of info.constants) {
      lines.push(`  cn ${c.name}:${c.type || c.initKind || 'unknown'}`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Convert project index to dependency graph format with code signatures.
 * 
 * This format emphasizes dependency relationships and provides 92% token
 * reduction. Ideal for large projects where dependency analysis is the
 * primary concern.
 * 
 * ## Format Structure
 * ```
 * DEPS:
 * fileA→fileB
 * fileB→fileC
 * 
 * SIGS:
 * fileA: fn:functionName cl:ClassName(2m,1p) cn:CONSTANT
 * ```
 * 
 * @param index - Project index to format
 * @returns Graph-formatted string representation
 * 
 * @example
 * ```typescript
 * const index = await indexer.processProject();
 * const graphOutput = toGraph(index);
 * 
 * console.log(graphOutput);
 * // DEPS:
 * // utils→types
 * // components/Button→utils
 * //
 * // SIGS:
 * // utils: fn:processData,fn:validateInput cn:CONFIG
 * // components/Button: cl:Button(3m,2p)
 * ```
 */
export function toGraph(index: ProjectIndex): string {
  
  const lines: string[] = [
    '# Graph Format: Short names, arrows show dependencies',
    '# fn=function cl=class cn=constant',
    '',
    'DEPS:'];
  
  // Build edges with shortened names
  for (const edge of index.edges) {
    const from = shortenPath(edge.from);
    const to = shortenPath(edge.to);
    lines.push(`${from}→${to}`);
  }
  
  lines.push('\nSIGS:');
  for (const [path, info] of Object.entries(index.files)) {
    // Skip files with no signatures
    if (!info.functions.length && !info.classes.length && !info.constants.length) {
      continue;
    }
    
    const shortPath = shortenPath(path);
    const parts: string[] = [];
    
    // Compact function signatures
    if (info.functions.length > 0) {
      const fns = info.functions.map(f => `fn:${f.name}`).join(',');
      parts.push(fns);
    }
    
    // Compact class info
    if (info.classes.length > 0) {
      const cls = info.classes.map(c => 
        `cl:${c.name}(${c.methods?.length || 0}m,${c.properties?.length || 0}p)`
      ).join(',');
      parts.push(cls);
    }
    
    // Constants (just names)
    if (info.constants.length > 0) {
      parts.push('cn:' + info.constants.map(c => c.name).join(','));
    }
    
    if (parts.length > 0) {
      lines.push(`${shortPath}: ${parts.join(' ')}`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Convert project index to ASCII tree format for visual project structure.
 * 
 * This format provides a visual tree representation of the project structure
 * using ASCII art characters. Perfect for quickly understanding the project
 * hierarchy and file organization. This format is complementary to other formats
 * and focuses on structure visualization rather than code content analysis.
 * 
 * ## Format Structure
 * - Uses ASCII art characters (├── └── │) for tree structure
 * - Directories shown with trailing slash
 * - Directories sorted before files at each level
 * - Files and directories sorted alphabetically within their type
 * 
 * @param index - Project index to format
 * @returns Tree-formatted string representation
 * 
 * @example
 * ```typescript
 * const index = await indexer.processProject();
 * const treeOutput = toTree(index);
 * 
 * console.log(treeOutput);
 * // project/
 * // ├── src/
 * // │   ├── components/
 * // │   │   └── Button.tsx
 * // │   ├── index.ts
 * // │   └── utils.ts
 * // └── package.json
 * ```
 */
export function toTree(index: ProjectIndex): string {
  // Handle corrupted tree structure
  if (!index.tree || typeof index.tree !== 'object') {
    return '(error: corrupted tree structure)';
  }

  const lines: string[] = [];
  
  // Add root directory
  lines.push(`${index.tree.name}/`);
  
  // Handle empty project
  if (!index.tree.children || index.tree.children.length === 0) {
    lines.push('(empty)');
    return lines.join('\n');
  }
  
  // Render children with proper tree structure
  renderTreeNode(index.tree.children, '', true, lines);
  
  return lines.join('\n');
}

/**
 * Recursively render tree nodes with proper ASCII art
 */
function renderTreeNode(children: TreeNode[], prefix: string, isRoot: boolean, lines: string[]): void {
  if (!children) {
    return;
  }
  
  // Sort children: directories first, then files, alphabetically within each type
  const sortedChildren = [...children].sort((a, b) => {
    // Directories come before files
    if (a.type === 'dir' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'dir') return 1;
    
    // Within same type, sort alphabetically
    return a.name.localeCompare(b.name);
  });
  
  sortedChildren.forEach((child, index) => {
    const isLast = index === sortedChildren.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';
    
    // Display the node
    const displayName = child.type === 'dir' ? `${child.name}/` : child.name;
    lines.push(`${prefix}${connector}${displayName}`);
    
    // Recursively render children for directories
    if (child.type === 'dir' && child.children) {
      renderTreeNode(child.children, `${prefix}${childPrefix}`, false, lines);
    }
  });
}

/**
 * Convert project index to human-readable Markdown documentation format.
 * 
 * This format provides the highest readability with 93% token reduction.
 * Perfect for generating project documentation, README files, or reports
 * that need to be easily understood by developers.
 * 
 * ## Format Structure
 * - Organized by directory
 * - Clear dependency listings
 * - Detailed function and class information
 * - Project statistics summary
 * 
 * @param index - Project index to format
 * @returns Markdown-formatted string representation
 * 
 * @example
 * ```typescript
 * const index = await indexer.processProject();
 * const markdownOutput = toMarkdown(index);
 * 
 * console.log(markdownOutput);
 * // # Project Structure
 * //
 * // ## src/
 * //
 * // ### utils.ts
 * // **Dependencies:** ./types
 * // **Functions:** processData(), validateInput()
 * // **Constants:** API_URL, DEFAULT_CONFIG
 * ```
 */
export function toMarkdown(index: ProjectIndex): string {
  const lines: string[] = ['# Project Structure\n'];
  
  // Group files by directory
  const byDir = new Map<string, Array<[string, typeof index.files[string]]>>();
  
  for (const [path, info] of Object.entries(index.files)) {
    const dir = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '.';
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir)?.push([path, info]);
  }
  
  // Process each directory
  for (const [dir, files] of Array.from(byDir.entries()).sort()) {
    lines.push(`## ${dir}/\n`);
    
    for (const [path, info] of files.sort()) {
      const fileName = path.split('/').pop() || path;
      
      // File header with full dependency paths for clarity
      if (info.dependencies.length > 0) {
        lines.push(`### ${fileName}`);
        lines.push(`**Dependencies:** ${info.dependencies.join(', ')}`);
      } else {
        lines.push(`### ${fileName}`);
      }
      
      // Compact content representation
      const content: string[] = [];
      
      // Functions (just names and async indicator)
      const fns = info.functions.map(f => `${f.isAsync ? 'async ' : ''}${f.name}()`).join(', ');
      if (fns) content.push(`**Functions:** ${fns}`);
      
      // Classes with counts
      const cls = info.classes.map(c => {
        const methodCount = c.methods?.length || 0;
        const propCount = c.properties?.length || 0;
        if (methodCount === 0 && propCount === 0) {
          return c.name;
        }
        return `${c.name} (${methodCount} methods, ${propCount} properties)`;
      }).join(', ');
      if (cls) content.push(`**Classes:** ${cls}`);
      
      // Constants (just names)
      const consts = info.constants.map(c => c.name).join(', ');
      if (consts) content.push(`**Constants:** ${consts}`);
      
      if (content.length > 0) {
        lines.push(content.join('  \n'));
      }
      lines.push('');
    }
  }
  
  // Add dependency graph summary at the end
  lines.push('## Dependencies\n');
  lines.push(`- **Total files:** ${index.metadata.totalFiles}`);
  lines.push(`- **Dependencies:** ${index.edges.length}`);
  lines.push(`- **Avg per file:** ${(index.edges.length / index.metadata.totalFiles).toFixed(1)}`);
  
  return lines.join('\n');
}

/**
 * Automatically select the optimal format based on project size and token efficiency.
 * 
 * This function intelligently chooses between available formats to maximize
 * readability while staying within practical token limits for AI context usage.
 * Tree format is excluded from auto-selection as it serves a different purpose
 * (structure visualization rather than content analysis).
 * 
 * ## Selection Logic
 * 
 * - **≤5000 files**: DSL format (best readability, 90% compression)
 * - **>5000 files**: Graph format (maximum compression, 92% reduction)
 * 
 * ## Token Budget Philosophy
 * 
 * Uses DSL format for most projects since it provides the best balance of
 * readability and token efficiency, and only switches to graph format for
 * very large projects where maximum compression is needed.
 * 
 * **Token estimates:**
 * - Small projects: DSL format (excellent readability)
 * - 1000 files ≈ 21K tokens (DSL, 10% of 200K context) ✓
 * - 2000 files ≈ 42K tokens (DSL, 21% of context) ⚠️
 * - 5000 files ≈ 105K tokens (DSL, 53% of context) - switches to Graph
 * 
 * @param index - Project index to format
 * @returns Object containing the selected format type and formatted content
 * 
 * @example
 * ```typescript
 * const index = await indexer.processProject();
 * const { format, content } = formatAuto(index);
 * 
 * console.log(`Auto-selected ${format} format`);
 * console.log(`Content length: ${content.length} characters`);
 * 
 * if (format === 'dsl') {
 *   console.log('Using readable DSL format');
 * } else {
 *   console.log('Using compact graph format for large project');
 * }
 * ```
 */
export function formatAuto(index: ProjectIndex): { format: FormatType; content: string } {
  const fileCount = index.metadata.totalFiles;
  
  // Use DSL for most projects - it provides the best balance of readability
  // and token efficiency (90% reduction) for AI context usage
  // Only switch to graph for very large projects where maximum compression is needed
  if (fileCount <= 5000) {
    return { format: 'dsl', content: toDSL(index) };
  } else {
    // Graph format for very large projects (>5000 files)
    // Maximum compression (92% reduction) for token efficiency
    return { format: 'graph', content: toGraph(index) };
  }
}

/**
 * Calculate compression statistics for a formatted output.
 * 
 * Provides detailed metrics about token and size reduction compared to
 * compact JSON baseline. Useful for analyzing format efficiency and
 * making informed decisions about context usage.
 * 
 * @param original - Original project index
 * @param formatted - Formatted string output
 * @returns Compression statistics object
 * 
 * @example
 * ```typescript
 * const index = await indexer.processProject();
 * const dslOutput = toDSL(index);
 * const stats = getCompressionStats(index, dslOutput);
 * 
 * console.log(`Original size: ${stats.originalSize} characters`);
 * console.log(`Compressed size: ${stats.compressedSize} characters`);
 * console.log(`Token reduction: ${stats.reduction}%`);
 * console.log(`Estimated tokens: ${stats.estimatedTokens}`);
 * 
 * // Example output:
 * // Original size: 245680 characters
 * // Compressed size: 24568 characters
 * // Token reduction: 90%
 * // Estimated tokens: 7019
 * ```
 */
export function getCompressionStats(original: ProjectIndex, formatted: string): {
  /** Size of compact JSON representation in characters */
  originalSize: number;
  /** Size of formatted output in characters */
  compressedSize: number;
  /** Token reduction percentage (0-100) */
  reduction: number;
  /** Estimated token count for formatted output */
  estimatedTokens: number;
} {
  // Use compact JSON as baseline (no whitespace) - this is what actually gets sent to LLMs
  const compactJson = JSON.stringify(original);
  const originalSize = compactJson.length;
  const compressedSize = formatted.length;
  
  // Calculate token reduction (what actually matters for LLMs)
  const originalTokens = Math.round(originalSize / 3.5);
  const compressedTokens = Math.round(compressedSize / 3.5);
  const tokenReduction = Math.round((1 - compressedTokens / originalTokens) * 100);
  
  return {
    originalSize,
    compressedSize,
    reduction: tokenReduction,  // Now this is token reduction, not byte reduction
    estimatedTokens: compressedTokens
  };
}