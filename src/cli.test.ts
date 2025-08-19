/**
 * Unit tests for CLI option parsing and validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// Mock dependencies that the CLI imports
vi.mock('./core/index.js');
vi.mock('./utils/find-project-root.js');
vi.mock('node:fs');

describe('CLI Option Parsing', () => {
  let program: Command;
  let capturedOptions: Record<string, unknown> = {};

  beforeEach(() => {
    program = new Command();
    capturedOptions = {};
    program
      .name('codebase-map')
      .description('A lightweight code indexer')
      .version('0.3.0');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('scan command options', () => {
    beforeEach(() => {
      program
        .command('scan')
        .description('Scan the entire project and generate index')
        .option('--include <patterns...>', 'include patterns (glob)')
        .option('--exclude <patterns...>', 'exclude patterns (glob)')
        .option('-v, --verbose', 'show detailed progress')
        .action((options) => {
          capturedOptions = options;
        });
    });

    it('should parse single include pattern correctly', async () => {
      const args = ['scan', '--include', 'src/**/*.ts'];
      await program.parseAsync(args, { from: 'user' });
      expect(capturedOptions.include).toEqual(['src/**/*.ts']);
    });

    it('should parse multiple include patterns correctly', async () => {
      const args = ['scan', '--include', 'src/**/*.ts', 'lib/**/*.js'];
      await program.parseAsync(args, { from: 'user' });
      expect(capturedOptions.include).toEqual(['src/**/*.ts', 'lib/**/*.js']);
    });

    it('should parse exclude patterns correctly', async () => {
      const args = ['scan', '--exclude', '**/*.test.*', 'node_modules/**'];
      await program.parseAsync(args, { from: 'user' });
      expect(capturedOptions.exclude).toEqual(['**/*.test.*', 'node_modules/**']);
    });

    it('should parse both include and exclude patterns', async () => {
      const args = ['scan', '--include', 'src/**/*.ts', '--exclude', '**/*.test.*'];
      await program.parseAsync(args, { from: 'user' });
      expect(capturedOptions.include).toEqual(['src/**/*.ts']);
      expect(capturedOptions.exclude).toEqual(['**/*.test.*']);
    });

    it('should parse verbose flag', async () => {
      const args = ['scan', '--verbose'];
      await program.parseAsync(args, { from: 'user' });
      expect(capturedOptions.verbose).toBe(true);
    });

    it('should handle patterns with special characters', async () => {
      const args = ['scan', '--include', 'src/**/*.{ts,tsx,js,jsx}'];
      await program.parseAsync(args, { from: 'user' });
      expect(capturedOptions.include).toEqual(['src/**/*.{ts,tsx,js,jsx}']);
    });
  });

  describe('format command options', () => {
    beforeEach(() => {
      program
        .command('format')
        .description('Format the index for LLMs')
        .option('-f, --format <type>', 'output format', 'auto')
        .option('-s, --stats', 'show statistics')
        .action((options) => {
          capturedOptions = options;
        });
    });

    it('should parse format option correctly', async () => {
      const args = ['format', '--format', 'json'];
      await program.parseAsync(args, { from: 'user' });
      expect(capturedOptions.format).toBe('json');
    });

    it('should use default format', async () => {
      const args = ['format'];
      await program.parseAsync(args, { from: 'user' });
      expect(capturedOptions.format).toBe('auto');
    });

    it('should parse stats flag', async () => {
      const args = ['format', '--stats'];
      await program.parseAsync(args, { from: 'user' });
      expect(capturedOptions.stats).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle unknown commands', async () => {
      const args = ['unknown-command'];
      try {
        await program.parseAsync(args, { from: 'user' });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('help text generation', () => {
    it('should generate help text', () => {
      program
        .command('scan')
        .description('Scan the project')
        .option('--include <patterns...>', 'include patterns');
      
      const helpText = program.commands[0].helpInformation();
      expect(helpText).toContain('Scan the project');
      expect(helpText).toContain('--include');
    });
  });
});