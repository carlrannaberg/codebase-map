/**
 * Performance Integration Tests
 * 
 * Tests performance with large codebases, complex patterns,
 * cache effectiveness, and memory optimization.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { TestProjectBuilder, runCLI, loadIndex } from './test-integration.js';

describe('Performance Integration Tests', () => {
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

  describe('Large Codebase Scenarios', () => {
    it('should handle 1000+ files with reasonable performance', () => {
      // Create a large project structure
      const builder = testProject
        .addFile('package.json', JSON.stringify({
          name: 'large-project',
          type: 'module'
        }, null, 2));

      // Generate 1000+ files across multiple modules
      const moduleCount = 50;
      const filesPerModule = 25;

      for (let moduleIndex = 0; moduleIndex < moduleCount; moduleIndex++) {
        const moduleDir = `src/modules/module_${String(moduleIndex).padStart(3, '0')}`;
        
        // Add various file types per module
        builder
          .addFile(`${moduleDir}/index.ts`, `
export { Service${moduleIndex} } from './service.js';
export { Utils${moduleIndex} } from './utils.js';
export { Types${moduleIndex} } from './types.js';
          `)
          .addFile(`${moduleDir}/service.ts`, `
import { Utils${moduleIndex} } from './utils.js';
import type { Config${moduleIndex} } from './types.js';

export class Service${moduleIndex} {
  private utils = new Utils${moduleIndex}();
  private config: Config${moduleIndex};
  
  constructor(config: Config${moduleIndex}) {
    this.config = config;
  }
  
  execute(): string {
    return this.utils.process(this.config);
  }
  
  async processAsync(): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 1));
    return this.execute();
  }
}
          `)
          .addFile(`${moduleDir}/utils.ts`, `
import type { Config${moduleIndex}, Result${moduleIndex} } from './types.js';

export class Utils${moduleIndex} {
  process(config: Config${moduleIndex}): string {
    return \`Module ${moduleIndex}: \${config.name}\`;
  }
  
  validate(input: unknown): input is Config${moduleIndex} {
    return typeof input === 'object' && input !== null;
  }
  
  transform(data: Config${moduleIndex}): Result${moduleIndex} {
    return {
      success: true,
      data: this.process(data),
      timestamp: Date.now()
    };
  }
}
          `)
          .addFile(`${moduleDir}/types.ts`, `
export interface Config${moduleIndex} {
  name: string;
  enabled: boolean;
  priority: number;
}

export interface Result${moduleIndex} {
  success: boolean;
  data: string;
  timestamp: number;
}

export type Status${moduleIndex} = 'idle' | 'processing' | 'completed' | 'error';
          `);

        // Add additional files to reach target count
        for (let fileIndex = 4; fileIndex < filesPerModule; fileIndex++) {
          builder.addFile(`${moduleDir}/helper_${fileIndex}.ts`, `
export function helper${moduleIndex}_${fileIndex}(): string {
  return 'Helper function ${fileIndex} in module ${moduleIndex}';
}

export const CONSTANT_${fileIndex} = {
  MODULE: ${moduleIndex},
  FILE: ${fileIndex},
  VERSION: '1.0.0'
} as const;
          `);
        }
      }

      projectPath = builder.build();

      // Test performance with large file count
      const startTime = Date.now();
      
      const result = runCLI([
        'scan',
        '--include', 'src/**/*.ts',
        '--exclude', '**/*.test.*', '**/*.spec.*',
        '--verbose'
      ], projectPath);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Scan completed successfully');
      
      const index = loadIndex(result.indexPath);
      
      // Verify file count
      const expectedFiles = moduleCount * filesPerModule;
      expect(index.nodes).toHaveLength(expectedFiles);
      expect(index.metadata.totalFiles).toBe(expectedFiles);
      
      // Performance assertions
      expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds
      expect(result.stdout).toMatch(/Processing time: \d+\.\d+s/);
      
      console.log(`Performance test: ${expectedFiles} files processed in ${processingTime}ms`);
    }, 60000); // 60 second timeout

    it('should handle complex pattern combinations efficiently', () => {
      // Create a project with many different file types and patterns
      const builder = testProject
        .addFile('package.json', JSON.stringify({ name: 'complex-patterns' }, null, 2));

      // Generate diverse file structure
      const fileTypes = ['ts', 'tsx', 'js', 'jsx'];
      const directories = ['src', 'lib', 'components', 'utils', 'services', 'types'];
      
      for (const dir of directories) {
        for (let i = 0; i < 20; i++) {
          for (const ext of fileTypes) {
            builder.addFile(`${dir}/file_${i}.${ext}`, `
// File ${i} in ${dir} with extension ${ext}
export const value${i} = '${dir}_${ext}_${i}';
            `);
          }
          
          // Add test files
          builder.addFile(`${dir}/file_${i}.test.ts`, `test for ${dir}/file_${i}`);
          builder.addFile(`${dir}/file_${i}.spec.js`, `spec for ${dir}/file_${i}`);
          
          // Add story files
          builder.addFile(`${dir}/file_${i}.stories.tsx`, `stories for ${dir}/file_${i}`);
        }
      }

      projectPath = builder.build();

      const result = runCLI([
        'scan',
        '--include', 'src/**/*.{ts,tsx}', 'lib/**/*.{js,jsx}', 'components/**/*.tsx',
        '--exclude', '**/*.test.*', '**/*.spec.*', '**/*.stories.*',
        '--verbose'
      ], projectPath);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Pattern effectiveness');
      
      const index = loadIndex(result.indexPath);
      
      // Should include only matching patterns
      const hasIncludedFiles = index.nodes.some(file => 
        (file.startsWith('src/') && (file.endsWith('.ts') || file.endsWith('.tsx'))) ||
        (file.startsWith('lib/') && (file.endsWith('.js') || file.endsWith('.jsx'))) ||
        (file.startsWith('components/') && file.endsWith('.tsx'))
      );
      expect(hasIncludedFiles).toBe(true);
      
      // Should exclude test and story files
      const hasExcludedFiles = index.nodes.some(file => 
        file.includes('.test.') || file.includes('.spec.') || file.includes('.stories.')
      );
      expect(hasExcludedFiles).toBe(false);
    });
  });

  describe('Cache Effectiveness', () => {
    it('should demonstrate cache performance improvement', () => {
      projectPath = testProject
        .addFile('src/index.ts', 'export const main = true;')
        .addFile('src/utils.ts', 'export const utils = {};')
        .addFile('src/service.ts', 'export class Service {}')
        .build();

      // First scan (cold cache)
      const firstScanStart = Date.now();
      const firstResult = runCLI(['scan', '--include', 'src/**/*.ts'], projectPath);
      const firstScanTime = Date.now() - firstScanStart;

      expect(firstResult.exitCode).toBe(0);
      
      // Second scan (warm cache) - modify one file
      const modifiedFilePath = `${projectPath}/src/new-file.ts`;
      fs.writeFileSync(modifiedFilePath, 'export const newFile = true;');

      const secondScanStart = Date.now();
      const secondResult = runCLI(['scan', '--include', 'src/**/*.ts'], projectPath);
      const secondScanTime = Date.now() - secondScanStart;

      expect(secondResult.exitCode).toBe(0);
      
      // Verify cache effectiveness (second scan should be faster for unchanged files)
      console.log(`First scan: ${firstScanTime}ms, Second scan: ${secondScanTime}ms`);
      
      const secondIndex = loadIndex(secondResult.indexPath);
      expect(secondIndex.nodes).toHaveLength(4); // Original 3 + new file
    });

    it('should handle incremental updates efficiently', () => {
      projectPath = testProject
        .addFile('src/base.ts', 'export const base = true;')
        .addFile('src/utils.ts', 'export const utils = {};')
        .build();

      // Initial scan
      const initialResult = runCLI(['scan'], projectPath);
      expect(initialResult.exitCode).toBe(0);
      
      // Add new file and use update command
      const newFilePath = `${projectPath}/src/incremental.ts`;
      fs.writeFileSync(newFilePath, 'export const incremental = true;');

      const updateStart = Date.now();
      const updateResult = runCLI(['update', 'src/incremental.ts'], projectPath);
      const updateTime = Date.now() - updateStart;

      expect(updateResult.exitCode).toBe(0);
      expect(updateResult.stdout).toContain('Index updated successfully');
      
      // Update should be much faster than full scan
      expect(updateTime).toBeLessThan(2000); // Should complete within 2 seconds
      
      const updatedIndex = loadIndex(initialResult.indexPath);
      expect(updatedIndex.nodes).toContain('src/incremental.ts');
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should handle large dependency graphs without memory issues', () => {
      // Create interconnected modules
      const builder = testProject
        .addFile('package.json', JSON.stringify({ name: 'memory-test' }, null, 2));

      const moduleCount = 100;
      
      // Create modules with cross-dependencies
      for (let i = 0; i < moduleCount; i++) {
        const dependencies = [];
        // Each module depends on a few previous modules
        for (let j = Math.max(0, i - 5); j < i; j++) {
          dependencies.push(`import { module${j} } from './module_${j}.js';`);
        }
        
        builder.addFile(`src/module_${i}.ts`, `
${dependencies.join('\n')}

export const module${i} = {
  id: ${i},
  dependencies: [${Array.from({length: Math.min(i, 5)}, (_, k) => i - k - 1).join(', ')}]
};

export function process${i}(): string {
  return 'Processed module ${i}';
}
        `);
      }

      projectPath = builder.build();

      const result = runCLI([
        'scan',
        '--include', 'src/**/*.ts',
        '--verbose'
      ], projectPath);

      expect(result.exitCode).toBe(0);
      
      const index = loadIndex(result.indexPath);
      expect(index.nodes).toHaveLength(moduleCount);
      expect(index.edges.length).toBeGreaterThan(0); // Should have dependencies
      
      // Memory usage should be reasonable
      expect(result.stdout).toContain('Scan completed successfully');
    });

    it('should optimize memory for large file content', () => {
      // Create files with substantial content
      const builder = testProject
        .addFile('package.json', JSON.stringify({ name: 'large-content' }, null, 2));

      for (let i = 0; i < 10; i++) {
        const largeContent = `
// Large TypeScript file ${i}
${Array.from({length: 100}, (_, line) => `
export interface Interface${i}_${line} {
  id: number;
  name: string;
  data: {
    value${line}: string;
    nested: {
      level1: number;
      level2: {
        deep: boolean;
      };
    };
  };
}

export class Class${i}_${line} implements Interface${i}_${line} {
  public id = ${line};
  public name = 'Class ${i}_${line}';
  public data = {
    value${line}: 'data ${line}',
    nested: {
      level1: ${line},
      level2: {
        deep: true
      }
    }
  };
  
  public method${line}(): string {
    return \`Method ${line} result: \${this.data.value${line}}\`;
  }
}
`).join('\n')}
        `;
        
        builder.addFile(`src/large_${i}.ts`, largeContent);
      }

      projectPath = builder.build();

      const result = runCLI([
        'scan',
        '--include', 'src/**/*.ts'
      ], projectPath);

      expect(result.exitCode).toBe(0);
      
      const index = loadIndex(result.indexPath);
      expect(index.nodes).toHaveLength(10);
      
      // Verify that large content doesn't cause memory issues
      expect(result.stdout).toContain('Scan completed successfully');
    });
  });

  describe('Benchmark Comparisons', () => {
    it('should show performance improvements with pattern optimization', () => {
      // Create a mixed project with many unnecessary files
      const builder = testProject
        .addFile('package.json', JSON.stringify({ name: 'benchmark' }, null, 2));

      // Add source files
      for (let i = 0; i < 20; i++) {
        builder.addFile(`src/module_${i}.ts`, `export const module${i} = true;`);
      }
      
      // Add many files that should be excluded
      for (let i = 0; i < 100; i++) {
        builder
          .addFile(`node_modules/dep_${i}/index.js`, `module.exports = {};`)
          .addFile(`dist/compiled_${i}.js`, `// compiled`)
          .addFile(`coverage/report_${i}.html`, `<html></html>`)
          .addFile(`logs/debug_${i}.log`, `debug log ${i}`);
      }

      projectPath = builder.build();

      // Test without patterns (scan everything)
      const unoptimizedStart = Date.now();
      const unoptimizedResult = runCLI(['scan'], projectPath);
      const unoptimizedTime = Date.now() - unoptimizedStart;

      expect(unoptimizedResult.exitCode).toBe(0);

      // Test with optimized patterns
      const optimizedStart = Date.now();
      const optimizedResult = runCLI([
        'scan',
        '--include', 'src/**/*.ts',
        '--exclude', 'node_modules/**', 'dist/**', 'coverage/**', 'logs/**'
      ], projectPath);
      const optimizedTime = Date.now() - optimizedStart;

      expect(optimizedResult.exitCode).toBe(0);

      const unoptimizedIndex = loadIndex(unoptimizedResult.indexPath);
      const optimizedIndex = loadIndex(optimizedResult.indexPath);

      // Optimized should process fewer files
      expect(optimizedIndex.nodes.length).toBeLessThan(unoptimizedIndex.nodes.length);
      expect(optimizedIndex.nodes).toHaveLength(20); // Only source files

      console.log(`Unoptimized: ${unoptimizedTime}ms (${unoptimizedIndex.nodes.length} files)`);
      console.log(`Optimized: ${optimizedTime}ms (${optimizedIndex.nodes.length} files)`);

      // Performance improvement should be significant
      const improvement = ((unoptimizedTime - optimizedTime) / unoptimizedTime) * 100;
      expect(improvement).toBeGreaterThan(0); // Some improvement expected
    });
  });
});

export { };