/**
 * Utility to find project root by looking for PROJECT_INDEX.json or package.json
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Find the project root by climbing up the directory tree
 * Looks for PROJECT_INDEX.json, package.json, or .git directory
 * @param startDir - Starting directory (defaults to cwd)
 * @returns Project root directory or null if not found
 */
export function findProjectRoot(startDir: string = process.cwd()): string | null {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    // Check for PROJECT_INDEX.json (existing index)
    if (fs.existsSync(path.join(currentDir, 'PROJECT_INDEX.json'))) {
      return currentDir;
    }

    // Check for package.json (Node.js project root)
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      return currentDir;
    }

    // Check for .git directory (git repository root)
    if (fs.existsSync(path.join(currentDir, '.git'))) {
      return currentDir;
    }

    // Check for other project markers
    if (fs.existsSync(path.join(currentDir, 'tsconfig.json')) ||
        fs.existsSync(path.join(currentDir, 'pyproject.toml')) ||
        fs.existsSync(path.join(currentDir, 'Cargo.toml')) ||
        fs.existsSync(path.join(currentDir, 'go.mod'))) {
      return currentDir;
    }

    // Move up one directory
    currentDir = path.dirname(currentDir);
  }

  // Check the root directory itself
  if (fs.existsSync(path.join(root, 'PROJECT_INDEX.json')) ||
      fs.existsSync(path.join(root, 'package.json'))) {
    return root;
  }

  return null;
}

/**
 * Find existing PROJECT_INDEX.json by climbing up the directory tree
 * @param startDir - Starting directory (defaults to cwd)
 * @returns Path to PROJECT_INDEX.json or null if not found
 */
export function findIndexFile(startDir: string = process.cwd()): string | null {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const indexPath = path.join(currentDir, 'PROJECT_INDEX.json');
    if (fs.existsSync(indexPath)) {
      return indexPath;
    }

    // Move up one directory
    currentDir = path.dirname(currentDir);
  }

  // Check the root directory itself
  const rootIndex = path.join(root, 'PROJECT_INDEX.json');
  if (fs.existsSync(rootIndex)) {
    return rootIndex;
  }

  return null;
}