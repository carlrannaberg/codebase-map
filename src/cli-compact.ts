#!/usr/bin/env node

/**
 * CLI command for generating compact index for Claude
 * Usage: npm run index:compact [--format=dsl|graph|mini|ts|auto]
 */

import fs from 'node:fs';
import path from 'node:path';
import { 
  toMinifiedJSON, 
  toDSL, 
  toGraph,
  formatAuto,
  getCompressionStats
} from './core/index-formatter.js';
import type { ProjectIndex } from './types/index.js';

const args = process.argv.slice(2);
const formatArg = args.find(a => a.startsWith('--format='));
const format = formatArg?.split('=')[1] || 'auto';

// Load the index
const indexPath = path.join(process.cwd(), 'PROJECT_INDEX.json');
if (!fs.existsSync(indexPath)) {
  console.error('❌ PROJECT_INDEX.json not found. Run "npm run scan" first.');
  process.exit(1);
}

const index: ProjectIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

// Generate compact format
let result: { format: string; content: string };

switch (format) {
  case 'mini':
    result = { format: 'mini', content: toMinifiedJSON(index) };
    break;
  case 'dsl':
    result = { format: 'dsl', content: toDSL(index) };
    break;
  case 'graph':
    result = { format: 'graph', content: toGraph(index) };
    break;
  case 'auto':
  default:
    result = formatAuto(index);
    break;
}

// Save compact version
const outputPath = path.join(process.cwd(), 'PROJECT_INDEX.compact');
fs.writeFileSync(outputPath, result.content);

// Show stats
const stats = getCompressionStats(index, result.content);
console.log(`✅ Compact index generated: PROJECT_INDEX.compact`);
console.log(`📊 Format: ${result.format}`);
console.log(`📏 Size: ${(stats.compressedSize / 1024).toFixed(1)} KB (${stats.reduction}% reduction)`);
console.log(`🎯 Tokens: ~${stats.estimatedTokens.toLocaleString()} (${Math.round(stats.estimatedTokens / index.metadata.totalFiles)} per file)`);
console.log(`📁 Files: ${index.metadata.totalFiles}`);

// Show usage instructions
console.log('\n💡 Usage with Claude Code:');
console.log('1. Load PROJECT_INDEX.compact into context');
console.log('2. Tell Claude: "Use the project index to understand the codebase structure"');
console.log('3. Claude can now navigate and understand relationships without loading all files');

// Warning for large projects
if (stats.estimatedTokens > 10000) {
  console.log('\n⚠️  Warning: Even compact format uses >10K tokens.');
  console.log('   Consider using --format=graph for maximum compression.');
}