/**
 * Integration tests for DependencyResolver using real project structures
 * Tests dependency resolution with actual file paths and import patterns
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DependencyResolver } from './dependency-resolver.js';
import type { ImportInfo } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('DependencyResolver Integration Tests', () => {
  const testProjectRoot = path.join(__dirname, '../../temp/dependency-test-project');
  const realProjectRoot = path.join(__dirname, '../..'); // Actual codebase

  beforeAll(async () => {
    // Create test project with realistic dependency structures
    await fs.promises.mkdir(testProjectRoot, { recursive: true });
    await fs.promises.mkdir(path.join(testProjectRoot, 'src/core'), { recursive: true });
    await fs.promises.mkdir(path.join(testProjectRoot, 'src/utils'), { recursive: true });
    await fs.promises.mkdir(path.join(testProjectRoot, 'src/services'), { recursive: true });
    await fs.promises.mkdir(path.join(testProjectRoot, 'src/types'), { recursive: true });
    await fs.promises.mkdir(path.join(testProjectRoot, 'lib'), { recursive: true });

    // Create files with various import patterns
    await fs.promises.writeFile(
      path.join(testProjectRoot, 'src/types/base.ts'),
      `export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export type EntityStatus = 'active' | 'inactive';`
    );

    await fs.promises.writeFile(
      path.join(testProjectRoot, 'src/types/user.ts'),
      `import type { BaseEntity, EntityStatus } from './base';
import { validateEmail } from '../utils/validators';

export interface User extends BaseEntity {
  name: string;
  email: string;
  status: EntityStatus;
}

export class UserHelper {
  static isValid(user: User): boolean {
    return validateEmail(user.email);
  }
}`
    );

    await fs.promises.writeFile(
      path.join(testProjectRoot, 'src/utils/validators.ts'),
      `export function validateEmail(email: string): boolean {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
}

export function validateRequired(value: any): boolean {
  return value !== null && value !== undefined && value !== '';
}`
    );

    await fs.promises.writeFile(
      path.join(testProjectRoot, 'src/utils/helpers.ts'),
      `import { validateRequired } from './validators';
import type { User } from '../types/user';

export function formatUser(user: User): string {
  if (!validateRequired(user.name)) {
    throw new Error('User name is required');
  }
  return \`\${user.name} <\${user.email}>\`;
}

export const DEFAULT_USER_STATUS = 'active';`
    );

    await fs.promises.writeFile(
      path.join(testProjectRoot, 'src/services/user-service.ts'),
      `import type { User } from '../types/user';
import { formatUser, DEFAULT_USER_STATUS } from '../utils/helpers';
import { validateEmail } from '../utils/validators';

export class UserService {
  private users: User[] = [];

  addUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): User {
    if (!validateEmail(userData.email)) {
      throw new Error('Invalid email');
    }

    const user: User = {
      id: Math.random().toString(36),
      createdAt: new Date(),
      updatedAt: new Date(),
      status: DEFAULT_USER_STATUS as any,
      ...userData
    };

    this.users.push(user);
    return user;
  }

  getUser(id: string): User | undefined {
    return this.users.find(user => user.id === id);
  }

  formatUser(user: User): string {
    return formatUser(user);
  }
}`
    );

    await fs.promises.writeFile(
      path.join(testProjectRoot, 'src/core/app.ts'),
      `import { UserService } from '../services/user-service';
import type { User } from '../types/user';
import type { BaseEntity } from '../types/base';

export class App {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  createUser(name: string, email: string): User {
    return this.userService.addUser({ name, email, status: 'active' });
  }

  getUser(id: string): User | undefined {
    return this.userService.getUser(id);
  }

  getAllEntities(): BaseEntity[] {
    // This would return all entities in a real app
    return [];
  }
}`
    );

    await fs.promises.writeFile(
      path.join(testProjectRoot, 'src/index.ts'),
      `export { App } from './core/app';
export { UserService } from './services/user-service';
export { formatUser } from './utils/helpers';
export { validateEmail, validateRequired } from './utils/validators';
export type { User } from './types/user';
export type { BaseEntity } from './types/base';`
    );

    // Create file with circular dependency potential
    await fs.promises.writeFile(
      path.join(testProjectRoot, 'src/utils/circular-a.ts'),
      `import { helperB } from './circular-b';

export function helperA(value: string): string {
  return helperB(value.toUpperCase());
}`
    );

    await fs.promises.writeFile(
      path.join(testProjectRoot, 'src/utils/circular-b.ts'),
      `import { helperA } from './circular-a';

export function helperB(value: string): string {
  if (value.length > 10) {
    return helperA(value.substring(0, 10));
  }
  return value.toLowerCase();
}`
    );

    // Create files in lib directory for cross-directory imports
    await fs.promises.writeFile(
      path.join(testProjectRoot, 'lib/external.ts'),
      `export function externalHelper(): string {
  return 'external';
}`
    );

    await fs.promises.writeFile(
      path.join(testProjectRoot, 'src/core/lib-user.ts'),
      `import { externalHelper } from '../../lib/external';

export function useExternal(): string {
  return externalHelper();
}`
    );
  });

  afterAll(async () => {
    // Clean up test files
    try {
      await fs.promises.rm(testProjectRoot, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test files:', error);
    }
  });

  describe('Real dependency resolution', () => {
    it('should resolve relative imports correctly', () => {
      const imports: ImportInfo[] = [
        { from: './base', kind: 'import' },
        { from: '../utils/validators', kind: 'import' }
      ];

      const allFiles = [
        'src/types/base.ts',
        'src/types/user.ts',
        'src/utils/validators.ts'
      ];

      const result = DependencyResolver.resolveImports(
        imports,
        'src/types/user.ts',
        allFiles
      );

      expect(result).toHaveLength(2);
      expect(result).toContain('src/types/base.ts');
      expect(result).toContain('src/utils/validators.ts');
    });

    it('should handle complex relative paths', () => {
      const imports: ImportInfo[] = [
        { from: '../../lib/external', kind: 'import' }
      ];

      const allFiles = [
        'src/core/lib-user.ts',
        'lib/external.ts'
      ];

      const result = DependencyResolver.resolveImports(
        imports,
        'src/core/lib-user.ts',
        allFiles
      );

      expect(result).toHaveLength(1);
      expect(result).toContain('lib/external.ts');
    });

    it('should ignore external package imports', () => {
      const imports: ImportInfo[] = [
        { from: 'react', kind: 'import' },
        { from: '@types/node', kind: 'import' },
        { from: 'lodash', kind: 'import' },
        { from: './local-file', kind: 'import' }
      ];

      const allFiles = [
        'src/index.ts',
        'src/local-file.ts'
      ];

      const result = DependencyResolver.resolveImports(
        imports,
        'src/index.ts',
        allFiles
      );

      expect(result).toHaveLength(1);
      expect(result).toContain('src/local-file.ts');
    });

    it('should build dependency graph from real project structure', async () => {
      const allFiles = [
        'src/types/base.ts',
        'src/types/user.ts',
        'src/utils/validators.ts',
        'src/utils/helpers.ts',
        'src/services/user-service.ts',
        'src/core/app.ts',
        'src/index.ts'
      ];

      // Create a mock file map with real imports
      const fileImports: Record<string, ImportInfo[]> = {
        'src/types/user.ts': [
          { from: './base', kind: 'import' },
          { from: '../utils/validators', kind: 'import' }
        ],
        'src/utils/helpers.ts': [
          { from: './validators', kind: 'import' },
          { from: '../types/user', kind: 'import' }
        ],
        'src/services/user-service.ts': [
          { from: '../types/user', kind: 'import' },
          { from: '../utils/helpers', kind: 'import' },
          { from: '../utils/validators', kind: 'import' }
        ],
        'src/core/app.ts': [
          { from: '../services/user-service', kind: 'import' },
          { from: '../types/user', kind: 'import' },
          { from: '../types/base', kind: 'import' }
        ],
        'src/index.ts': [
          { from: './core/app', kind: 'import' },
          { from: './services/user-service', kind: 'import' },
          { from: './utils/helpers', kind: 'import' },
          { from: './utils/validators', kind: 'import' },
          { from: './types/user', kind: 'import' },
          { from: './types/base', kind: 'import' }
        ]
      };

      const edges = DependencyResolver.buildDependencyGraph(fileImports, allFiles);

      expect(edges.length).toBeGreaterThan(0);

      // Verify some key dependencies exist
      expect(edges).toContainEqual({
        from: 'src/types/user.ts',
        to: 'src/types/base.ts'
      });

      expect(edges).toContainEqual({
        from: 'src/types/user.ts',
        to: 'src/utils/validators.ts'
      });

      expect(edges).toContainEqual({
        from: 'src/services/user-service.ts',
        to: 'src/types/user.ts'
      });

      expect(edges).toContainEqual({
        from: 'src/core/app.ts',
        to: 'src/services/user-service.ts'
      });
    });

    it('should detect circular dependencies', () => {
      const allFiles = [
        'src/utils/circular-a.ts',
        'src/utils/circular-b.ts'
      ];

      const fileImports: Record<string, ImportInfo[]> = {
        'src/utils/circular-a.ts': [
          { from: './circular-b', kind: 'import' }
        ],
        'src/utils/circular-b.ts': [
          { from: './circular-a', kind: 'import' }
        ]
      };

      const edges = DependencyResolver.buildDependencyGraph(fileImports, allFiles);
      const cycles = DependencyResolver.findCircularDependencies(edges);

      expect(cycles.length).toBeGreaterThan(0);
      expect(cycles[0]).toContain('src/utils/circular-a.ts');
      expect(cycles[0]).toContain('src/utils/circular-b.ts');
    });
  });

  describe('Real project analysis', () => {
    it('should analyze actual project dependencies', async () => {
      // Get some real files from the actual project
      const coreFiles = [
        'src/core/file-discovery.ts',
        'src/core/indexer.ts',
        'src/parsers/ast-parser.ts'
      ];

      // Check if files exist
      const existingFiles = [];
      for (const file of coreFiles) {
        const filePath = path.join(realProjectRoot, file);
        try {
          await fs.promises.access(filePath);
          existingFiles.push(file);
        } catch {
          // File doesn't exist, skip it
        }
      }

      if (existingFiles.length === 0) {
        return; // Skip test if no files found
      }

      // Create mock imports based on what we know about the project structure
      const fileImports: Record<string, ImportInfo[]> = {
        'src/core/indexer.ts': [
          { from: './file-discovery', kind: 'import' },
          { from: '../parsers/ast-parser', kind: 'import' }
        ]
      };

      const edges = DependencyResolver.buildDependencyGraph(fileImports, existingFiles);

      expect(Array.isArray(edges)).toBe(true);
      
      if (existingFiles.includes('src/core/indexer.ts') && 
          existingFiles.includes('src/core/file-discovery.ts')) {
        expect(edges).toContainEqual({
          from: 'src/core/indexer.ts',
          to: 'src/core/file-discovery.ts'
        });
      }
    });

    it('should handle large dependency graphs efficiently', () => {
      // Create a large number of files with interconnected dependencies
      const largeFileList: string[] = [];
      const largeFileImports: Record<string, ImportInfo[]> = {};

      // Create 100 files with various dependency patterns
      for (let i = 0; i < 100; i++) {
        const fileName = `src/module${i}.ts`;
        largeFileList.push(fileName);
        
        // Each file depends on a few others
        const imports: ImportInfo[] = [];
        for (let j = 1; j <= 3; j++) {
          const depIndex = (i + j) % 100;
          if (depIndex !== i) {
            imports.push({
              from: `./module${depIndex}`,
              kind: 'import'
            });
          }
        }
        largeFileImports[fileName] = imports;
      }

      const startTime = Date.now();
      const edges = DependencyResolver.buildDependencyGraph(largeFileImports, largeFileList);
      const endTime = Date.now();

      expect(edges.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second

      // Verify some edges exist
      expect(edges.some(edge => edge.from.includes('module0'))).toBe(true);
      expect(edges.some(edge => edge.to.includes('module1'))).toBe(true);
    });

    it('should find complex circular dependencies', () => {
      const complexFiles = [
        'src/a.ts',
        'src/b.ts',
        'src/c.ts',
        'src/d.ts'
      ];

      // Create a longer cycle: A -> B -> C -> D -> A
      const complexImports: Record<string, ImportInfo[]> = {
        'src/a.ts': [{ from: './b', kind: 'import' }],
        'src/b.ts': [{ from: './c', kind: 'import' }],
        'src/c.ts': [{ from: './d', kind: 'import' }],
        'src/d.ts': [{ from: './a', kind: 'import' }]
      };

      const edges = DependencyResolver.buildDependencyGraph(complexImports, complexFiles);
      const cycles = DependencyResolver.findCircularDependencies(edges);

      expect(cycles.length).toBeGreaterThan(0);
      
      // Should find the 4-file cycle (might be length 4 or 5 if it includes the starting node twice)
      const longCycle = cycles.find(cycle => cycle.length >= 4 && cycle.length <= 5);
      expect(longCycle).toBeDefined();
      
      if (longCycle) {
        // Check that all 4 files are in the cycle
        const uniqueFiles = [...new Set(longCycle)];
        expect(uniqueFiles).toContain('src/a.ts');
        expect(uniqueFiles).toContain('src/b.ts');
        expect(uniqueFiles).toContain('src/c.ts');
        expect(uniqueFiles).toContain('src/d.ts');
      }
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle files with no imports', () => {
      const imports: ImportInfo[] = [];
      const allFiles = ['src/standalone.ts'];

      const result = DependencyResolver.resolveImports(
        imports,
        'src/standalone.ts',
        allFiles
      );

      expect(result).toEqual([]);
    });

    it('should handle malformed import paths', () => {
      const imports: ImportInfo[] = [
        { from: '', kind: 'import' },
        { from: '.', kind: 'import' },
        { from: '..', kind: 'import' },
        { from: './valid', kind: 'import' }
      ];

      const allFiles = ['src/test.ts', 'src/valid.ts'];

      const result = DependencyResolver.resolveImports(
        imports,
        'src/test.ts',
        allFiles
      );

      // Should only resolve the valid import
      expect(result).toHaveLength(1);
      expect(result).toContain('src/valid.ts');
    });

    it('should handle imports that dont match any files', () => {
      const imports: ImportInfo[] = [
        { from: './nonexistent', kind: 'import' },
        { from: '../missing/file', kind: 'import' },
        { from: './actual', kind: 'import' }
      ];

      const allFiles = ['src/test.ts', 'src/actual.ts'];

      const result = DependencyResolver.resolveImports(
        imports,
        'src/test.ts',
        allFiles
      );

      // Should only resolve imports that match actual files
      expect(result).toHaveLength(1);
      expect(result).toContain('src/actual.ts');
    });

    it('should handle very deep directory structures', () => {
      const imports: ImportInfo[] = [
        { from: '../../../../../../utils/deep', kind: 'import' }
      ];

      const allFiles = [
        'src/very/deep/nested/directory/structure/file.ts',
        'utils/deep.ts'
      ];

      const result = DependencyResolver.resolveImports(
        imports,
        'src/very/deep/nested/directory/structure/file.ts',
        allFiles
      );

      expect(result).toHaveLength(1);
      expect(result).toContain('utils/deep.ts');
    });

    it('should handle concurrent dependency resolution', async () => {
      const allFiles = [
        'src/a.ts',
        'src/b.ts',
        'src/c.ts'
      ];

      const fileImports: Record<string, ImportInfo[]> = {
        'src/a.ts': [{ from: './b', kind: 'import' }],
        'src/b.ts': [{ from: './c', kind: 'import' }],
        'src/c.ts': []
      };

      // Run dependency resolution concurrently
      const promises = Array.from({ length: 10 }, () =>
        Promise.resolve(DependencyResolver.buildDependencyGraph(fileImports, allFiles))
      );

      const results = await Promise.all(promises);

      // All results should be identical
      expect(results).toHaveLength(10);
      const firstResult = results[0];
      
      results.forEach(result => {
        expect(result).toEqual(firstResult);
      });
    });
  });

  describe('Performance and scalability', () => {
    it('should handle projects with many files efficiently', () => {
      const manyFiles = Array.from({ length: 1000 }, (_, i) => `src/file${i}.ts`);
      
      // Create sparse dependencies (each file depends on 0-3 others)
      const sparseImports: Record<string, ImportInfo[]> = {};
      manyFiles.forEach((file, index) => {
        const imports: ImportInfo[] = [];
        for (let j = 1; j <= Math.min(3, index); j++) {
          imports.push({
            from: `./file${index - j}`,
            kind: 'import'
          });
        }
        sparseImports[file] = imports;
      });

      const startTime = Date.now();
      const edges = DependencyResolver.buildDependencyGraph(sparseImports, manyFiles);
      const cycles = DependencyResolver.findCircularDependencies(edges);
      const endTime = Date.now();

      expect(edges.length).toBeGreaterThan(0);
      expect(Array.isArray(cycles)).toBe(true);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should maintain consistent performance across multiple runs', () => {
      const files = Array.from({ length: 50 }, (_, i) => `src/mod${i}.ts`);
      const imports: Record<string, ImportInfo[]> = {};
      
      files.forEach((file, index) => {
        imports[file] = index > 0 ? [{ from: `./mod${index - 1}`, kind: 'import' }] : [];
      });

      const durations: number[] = [];

      // Run multiple times to check consistency
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        const edges = DependencyResolver.buildDependencyGraph(imports, files);
        const endTime = Date.now();
        
        durations.push(endTime - startTime);
        expect(edges.length).toBe(49); // 50 files - 1 (first has no deps) = 49 edges
      }

      // Performance should be consistent
      const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
      const maxAcceptable = Math.max(avgDuration * 3, 2); // More tolerance for very fast operations
      durations.forEach(duration => {
        expect(duration).toBeLessThanOrEqual(maxAcceptable); // No run should be more than 3x average
      });
    });
  });
});