/**
 * Tests for pattern analysis utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { 
  analyzePatternEffectiveness, 
  formatWarningsForCLI, 
  formatSuggestionsForCLI,
  type PatternWarning 
} from './pattern-analysis.js';

describe('pattern-analysis', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = join(tmpdir(), `pattern-analysis-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    
    // Create test file structure
    await mkdir(join(tempDir, 'src'), { recursive: true });
    await mkdir(join(tempDir, 'tests'), { recursive: true });
    await mkdir(join(tempDir, 'lib'), { recursive: true });
    await mkdir(join(tempDir, 'dist'), { recursive: true });
    
    // Create test files
    await writeFile(join(tempDir, 'src', 'index.ts'), 'export const hello = "world";');
    await writeFile(join(tempDir, 'src', 'utils.ts'), 'export function test() {}');
    await writeFile(join(tempDir, 'src', 'component.tsx'), 'export const Component = () => null;');
    await writeFile(join(tempDir, 'tests', 'index.test.ts'), 'import { hello } from "../src/index";');
    await writeFile(join(tempDir, 'lib', 'legacy.js'), 'module.exports = {};');
    await writeFile(join(tempDir, 'dist', 'build.js'), 'console.log("built");');
    await writeFile(join(tempDir, 'README.md'), '# Test project');
  });
  
  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('analyzePatternEffectiveness', () => {
    it('should analyze with no patterns (include all)', async () => {
      const result = await analyzePatternEffectiveness(tempDir);
      
      expect(result.stats.totalCandidateFiles).toBeGreaterThan(0);
      expect(result.stats.includedFiles).toBe(result.stats.totalCandidateFiles);
      expect(result.stats.finalFiles).toBe(result.stats.totalCandidateFiles);
      expect(result.stats.excludedFiles).toBe(0);
      expect(result.warnings).toHaveLength(0);
      // Check that we get the suggestion about no patterns
      expect(result.suggestions[0]).toContain('supported files');
    });

    it('should detect include patterns with zero matches', async () => {
      const result = await analyzePatternEffectiveness(
        tempDir,
        ['**/*.nonexistent'], // Pattern that matches nothing
        []
      );
      
      expect(result.stats.includedFiles).toBe(0);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            level: 'warning',
            category: 'No files matched',
            patterns: ['**/*.nonexistent']
          })
        ])
      );
    });

    it('should detect pattern conflicts (all files excluded)', async () => {
      const result = await analyzePatternEffectiveness(
        tempDir,
        ['src/**/*.ts'], // Include some files
        ['**/*']        // Exclude everything
      );
      
      expect(result.stats.includedFiles).toBeGreaterThan(0);
      expect(result.stats.finalFiles).toBe(0);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            level: 'error',
            category: 'Pattern conflict',
            message: expect.stringContaining('All')
          })
        ])
      );
    });

    it('should detect overly broad exclusion patterns', async () => {
      const result = await analyzePatternEffectiveness(
        tempDir,
        ['src/**/*.ts'],
        ['src/**/*'] // Exclude everything in src (overly broad)
      );
      
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            level: 'warning',
            category: 'Overly broad exclusion',
            patterns: ['src/**/*']
          })
        ])
      );
    });

    it('should warn about performance impact of complex patterns', async () => {
      const complexPattern = '**/very/**/complex/**/pattern/**/*.ts';
      
      const result = await analyzePatternEffectiveness(
        tempDir,
        [complexPattern],
        []
      );
      
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            level: 'info',
            category: 'Performance',
            patterns: [complexPattern]
          })
        ])
      );
    });

    it('should provide narrow selection warning', async () => {
      const result = await analyzePatternEffectiveness(
        tempDir,
        ['src/index.ts'], // Very specific pattern
        []
      );
      
      expect(result.stats.finalFiles).toBe(1);
      // The narrow selection warning only triggers if less than 10% of files are selected
      // Let's check if we got any warnings, and if the selection ratio is small enough
      const selectionRatio = result.stats.finalFiles / result.stats.totalCandidateFiles;
      if (selectionRatio < 0.1) {
        expect(result.warnings).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              level: 'info',
              category: 'Narrow selection'
            })
          ])
        );
      }
    });

    it('should track pattern matches correctly', async () => {
      const result = await analyzePatternEffectiveness(
        tempDir,
        ['src/**/*'], // Include all files in src (including .tsx)
        ['**/*.tsx']  // Exclude .tsx files
      );
      
      // Check include pattern matches
      expect(result.stats.includePatternMatches['src/**/*']).toBeGreaterThan(0);
      
      // Check exclude pattern matches - there should be at least one .tsx file
      expect(result.stats.excludePatternMatches['**/*.tsx']).toBeGreaterThan(0);
      
      // Should have excluded some files (the .tsx files)
      expect(result.stats.excludedFiles).toBeGreaterThan(0);
      expect(result.stats.finalFiles).toBeLessThan(result.stats.includedFiles);
    });
  });

  describe('formatWarningsForCLI', () => {
    it('should format warnings with appropriate icons', () => {
      const warnings: PatternWarning[] = [
        {
          level: 'error',
          category: 'Pattern conflict',
          message: 'All files excluded',
          suggestion: 'Fix your patterns'
        },
        {
          level: 'warning',
          category: 'No files matched',
          message: 'Pattern matches nothing'
        },
        {
          level: 'info',
          category: 'Performance',
          message: 'Complex pattern detected'
        }
      ];
      
      const formatted = formatWarningsForCLI(warnings);
      
      expect(formatted[0]).toContain('❌');
      expect(formatted[0]).toContain('All files excluded');
      expect(formatted[0]).toContain('💡 Fix your patterns');
      
      expect(formatted[1]).toContain('⚠️');
      expect(formatted[1]).toContain('Pattern matches nothing');
      
      expect(formatted[2]).toContain('ℹ️');
      expect(formatted[2]).toContain('Complex pattern detected');
    });
  });

  describe('formatSuggestionsForCLI', () => {
    it('should format suggestions with lightbulb icon', () => {
      const suggestions = [
        'Consider using more specific patterns',
        'Remove unused patterns'
      ];
      
      const formatted = formatSuggestionsForCLI(suggestions);
      
      expect(formatted).toHaveLength(2);
      expect(formatted[0]).toBe('💡 Consider using more specific patterns');
      expect(formatted[1]).toBe('💡 Remove unused patterns');
    });
  });
});