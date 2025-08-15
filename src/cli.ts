#!/usr/bin/env node

/**
 * Code Map CLI
 *
 * Command-line interface for the code indexing tool.
 */

import { parseArgs } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CodeIndexer } from './core/index.js';
import type { ProjectIndex } from './types/index.js';

async function main(): Promise<void> {
  const { values: args, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
      config: { type: 'string', short: 'c' },
      output: { type: 'string', short: 'o' },
      verbose: { type: 'boolean' },
    },
  });

  if (args.help) {
    console.log(`
🗺️  Code Map - Code Indexing Tool

A comprehensive tool for indexing and analyzing TypeScript/JavaScript codebases.

Usage: code-map <command> [options]

Commands:
  scan [options]              Scan and index the entire codebase
                              Creates PROJECT_INDEX.json with complete project structure
                              
  update <file-path> [options] Update a single file in the existing index
                              Requires existing PROJECT_INDEX.json file
                              
  query [options]             Query the code index (coming soon)
                              Search and analyze indexed code structure

Options:
  -h, --help                  Show this help message
  -v, --version               Show version information
  -c, --config <path>         Configuration file path (not yet implemented)
  -o, --output <path>         Output path for index file (default: PROJECT_INDEX.json)
  --verbose                   Enable verbose logging and detailed output

Examples:
  code-map scan               # Scan current directory, save to PROJECT_INDEX.json
  code-map scan --verbose     # Scan with detailed progress information
  code-map scan -o index.json # Scan and save to custom file
  code-map update src/app.ts  # Update specific file in existing index
  
Performance:
  - Processes files in parallel for faster scanning
  - Incremental updates preserve existing analysis
  - Typical performance: <1s for 100 files, ~5s for 1000 files
  
For more information, visit: https://github.com/your-repo/code-map
    `);
    return;
  }

  if (args.version) {
    const pkg = await import('../package.json', { assert: { type: 'json' } });
    console.log(`code-map v${pkg.default.version}`);
    return;
  }

  const command = positionals[0];

  if (!command) {
    console.error('❌ Error: No command specified');
    console.error('📖 Use --help to see available commands');
    console.error('💡 Quick start: code-map scan');
    process.exit(1);
  }

  switch (command) {
    case 'scan':
      await handleScanCommand(args);
      break;
    case 'update':
      await handleUpdateCommand(args, positionals);
      break;
    case 'query':
      console.log('🔍 Query command coming soon!');
      console.log('This feature will allow you to:');
      console.log('  • Search for functions, classes, and variables');
      console.log('  • Analyze dependency relationships');
      console.log('  • Find circular dependencies');
      console.log('  • Export dependency graphs');
      break;
    default:
      console.error(`❌ Unknown command: ${command}`);
      console.error('📖 Available commands: scan, update, query');
      console.error('💡 Use --help for detailed usage information');
      process.exit(1);
  }
}

/**
 * Handle the scan command - full project scan
 */
async function handleScanCommand(args: Record<string, unknown>): Promise<void> {
  try {
    const rootPath = process.cwd();
    const outputPath = (args.output as string) || 'PROJECT_INDEX.json';
    const verbose = args.verbose as boolean;

    console.log('🔍 Scanning codebase...');
    if (verbose) {
      console.log(`Root path: ${rootPath}`);
      console.log(`Output path: ${outputPath}`);
    }

    const indexer = new CodeIndexer(rootPath);
    
    // Progress callback for user feedback
    const progressCallback = (progress: { step: string; current: number; total: number }): void => {
      const percentage = Math.round((progress.current / progress.total) * 100);
      console.log(`[${percentage}%] ${progress.step}`);
    };

    // Process the project
    const startTime = Date.now();
    const projectIndex = await indexer.processProject(verbose ? progressCallback : undefined);
    const endTime = Date.now();

    // Save to file
    const absoluteOutputPath = path.resolve(outputPath);
    await fs.promises.writeFile(
      absoluteOutputPath, 
      JSON.stringify(projectIndex, null, 2), 
      'utf8'
    );

    // Display results
    const stats = CodeIndexer.getProjectStats(projectIndex);
    const duration = (endTime - startTime) / 1000;

    console.log('\n✅ Scan completed successfully!');
    console.log(`📁 Files processed: ${stats.totalFiles}`);
    console.log(`🔗 Dependencies found: ${stats.totalDependencies}`);
    console.log(`📊 Average dependencies per file: ${stats.averageDependenciesPerFile}`);
    console.log(`⏱️  Processing time: ${duration.toFixed(2)}s`);
    console.log(`💾 Index saved to: ${absoluteOutputPath}`);

    if (stats.circularDependencies.length > 0) {
      console.log(`⚠️  Circular dependencies detected: ${stats.circularDependencies.length}`);
      if (verbose) {
        stats.circularDependencies.forEach((cycle, index) => {
          console.log(`   ${index + 1}. ${cycle.join(' → ')}`);
        });
      }
    }

    if (verbose) {
      console.log(`🚀 Entry points: ${stats.entryPoints.length}`);
      console.log(`🍃 Leaf files: ${stats.leafFiles.length}`);
    }

  } catch (error) {
    console.error('❌ Scan failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Handle the update command - incremental file update
 */
async function handleUpdateCommand(args: Record<string, unknown>, positionals: string[]): Promise<void> {
  try {
    const filePath = positionals[1];
    if (!filePath) {
      console.error('❌ Error: File path required for update command');
      console.error('Usage: code-map update <file-path>');
      process.exit(1);
    }

    const indexPath = (args.output as string) || 'PROJECT_INDEX.json';
    const verbose = args.verbose as boolean;

    if (verbose) {
      console.log(`Updating file: ${filePath}`);
      console.log(`Index path: ${indexPath}`);
    }

    // Load existing index
    let existingIndex: ProjectIndex;
    try {
      const indexContent = await fs.promises.readFile(indexPath, 'utf8');
      existingIndex = JSON.parse(indexContent) as ProjectIndex;
    } catch {
      console.error('❌ Error: Could not load existing index. Run scan command first.');
      console.error(`Expected index file: ${path.resolve(indexPath)}`);
      process.exit(1);
    }

    const indexer = new CodeIndexer(existingIndex.metadata.root);

    // Check if file exists
    const absoluteFilePath = path.resolve(existingIndex.metadata.root, filePath);
    const fileExists = await fs.promises.access(absoluteFilePath).then(() => true).catch(() => false);

    console.log(`🔄 Updating index for: ${filePath}`);

    let updatedIndex: ProjectIndex;

    if (!fileExists) {
      // File was deleted - remove from index
      console.log('📁 File not found - removing from index');
      updatedIndex = indexer.removeFile(filePath, existingIndex);
    } else {
      // File exists - update it
      console.log('📝 File found - updating index');
      updatedIndex = await indexer.updateFile(filePath, existingIndex);
    }

    // Save updated index
    await fs.promises.writeFile(
      indexPath,
      JSON.stringify(updatedIndex, null, 2),
      'utf8'
    );

    console.log('✅ Update completed successfully!');
    console.log(`💾 Updated index saved to: ${path.resolve(indexPath)}`);

    if (verbose) {
      const stats = CodeIndexer.getProjectStats(updatedIndex);
      console.log(`📁 Total files: ${stats.totalFiles}`);
      console.log(`🔗 Total dependencies: ${stats.totalDependencies}`);
    }

  } catch (error) {
    console.error('❌ Update failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
