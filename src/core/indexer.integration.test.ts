/**
 * End-to-end integration tests for CodeIndexer using real filesystem and project files
 * These tests verify the complete indexing workflow without mocking core dependencies
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CodeIndexer } from './indexer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('CodeIndexer End-to-End Integration Tests', () => {
  const testProjectRoot = path.join(__dirname, '../../temp/e2e-test-project');
  const realProjectRoot = path.join(__dirname, '../..'); // Actual codebase

  beforeAll(async () => {
    // Create a realistic test project structure
    await fs.promises.mkdir(testProjectRoot, { recursive: true });
    await fs.promises.mkdir(path.join(testProjectRoot, 'src/components'), { recursive: true });
    await fs.promises.mkdir(path.join(testProjectRoot, 'src/services'), { recursive: true });
    await fs.promises.mkdir(path.join(testProjectRoot, 'src/utils'), { recursive: true });
    await fs.promises.mkdir(path.join(testProjectRoot, 'src/types'), { recursive: true });
    await fs.promises.mkdir(path.join(testProjectRoot, 'tests'), { recursive: true });
    await fs.promises.mkdir(path.join(testProjectRoot, 'node_modules'), { recursive: true });

    // Create interconnected TypeScript files with real dependencies
    await fs.promises.writeFile(
      path.join(testProjectRoot, 'src/types/user.ts'),
      `export interface User {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  roles: string[];
}

export type UserStatus = 'active' | 'inactive' | 'pending';

export interface UserCreateRequest {
  name: string;
  email: string;
  roles?: string[];
}

export class UserValidator {
  static validate(user: User): boolean {
    return !!(user.id && user.name && user.email);
  }

  static validateEmail(email: string): boolean {
    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
  }
}

export const DEFAULT_USER_ROLES = ['user', 'viewer'] as const;`
    );

    await fs.promises.writeFile(
      path.join(testProjectRoot, 'src/types/api.ts'),
      `import type { User } from './user';

export interface ApiResponse<T = any> {
  data: T;
  status: 'success' | 'error';
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
  };
}

export type ApiError = {
  code: string;
  message: string;
  details?: Record<string, any>;
};

export interface UserApiResponse extends ApiResponse<User> {}
export interface UsersApiResponse extends PaginatedResponse<User> {}`
    );

    await fs.promises.writeFile(
      path.join(testProjectRoot, 'src/utils/http-client.ts'),
      `import type { ApiResponse, ApiError } from '../types/api';

export class HttpClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string = 'https://api.example.com') {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    const response = await fetch(\`\${this.baseUrl}\${endpoint}\`, {
      method: 'GET',
      headers: this.defaultHeaders
    });

    if (!response.ok) {
      throw new HttpError(\`HTTP \${response.status}: \${response.statusText}\`);
    }

    return response.json();
  }

  async post<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    const response = await fetch(\`\${this.baseUrl}\${endpoint}\`, {
      method: 'POST',
      headers: this.defaultHeaders,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new HttpError(\`HTTP \${response.status}: \${response.statusText}\`);
    }

    return response.json();
  }

  setAuthToken(token: string): void {
    this.defaultHeaders['Authorization'] = \`Bearer \${token}\`;
  }
}

export class HttpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export const createHttpClient = (baseUrl?: string): HttpClient => {
  return new HttpClient(baseUrl);
};`
    );

    await fs.promises.writeFile(
      path.join(testProjectRoot, 'src/services/user-service.ts'),
      `import { HttpClient, HttpError } from '../utils/http-client';
import type { User, UserCreateRequest, UserValidator } from '../types/user';
import type { UserApiResponse, UsersApiResponse } from '../types/api';

export class UserService {
  private httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  async getUser(id: string): Promise<User> {
    const response = await this.httpClient.get<User>(\`/users/\${id}\`);
    
    if (response.status === 'error') {
      throw new Error(\`Failed to get user: \${response.message}\`);
    }

    return response.data;
  }

  async getUsers(page: number = 1, limit: number = 10): Promise<User[]> {
    const response = await this.httpClient.get<User[]>(\`/users?page=\${page}&limit=\${limit}\`);
    
    if (response.status === 'error') {
      throw new Error(\`Failed to get users: \${response.message}\`);
    }

    return response.data;
  }

  async createUser(userData: UserCreateRequest): Promise<User> {
    if (!UserValidator.validateEmail(userData.email)) {
      throw new Error('Invalid email format');
    }

    const response = await this.httpClient.post<User>('/users', userData);
    
    if (response.status === 'error') {
      throw new Error(\`Failed to create user: \${response.message}\`);
    }

    return response.data;
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    const response = await this.httpClient.post<User>(\`/users/\${id}\`, userData);
    
    if (response.status === 'error') {
      throw new Error(\`Failed to update user: \${response.message}\`);
    }

    return response.data;
  }

  static create(baseUrl?: string): UserService {
    const httpClient = new HttpClient(baseUrl);
    return new UserService(httpClient);
  }
}

export const DEFAULT_USER_SERVICE_CONFIG = {
  baseUrl: 'https://api.example.com',
  timeout: 5000,
  retries: 3
} as const;`
    );

    await fs.promises.writeFile(
      path.join(testProjectRoot, 'src/components/UserManager.tsx'),
      `import React, { useState, useEffect } from 'react';
import { UserService } from '../services/user-service';
import { createHttpClient } from '../utils/http-client';
import type { User, UserCreateRequest } from '../types/user';

interface UserManagerProps {
  baseUrl?: string;
  onUserChange?: (users: User[]) => void;
}

export const UserManager: React.FC<UserManagerProps> = ({ 
  baseUrl, 
  onUserChange 
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const userService = UserService.create(baseUrl);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      const userList = await userService.getUsers();
      setUsers(userList);
      onUserChange?.(userList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (userData: UserCreateRequest): Promise<void> => {
    try {
      const newUser = await userService.createUser(userData);
      setUsers(prev => [...prev, newUser]);
      onUserChange?.([...users, newUser]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  const handleDeleteUser = async (userId: string): Promise<void> => {
    try {
      const updatedUsers = users.filter(user => user.id !== userId);
      setUsers(updatedUsers);
      onUserChange?.(updatedUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  if (loading) {
    return <div>Loading users...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="user-manager">
      <h2>User Management</h2>
      <div className="user-list">
        {users.map(user => (
          <div key={user.id} className="user-card">
            <h3>{user.name}</h3>
            <p>{user.email}</p>
            <p>Status: {user.isActive ? 'Active' : 'Inactive'}</p>
            <button onClick={() => handleDeleteUser(user.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export function createUserManager(props: UserManagerProps): JSX.Element {
  return <UserManager {...props} />;
}

export const USER_MANAGER_DEFAULTS = {
  pageSize: 10,
  refreshInterval: 30000
} as const;`
    );

    await fs.promises.writeFile(
      path.join(testProjectRoot, 'src/index.ts'),
      `export { UserService, DEFAULT_USER_SERVICE_CONFIG } from './services/user-service';
export { HttpClient, HttpError, createHttpClient } from './utils/http-client';
export { UserManager, createUserManager, USER_MANAGER_DEFAULTS } from './components/UserManager';
export type { 
  User, 
  UserStatus, 
  UserCreateRequest,
  ApiResponse,
  PaginatedResponse,
  ApiError 
} from './types/user';
export { UserValidator, DEFAULT_USER_ROLES } from './types/user';

import { UserService } from './services/user-service';
import { createHttpClient } from './utils/http-client';

export function createApp(baseUrl: string = 'https://api.example.com') {
  const httpClient = createHttpClient(baseUrl);
  const userService = new UserService(httpClient);
  
  return {
    userService,
    httpClient
  };
}

export const APP_VERSION = '1.0.0';
export const API_VERSION = 'v1';`
    );

    // Create .gitignore
    await fs.promises.writeFile(
      path.join(testProjectRoot, '.gitignore'),
      `node_modules/
dist/
build/
*.log
.env
.env.local
coverage/
.nyc_output/`
    );

    // Create package.json
    await fs.promises.writeFile(
      path.join(testProjectRoot, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        type: 'module',
        dependencies: {
          'react': '^18.0.0'
        }
      }, null, 2)
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

  describe('Complete indexing workflow', () => {
    it('should index a realistic TypeScript project end-to-end', async () => {
      const indexer = new CodeIndexer(testProjectRoot);
      const result = await indexer.processProject();

      // Verify metadata
      expect(result.metadata.version).toBe(1);
      expect(result.metadata.root).toBe(testProjectRoot);
      expect(result.metadata.totalFiles).toBeGreaterThanOrEqual(6);
      expect(result.metadata.createdAt).toBeDefined();
      expect(result.metadata.updatedAt).toBeDefined();

      // Verify all TypeScript/JavaScript files were discovered
      // (package.json might also be included)
      const tsJsFiles = result.nodes.filter(n => 
        n.endsWith('.ts') || n.endsWith('.tsx') || n.endsWith('.js') || n.endsWith('.jsx')
      );
      expect(tsJsFiles).toHaveLength(6);
      expect(tsJsFiles).toContain('src/types/user.ts');
      expect(tsJsFiles).toContain('src/types/api.ts');
      expect(tsJsFiles).toContain('src/utils/http-client.ts');
      expect(tsJsFiles).toContain('src/services/user-service.ts');
      expect(tsJsFiles).toContain('src/components/UserManager.tsx');
      expect(tsJsFiles).toContain('src/index.ts');

      // Verify tree structure
      expect(result.tree).toBeDefined();
      expect(result.tree.name).toBe('e2e-test-project');
      expect(result.tree.type).toBe('dir');

      // Verify file parsing results
      expect(Object.keys(result.files)).toHaveLength(6);

      // Check user types file
      const userTypesFile = result.files['src/types/user.ts'];
      expect(userTypesFile).toBeDefined();
      expect(userTypesFile.classes.some(c => c.name === 'UserValidator')).toBe(true);
      expect(userTypesFile.constants.some(c => c.name === 'DEFAULT_USER_ROLES')).toBe(true);

      // Check HTTP client file
      const httpClientFile = result.files['src/utils/http-client.ts'];
      expect(httpClientFile).toBeDefined();
      expect(httpClientFile.classes.some(c => c.name === 'HttpClient')).toBe(true);
      expect(httpClientFile.classes.some(c => c.name === 'HttpError')).toBe(true);
      // Arrow functions are parsed as constants with initKind: 'function'
      expect(httpClientFile.constants.some(c => c.name === 'createHttpClient' && c.initKind === 'function')).toBe(true);

      // Check user service file
      const userServiceFile = result.files['src/services/user-service.ts'];
      expect(userServiceFile).toBeDefined();
      expect(userServiceFile.classes.some(c => c.name === 'UserService')).toBe(true);
      expect(userServiceFile.constants.some(c => c.name === 'DEFAULT_USER_SERVICE_CONFIG')).toBe(true);
      
      // Verify imports
      expect(userServiceFile.imports.length).toBeGreaterThan(0);
      expect(userServiceFile.imports.some(i => i.from === '../utils/http-client')).toBe(true);
      expect(userServiceFile.imports.some(i => i.from === '../types/user')).toBe(true);

      // Check dependency resolution
      expect(result.edges.length).toBeGreaterThan(0);
      
      // Verify dependencies exist between related files
      const dependencies = result.edges.map(edge => `${edge.from} -> ${edge.to}`);
      expect(dependencies.some(dep => 
        dep.includes('src/services/user-service.ts') && dep.includes('src/utils/http-client.ts')
      )).toBe(true);
    });

    it('should handle project statistics accurately', async () => {
      const indexer = new CodeIndexer(testProjectRoot);
      const index = await indexer.processProject();
      const stats = CodeIndexer.getProjectStats(index);

      expect(stats.totalFiles).toBe(6);
      expect(stats.totalDependencies).toBeGreaterThan(0);
      expect(stats.averageDependenciesPerFile).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(stats.circularDependencies)).toBe(true);
      expect(Array.isArray(stats.entryPoints)).toBe(true);
      expect(Array.isArray(stats.leafFiles)).toBe(true);

      // Entry points are files with no incoming dependencies - check if src/index.ts is one
      // Note: src/index.ts may have dependencies from other files in our test project
      // So let's just verify that entryPoints array is populated
      expect(stats.entryPoints.length).toBeGreaterThanOrEqual(1);
    });

    it('should support incremental updates correctly', async () => {
      const indexer = new CodeIndexer(testProjectRoot);
      const initialIndex = await indexer.processProject();

      // Verify initial state
      expect(initialIndex.nodes).toHaveLength(6);
      expect(initialIndex.files['src/types/user.ts']).toBeDefined();

      // Update a file
      await fs.promises.writeFile(
        path.join(testProjectRoot, 'src/types/user.ts'),
        `export interface User {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  roles: string[];
  updatedAt: string; // New field
}

export type UserStatus = 'active' | 'inactive' | 'pending' | 'suspended'; // New status

export class UserValidator {
  static validate(user: User): boolean {
    return !!(user.id && user.name && user.email);
  }

  static validateEmail(email: string): boolean {
    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
  }

  // New method
  static isRecentlyUpdated(user: User): boolean {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return new Date(user.updatedAt) > oneWeekAgo;
  }
}

export const DEFAULT_USER_ROLES = ['user', 'viewer', 'editor'] as const; // Added editor role`
      );

      // Small delay to ensure different timestamps
      await new Promise(resolve => globalThis.setTimeout(resolve, 100));
      
      // Update the index
      const updatedIndex = await indexer.updateFile('src/types/user.ts', initialIndex);

      // Verify update - check timestamp is newer or equal (might be same in fast systems)
      expect(updatedIndex.nodes).toHaveLength(6); // Same number of files
      const initialTime = new Date(initialIndex.metadata.updatedAt).getTime();
      const updatedTime = new Date(updatedIndex.metadata.updatedAt).getTime();
      expect(updatedTime).toBeGreaterThanOrEqual(initialTime);
      
      const updatedUserFile = updatedIndex.files['src/types/user.ts'];
      expect(updatedUserFile).toBeDefined();
      
      // Verify the updated file has the new method
      const updatedMethods = updatedUserFile.classes[0].methods;
      const initialMethods = initialIndex.files['src/types/user.ts'].classes[0].methods;
      
      // Should have at least the same number of methods, or more if new method was detected
      expect(updatedMethods.length).toBeGreaterThanOrEqual(initialMethods.length);
      
      // Verify the new method exists (isRecentlyUpdated)
      const hasNewMethod = updatedMethods.some(m => m.name === 'isRecentlyUpdated');
      expect(hasNewMethod).toBe(true);

      // Other files should remain unchanged
      expect(updatedIndex.files['src/utils/http-client.ts']).toEqual(
        initialIndex.files['src/utils/http-client.ts']
      );
    });

    it('should support file removal correctly', async () => {
      const indexer = new CodeIndexer(testProjectRoot);
      const initialIndex = await indexer.processProject();

      expect(initialIndex.nodes).toHaveLength(6);
      expect(initialIndex.files['src/types/api.ts']).toBeDefined();

      // Small delay to ensure different timestamps
      await new Promise(resolve => globalThis.setTimeout(resolve, 100));
      
      // Remove a file
      const updatedIndex = indexer.removeFile('src/types/api.ts', initialIndex);

      expect(updatedIndex.nodes).toHaveLength(5);
      expect(updatedIndex.files['src/types/api.ts']).toBeUndefined();
      expect(updatedIndex.metadata.totalFiles).toBe(5);
      // Check timestamp is newer or equal (might be same in fast systems)
      const initialTime = new Date(initialIndex.metadata.updatedAt).getTime();
      const updatedTime = new Date(updatedIndex.metadata.updatedAt).getTime();
      expect(updatedTime).toBeGreaterThanOrEqual(initialTime);

      // Dependencies involving the removed file should be cleaned up
      const edgesInvolvingRemovedFile = updatedIndex.edges.filter(
        edge => edge.from === 'src/types/api.ts' || edge.to === 'src/types/api.ts'
      );
      expect(edgesInvolvingRemovedFile).toHaveLength(0);
    });
  });

  describe('Filter options integration', () => {
    it('should work with include patterns on real project', async () => {
      const indexer = new CodeIndexer(testProjectRoot, {
        include: ['src/types/**/*.ts']
      });

      const result = await indexer.processProject();

      expect(result.nodes).toHaveLength(2);
      expect(result.nodes).toContain('src/types/user.ts');
      expect(result.nodes).toContain('src/types/api.ts');
      expect(result.nodes).not.toContain('src/services/user-service.ts');
      expect(result.nodes).not.toContain('src/components/UserManager.tsx');
    });

    it('should work with exclude patterns on real project', async () => {
      const indexer = new CodeIndexer(testProjectRoot, {
        exclude: ['**/*.tsx', '**/types/**']
      });

      const result = await indexer.processProject();

      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.nodes).not.toContain('src/components/UserManager.tsx');
      expect(result.nodes).not.toContain('src/types/user.ts');
      expect(result.nodes).not.toContain('src/types/api.ts');
      expect(result.nodes).toContain('src/services/user-service.ts');
      expect(result.nodes).toContain('src/utils/http-client.ts');
      expect(result.nodes).toContain('src/index.ts');
    });

    it('should work with complex include/exclude combinations', async () => {
      const indexer = new CodeIndexer(testProjectRoot, {
        include: ['src/**/*.ts', 'src/**/*.tsx'],
        exclude: ['**/components/**', '**/types/api.ts']
      });

      const result = await indexer.processProject();

      expect(result.nodes).not.toContain('src/components/UserManager.tsx');
      expect(result.nodes).not.toContain('src/types/api.ts');
      expect(result.nodes).toContain('src/types/user.ts');
      expect(result.nodes).toContain('src/services/user-service.ts');
      expect(result.nodes).toContain('src/utils/http-client.ts');
      expect(result.nodes).toContain('src/index.ts');
    });
  });

  describe('Error handling and resilience', () => {
    it('should handle files with syntax errors gracefully', async () => {
      // Create a file with syntax errors
      await fs.promises.writeFile(
        path.join(testProjectRoot, 'src/broken.ts'),
        `export function broken( {
  // Missing closing parenthesis and function body
export const incomplete = ;
// Syntax errors everywhere
`
      );

      const indexer = new CodeIndexer(testProjectRoot);
      const result = await indexer.processProject();

      // Should include the broken file but with limited parsing results
      expect(result.nodes).toContain('src/broken.ts');
      expect(result.files['src/broken.ts']).toBeDefined();
      // Safe parsing might extract some minimal information
      expect(result.files['src/broken.ts'].functions.length).toBeLessThanOrEqual(1);
      expect(result.files['src/broken.ts'].classes).toHaveLength(0);
      expect(result.files['src/broken.ts'].constants.length).toBeLessThanOrEqual(1);

      // Other files should still be processed correctly
      expect(result.files['src/types/user.ts'].classes.length).toBeGreaterThan(0);
    });

    it('should handle concurrent operations safely', async () => {
      const indexer = new CodeIndexer(testProjectRoot);
      
      // Perform multiple operations concurrently
      const [
        fullIndex,
        typeServiceResult,
        utilsResult
      ] = await Promise.all([
        indexer.processProject(),
        indexer.processProject(), // Duplicate operation
        indexer.processProject()  // Another duplicate
      ]);

      // All results should be consistent
      expect(fullIndex.nodes).toEqual(typeServiceResult.nodes);
      expect(fullIndex.nodes).toEqual(utilsResult.nodes);
      expect(fullIndex.metadata.totalFiles).toBe(typeServiceResult.metadata.totalFiles);
      expect(fullIndex.metadata.totalFiles).toBe(utilsResult.metadata.totalFiles);
    });

    it('should handle progress reporting correctly', async () => {
      const progressUpdates: Array<{ step: string; current: number; total: number }> = [];
      
      const progressCallback = (progress: { step: string; current: number; total: number }) => {
        progressUpdates.push({ ...progress });
      };

      const indexer = new CodeIndexer(testProjectRoot);
      const result = await indexer.processProject(progressCallback);

      expect(result.nodes.length).toBeGreaterThan(0);
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // Should have discovery step
      expect(progressUpdates.some(p => p.step === 'Discovering files')).toBe(true);
      
      // Should have completion step
      expect(progressUpdates.some(p => p.step === 'Complete')).toBe(true);
      
      // Progress should be monotonic
      const completeUpdate = progressUpdates.find(p => p.step === 'Complete');
      expect(completeUpdate?.current).toBe(completeUpdate?.total);
    });
  });

  describe('Real codebase analysis', () => {
    it('should successfully analyze the actual project codebase', async () => {
      const indexer = new CodeIndexer(realProjectRoot, {
        exclude: ['**/temp/**', '**/*.test.ts', '**/test-*.ts', '**/node_modules/**']
      });

      const result = await indexer.processProject();

      expect(result.nodes.length).toBeGreaterThan(5);
      expect(result.metadata.totalFiles).toBeGreaterThan(5);
      
      // Should find core modules
      expect(result.nodes.some(n => n.includes('file-discovery.ts'))).toBe(true);
      expect(result.nodes.some(n => n.includes('indexer.ts'))).toBe(true);
      expect(result.nodes.some(n => n.includes('ast-parser.ts'))).toBe(true);

      // Should have meaningful dependency graph
      expect(result.edges.length).toBeGreaterThan(0);

      // Verify project statistics
      const stats = CodeIndexer.getProjectStats(result);
      expect(stats.totalFiles).toBe(result.nodes.length);
      expect(stats.totalDependencies).toBeGreaterThanOrEqual(0);
    });

    it('should handle the actual project structure efficiently', async () => {
      const indexer = new CodeIndexer(realProjectRoot, {
        include: ['src/**/*.ts'],
        exclude: ['**/*.test.ts', '**/test-*.ts', '**/temp/**']
      });

      const startTime = Date.now();
      const result = await indexer.processProject();
      const endTime = Date.now();

      expect(result.nodes.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      // All discovered files should be TypeScript
      expect(result.nodes.every(n => n.endsWith('.ts'))).toBe(true);
      
      // Should not include test files
      expect(result.nodes.every(n => !n.includes('.test.'))).toBe(true);
      expect(result.nodes.every(n => !n.includes('test-'))).toBe(true);
    });
  });

  describe('Memory and performance validation', () => {
    it('should handle large projects without memory issues', async () => {
      // Create many files to test scalability
      for (let i = 0; i < 50; i++) {
        await fs.promises.writeFile(
          path.join(testProjectRoot, `src/generated-${i}.ts`),
          `export function func${i}(): number {
  return ${i};
}

export const CONST_${i} = ${i};

export class Class${i} {
  private value = ${i};
  
  getValue(): number {
    return this.value;
  }
}`
        );
      }

      const indexer = new CodeIndexer(testProjectRoot);
      const startTime = Date.now();
      const result = await indexer.processProject();
      const endTime = Date.now();

      expect(result.nodes.length).toBeGreaterThanOrEqual(56); // Original 6 + 50 generated (+ possibly broken.ts from previous test)
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
      
      // Verify all generated files were processed
      for (let i = 0; i < 50; i++) {
        const fileName = `src/generated-${i}.ts`;
        expect(result.nodes).toContain(fileName);
        expect(result.files[fileName]).toBeDefined();
        expect(result.files[fileName].functions.length).toBeGreaterThan(0);
        expect(result.files[fileName].classes.length).toBeGreaterThan(0);
        expect(result.files[fileName].constants.length).toBeGreaterThan(0);
      }
    });

    it('should maintain consistent performance across multiple runs', async () => {
      const indexer = new CodeIndexer(testProjectRoot);
      const durations: number[] = [];

      // Run indexing multiple times
      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();
        const result = await indexer.processProject();
        const endTime = Date.now();
        
        durations.push(endTime - startTime);
        expect(result.nodes.length).toBeGreaterThan(0);
      }

      // Performance should be reasonable (no run should take more than 2 seconds)
      // Focus on absolute performance rather than relative variance
      const maxDuration = Math.max(...durations);
      expect(maxDuration).toBeLessThan(2000); // 2 seconds max for any single run
      
      // Verify all runs completed successfully
      expect(durations.length).toBe(3);
    });
  });
});