#!/usr/bin/env node

import fs from 'node:fs';
import { 
  toMinifiedJSON, 
  toDSL, 
  toGraph, 
  toTypeScriptStyle,
  toMarkdown,
  getCompressionStats,
  formatAuto
} from './core/index-formatter.js';
import type { ProjectIndex } from './types/index.js';

// Load the current index
const indexPath = 'PROJECT_INDEX.json';
const index: ProjectIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

console.log('=== Compression Analysis for PROJECT_INDEX.json ===\n');

// Test each format
const formats = [
  { name: 'Minified JSON', fn: toMinifiedJSON },
  { name: 'DSL Format', fn: toDSL },
  { name: 'Graph Format', fn: toGraph },
  { name: 'TypeScript Style', fn: toTypeScriptStyle },
  { name: 'Markdown', fn: toMarkdown }
];

for (const format of formats) {
  const compressed = format.fn(index);
  const stats = getCompressionStats(index, compressed);
  
  console.log(`${format.name}:`);
  console.log(`  Original: ${(stats.originalSize / 1024).toFixed(1)} KB`);
  console.log(`  Compressed: ${(stats.compressedSize / 1024).toFixed(1)} KB`);
  console.log(`  Reduction: ${stats.reduction}%`);
  console.log(`  Est. Tokens: ${stats.estimatedTokens.toLocaleString()}`);
  console.log(`  Tokens/file: ${Math.round(stats.estimatedTokens / index.metadata.totalFiles)}`);
  console.log('');
  
  // Save sample
  fs.writeFileSync(`PROJECT_INDEX.${format.name.toLowerCase().replace(' ', '_')}.txt`, compressed);
}

// Test auto-format selection
const auto = formatAuto(index);
console.log(`Auto-selected format: ${auto.format} (for ${index.metadata.totalFiles} files)\n`);

// Project size estimates
console.log('=== Token Estimates for Different Project Sizes ===\n');
const sizes = [20, 50, 100, 500, 1000];
const currentRatio = getCompressionStats(index, toDSL(index)).estimatedTokens / index.metadata.totalFiles;

console.log('| Files | Original JSON | DSL Format | Graph Format |');
console.log('|-------|--------------|------------|--------------|');
for (const size of sizes) {
  const original = Math.round(size * 165); // ~165 tokens per file in original
  const dsl = Math.round(size * currentRatio);
  const graph = Math.round(size * currentRatio * 0.8); // Graph is ~20% smaller
  console.log(`| ${size.toString().padEnd(5)} | ${original.toLocaleString().padEnd(12)} | ${dsl.toLocaleString().padEnd(10)} | ${graph.toLocaleString().padEnd(12)} |`);
}

console.log('\n✅ Sample files saved as PROJECT_INDEX.*.txt for inspection');