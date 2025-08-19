#!/usr/bin/env node

/**
 * @fileoverview Command-line interface for codebase-map
 * 
 * Provides commands for scanning codebases, updating indexes, formatting output,
 * and listing files with comprehensive pattern support for include/exclude filtering.
 * 
 * @example
 * ```bash
 * # Basic usage
 * codebase-map scan
 * 
 * # With patterns
 * codebase-map scan --include "src/**" --exclude "**\/*.test.ts"
 * 
 * # Format output
 * codebase-map format --format dsl
 * ```
 * 
 * @author codebase-map
 * @version Dynamic (read from package.json)
 */

import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CodeIndexer, DependencyResolver, FileDiscovery } from './core/index.js';
import type { ProjectIndex, FilterOptions } from './types/index.js';
import { findProjectRoot, findIndexFile } from './utils/find-project-root.js';
import { DEFAULT_INDEX_FILENAME } from './constants.js';
import { formatWarningsForCLI, formatSuggestionsForCLI } from './utils/pattern-analysis.js';
import { SecurityViolationError, displayError, getExitCode } from './utils/pattern-errors.js';
import { 
  toDSL, 
  toGraph,
  toMarkdown,
  formatAuto,
  getCompressionStats
} from './core/index-formatter.js';

/**
 * Reads the version from package.json using existing project utilities
 * @returns The version string from package.json or a fallback
 */
function getVersion(): string {
  try {
    // Use existing utility to find project root, but start from CLI module location
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const moduleProjectRoot = path.resolve(__dirname, '..');
    
    // Try the module's parent directory first (for both dev and built versions)
    let packageJsonPath = path.join(moduleProjectRoot, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      // Fallback: use existing findProjectRoot utility from current working directory
      const projectRoot = findProjectRoot();
      if (projectRoot) {
        packageJsonPath = path.join(projectRoot, 'package.json');
      }
    }
    
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      return packageJson.version || '0.4.0';
    }
    
    // Fallback if package.json is not found
    return '0.4.0';
  } catch (error) {
    // Fallback in case of any error
    console.warn(`Warning: Could not read version from package.json: ${error}`);
    return '0.4.0';
  }
}

const program = new Command();

/**
 * Validates and secures an output file path to prevent directory traversal attacks
 * @param outputPath - The output path provided by the user
 * @param projectRoot - The project root directory
 * @returns Validated and normalized output path
 * @throws SecurityViolationError if path is unsafe
 */
function validateOutputPath(outputPath: string, projectRoot: string): string {
  // Normalize paths to handle different path separators
  const normalizedOutput = path.normalize(outputPath);
  const normalizedRoot = path.normalize(projectRoot);
  
  // Check for directory traversal patterns
  if (normalizedOutput.includes('..')) {
    throw new SecurityViolationError(
      outputPath,
      'Directory traversal patterns (..) are not allowed in output path',
      'output path validation'
    );
  }
  
  // Determine the final absolute path
  const finalPath = path.isAbsolute(normalizedOutput) 
    ? normalizedOutput 
    : path.join(normalizedRoot, normalizedOutput);
  
  const resolvedPath = path.resolve(finalPath);
  const resolvedRoot = path.resolve(normalizedRoot);
  
  // Ensure the output path is within or at the project root
  if (!resolvedPath.startsWith(resolvedRoot) && resolvedPath !== resolvedRoot) {
    throw new SecurityViolationError(
      outputPath,
      `Output path '${resolvedPath}' is outside project root '${resolvedRoot}'`,
      'output path validation'
    );
  }
  
  return resolvedPath;
}

program
  .name('codebase-map')
  .description('A lightweight code indexer that generates comprehensive project maps for LLMs')
  .version(getVersion());

// Scan command
program
  .command('scan')
  .description('Scan the entire project and generate index')
  .option('-r, --root <path>', 'root directory to scan')
  .option('-o, --output <path>', 'output file path', DEFAULT_INDEX_FILENAME)
  .option('-v, --verbose', 'show detailed progress')
  .option('--include <patterns...>', 'include file patterns (glob syntax: src/** lib/**/*.ts)')
  .option('--exclude <patterns...>', 'exclude file patterns (glob syntax: **/*.test.ts docs/**)')
  .action(async (options) => {
    const { output, verbose, include, exclude } = options;
    
    // Find project root if not specified
    const root = options.root || findProjectRoot() || process.cwd();
    if (!options.root && root !== process.cwd()) {
      console.log(`📁 Found project root: ${root}`);
    }
    
    console.log('🔍 Scanning codebase...');
    
    // Build filter options from CLI arguments
    const filterOptions: FilterOptions = {};
    if (include && include.length > 0) {
      filterOptions.include = include;
    }
    if (exclude && exclude.length > 0) {
      filterOptions.exclude = exclude;
    }
    
    // Run pattern analysis if patterns are provided and verbose mode is on
    if (verbose && (include || exclude)) {
      console.log('\n📋 Analyzing patterns...');
      try {
        const { analysis } = await FileDiscovery.discoverFilesWithAnalysis(root, filterOptions);
        
        // Display warnings
        if (analysis.warnings.length > 0) {
          console.log('\n⚠️  Pattern warnings:');
          const formattedWarnings = formatWarningsForCLI(analysis.warnings);
          formattedWarnings.forEach(warning => console.log(`  ${warning}`));
        }
        
        // Display suggestions
        if (analysis.suggestions.length > 0) {
          console.log('\n💡 Suggestions:');
          const formattedSuggestions = formatSuggestionsForCLI(analysis.suggestions);
          formattedSuggestions.forEach(suggestion => console.log(`  ${suggestion}`));
        }
        
        // Display pattern effectiveness stats
        console.log('\n📊 Pattern effectiveness:');
        console.log(`  Total candidate files: ${analysis.stats.totalCandidateFiles}`);
        console.log(`  Files after include: ${analysis.stats.includedFiles}`);
        console.log(`  Files after exclude: ${analysis.stats.finalFiles}`);
        if (analysis.stats.excludedFiles > 0) {
          console.log(`  Files excluded: ${analysis.stats.excludedFiles}`);
        }
        
      } catch (error) {
        console.error(`❌ Pattern analysis failed: ${error}`);
      }
    }
    
    const indexer = new CodeIndexer(root, filterOptions);
    const startTime = Date.now();
    
    let stepsCompleted = 0;
    const index = await indexer.processProject(verbose ? (progress: { step: string; current: number; total: number }): void => {
      if (progress.current > stepsCompleted) {
        stepsCompleted = progress.current;
        console.log(`  ${progress.step}... (${progress.current}/${progress.total})`);
      }
    } : undefined);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Save the index with security validation
    try {
      const outputPath = validateOutputPath(output, root);
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
    } catch (error) {
      if (error instanceof SecurityViolationError) {
        displayError(error, verbose);
        process.exit(getExitCode(error));
      } else {
        console.error(`❌ Failed to save index: ${error}`);
        process.exit(1);
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
    const indexPath = findIndexFile() || path.join(process.cwd(), DEFAULT_INDEX_FILENAME);
    
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
  .option('-f, --format <type>', 'output format: auto|json|dsl|graph|markdown', 'auto')
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