/**
 * File discovery and filtering
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import fastGlob from 'fast-glob';
import ignore from 'ignore';

export class FileDiscovery {
  private static readonly SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
  private static readonly EXCLUDED_DIRS = [
    'node_modules',
    'dist',
    'build',
    '.next',
    '.turbo',
    '.git',
    'coverage',
    '.nyc_output'
  ];

  /**
   * Discover all TypeScript/JavaScript files in the project
   * @param rootPath - Root directory to scan
   * @returns Array of file paths relative to root
   */
  static async discoverFiles(rootPath: string): Promise<string[]> {
    const absoluteRoot = path.resolve(rootPath);
    
    // Load gitignore rules
    const ignoreRules = await this.loadIgnoreRules(absoluteRoot);
    
    // Use fast-glob to find all potential files
    const patterns = this.SUPPORTED_EXTENSIONS.map(ext => `**/*${ext}`);
    const globOptions = {
      cwd: absoluteRoot,
      ignore: this.EXCLUDED_DIRS.map(dir => `${dir}/**`),
      onlyFiles: true,
      followSymbolicLinks: false,
      absolute: false,
      dot: false
    };
    
    const allFiles = await fastGlob(patterns, globOptions);
    
    // Apply gitignore filtering
    const filteredFiles = this.applyIgnoreRules(allFiles, ignoreRules);
    
    // Convert to POSIX paths and sort
    return filteredFiles
      .map(file => file.replace(/\\/g, '/'))
      .sort();
  }

  /**
   * Load and parse .gitignore files
   * @param rootPath - Root directory path
   * @returns Ignore instance with loaded rules
   */
  private static async loadIgnoreRules(rootPath: string): Promise<ReturnType<typeof ignore>> {
    const ig = ignore();
    
    // Load .gitignore from root
    const gitignorePath = path.join(rootPath, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      try {
        const gitignoreContent = await fs.promises.readFile(gitignorePath, 'utf8');
        ig.add(gitignoreContent);
      } catch {
        // Silently continue if .gitignore cannot be read
      }
    }
    
    // Add default ignore patterns
    ig.add([
      // Common IDE and editor files
      '.vscode/',
      '.idea/',
      '*.swp',
      '*.swo',
      '*~',
      '.DS_Store',
      'Thumbs.db',
      
      // Logs
      '*.log',
      'logs/',
      
      // Runtime and temporary files
      '.env',
      '.env.local',
      '.env.*.local',
      'temp/',
      'tmp/',
      
      // Package manager files
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml'
    ]);
    
    return ig;
  }

  /**
   * Apply ignore rules to file list
   * @param files - Array of file paths
   * @param ignoreRules - Ignore instance with rules
   * @returns Filtered array of file paths
   */
  private static applyIgnoreRules(
    files: string[], 
    ignoreRules: ReturnType<typeof ignore>
  ): string[] {
    return files.filter(file => !ignoreRules.ignores(file));
  }

  /**
   * Check if a file has a supported extension
   * @param filePath - File path to check
   * @returns True if file is supported
   */
  static isSupportedFile(filePath: string): boolean {
    const ext = path.extname(filePath);
    return this.SUPPORTED_EXTENSIONS.includes(ext);
  }

  /**
   * Get supported file extensions
   * @returns Array of supported extensions
   */
  static getSupportedExtensions(): string[] {
    return [...this.SUPPORTED_EXTENSIONS];
  }
}
