/**
 * Tree building module - converts flat file list to hierarchical tree
 */

import type { TreeNode } from '../types/index.js';

export class TreeBuilder {
  /**
   * Build hierarchical tree structure from flat file list
   * @param files - Array of file paths relative to root
   * @param rootName - Name of the root directory (default: 'root')
   * @returns Root tree node with nested children
   */
  static buildTree(files: string[], rootName = 'root'): TreeNode {
    const root: TreeNode = {
      name: rootName,
      type: 'dir',
      children: []
    };

    // Sort files to ensure consistent tree structure
    const sortedFiles = [...files].sort();

    // Build tree by processing each file path
    for (const filePath of sortedFiles) {
      this.addFileToTree(root, filePath);
    }

    // Sort children at each level for consistency
    this.sortTreeChildren(root);

    return root;
  }

  /**
   * Add a single file path to the tree structure
   * @param root - Root tree node
   * @param filePath - File path to add (using POSIX separators)
   */
  private static addFileToTree(root: TreeNode, filePath: string): void {
    const parts = filePath.split('/').filter(part => part.length > 0);
    let current = root;

    // Navigate/create directory structure
    for (let i = 0; i < parts.length - 1; i++) {
      const dirName = parts[i];
      
      // Skip if dirName is undefined or empty
      if (!dirName) {
        continue;
      }
      
      // Ensure children array exists
      if (!current.children) {
        current.children = [];
      }

      // Find existing directory or create new one
      let dirNode = current.children.find(child => 
        child.name === dirName && child.type === 'dir'
      );

      if (!dirNode) {
        dirNode = {
          name: dirName,
          type: 'dir',
          children: []
        };
        current.children.push(dirNode);
      }

      current = dirNode;
    }

    // Add the file itself
    const fileName = parts[parts.length - 1];
    if (fileName && fileName.length > 0) {
      // Ensure children array exists
      if (!current.children) {
        current.children = [];
      }

      // Check if file already exists (shouldn't happen with valid input)
      const existingFile = current.children.find(child => 
        child.name === fileName && child.type === 'file'
      );

      if (!existingFile) {
        current.children.push({
          name: fileName,
          type: 'file'
        });
      }
    }
  }

  /**
   * Recursively sort tree children (directories first, then files, alphabetically)
   * @param node - Tree node to sort
   */
  private static sortTreeChildren(node: TreeNode): void {
    if (!node.children) {
      return;
    }

    // Sort children: directories first, then files, both alphabetically
    node.children.sort((a, b) => {
      // Directories come before files
      if (a.type !== b.type) {
        return a.type === 'dir' ? -1 : 1;
      }
      
      // Same type: sort alphabetically
      return a.name.localeCompare(b.name);
    });

    // Recursively sort children
    for (const child of node.children) {
      this.sortTreeChildren(child);
    }
  }

  /**
   * Get flat list of all files in tree
   * @param node - Root tree node
   * @param basePath - Base path for relative paths (default: empty)
   * @returns Array of file paths
   */
  static getFilesFromTree(node: TreeNode, basePath = ''): string[] {
    const files: string[] = [];

    if (node.type === 'file') {
      const fullPath = basePath ? `${basePath}/${node.name}` : node.name;
      files.push(fullPath);
    } else if (node.children) {
      const currentPath = basePath ? `${basePath}/${node.name}` : node.name;
      
      for (const child of node.children) {
        // For root node, don't include its name in the path
        const childBasePath = basePath === '' && node.name === 'root' ? '' : currentPath;
        files.push(...this.getFilesFromTree(child, childBasePath));
      }
    }

    return files;
  }

  /**
   * Count files and directories in tree
   * @param node - Tree node to count
   * @returns Object with file and directory counts
   */
  static countNodes(node: TreeNode): { files: number; directories: number } {
    let files = 0;
    let directories = 0;

    if (node.type === 'file') {
      files = 1;
    } else {
      directories = 1;
      
      if (node.children) {
        for (const child of node.children) {
          const childCount = this.countNodes(child);
          files += childCount.files;
          directories += childCount.directories;
        }
      }
    }

    return { files, directories };
  }

  /**
   * Find a node in the tree by path
   * @param root - Root tree node
   * @param targetPath - Path to find (using POSIX separators)
   * @returns Found node or undefined
   */
  static findNodeByPath(root: TreeNode, targetPath: string): TreeNode | undefined {
    if (targetPath === '' || targetPath === root.name) {
      return root;
    }

    const parts = targetPath.split('/').filter(part => part.length > 0);
    let current = root;

    for (const part of parts) {
      if (!current.children) {
        return undefined;
      }

      const found = current.children.find(child => child.name === part);
      if (!found) {
        return undefined;
      }

      current = found;
    }

    return current;
  }
}