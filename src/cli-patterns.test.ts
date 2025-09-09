/**
 * Tests for CLI scan command pattern functionality
 * Tests the actual pattern matching behavior for include/exclude flags
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ProjectIndex } from './types/index.js';

const execAsync = promisify(exec);

// Create a test project structure for pattern testing
function createTestProject(baseDir: string): void {
  const structure = {
    'src/index.ts': 'export const main = () => {}',
    'src/utils.ts': 'export const helper = () => {}', 
    'lib/core.ts': 'export class Core {}',
    'examples/basic.ts': 'const example = 1',
    'examples/advanced.ts': 'const advanced = 2',
    'test/index.test.ts': 'import { main } from "../src/index"',
    'docs/readme.md': '# Documentation',
    'package.json': '{"name": "test-project", "type": "module"}'
  };

  Object.entries(structure).forEach(([filePath, content]) => {
    const fullPath = path.join(baseDir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  });
}

function cleanup(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function parseIndex(indexPath: string): ProjectIndex {
  const content = fs.readFileSync(indexPath, 'utf8');
  return JSON.parse(content) as ProjectIndex;
}

describe('CLI scan command patterns', () => {
  let testDir: string;
  let cliPath: string;

  beforeEach(() => {
    testDir = path.join(process.cwd(), 'temp', `test-${Date.now()}`);
    cliPath = path.join(process.cwd(), 'dist', 'cli.js');
    
    fs.mkdirSync(testDir, { recursive: true });
    createTestProject(testDir);
  });

  afterEach(() => {
    cleanup(testDir);
  });

  describe('include patterns', () => {
    it('should include files matching src/** pattern', async () => {
      const { stdout } = await execAsync(`node ${cliPath} scan --include "src/**"`, { 
        cwd: testDir 
      });
      
      expect(stdout).toContain('Scan completed successfully');
      
      const index = parseIndex(path.join(testDir, '.codebasemap'));
      expect(index.nodes).toEqual(
        expect.arrayContaining(['src/index.ts', 'src/utils.ts'])
      );
      expect(index.nodes).not.toContain('lib/core.ts');
      expect(index.nodes).not.toContain('examples/basic.ts');
    });

    it('should include files matching examples/** pattern', async () => {
      const { stdout } = await execAsync(`node ${cliPath} scan --include "examples/**"`, { 
        cwd: testDir 
      });
      
      expect(stdout).toContain('Scan completed successfully');
      
      const index = parseIndex(path.join(testDir, '.codebasemap'));
      expect(index.nodes).toEqual(
        expect.arrayContaining(['examples/basic.ts', 'examples/advanced.ts'])
      );
      expect(index.nodes).not.toContain('src/index.ts');
    });

    it('should handle multiple include patterns', async () => {
      const { stdout } = await execAsync(
        `node ${cliPath} scan --include "src/**" --include "lib/**"`, 
        { cwd: testDir }
      );
      
      expect(stdout).toContain('Scan completed successfully');
      
      const index = parseIndex(path.join(testDir, '.codebasemap'));
      expect(index.nodes).toEqual(
        expect.arrayContaining(['src/index.ts', 'src/utils.ts', 'lib/core.ts'])
      );
      expect(index.nodes).not.toContain('examples/basic.ts');
    });

    it('should automatically normalize directory patterns like "examples" to "examples/**"', async () => {
      // This tests that bare directory names are normalized to work correctly
      const { stdout } = await execAsync(`node ${cliPath} scan --include "examples"`, { 
        cwd: testDir 
      });
      
      expect(stdout).toContain('Scan completed successfully');
      
      const index = parseIndex(path.join(testDir, '.codebasemap'));
      expect(index.nodes).toEqual(
        expect.arrayContaining(['examples/basic.ts', 'examples/advanced.ts'])
      );
      expect(index.nodes).not.toContain('src/index.ts');
    });

    it('should handle file extension patterns', async () => {
      const { stdout } = await execAsync(
        `node ${cliPath} scan --include "**/*.ts"`, 
        { cwd: testDir }
      );
      
      expect(stdout).toContain('Scan completed successfully');
      
      const index = parseIndex(path.join(testDir, '.codebasemap'));
      expect(index.nodes.every((file: string) => file.endsWith('.ts'))).toBe(true);
      expect(index.nodes).not.toContain('docs/readme.md');
    });
  });

  describe('exclude patterns', () => {
    it('should exclude test files', async () => {
      const { stdout } = await execAsync(
        `node ${cliPath} scan --exclude "**/*.test.ts"`, 
        { cwd: testDir }
      );
      
      expect(stdout).toContain('Scan completed successfully');
      
      const index = parseIndex(path.join(testDir, '.codebasemap'));
      expect(index.nodes).toEqual(
        expect.arrayContaining(['src/index.ts', 'src/utils.ts', 'lib/core.ts'])
      );
      expect(index.nodes).not.toContain('test/index.test.ts');
    });

    it('should exclude specific directories', async () => {
      const { stdout } = await execAsync(
        `node ${cliPath} scan --exclude "examples/**"`, 
        { cwd: testDir }
      );
      
      expect(stdout).toContain('Scan completed successfully');
      
      const index = parseIndex(path.join(testDir, '.codebasemap'));
      expect(index.nodes).toEqual(
        expect.arrayContaining(['src/index.ts', 'src/utils.ts', 'lib/core.ts'])
      );
      expect(index.nodes).not.toContain('examples/basic.ts');
      expect(index.nodes).not.toContain('examples/advanced.ts');
    });

    it('should handle multiple exclude patterns', async () => {
      const { stdout } = await execAsync(
        `node ${cliPath} scan --exclude "**/*.test.ts" --exclude "examples/**"`, 
        { cwd: testDir }
      );
      
      expect(stdout).toContain('Scan completed successfully');
      
      const index = parseIndex(path.join(testDir, '.codebasemap'));
      expect(index.nodes).toEqual(
        expect.arrayContaining(['src/index.ts', 'src/utils.ts', 'lib/core.ts'])
      );
      expect(index.nodes).not.toContain('test/index.test.ts');
      expect(index.nodes).not.toContain('examples/basic.ts');
    });
  });

  describe('combined patterns', () => {
    it('should handle both include and exclude patterns', async () => {
      const { stdout } = await execAsync(
        `node ${cliPath} scan --include "src/**" --exclude "**/*.test.ts"`, 
        { cwd: testDir }
      );
      
      expect(stdout).toContain('Scan completed successfully');
      
      const index = parseIndex(path.join(testDir, '.codebasemap'));
      expect(index.nodes).toEqual(['src/index.ts', 'src/utils.ts']);
    });

    it('should fail when include and exclude conflict', async () => {
      await expect(
        execAsync(
          `node ${cliPath} scan --include "src/**" --exclude "src/**"`, 
          { cwd: testDir }
        )
      ).rejects.toThrow(/No files found matching your patterns/);
    });
  });

  describe('edge cases', () => {
    it('should handle patterns with no matches', async () => {
      await expect(
        execAsync(`node ${cliPath} scan --include "nonexistent/**"`, { cwd: testDir })
      ).rejects.toThrow(/No files found matching your patterns/);
    });

    it('should work when no patterns are specified', async () => {
      const { stdout } = await execAsync(`node ${cliPath} scan`, { cwd: testDir });
      
      expect(stdout).toContain('Scan completed successfully');
      
      const index = parseIndex(path.join(testDir, '.codebasemap'));
      expect(index.nodes.length).toBeGreaterThan(0);
      // Should include all TypeScript files by default
      expect(index.nodes).toEqual(
        expect.arrayContaining([
          'src/index.ts',
          'src/utils.ts', 
          'lib/core.ts',
          'examples/basic.ts',
          'examples/advanced.ts',
          'test/index.test.ts'
        ])
      );
    });
  });

  describe('verbose mode with patterns', () => {
    it('should show pattern analysis in verbose mode', async () => {
      const { stdout } = await execAsync(
        `node ${cliPath} scan --include "src/**" --verbose`, 
        { cwd: testDir }
      );
      
      expect(stdout).toContain('Analyzing patterns');
      expect(stdout).toContain('Pattern effectiveness');
      expect(stdout).toContain('Total candidate files');
      expect(stdout).toContain('Files after include');
      expect(stdout).toContain('Files after exclude');
    });
  });
});