#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { CodeIndexer, DependencyResolver } from './core/index.js';
import type { ProjectIndex } from './types/index.js';
import { findProjectRoot, findIndexFile } from './utils/find-project-root.js';
import { 
  toMinifiedJSON, 
  toDSL, 
  toGraph,
  toMarkdown,
  formatAuto,
  getCompressionStats
} from './core/index-formatter.js';

const program = new Command();

program
  .name('codebase-map')
  .description('A lightweight code indexer that generates comprehensive project maps for LLMs')
  .version('0.1.2');

// Scan command
program
  .command('scan')
  .description('Scan the entire project and generate index')
  .option('-r, --root <path>', 'root directory to scan')
  .option('-o, --output <path>', 'output file path', 'PROJECT_INDEX.json')
  .option('-v, --verbose', 'show detailed progress')
  .action(async (options) => {
    const { output, verbose } = options;
    
    // Find project root if not specified
    const root = options.root || findProjectRoot() || process.cwd();
    if (!options.root && root !== process.cwd()) {
      console.log(`📁 Found project root: ${root}`);
    }
    
    console.log('🔍 Scanning codebase...');
    
    const indexer = new CodeIndexer(root);
    const startTime = Date.now();
    
    let stepsCompleted = 0;
    const index = await indexer.processProject(verbose ? (progress: { step: string; current: number; total: number }): void => {
      if (progress.current > stepsCompleted) {
        stepsCompleted = progress.current;
        console.log(`  ${progress.step}... (${progress.current}/${progress.total})`);
      }
    } : undefined);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Save the index
    const outputPath = path.isAbsolute(output) ? output : path.join(root, output);
    fs.writeFileSync(outputPath, JSON.stringify(index, null, 2));
    
    console.log('\n✅ Scan completed successfully!');
    console.log(`📁 Files processed: ${index.metadata.totalFiles}`);
    console.log(`🔗 Dependencies found: ${index.edges.length}`);
    console.log(`📊 Average dependencies per file: ${(index.edges.length / index.metadata.totalFiles).toFixed(1)}`);
    console.log(`⏱️  Processing time: ${elapsed}s`);
    console.log(`💾 Index saved to: ${outputPath}`);
    
    if (verbose) {
      // Show entry points and leaf files
      const entryPoints = DependencyResolver.findEntryPoints(index.edges, index.nodes);
      const leafFiles = DependencyResolver.findLeafFiles(index.edges, index.nodes);
      
      if (entryPoints.length > 0) {
        console.log('\n📍 Entry points (files with no dependents):');
        entryPoints.slice(0, 5).forEach((file: string) => console.log(`  - ${file}`));
        if (entryPoints.length > 5) {
          console.log(`  ... and ${entryPoints.length - 5} more`);
        }
      }
      
      if (leafFiles.length > 0) {
        console.log('\n🍃 Leaf files (files with no dependencies):');
        leafFiles.slice(0, 5).forEach((file: string) => console.log(`  - ${file}`));
        if (leafFiles.length > 5) {
          console.log(`  ... and ${leafFiles.length - 5} more`);
        }
      }
      
      // Check for circular dependencies
      const circular = DependencyResolver.findCircularDependencies(index.edges);
      if (circular.length > 0) {
        console.log('\n⚠️  Warning: Circular dependencies detected:');
        circular.slice(0, 3).forEach((cycle: string[]) => {
          console.log(`  ${cycle.join(' → ')} → ${cycle[0]}`);
        });
        if (circular.length > 3) {
          console.log(`  ... and ${circular.length - 3} more cycles`);
        }
      }
    }
  });

// Update command
program
  .command('update <file>')
  .description('Update the index for a specific file')
  .option('-r, --root <path>', 'root directory')
  .action(async (file, options) => {
    // Find existing index file
    const indexPath = findIndexFile() || path.join(process.cwd(), 'PROJECT_INDEX.json');
    
    if (!fs.existsSync(indexPath)) {
      console.error('❌ No existing index found. Run "codebase-map scan" first.');
      process.exit(1);
    }
    
    // Derive root from index location
    const root = options.root || path.dirname(indexPath);
    
    console.log(`🔄 Updating index for: ${file}`);
    
    // Load existing index
    const existingIndex: ProjectIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    
    const indexer = new CodeIndexer(root);
    const filePath = path.isAbsolute(file) ? file : path.join(root, file);
    const relativePath = path.relative(root, filePath);
    
    try {
      const updatedIndex = await indexer.updateFile(relativePath, existingIndex);
      // Save the updated index
      fs.writeFileSync(indexPath, JSON.stringify(updatedIndex, null, 2));
      console.log('✅ Index updated successfully!');
    } catch (error) {
      console.error(`❌ Failed to update index: ${error}`);
      process.exit(1);
    }
  });

// Format command - outputs to stdout
program
  .command('format')
  .description('Format the index for LLMs (outputs to stdout)')
  .option('-f, --format <type>', 'output format: auto|json|dsl|graph|markdown|mini', 'auto')
  .option('-s, --stats', 'show statistics to stderr (does not affect stdout output)')
  .action((options) => {
    const { format, stats } = options;
    
    // Find existing index file
    const indexPath = findIndexFile();
    
    if (!indexPath || !fs.existsSync(indexPath)) {
      console.error('❌ PROJECT_INDEX.json not found. Run "codebase-map scan" first.');
      process.exit(1);
    }
    
    const index: ProjectIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    
    // Generate formatted output
    let result: { format: string; content: string };
    
    switch (format) {
      case 'json':
        result = { format: 'json', content: JSON.stringify(index, null, 2) };
        break;
      case 'mini':
        result = { format: 'mini', content: toMinifiedJSON(index) };
        break;
      case 'dsl':
        result = { format: 'dsl', content: toDSL(index) };
        break;
      case 'graph':
        result = { format: 'graph', content: toGraph(index) };
        break;
      case 'markdown':
        result = { format: 'markdown', content: toMarkdown(index) };
        break;
      case 'auto':
      default:
        result = formatAuto(index);
        break;
    }
    
    // Output to stdout (the actual formatted content)
    process.stdout.write(result.content);
    
    // Optional stats to stderr (so it doesn't mix with the output)
    if (stats) {
      const compressionStats = getCompressionStats(index, result.content);
      console.error(`\n--- Statistics (${result.format} format) ---`);
      console.error(`Size: ${(compressionStats.compressedSize / 1024).toFixed(1)} KB (${compressionStats.reduction}% reduction)`);
      console.error(`Tokens: ~${compressionStats.estimatedTokens.toLocaleString()} (${Math.round(compressionStats.estimatedTokens / index.metadata.totalFiles)} per file)`);
      console.error(`Files: ${index.metadata.totalFiles}`);
      
      if (compressionStats.estimatedTokens > 50000) {
        console.error('Warning: Index uses >50K tokens. Consider --format=graph for maximum compression.');
      }
    }
  });

// List command to show what's in the index
program
  .command('list')
  .description('List files in the index')
  .option('-d, --deps', 'show files with most dependencies')
  .option('-e, --entries', 'show entry point files')
  .option('-l, --leaves', 'show leaf files (no dependencies)')
  .action((options) => {
    // Find existing index file
    const indexPath = findIndexFile();
    
    if (!indexPath || !fs.existsSync(indexPath)) {
      console.error('❌ PROJECT_INDEX.json not found. Run "codebase-map scan" first.');
      process.exit(1);
    }
    
    const index: ProjectIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    
    if (options.deps) {
      // Show files with most dependencies
      console.log('📊 Files with most dependencies:\n');
      const fileDeps = Object.entries(index.files)
        .map(([file, info]) => ({ file, count: info.dependencies.length }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      fileDeps.forEach(({ file, count }) => {
        console.log(`  ${file} (${count} deps)`);
      });
    } else if (options.entries) {
      // Show entry points
      console.log('📍 Entry point files (no dependents):\n');
      const dependents = new Set(index.edges.map(e => e.to));
      const entries = index.nodes.filter(node => !dependents.has(node));
      
      entries.slice(0, 20).forEach(file => console.log(`  ${file}`));
      if (entries.length > 20) {
        console.log(`  ... and ${entries.length - 20} more`);
      }
    } else if (options.leaves) {
      // Show leaf files
      console.log('🍃 Leaf files (no dependencies):\n');
      const leaves = Object.entries(index.files)
        .filter(([_, info]) => info.dependencies.length === 0)
        .map(([file]) => file);
      
      leaves.slice(0, 20).forEach(file => console.log(`  ${file}`));
      if (leaves.length > 20) {
        console.log(`  ... and ${leaves.length - 20} more`);
      }
    } else {
      // Default: show all files
      console.log(`📁 ${index.metadata.totalFiles} files indexed:\n`);
      index.nodes.slice(0, 30).forEach(file => console.log(`  ${file}`));
      if (index.nodes.length > 30) {
        console.log(`  ... and ${index.nodes.length - 30} more`);
      }
    }
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}