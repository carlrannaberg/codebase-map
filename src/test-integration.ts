/**
 * Integration Test Suite for Include/Exclude Patterns
 * 
 * This comprehensive test suite validates complete CLI workflows,
 * realistic project structures, and pattern effectiveness.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import type { ProjectIndex } from './types/index.js';

// Test infrastructure for creating real file structures
class TestProjectBuilder {
  private tempDir: string;
  private files: Map<string, string> = new Map();

  constructor() {
    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codebase-map-test-'));
  }

  /**
   * Add a file to the test project
   */
  addFile(relativePath: string, content: string): this {
    this.files.set(relativePath, content);
    return this;
  }

  /**
   * Add a directory structure with TypeScript files
   */
  addTypescriptProject(): this {
    return this
      .addFile('package.json', JSON.stringify({
        name: 'test-project',
        type: 'module',
        dependencies: { lodash: '^4.0.0' }
      }, null, 2))
      .addFile('tsconfig.json', JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          strict: true
        }
      }, null, 2))
      .addFile('src/index.ts', `
import { utils } from './utils/index.js';
import { UserService } from './services/user.service.js';

export function main() {
  const userService = new UserService();
  return utils.formatUser(userService.getUser());
}
      `)
      .addFile('src/utils/index.ts', `
export const utils = {
  formatUser: (user: any) => \`Hello \${user.name}\`
};
      `)
      .addFile('src/services/user.service.ts', `
export class UserService {
  getUser() {
    return { name: 'John', id: 1 };
  }
}
      `)
      .addFile('src/types/user.types.ts', `
export interface User {
  id: number;
  name: string;
}
      `);
  }

  /**
   * Add test files
   */
  addTestFiles(): this {
    return this
      .addFile('src/index.test.ts', `
import { describe, it, expect } from 'vitest';
import { main } from './index.js';

describe('main', () => {
  it('should work', () => {
    expect(main()).toContain('Hello');
  });
});
      `)
      .addFile('src/utils/index.test.ts', `
import { describe, it, expect } from 'vitest';
import { utils } from './index.js';

describe('utils', () => {
  it('should format user', () => {
    expect(utils.formatUser({ name: 'Test' })).toBe('Hello Test');
  });
});
      `);
  }

  /**
   * Build the project structure on disk
   */
  build(): string {
    for (const [relativePath, content] of this.files) {
      const fullPath = path.join(this.tempDir, relativePath);
      const dir = path.dirname(fullPath);
      
      // Ensure directory exists
      fs.mkdirSync(dir, { recursive: true });
      
      // Write file
      fs.writeFileSync(fullPath, content.trim());
    }
    
    return this.tempDir;
  }

  /**
   * Clean up the temporary directory
   */
  cleanup(): void {
    if (fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    }
  }

  /**
   * Get the temp directory path
   */
  getPath(): string {
    return this.tempDir;
  }
}

// Helper to run CLI commands and capture output
function runCLI(args: string[], cwd: string): { 
  stdout: string; 
  stderr: string; 
  exitCode: number; 
  indexPath: string;
} {
  const cliPath = path.resolve(__dirname, '../dist/cli.js');
  const indexPath = path.join(cwd, '.codebasemap');
  
  try {
    const result = execSync(`node "${cliPath}" ${args.join(' ')}`, {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    
    return {
      stdout: result.toString(),
      stderr: '',
      exitCode: 0,
      indexPath
    };
  } catch (error: unknown) {
    const execError = error as { stdout?: Buffer; stderr?: Buffer; status?: number };
    return {
      stdout: execError.stdout?.toString() || '',
      stderr: execError.stderr?.toString() || '',
      exitCode: execError.status || 1,
      indexPath
    };
  }
}

// Helper to load and validate index file
function loadIndex(indexPath: string): ProjectIndex {
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Index file not found: ${indexPath}`);
  }
  
  const content = fs.readFileSync(indexPath, 'utf-8');
  return JSON.parse(content);
}

describe('CLI Integration Tests', () => {
  let testProject: TestProjectBuilder;
  let projectPath: string;

  beforeEach(() => {
    testProject = new TestProjectBuilder();
  });

  afterEach(() => {
    if (testProject) {
      testProject.cleanup();
    }
  });

  describe('End-to-End CLI Workflows', () => {
    it('should complete basic scan workflow without patterns', () => {
      projectPath = testProject
        .addTypescriptProject()
        .addTestFiles()
        .build();

      const result = runCLI(['scan'], projectPath);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Scan completed successfully');
      expect(fs.existsSync(result.indexPath)).toBe(true);
      
      const index = loadIndex(result.indexPath);
      expect(index.nodes).toHaveLength(4); // All .ts files
      expect(index.metadata.totalFiles).toBe(4);
    });

    it('should complete scan workflow with include patterns', () => {
      projectPath = testProject
        .addTypescriptProject()
        .addTestFiles()
        .build();

      const result = runCLI(['scan', '--include', 'src/**/*.ts', '--verbose'], projectPath);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Pattern effectiveness');
      expect(result.stdout).toContain('Scan completed successfully');
      
      const index = loadIndex(result.indexPath);
      // Should only include TypeScript files in src/
      const srcFiles = index.nodes.filter(file => file.startsWith('src/') && file.endsWith('.ts'));
      expect(srcFiles.length).toBeGreaterThan(0);
      expect(index.nodes.every(file => file.startsWith('src/') && file.endsWith('.ts'))).toBe(true);
    });

    it('should complete scan workflow with exclude patterns', () => {
      projectPath = testProject
        .addTypescriptProject()
        .addTestFiles()
        .build();

      const result = runCLI(['scan', '--exclude', '**/*.test.*'], projectPath);
      
      expect(result.exitCode).toBe(0);
      const index = loadIndex(result.indexPath);
      
      // Should exclude test files
      expect(index.nodes.some(file => file.includes('.test.'))).toBe(false);
      expect(index.nodes.length).toBe(2); // Only non-test files
    });
  });
});

export { TestProjectBuilder, runCLI, loadIndex };