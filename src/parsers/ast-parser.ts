/**
 * AST parsing module - extracts code signatures using TypeScript compiler API
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import type { 
  FuncSig, 
  ClassInfo, 
  ConstInfo, 
  ImportInfo,
  FileInfo 
} from '../types/index.js';

export class ASTParser {
  /**
   * Parse a TypeScript/JavaScript file and extract code signatures
   * @param filePath - Absolute path to the file
   * @returns FileInfo with extracted signatures
   */
  static async parseFile(filePath: string): Promise<FileInfo> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      return this.parseContent(content, filePath);
    } catch {
      // Return empty FileInfo for files that can't be read
      return {
        imports: [],
        dependencies: [],
        functions: [],
        classes: [],
        constants: []
      };
    }
  }

  /**
   * Parse file content and extract code signatures
   * @param content - File content as string
   * @param filePath - File path for error reporting
   * @returns FileInfo with extracted signatures
   */
  static parseContent(content: string, filePath: string): FileInfo {
    const ext = path.extname(filePath);
    const scriptKind = this.getScriptKind(ext);
    
    try {
      // Create TypeScript source file
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true,
        scriptKind
      );

      const imports: ImportInfo[] = [];
      const functions: FuncSig[] = [];
      const classes: ClassInfo[] = [];
      const constants: ConstInfo[] = [];

      // Walk the AST for top-level declarations
      ts.forEachChild(sourceFile, (node) => {
        this.visitNode(node, imports, functions, classes, constants, sourceFile);
      });

      return {
        imports,
        dependencies: [], // Will be populated by dependency resolver
        functions,
        classes,
        constants
      };
    } catch {
      // Return empty FileInfo for files with syntax errors
      return {
        imports: [],
        dependencies: [],
        functions: [],
        classes: [],
        constants: []
      };
    }
  }

  /**
   * Get appropriate ScriptKind for file extension
   * @param ext - File extension
   * @returns TypeScript ScriptKind
   */
  private static getScriptKind(ext: string): ts.ScriptKind {
    switch (ext) {
      case '.tsx':
        return ts.ScriptKind.TSX;
      case '.jsx':
        return ts.ScriptKind.JSX;
      case '.js':
        return ts.ScriptKind.JS;
      case '.ts':
      default:
        return ts.ScriptKind.TS;
    }
  }

  /**
   * Visit AST node and extract relevant information
   * @param node - AST node to visit
   * @param imports - Array to collect imports
   * @param functions - Array to collect functions
   * @param classes - Array to collect classes
   * @param constants - Array to collect constants
   * @param sourceFile - Source file for text extraction
   */
  private static visitNode(
    node: ts.Node,
    imports: ImportInfo[],
    functions: FuncSig[],
    classes: ClassInfo[],
    constants: ConstInfo[],
    sourceFile: ts.SourceFile
  ): void {
    switch (node.kind) {
      case ts.SyntaxKind.ImportDeclaration:
        this.extractImport(node as ts.ImportDeclaration, imports);
        break;
      
      case ts.SyntaxKind.ExportDeclaration:
        this.extractExport(node as ts.ExportDeclaration, imports);
        break;
      
      case ts.SyntaxKind.FunctionDeclaration:
        this.extractFunction(node as ts.FunctionDeclaration, functions);
        break;
      
      case ts.SyntaxKind.ClassDeclaration:
        this.extractClass(node as ts.ClassDeclaration, classes, sourceFile);
        break;
      
      case ts.SyntaxKind.VariableStatement:
        this.extractConstants(node as ts.VariableStatement, constants);
        break;
      
      case ts.SyntaxKind.ExportAssignment:
        // Handle export = statements
        break;
      
      default:
        // For dynamic imports and requires, we need to walk deeper
        if (node.kind === ts.SyntaxKind.CallExpression) {
          this.extractDynamicImport(node as ts.CallExpression, imports);
        }
        
        // Continue walking for nested dynamic imports
        ts.forEachChild(node, (child) => {
          if (child.kind === ts.SyntaxKind.CallExpression) {
            this.visitNode(child, imports, functions, classes, constants, sourceFile);
          }
        });
        break;
    }
  }

  /**
   * Extract import declaration information
   * @param node - Import declaration node
   * @param imports - Array to add import info to
   */
  private static extractImport(node: ts.ImportDeclaration, imports: ImportInfo[]): void {
    if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) {
      return;
    }

    const from = node.moduleSpecifier.text;
    const importInfo: ImportInfo = {
      from,
      kind: 'import'
    };

    if (node.importClause) {
      const clause = node.importClause;
      
      // Default import
      if (clause.name) {
        importInfo.isDefault = true;
      }
      
      // Named imports or namespace import
      if (clause.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings)) {
          importInfo.isNamespace = true;
        } else if (ts.isNamedImports(clause.namedBindings)) {
          importInfo.imported = clause.namedBindings.elements.map(
            element => element.name.text
          );
        }
      }
    }

    imports.push(importInfo);
  }

  /**
   * Extract export declaration information
   * @param node - Export declaration node
   * @param imports - Array to add export info to
   */
  private static extractExport(node: ts.ExportDeclaration, imports: ImportInfo[]): void {
    if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) {
      return;
    }

    const from = node.moduleSpecifier.text;
    const exportInfo: ImportInfo = {
      from,
      kind: 'export'
    };

    if (node.exportClause && ts.isNamedExports(node.exportClause)) {
      exportInfo.imported = node.exportClause.elements.map(
        element => element.name.text
      );
    }

    imports.push(exportInfo);
  }

  /**
   * Extract dynamic import or require call
   * @param node - Call expression node
   * @param imports - Array to add import info to
   */
  private static extractDynamicImport(node: ts.CallExpression, imports: ImportInfo[]): void {
    const expression = node.expression;
    
    // Dynamic import: import('module')
    if (expression.kind === ts.SyntaxKind.ImportKeyword) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteral(arg)) {
        imports.push({
          from: arg.text,
          kind: 'dynamic-import'
        });
      }
    }
    
    // Require: require('module')
    if (ts.isIdentifier(expression) && expression.text === 'require') {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteral(arg)) {
        imports.push({
          from: arg.text,
          kind: 'require'
        });
      }
    }
  }

  /**
   * Extract function declaration information
   * @param node - Function declaration node
   * @param functions - Array to add function info to
   */
  private static extractFunction(node: ts.FunctionDeclaration, functions: FuncSig[]): void {
    if (!node.name) {
      return; // Skip anonymous functions
    }

    const name = node.name.text;
    const isAsync = !!(node.modifiers && node.modifiers.some(
      mod => mod.kind === ts.SyntaxKind.AsyncKeyword
    ));
    const isExported = !!(node.modifiers && node.modifiers.some(
      mod => mod.kind === ts.SyntaxKind.ExportKeyword
    ));
    const isGenerator = !!node.asteriskToken;

    const params = node.parameters.map(param => {
      const paramName = param.name.kind === ts.SyntaxKind.Identifier 
        ? (param.name as ts.Identifier).text 
        : 'unknown';
      
      const paramObj: {
        name: string;
        type?: string;
        optional?: boolean;
        rest?: boolean;
      } = { name: paramName };
      
      if (param.type) {
        paramObj.type = param.type.getText();
      }
      if (param.questionToken) {
        paramObj.optional = true;
      }
      if (param.dotDotDotToken) {
        paramObj.rest = true;
      }
      
      return paramObj;
    });

    const funcSig: FuncSig = {
      name,
      params,
      isAsync,
      isExported
    };
    
    if (node.type) {
      funcSig.returnType = node.type.getText();
    }
    if (isGenerator) {
      funcSig.isGenerator = true;
    }

    functions.push(funcSig);
  }

  /**
   * Extract class declaration information
   * @param node - Class declaration node
   * @param classes - Array to add class info to
   * @param sourceFile - Source file for text extraction
   */
  private static extractClass(
    node: ts.ClassDeclaration, 
    classes: ClassInfo[], 
    sourceFile: ts.SourceFile
  ): void {
    if (!node.name) {
      return; // Skip anonymous classes
    }

    const name = node.name.text;
    const isExported = !!(node.modifiers && node.modifiers.some(
      mod => mod.kind === ts.SyntaxKind.ExportKeyword
    ));
    const isAbstract = !!(node.modifiers && node.modifiers.some(
      mod => mod.kind === ts.SyntaxKind.AbstractKeyword
    ));

    // Extract extends clause
    let extendsClass: string | undefined;
    if (node.heritageClauses) {
      const extendsClause = node.heritageClauses.find(
        clause => clause.token === ts.SyntaxKind.ExtendsKeyword
      );
      if (extendsClause && extendsClause.types.length > 0) {
        const firstType = extendsClause.types[0];
        if (firstType && firstType.expression) {
          extendsClass = firstType.expression.getText(sourceFile);
        }
      }
    }

    // Extract implements clause
    let implementsInterfaces: string[] = [];
    if (node.heritageClauses) {
      const implementsClause = node.heritageClauses.find(
        clause => clause.token === ts.SyntaxKind.ImplementsKeyword
      );
      if (implementsClause) {
        implementsInterfaces = implementsClause.types.map(
          type => type.expression.getText(sourceFile)
        );
      }
    }

    const methods: ClassInfo['methods'] = [];
    const properties: ClassInfo['properties'] = [];

    // Extract members
    node.members.forEach(member => {
      if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
        const methodName = member.name.text;
        const isStatic = !!(member.modifiers && member.modifiers.some(
          mod => mod.kind === ts.SyntaxKind.StaticKeyword
        ));
        const isPrivate = !!(member.modifiers && member.modifiers.some(
          mod => mod.kind === ts.SyntaxKind.PrivateKeyword
        ));
        const isProtected = !!(member.modifiers && member.modifiers.some(
          mod => mod.kind === ts.SyntaxKind.ProtectedKeyword
        ));
        const isAbstractMethod = !!(member.modifiers && member.modifiers.some(
          mod => mod.kind === ts.SyntaxKind.AbstractKeyword
        ));
        const isAsyncMethod = !!(member.modifiers && member.modifiers.some(
          mod => mod.kind === ts.SyntaxKind.AsyncKeyword
        ));

        const params = member.parameters.map(param => {
          const paramName = param.name.kind === ts.SyntaxKind.Identifier 
            ? (param.name as ts.Identifier).text 
            : 'unknown';
          
          const paramObj: {
            name: string;
            type?: string;
            optional?: boolean;
            rest?: boolean;
          } = { name: paramName };
          
          if (param.type) {
            paramObj.type = param.type.getText();
          }
          if (param.questionToken) {
            paramObj.optional = true;
          }
          if (param.dotDotDotToken) {
            paramObj.rest = true;
          }
          
          return paramObj;
        });

        const methodObj: ClassInfo['methods'][0] = {
          name: methodName,
          params,
          isAsync: isAsyncMethod
        };
        
        if (member.type) {
          methodObj.returnType = member.type.getText();
        }
        if (isStatic) {
          methodObj.isStatic = true;
        }
        if (isPrivate) {
          methodObj.isPrivate = true;
        }
        if (isProtected) {
          methodObj.isProtected = true;
        }
        if (isAbstractMethod) {
          methodObj.isAbstract = true;
        }

        methods.push(methodObj);
      } else if (ts.isPropertyDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
        const propertyName = member.name.text;
        const isStatic = !!(member.modifiers && member.modifiers.some(
          mod => mod.kind === ts.SyntaxKind.StaticKeyword
        ));
        const isPrivate = !!(member.modifiers && member.modifiers.some(
          mod => mod.kind === ts.SyntaxKind.PrivateKeyword
        ));
        const isProtected = !!(member.modifiers && member.modifiers.some(
          mod => mod.kind === ts.SyntaxKind.ProtectedKeyword
        ));
        const isReadonly = !!(member.modifiers && member.modifiers.some(
          mod => mod.kind === ts.SyntaxKind.ReadonlyKeyword
        ));

        const propertyObj: ClassInfo['properties'][0] = {
          name: propertyName
        };
        
        if (member.type) {
          propertyObj.type = member.type.getText();
        }
        if (isStatic) {
          propertyObj.isStatic = true;
        }
        if (isPrivate) {
          propertyObj.isPrivate = true;
        }
        if (isProtected) {
          propertyObj.isProtected = true;
        }
        if (isReadonly) {
          propertyObj.isReadonly = true;
        }

        properties.push(propertyObj);
      }
    });

    const classObj: ClassInfo = {
      name,
      isExported,
      methods,
      properties
    };
    
    if (isAbstract) {
      classObj.isAbstract = true;
    }
    if (extendsClass) {
      classObj.extends = extendsClass;
    }
    if (implementsInterfaces.length > 0) {
      classObj.implements = implementsInterfaces;
    }

    classes.push(classObj);
  }

  /**
   * Extract constant/variable declarations
   * @param node - Variable statement node
   * @param constants - Array to add constant info to
   */
  private static extractConstants(node: ts.VariableStatement, constants: ConstInfo[]): void {
    const isExported = !!(node.modifiers && node.modifiers.some(
      mod => mod.kind === ts.SyntaxKind.ExportKeyword
    ));

    node.declarationList.declarations.forEach(declaration => {
      if (declaration.name.kind === ts.SyntaxKind.Identifier) {
        const name = (declaration.name as ts.Identifier).text;
        const type = declaration.type ? declaration.type.getText() : undefined;
        
        // Determine initialization kind
        let initKind: ConstInfo['initKind'] = 'unknown';
        if (declaration.initializer) {
          initKind = this.getInitializerKind(declaration.initializer);
        }

        // Only include const declarations or exported let/var
        const isConst = node.declarationList.flags & ts.NodeFlags.Const;
        if (isConst || isExported) {
          const constObj: ConstInfo = {
            name,
            initKind,
            isExported
          };
          
          if (type) {
            constObj.type = type;
          }
          
          constants.push(constObj);
        }
      }
    });
  }

  /**
   * Determine the kind of initializer expression
   * @param initializer - Initializer expression
   * @returns Kind of initializer
   */
  private static getInitializerKind(initializer: ts.Expression): ConstInfo['initKind'] {
    switch (initializer.kind) {
      case ts.SyntaxKind.StringLiteral:
      case ts.SyntaxKind.NumericLiteral:
      case ts.SyntaxKind.TrueKeyword:
      case ts.SyntaxKind.FalseKeyword:
      case ts.SyntaxKind.NullKeyword:
      case ts.SyntaxKind.UndefinedKeyword:
        return 'literal';
      
      case ts.SyntaxKind.FunctionExpression:
      case ts.SyntaxKind.ArrowFunction:
        return 'function';
      
      case ts.SyntaxKind.ClassExpression:
        return 'class';
      
      case ts.SyntaxKind.ObjectLiteralExpression:
        return 'object';
      
      case ts.SyntaxKind.ArrayLiteralExpression:
        return 'array';
      
      default:
        return 'unknown';
    }
  }
}