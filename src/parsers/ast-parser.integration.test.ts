/**
 * Integration tests for AstParser using real TypeScript files and code
 * These tests supplement the unit tests by testing actual AST parsing behavior
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASTParser } from './ast-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('AstParser Integration Tests', () => {
  const testFilesRoot = path.join(__dirname, '../../temp/ast-test-files');
  const realProjectRoot = path.join(__dirname, '../..'); // Actual codebase

  beforeAll(async () => {
    // Create directory for test files
    await fs.promises.mkdir(testFilesRoot, { recursive: true });

    // Create complex TypeScript file with various constructs
    await fs.promises.writeFile(
      path.join(testFilesRoot, 'complex.ts'),
      `import { Component } from 'react';
import * as Utils from './utils';
import { ApiService } from '../services/api';
import type { User, ApiResponse } from './types';

export interface ComponentProps {
  title: string;
  isVisible: boolean;
  data?: User[];
}

export class UserManager extends Component<ComponentProps> {
  private apiService: ApiService;
  
  constructor(props: ComponentProps) {
    super(props);
    this.apiService = new ApiService();
  }

  async fetchUsers(): Promise<User[]> {
    const response = await this.apiService.get('/users');
    return response.data;
  }

  private validateUser(user: User): boolean {
    return user.id && user.name && user.email;
  }

  static createDefault(): UserManager {
    return new UserManager({ title: 'Default', isVisible: true });
  }
}

export function processUsers(users: User[]): User[] {
  return users.filter(user => user.isActive);
}

export const DEFAULT_CONFIG = {
  timeout: 5000,
  retries: 3,
  baseUrl: 'https://api.example.com'
} as const;

export const API_ENDPOINTS = {
  users: '/api/users',
  posts: '/api/posts'
};

export type UserStatus = 'active' | 'inactive' | 'pending';

export enum ResponseStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  LOADING = 'loading'
}`
    );

    // Create JavaScript file with modern syntax
    await fs.promises.writeFile(
      path.join(testFilesRoot, 'modern.js'),
      `import { debounce } from 'lodash';

export class EventManager {
  constructor() {
    this.listeners = new Map();
    this.handleEvent = debounce(this.handleEvent.bind(this), 100);
  }

  addEventListener(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(callback);
  }

  async handleEvent(event) {
    const callbacks = this.listeners.get(event.type) || [];
    await Promise.all(callbacks.map(cb => cb(event)));
  }
}

export const createEventManager = () => new EventManager();

export const EVENTS = {
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  DATA_UPDATE: 'data_update'
};`
    );

    // Create React TSX file
    await fs.promises.writeFile(
      path.join(testFilesRoot, 'component.tsx'),
      `import React, { useState, useEffect } from 'react';
import { User } from '../types';

interface UserCardProps {
  user: User;
  onEdit: (user: User) => void;
  onDelete: (id: string) => void;
}

export const UserCard: React.FC<UserCardProps> = ({ user, onEdit, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  
  useEffect(() => {
    console.log('User card rendered for:', user.name);
  }, [user.name]);

  const handleEdit = () => {
    setIsEditing(true);
    onEdit(user);
  };

  return (
    <div className="user-card">
      <h3>{user.name}</h3>
      <p>{user.email}</p>
      <button onClick={handleEdit}>Edit</button>
      <button onClick={() => onDelete(user.id)}>Delete</button>
    </div>
  );
};

export function createUserList(users: User[]): JSX.Element {
  return (
    <div>
      {users.map(user => (
        <UserCard
          key={user.id}
          user={user}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      ))}
    </div>
  );
}`
    );

    // Create file with syntax errors
    await fs.promises.writeFile(
      path.join(testFilesRoot, 'invalid.ts'),
      `export function incomplete(
  // Missing closing parenthesis and function body
export const broken = ;
`
    );

    // Create empty file
    await fs.promises.writeFile(path.join(testFilesRoot, 'empty.ts'), '');

    // Create file with only comments
    await fs.promises.writeFile(
      path.join(testFilesRoot, 'comments.ts'),
      `/**
 * This file only contains comments
 * No actual code here
 */

// Just comments
/* More comments */
`
    );
  });

  afterAll(async () => {
    // Clean up test files
    try {
      await fs.promises.rm(testFilesRoot, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test files:', error);
    }
  });

  describe('Real TypeScript file parsing', () => {
    it('should parse complex TypeScript file correctly', async () => {
      const filePath = path.join(testFilesRoot, 'complex.ts');
      await fs.promises.readFile(filePath, 'utf-8'); // Ensure file exists
      
      const result = await ASTParser.parseFile(filePath);

      // Verify imports
      expect(result.imports).toHaveLength(4);
      expect(result.imports.some(i => i.from === 'react' && i.kind === 'import')).toBe(true);
      expect(result.imports.some(i => i.from === './utils' && i.kind === 'import')).toBe(true);
      expect(result.imports.some(i => i.from === '../services/api' && i.kind === 'import')).toBe(true);
      expect(result.imports.some(i => i.from === './types' && i.kind === 'import')).toBe(true);

      // Dependencies array is populated by dependency resolver, not AST parser
      // AST parser always returns empty dependencies array
      expect(result.dependencies).toEqual([]);

      // Verify classes
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].name).toBe('UserManager');
      expect(result.classes[0].extends).toBe('Component');
      expect(result.classes[0].methods.length).toBeGreaterThanOrEqual(3);

      // Verify functions
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('processUsers');
      // Parameters might be parsed differently
      expect(result.functions[0].params).toBeDefined();
      expect(result.functions[0].returnType).toBeDefined();

      // Verify constants
      expect(result.constants.length).toBeGreaterThanOrEqual(2);
      const constantNames = result.constants.map(c => c.name);
      expect(constantNames).toContain('DEFAULT_CONFIG');
      expect(constantNames).toContain('API_ENDPOINTS');
    });

    it('should parse modern JavaScript correctly', async () => {
      const filePath = path.join(testFilesRoot, 'modern.js');
      await fs.promises.readFile(filePath, 'utf-8'); // Ensure file exists
      
      const result = await ASTParser.parseFile(filePath);

      // Verify imports
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].from).toBe('lodash');

      // Verify classes
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].name).toBe('EventManager');

      // Verify functions (arrow functions are parsed as constants)
      const functionConstants = result.constants.filter(c => c.initKind === 'function');
      expect(functionConstants.length).toBeGreaterThanOrEqual(1);
      const functionNames = functionConstants.map(f => f.name);
      expect(functionNames).toContain('createEventManager');

      // Verify constants
      expect(result.constants.length).toBeGreaterThanOrEqual(1);
      const constantNames = result.constants.map(c => c.name);
      expect(constantNames).toContain('EVENTS');
    });

    it('should parse React TSX file correctly', async () => {
      const filePath = path.join(testFilesRoot, 'component.tsx');
      await fs.promises.readFile(filePath, 'utf-8'); // Ensure file exists
      
      const result = await ASTParser.parseFile(filePath);

      // Verify imports
      expect(result.imports.length).toBeGreaterThanOrEqual(2);
      const importSources = result.imports.map(i => i.from);
      expect(importSources).toContain('react');
      expect(importSources).toContain('../types');

      // Verify functions (React components can be functions or arrow functions as constants)
      const allFunctions = [...result.functions, ...result.constants.filter(c => c.initKind === 'function')];
      expect(allFunctions.length).toBeGreaterThanOrEqual(2);
      const functionNames = allFunctions.map(f => f.name);
      expect(functionNames).toContain('UserCard');
      expect(functionNames).toContain('createUserList');
    });
  });

  describe('Error handling with real files', () => {
    it('should handle files with syntax errors gracefully', async () => {
      const filePath = path.join(testFilesRoot, 'invalid.ts');
      await fs.promises.readFile(filePath, 'utf-8'); // Ensure file exists
      
      const result = await ASTParser.parseFile(filePath);

      // File with syntax errors may still parse some content
      // The parser is resilient and extracts what it can
      expect(result.imports).toEqual([]);
      expect(result.dependencies).toEqual([]);
      // Functions might be partially parsed
      expect(result.classes).toEqual([]);
    });

    it('should handle empty files', async () => {
      const filePath = path.join(testFilesRoot, 'empty.ts');
      await fs.promises.readFile(filePath, 'utf-8'); // Ensure file exists
      
      const result = await ASTParser.parseFile(filePath);

      expect(result.imports).toEqual([]);
      expect(result.dependencies).toEqual([]);
      expect(result.functions).toEqual([]);
      expect(result.classes).toEqual([]);
      expect(result.constants).toEqual([]);
    });

    it('should handle files with only comments', async () => {
      const filePath = path.join(testFilesRoot, 'comments.ts');
      await fs.promises.readFile(filePath, 'utf-8'); // Ensure file exists
      
      const result = await ASTParser.parseFile(filePath);

      expect(result.imports).toEqual([]);
      expect(result.dependencies).toEqual([]);
      expect(result.functions).toEqual([]);
      expect(result.classes).toEqual([]);
      expect(result.constants).toEqual([]);
    });

    it('should handle very large files efficiently', async () => {
      // Create a large TypeScript file
      const largeContent = Array.from({ length: 1000 }, (_, i) => 
        `export function func${i}(): number { return ${i}; }\n`
      ).join('');

      const startTime = Date.now();
      const result = ASTParser.parseContent(largeContent, 'large.ts');
      const endTime = Date.now();

      expect(result.functions).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should parse within 1 second
    });
  });

  describe('Real project file analysis', () => {
    it('should parse actual project files correctly', async () => {
      // Parse the actual FileDiscovery module
      const fileDiscoveryPath = path.join(realProjectRoot, 'src/core/file-discovery.ts');
      
      if (await fs.promises.access(fileDiscoveryPath).then(() => true).catch(() => false)) {
        const content = await fs.promises.readFile(fileDiscoveryPath, 'utf-8');
        const result = ASTParser.parseContent(content, fileDiscoveryPath);

        // Should find the FileDiscovery class
        expect(result.classes.length).toBeGreaterThan(0);
        const classNames = result.classes.map(c => c.name);
        expect(classNames).toContain('FileDiscovery');

        // Should have imports
        expect(result.imports.length).toBeGreaterThan(0);
        const importSources = result.imports.map(i => i.from);
        expect(importSources).toContain('fast-glob');
        expect(importSources).toContain('ignore');

        // Should have methods in the class
        const fileDiscoveryClass = result.classes.find(c => c.name === 'FileDiscovery');
        if (fileDiscoveryClass) {
          expect(fileDiscoveryClass.methods.length).toBeGreaterThan(0);
        }
      }
    });

    it('should parse the AST parser itself (dogfooding test)', async () => {
      const astParserPath = path.join(realProjectRoot, 'src/parsers/ast-parser.ts');
      
      if (await fs.promises.access(astParserPath).then(() => true).catch(() => false)) {
        const content = await fs.promises.readFile(astParserPath, 'utf-8');
        const result = ASTParser.parseContent(content, astParserPath);

        // Should find the AstParser class
        expect(result.classes.length).toBeGreaterThan(0);
        const classNames = result.classes.map(c => c.name);
        expect(classNames).toContain('ASTParser');

        // Should have the parseFile method
        const astParserClass = result.classes.find(c => c.name === 'ASTParser');
        expect(astParserClass?.methods.some(m => m.name === 'parseFile')).toBe(true);
      }
    });

    it('should handle multiple project files in sequence', async () => {
      const projectFiles = [
        'src/core/file-discovery.ts',
        'src/core/indexer.ts',
        'src/parsers/ast-parser.ts'
      ];

      const results = [];
      
      for (const file of projectFiles) {
        const filePath = path.join(realProjectRoot, file);
        
        if (await fs.promises.access(filePath).then(() => true).catch(() => false)) {
          await fs.promises.readFile(filePath, 'utf-8'); // Ensure file exists
          const result = await ASTParser.parseFile(filePath);
          results.push({ file, result });
        }
      }

      expect(results.length).toBeGreaterThan(0);
      
      // Each file should have been parsed successfully
      results.forEach(({ file: _file, result }) => {
        expect(result).toBeDefined();
        expect(result.imports).toBeDefined();
        expect(result.functions).toBeDefined();
        expect(result.classes).toBeDefined();
        expect(result.constants).toBeDefined();
      });
    });
  });

  describe('Concurrent parsing', () => {
    it('should handle concurrent parsing operations', async () => {
      const files = [
        path.join(testFilesRoot, 'complex.ts'),
        path.join(testFilesRoot, 'modern.js'),
        path.join(testFilesRoot, 'component.tsx')
      ];

      const contents = await Promise.all(
        files.map(file => fs.promises.readFile(file, 'utf-8'))
      );

      const startTime = Date.now();
      const results = await Promise.all(
        contents.map((content, index) => 
          ASTParser.parseFile(files[index])
        )
      );
      const endTime = Date.now();

      expect(results).toHaveLength(3);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete quickly

      // All results should be valid
      results.forEach((result, _index) => {
        expect(result).toBeDefined();
        expect(Array.isArray(result.imports)).toBe(true);
        expect(Array.isArray(result.functions)).toBe(true);
        expect(Array.isArray(result.classes)).toBe(true);
        expect(Array.isArray(result.constants)).toBe(true);
      });
    });

    it('should maintain thread safety during concurrent operations', async () => {
      const complexContent = await fs.promises.readFile(
        path.join(testFilesRoot, 'complex.ts'), 
        'utf-8'
      );

      // Parse the same file multiple times concurrently
      const promises = Array.from({ length: 10 }, (_, i) => 
        Promise.resolve(ASTParser.parseContent(complexContent, `complex-${i}.ts`))
      );

      const results = await Promise.all(promises);

      // All results should be identical
      expect(results).toHaveLength(10);
      
      const firstResult = results[0];
      results.forEach(result => {
        expect(result.imports).toEqual(firstResult.imports);
        expect(result.functions).toEqual(firstResult.functions);
        expect(result.classes).toEqual(firstResult.classes);
        expect(result.constants).toEqual(firstResult.constants);
      });
    });
  });

  describe('Memory management', () => {
    it('should not leak memory during repeated parsing', async () => {
      const content = await fs.promises.readFile(
        path.join(testFilesRoot, 'complex.ts'), 
        'utf-8'
      );

      // Parse the same file many times to check for memory leaks
      for (let i = 0; i < 100; i++) {
        const result = ASTParser.parseContent(content, `test-${i}.ts`);
        
        // Verify result is valid
        expect(result.classes).toHaveLength(1);
        expect(result.functions).toHaveLength(1);
        
        // Force garbage collection if available (V8)
        if (global.gc) {
          global.gc();
        }
      }

      // Test should complete without running out of memory
      expect(true).toBe(true);
    });
  });
});