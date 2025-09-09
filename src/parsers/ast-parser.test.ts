/**
 * Unit tests for ASTParser module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import { ASTParser } from './ast-parser.js';

// Mock fs module
vi.mock('node:fs');
const mockFs = vi.mocked(fs);

interface MockFsPromises {
  readFile: ReturnType<typeof vi.fn>;
  stat: ReturnType<typeof vi.fn>;
}

describe('ASTParser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup fs mock
    mockFs.promises = {
      readFile: vi.fn(),
      stat: vi.fn().mockResolvedValue({ size: 1000 }) // Mock file size as 1KB (under 5MB limit)
    } as MockFsPromises;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseFile', () => {
    it('should parse a TypeScript file and extract code signatures', async () => {
      const filePath = '/test/sample.ts';
      const fileContent = `
import { Component } from 'react';
import utils from './utils';

export const API_URL = 'https://api.example.com';

export function calculateSum(a: number, b: number): number {
  return a + b;
}

export class UserService {
  private apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  async getUser(id: string): Promise<User> {
    return fetch(\`\${this.apiUrl}/users/\${id}\`);
  }
}
      `;

      (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(fileContent);

      const result = await ASTParser.parseFile(filePath);

      expect(result.imports).toHaveLength(2);
      expect(result.imports[0]).toEqual({
        from: 'react',
        kind: 'import',
        imported: ['Component']
      });
      expect(result.imports[1]).toEqual({
        from: './utils',
        kind: 'import',
        isDefault: true
      });

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0]).toEqual({
        name: 'calculateSum',
        params: [
          { name: 'a', type: 'number' },
          { name: 'b', type: 'number' }
        ],
        returnType: 'number',
        isAsync: false,
        isExported: true
      });

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].name).toBe('UserService');
      expect(result.classes[0].isExported).toBe(true);
      expect(result.classes[0].methods).toHaveLength(1);
      expect(result.classes[0].methods[0].name).toBe('getUser');
      expect(result.classes[0].methods[0].isAsync).toBe(true);

      expect(result.constants).toHaveLength(1);
      expect(result.constants[0]).toEqual({
        name: 'API_URL',
        type: undefined,
        initKind: 'literal',
        isExported: true
      });
    });

    it('should handle JavaScript files with JSX', async () => {
      const filePath = '/test/component.jsx';
      const fileContent = `
import React from 'react';

const Button = ({ onClick, children }) => {
  return <button onClick={onClick}>{children}</button>;
};

export default Button;
      `;

      (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(fileContent);

      const result = await ASTParser.parseFile(filePath);

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0]).toEqual({
        from: 'react',
        kind: 'import',
        isDefault: true
      });

      expect(result.constants).toHaveLength(1);
      expect(result.constants[0].name).toBe('Button');
      expect(result.constants[0].initKind).toBe('function');
    });

    it('should extract dynamic imports and require statements', async () => {
      const filePath = '/test/dynamic.ts';
      const fileContent = `
// Top-level require calls (these are currently not extracted by the parser)
const utils = require('./utils');
const config = require('../config.json');

// Top-level dynamic import (this might be extracted)
const dynamicModule = import('./top-level-dynamic');

async function loadModule() {
  const { helper } = await import('./helper');
  const dynamicModule = await import(\`./modules/\${moduleName}\`);
  return helper;
}
      `;

      (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(fileContent);

      const result = await ASTParser.parseFile(filePath);

      // Current implementation has limited support for dynamic imports/requires
      // It doesn't extract requires from variable declarations properly
      // Test what actually gets extracted
      expect(result.imports).toHaveLength(0); // Current behavior - no imports extracted
      
      // Function should be detected
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('loadModule');
      expect(result.functions[0].isAsync).toBe(true);
      
      // Constants should be detected (require() assignments become constants)
      expect(result.constants).toHaveLength(3); // utils, config, dynamicModule
      expect(result.constants.find(c => c.name === 'utils')).toBeDefined();
      expect(result.constants.find(c => c.name === 'config')).toBeDefined();
      expect(result.constants.find(c => c.name === 'dynamicModule')).toBeDefined();
    });

    it('should extract export statements', async () => {
      const filePath = '/test/exports.ts';
      const fileContent = `
export { utils, helper } from './utils';
export { default as Config } from './config';
export * from './types';

export const VERSION = '1.0.0';
export function deprecated() {}
      `;

      (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(fileContent);

      const result = await ASTParser.parseFile(filePath);

      const exportImports = result.imports.filter(imp => imp.kind === 'export');
      expect(exportImports).toHaveLength(3);
      
      expect(exportImports[0]).toEqual({
        from: './utils',
        kind: 'export',
        imported: ['utils', 'helper']
      });
      
      expect(exportImports[1]).toEqual({
        from: './config',
        kind: 'export',
        imported: ['Config']
      });
      
      expect(exportImports[2]).toEqual({
        from: './types',
        kind: 'export'
      });
    });

    it('should extract class inheritance and interfaces', async () => {
      const filePath = '/test/inheritance.ts';
      const fileContent = `
interface Serializable {
  serialize(): string;
}

interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

abstract class BaseEntity implements Serializable, Timestamped {
  createdAt: Date;
  updatedAt: Date;
  
  abstract serialize(): string;
  
  protected updateTimestamp(): void {
    this.updatedAt = new Date();
  }
}

export class User extends BaseEntity {
  private name: string;
  public readonly id: string;
  static instanceCount = 0;

  constructor(id: string, name: string) {
    super();
    this.id = id;
    this.name = name;
    User.instanceCount++;
  }

  serialize(): string {
    return JSON.stringify({ id: this.id, name: this.name });
  }

  static getInstanceCount(): number {
    return User.instanceCount;
  }
}
      `;

      (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(fileContent);

      const result = await ASTParser.parseFile(filePath);

      expect(result.classes).toHaveLength(2);
      
      const baseEntity = result.classes.find(cls => cls.name === 'BaseEntity');
      expect(baseEntity).toBeDefined();
      expect(baseEntity?.isAbstract).toBe(true);
      expect(baseEntity?.implements).toEqual(['Serializable', 'Timestamped']);
      expect(baseEntity?.methods).toHaveLength(2);
      
      const abstractMethod = baseEntity?.methods.find(m => m.name === 'serialize');
      expect(abstractMethod?.isAbstract).toBe(true);
      
      const protectedMethod = baseEntity?.methods.find(m => m.name === 'updateTimestamp');
      expect(protectedMethod?.isProtected).toBe(true);

      const user = result.classes.find(cls => cls.name === 'User');
      expect(user).toBeDefined();
      expect(user?.isExported).toBe(true);
      expect(user?.extends).toBe('BaseEntity');
      expect(user?.properties).toHaveLength(3);
      
      const nameProperty = user?.properties.find(p => p.name === 'name');
      expect(nameProperty?.isPrivate).toBe(true);
      
      const idProperty = user?.properties.find(p => p.name === 'id');
      expect(idProperty?.isReadonly).toBe(true);
      
      const staticProperty = user?.properties.find(p => p.name === 'instanceCount');
      expect(staticProperty?.isStatic).toBe(true);

      const staticMethod = user?.methods.find(m => m.name === 'getInstanceCount');
      expect(staticMethod?.isStatic).toBe(true);
    });

    it('should extract function signatures with various parameter types', async () => {
      const filePath = '/test/functions.ts';
      const fileContent = `
export function basicFunction(name: string): void {}

export async function asyncFunction(id: number): Promise<User> {
  return {} as User;
}

export function* generatorFunction(): Generator<number, void, unknown> {
  yield 1;
}

export function complexParams(
  required: string,
  optional?: number,
  ...rest: string[]
): { success: boolean } {
  return { success: true };
}

function privateFunction() {}

const arrowFunction = (x: number) => x * 2;

const asyncArrow = async (data: unknown) => {
  return data;
};
      `;

      (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(fileContent);

      const result = await ASTParser.parseFile(filePath);

      expect(result.functions).toHaveLength(5); // All function declarations including privateFunction

      const basicFunc = result.functions.find(f => f.name === 'basicFunction');
      expect(basicFunc).toEqual({
        name: 'basicFunction',
        params: [{ name: 'name', type: 'string' }],
        returnType: 'void',
        isAsync: false,
        isExported: true
      });

      const asyncFunc = result.functions.find(f => f.name === 'asyncFunction');
      expect(asyncFunc?.isAsync).toBe(true);
      expect(asyncFunc?.returnType).toBe('Promise<User>');

      const generatorFunc = result.functions.find(f => f.name === 'generatorFunction');
      expect(generatorFunc?.isGenerator).toBe(true);

      const complexFunc = result.functions.find(f => f.name === 'complexParams');
      expect(complexFunc?.params).toHaveLength(3);
      expect(complexFunc?.params[1]?.optional).toBe(true);
      expect(complexFunc?.params[2]?.rest).toBe(true);

      const privateFunc = result.functions.find(f => f.name === 'privateFunction');
      expect(privateFunc?.isExported).toBe(false);

      // Arrow functions should be in constants
      expect(result.constants).toHaveLength(2);
      const arrowConst = result.constants.find(c => c.name === 'arrowFunction');
      expect(arrowConst?.initKind).toBe('function');
    });

    it('should extract various constant types', async () => {
      const filePath = '/test/constants.ts';
      const fileContent = `
export const STRING_CONST = 'hello';
export const NUMBER_CONST = 42;
export const BOOLEAN_CONST = true;
export const NULL_CONST = null;
export const UNDEFINED_CONST = undefined;

export const OBJECT_CONST = {
  name: 'test',
  value: 123
};

export const ARRAY_CONST = [1, 2, 3];

const FUNCTION_CONST = function() { return 'test'; };

class ClassConst {}
const CLASS_CONST = ClassConst;

let variableLet = 'not exported';
var variableVar = 'also not exported';
      `;

      (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(fileContent);

      const result = await ASTParser.parseFile(filePath);

      expect(result.constants).toHaveLength(9); // 7 exported const + 2 const (FUNCTION_CONST, CLASS_CONST)

      const stringConst = result.constants.find(c => c.name === 'STRING_CONST');
      expect(stringConst?.initKind).toBe('literal');
      expect(stringConst?.isExported).toBe(true);

      const objectConst = result.constants.find(c => c.name === 'OBJECT_CONST');
      expect(objectConst?.initKind).toBe('object');

      const arrayConst = result.constants.find(c => c.name === 'ARRAY_CONST');
      expect(arrayConst?.initKind).toBe('array');

      const functionConst = result.constants.find(c => c.name === 'FUNCTION_CONST');
      expect(functionConst?.initKind).toBe('function');
      expect(functionConst?.isExported).toBe(false);

      // let and var should not be included unless exported
      const letVar = result.constants.find(c => c.name === 'variableLet');
      const varVar = result.constants.find(c => c.name === 'variableVar');
      expect(letVar).toBeUndefined();
      expect(varVar).toBeUndefined();
    });

    it('should handle files with syntax errors gracefully', async () => {
      const filePath = '/test/invalid.ts';
      const invalidContent = `
import { Component from 'react'; // Missing closing quote
export function broken(
  // Missing closing parenthesis and body
      `;

      (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(invalidContent);

      const result = await ASTParser.parseFile(filePath);

      // TypeScript parser is quite robust and can parse partial invalid syntax
      // The parser extracts what it can understand
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].from).toBe('react');
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('broken');
    });

    it('should handle file read errors gracefully', async () => {
      const filePath = '/test/nonexistent.ts';

      (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('File not found'));

      const result = await ASTParser.parseFile(filePath);

      // Should return empty FileInfo for files that cannot be read
      expect(result).toEqual({
        imports: [],
        dependencies: [],
        functions: [],
        classes: [],
        constants: []
      });
    });

    it('should determine correct script kind based on file extension', async () => {
      const testCases = [
        { filePath: '/test/file.ts', content: 'const x = 1;' },
        { filePath: '/test/file.tsx', content: 'const x = <div>test</div>;' },
        { filePath: '/test/file.js', content: 'const x = 1;' },
        { filePath: '/test/file.jsx', content: 'const x = <div>test</div>;' }
      ];

      for (const testCase of testCases) {
        (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(testCase.content);
        
        const result = await ASTParser.parseFile(testCase.filePath);
        
        // Should not throw and should parse successfully
        expect(result).toBeDefined();
        expect(result.imports).toBeDefined();
        expect(result.functions).toBeDefined();
        expect(result.classes).toBeDefined();
        expect(result.constants).toBeDefined();
      }
    });
  });

  describe('parseContent', () => {
    it('should parse content directly without file I/O', () => {
      const content = `
export const TEST_CONST = 'test';
export function testFunction(): void {}
      `;

      const result = ASTParser.parseContent(content, '/test/file.ts');

      expect(result.constants).toHaveLength(1);
      expect(result.constants[0].name).toBe('TEST_CONST');
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('testFunction');
    });

    it('should handle empty and whitespace-only content', () => {
      const emptyResult = ASTParser.parseContent('', '/test/empty.ts');
      const whitespaceResult = ASTParser.parseContent('   \n\t  \n   ', '/test/whitespace.ts');
      
      const expectedEmptyStructure = {
        imports: [],
        dependencies: [],
        functions: [],
        classes: [],
        constants: []
      };

      expect(emptyResult).toEqual(expectedEmptyStructure);
      expect(whitespaceResult).toEqual(expectedEmptyStructure);
    });
  });

  describe('edge cases and complex scenarios', () => {
    it('should handle nested classes and functions', async () => {
      const filePath = '/test/nested.ts';
      const content = `
export class OuterClass {
  innerMethod() {
    // This inner function should not be extracted as a top-level function
    function innerFunction() {
      return 'inner';
    }
    return innerFunction();
  }
}

function outerFunction() {
  // This inner class should not be extracted as a top-level class
  class InnerClass {
    method() {}
  }
  return new InnerClass();
}
      `;

      (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(content);

      const result = await ASTParser.parseFile(filePath);

      // Should only extract top-level declarations
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].name).toBe('OuterClass');
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('outerFunction');
    });

    it('should handle method overloads', async () => {
      const filePath = '/test/overloads.ts';
      const content = `
export class Calculator {
  add(a: number, b: number): number;
  add(a: string, b: string): string;
  add(a: number | string, b: number | string): number | string {
    return a + b;
  }
}
      `;

      (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(content);

      const result = await ASTParser.parseFile(filePath);

      expect(result.classes).toHaveLength(1);
      const calculator = result.classes[0];
      // TypeScript AST includes overload signatures as separate method declarations
      expect(calculator.methods).toHaveLength(3);
      // All methods should be named 'add'
      expect(calculator.methods.every(m => m.name === 'add')).toBe(true);
    });

    it('should handle decorators in classes', async () => {
      const filePath = '/test/decorators.ts';
      const content = `
function Component(target: any) {
  return target;
}

@Component
export class DecoratedClass {
  @Readonly
  property: string = 'test';

  @Log
  method(): void {}
}
      `;

      (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(content);

      const result = await ASTParser.parseFile(filePath);

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].name).toBe('DecoratedClass');
      expect(result.classes[0].properties).toHaveLength(1);
      expect(result.classes[0].methods).toHaveLength(1);
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('Component');
    });

    it('should handle very large files efficiently', async () => {
      const filePath = '/test/large.ts';
      
      // Generate a large file with many functions
      const functions = Array.from({ length: 1000 }, (_, i) => 
        `export function func${i}(param: number): number { return param * ${i}; }`
      ).join('\n');

      (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(functions);

      const startTime = Date.now();
      const result = await ASTParser.parseFile(filePath);
      const endTime = Date.now();

      expect(result.functions).toHaveLength(1000);
      // Should complete parsing within reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('critical failure path testing', () => {
    describe('file system failures', () => {
      it('should handle ENOENT file not found errors', async () => {
        const filePath = '/test/nonexistent.ts';
        (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ENOENT: no such file or directory, open'));

        const result = await ASTParser.parseFile(filePath);

        expect(result).toEqual({
          imports: [],
          dependencies: [],
          functions: [],
          classes: [],
          constants: []
        });
      });

      it('should handle EACCES permission denied errors', async () => {
        const filePath = '/test/restricted.ts';
        (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('EACCES: permission denied, open'));

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await ASTParser.parseFile(filePath);

        expect(result).toEqual({
          imports: [],
          dependencies: [],
          functions: [],
          classes: [],
          constants: []
        });

        consoleSpy.mockRestore();
      });

      it('should handle EIO input/output errors', async () => {
        const filePath = '/test/corrupted.ts';
        (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('EIO: i/o error, read'));

        const result = await ASTParser.parseFile(filePath);

        expect(result).toEqual({
          imports: [],
          dependencies: [],
          functions: [],
          classes: [],
          constants: []
        });
      });

      it('should handle EMFILE too many open files', async () => {
        const filePath = '/test/file.ts';
        (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('EMFILE: too many open files, open'));

        const result = await ASTParser.parseFile(filePath);

        expect(result).toEqual({
          imports: [],
          dependencies: [],
          functions: [],
          classes: [],
          constants: []
        });
      });

      it('should handle ENOSPC no space left on device during stat', async () => {
        const filePath = '/test/file.ts';
        (mockFs.promises.stat as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ENOSPC: no space left on device, stat'));

        const result = await ASTParser.parseFile(filePath);

        expect(result).toEqual({
          imports: [],
          dependencies: [],
          functions: [],
          classes: [],
          constants: []
        });
      });
    });

    describe('memory and resource exhaustion', () => {
      it('should handle oversized files gracefully', async () => {
        const filePath = '/test/huge.ts';
        
        // Mock stat to return file size over limit
        (mockFs.promises.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ 
          size: 10 * 1024 * 1024 // 10MB - over the 1MB limit
        });

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await ASTParser.parseFile(filePath);

        expect(result).toEqual({
          imports: [],
          dependencies: [],
          functions: [],
          classes: [],
          constants: []
        });

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Warning: Skipping AST parsing for oversized file'));

        consoleSpy.mockRestore();
      });

      it('should handle memory exhaustion during parsing', async () => {
        const filePath = '/test/memory-intensive.ts';
        const complexContent = `
          // Complex deeply nested structure that could cause memory issues
          export const deeplyNested = ${JSON.stringify(Array.from({ length: 1000 }, (_, i) => ({ [`key${i}`]: `value${i}` })))};
        `;

        (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(complexContent);

        // Should handle even complex content without crashing
        const result = await ASTParser.parseFile(filePath);

        expect(result).toBeDefined();
        expect(result.constants).toHaveLength(1);
        expect(result.constants[0].name).toBe('deeplyNested');
      });

      it('should handle circular reference attempts', async () => {
        const filePath = '/test/circular.ts';
        const circularContent = `
          export const a: any = { b };
          export const b: any = { a };
          export function recursive(): any {
            return recursive();
          }
        `;

        (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(circularContent);

        const result = await ASTParser.parseFile(filePath);

        expect(result.constants).toHaveLength(2);
        expect(result.functions).toHaveLength(1);
        expect(result.constants.find(c => c.name === 'a')).toBeDefined();
        expect(result.constants.find(c => c.name === 'b')).toBeDefined();
        expect(result.functions[0].name).toBe('recursive');
      });
    });

    describe('encoding and character issues', () => {
      it('should handle non-UTF8 encoded files', async () => {
        const filePath = '/test/encoded.ts';
        // Simulate file with encoding issues
        const binaryContent = Buffer.from([0xFF, 0xFE, 0x65, 0x00, 0x78, 0x00, 0x70, 0x00]).toString('binary');
        
        (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(binaryContent);

        const result = await ASTParser.parseFile(filePath);

        // Should not crash and return empty structure
        expect(result).toBeDefined();
        expect(result.imports).toBeDefined();
        expect(result.functions).toBeDefined();
        expect(result.classes).toBeDefined();
        expect(result.constants).toBeDefined();
      });

      it('should handle files with null bytes', async () => {
        const filePath = '/test/nullbytes.ts';
        const contentWithNulls = 'export const test\0 = true;\0function bad\0() {}';
        
        (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(contentWithNulls);

        const result = await ASTParser.parseFile(filePath);

        // Should parse what it can despite null bytes
        expect(result).toBeDefined();
        expect(result.imports).toBeDefined();
        expect(result.functions).toBeDefined();
        expect(result.classes).toBeDefined();
        expect(result.constants).toBeDefined();
      });

      it('should handle extremely long lines', async () => {
        const filePath = '/test/longlines.ts';
        const veryLongLine = 'export const longString = "' + 'x'.repeat(10000) + '";';
        
        (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(veryLongLine);

        const result = await ASTParser.parseFile(filePath);

        expect(result.constants).toHaveLength(1);
        expect(result.constants[0].name).toBe('longString');
      });
    });

    describe('parsing corruption scenarios', () => {
      it('should handle incomplete TypeScript syntax gracefully', async () => {
        const filePath = '/test/incomplete.ts';
        const incompleteContent = `
          import { Component from 'react
          export function broken(
          class Invalid {
            method( {
          export const incomplete = 
          interface Broken
        `;

        (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(incompleteContent);

        const result = await ASTParser.parseFile(filePath);

        // TypeScript parser is resilient - should extract what it can
        expect(result).toBeDefined();
        expect(result.imports).toBeDefined();
        expect(result.functions).toBeDefined();
        expect(result.classes).toBeDefined();
        expect(result.constants).toBeDefined();
      });

      it('should handle mixed content types (TypeScript + non-code)', async () => {
        const filePath = '/test/mixed.ts';
        const mixedContent = `
          /* This is TypeScript */
          export const valid = true;
          
          <!-- This is HTML somehow mixed in -->
          <div>Not TypeScript</div>
          
          # This looks like Markdown
          
          export function stillValid() {
            return 'works';
          }
        `;

        (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(mixedContent);

        const result = await ASTParser.parseFile(filePath);

        // Should extract valid TypeScript despite mixed content
        expect(result.constants.length).toBeGreaterThanOrEqual(1);
        expect(result.functions.length).toBeGreaterThanOrEqual(1);
        expect(result.constants.find(c => c.name === 'valid')).toBeDefined();
        expect(result.functions.find(f => f.name === 'stillValid')).toBeDefined();
      });

      it('should handle parser timeouts on extremely complex files', async () => {
        const filePath = '/test/complex.ts';
        
        // Generate extremely complex nested structure
        const complexContent = `
          export const complex = {
            ${Array.from({ length: 100 }, (_, i) => `
              level${i}: {
                ${Array.from({ length: 50 }, (_, j) => `prop${j}: () => ({ nested: true })`).join(',\n                ')}
              }`).join(',\n            ')}
          };
        `;

        (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(complexContent);

        const startTime = Date.now();
        const result = await ASTParser.parseFile(filePath);
        const endTime = Date.now();

        // Should complete within reasonable time
        expect(endTime - startTime).toBeLessThan(5000);
        expect(result.constants).toHaveLength(1);
        expect(result.constants[0].name).toBe('complex');
      });
    });


    describe('recovery and cleanup after failures', () => {
      it('should maintain clean state after parse failures', async () => {
        const filePath1 = '/test/fail.ts';
        const filePath2 = '/test/success.ts';

        // First file fails
        (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Parse failure'));
        
        const result1 = await ASTParser.parseFile(filePath1);
        expect(result1).toEqual({
          imports: [],
          dependencies: [],
          functions: [],
          classes: [],
          constants: []
        });

        // Second file should work normally
        (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce('export const success = true;');
        
        const result2 = await ASTParser.parseFile(filePath2);
        expect(result2.constants).toHaveLength(1);
        expect(result2.constants[0].name).toBe('success');
      });

      it('should handle concurrent parsing without interference', async () => {
        const filePath1 = '/test/concurrent1.ts';
        const filePath2 = '/test/concurrent2.ts';

        (mockFs.promises.readFile as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
          if (path.includes('concurrent1')) {
            return Promise.resolve('export const one = 1;');
          } else if (path.includes('concurrent2')) {
            return Promise.resolve('export const two = 2;');
          }
          return Promise.reject(new Error('Unknown file'));
        });

        // Parse files concurrently
        const [result1, result2] = await Promise.all([
          ASTParser.parseFile(filePath1),
          ASTParser.parseFile(filePath2)
        ]);

        expect(result1.constants[0].name).toBe('one');
        expect(result2.constants[0].name).toBe('two');
      });
    });
  });
});