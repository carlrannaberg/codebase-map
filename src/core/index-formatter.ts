/**
 * Ultra-compact formatters for Claude context optimization
 */

import type { ProjectIndex } from '../types/index.js';

export type FormatType = 'json' | 'mini' | 'dsl' | 'graph' | 'markdown';

interface MinifiedIndex {
  m: {
    v: number;
    f: number;
  };
  e: Array<[string, string]>;
  f: Record<string, {
    d?: string[];
    fn?: Array<{ n: string; r?: string; a?: number }>;
    cl?: Array<{ n: string; m: number; p: number }>;
    c?: string[];
  }>;
}

/**
 * Format 1: Minified JSON (60% reduction)
 * Removes all whitespace and uses abbreviated keys
 */
export function toMinifiedJSON(index: ProjectIndex): string {
  const mini: MinifiedIndex = {
    m: { // metadata
      v: index.metadata.version,
      f: index.metadata.totalFiles
    },
    e: index.edges.map(e => [e.from, e.to]), // edges as arrays
    f: {} // files
  };

  for (const [path, info] of Object.entries(index.files)) {
    if (!info.functions.length && !info.classes.length && !info.constants.length) {
      continue; // Skip empty files
    }
    
    mini.f[path] = {
      ...(info.dependencies.length > 0 && { d: info.dependencies }),
      ...(info.functions.length > 0 && { 
        fn: info.functions.map(f => ({
          n: f.name,
          ...(f.returnType && { r: f.returnType }),
          ...(f.isAsync && { a: 1 })
        }))
      }),
      ...(info.classes.length > 0 && { 
        cl: info.classes.map(c => ({
          n: c.name,
          m: c.methods?.length || 0,
          p: c.properties?.length || 0
        }))
      }),
      ...(info.constants.length > 0 && { 
        c: info.constants.map(c => c.name)
      })
    };
  }

  return JSON.stringify(mini);
}

/**
 * Format 2: Custom DSL (75% reduction)
 * Human-readable, ultra-compact format
 */
export function toDSL(index: ProjectIndex): string {
  const lines: string[] = [];
  
  for (const [path, info] of Object.entries(index.files)) {
    // Skip empty files
    if (!info.functions.length && !info.classes.length && 
        !info.constants.length && !info.dependencies.length) {
      continue;
    }
    
    // File header with dependencies
    const deps = info.dependencies.map(d => d.replace('src/', '')).join(',');
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
 * Format 3: Graph + Signatures (80% reduction)
 * Extreme compression for large projects
 */
export function toGraph(index: ProjectIndex): string {
  const fileMap = new Map<string, number>();
  let idx = 0;
  
  // Create file index
  for (const file of index.nodes) {
    fileMap.set(file, idx++);
  }
  
  // Build edges section
  const edgeMap = new Map<number, number[]>();
  for (const edge of index.edges) {
    const from = fileMap.get(edge.from);
    const to = fileMap.get(edge.to);
    if (from !== undefined && to !== undefined) {
      if (!edgeMap.has(from)) edgeMap.set(from, []);
      const fromEdges = edgeMap.get(from);
      if (fromEdges) fromEdges.push(to);
    }
  }
  
  const lines: string[] = ['EDGES:'];
  for (const [from, tos] of edgeMap.entries()) {
    lines.push(`${from}→${tos.join(',')}`);
  }
  
  lines.push('\nSIGS:');
  for (const [path, info] of Object.entries(index.files)) {
    const idx = fileMap.get(path);
    if (idx === undefined) continue;
    
    const fileName = path.split('/').pop() || path;
    const parts: string[] = [idx.toString(), fileName.replace('.ts', '')];
    
    // Compact function signatures
    if (info.functions.length > 0) {
      const fns = info.functions.map(f => 
        `${f.name}():${(f.returnType || 'v').substring(0, 1)}`
      ).join(',');
      parts.push(fns);
    }
    
    // Compact class info
    if (info.classes.length > 0) {
      const cls = info.classes.map(c => 
        `${c.name}{${c.methods?.length || 0}m,${c.properties?.length || 0}p}`
      ).join(',');
      parts.push(cls);
    }
    
    // Constants (just names)
    if (info.constants.length > 0) {
      parts.push(info.constants.map(c => c.name).join(','));
    }
    
    lines.push(parts.join('|'));
  }
  
  return lines.join('\n');
}

/**
 * Format 4: Markdown with arrows (72% reduction)
 * Clean, readable markdown format with arrow dependencies
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
      const deps = info.dependencies.map(d => d.split('/').pop()?.replace('.ts', '')).join(', ');
      
      // File header with arrow dependencies
      lines.push(`### ${fileName}${deps ? ` → ${deps}` : ''}`);
      
      // Compact content representation
      const content: string[] = [];
      
      // Functions (just names and async indicator)
      const fns = info.functions.map(f => `${f.isAsync ? 'async ' : ''}${f.name}()`).join(', ');
      if (fns) content.push(`**Functions:** ${fns}`);
      
      // Classes with counts
      const cls = info.classes.map(c => 
        `${c.name}(${c.methods?.length || 0}m/${c.properties?.length || 0}p)`
      ).join(', ');
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
 * Auto-select best format based on project size and context usage
 * 
 * Philosophy: Use DSL format for as long as possible since it's readable.
 * Switch to graph format before the index gets too heavy (>20% of context).
 * 
 * At ~21 tokens per file in DSL:
 * - 1000 files = 21K tokens (10% of context) ✅ Use DSL
 * - 2000 files = 42K tokens (21% of context) ⚠️ Good cutoff point
 * - 3000 files = 63K tokens (31% of context) ❌ Too heavy
 * 
 * 2000 files is the sweet spot:
 * - Covers most production codebases
 * - Keeps context usage reasonable (≤20%)
 * - Leaves 80% of context for actual work
 */
export function formatAuto(index: ProjectIndex): { format: FormatType; content: string } {
  const fileCount = index.metadata.totalFiles;
  
  // Use DSL for projects up to 2000 files (uses ~21% of Claude's context)
  // This covers most real-world projects while keeping context usage reasonable
  if (fileCount <= 2000) {
    return { format: 'dsl', content: toDSL(index) };
  } else {
    // Graph format for large projects (>2000 files)
    // Reduces token usage from 21% to 9% for a 2000-file project
    return { format: 'graph', content: toGraph(index) };
  }
}

/**
 * Get compression stats for a format
 */
export function getCompressionStats(original: ProjectIndex, formatted: string): {
  originalSize: number;
  compressedSize: number;
  reduction: number;
  estimatedTokens: number;
} {
  const originalJson = JSON.stringify(original, null, 2);
  const originalSize = originalJson.length;
  const compressedSize = formatted.length;
  const reduction = Math.round((1 - compressedSize / originalSize) * 100);
  
  // Estimate tokens (rough: 3.5 chars per token for structured text)
  const estimatedTokens = Math.round(compressedSize / 3.5);
  
  return {
    originalSize,
    compressedSize,
    reduction,
    estimatedTokens
  };
}