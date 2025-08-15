# Code Map

A comprehensive code indexing and analysis tool for large TypeScript and JavaScript codebases.

## Overview

Code Map is a powerful tool that analyzes your TypeScript/JavaScript projects to extract code signatures, build dependency graphs, and provide insights into your codebase structure. It helps developers understand complex codebases by creating detailed maps of functions, classes, imports, and their relationships.

## Features

- **Fast File Discovery**: Automatically finds and filters TypeScript/JavaScript files while respecting `.gitignore` patterns
- **AST-Based Parsing**: Extracts detailed code signatures including functions, classes, constants, and imports
- **Dependency Resolution**: Resolves relative imports and builds comprehensive dependency graphs
- **Tree Visualization**: Creates hierarchical tree structures of your project
- **Incremental Updates**: Supports updating individual files without full re-indexing
- **Performance Optimized**: Processes files in parallel batches for large codebases
- **Comprehensive Stats**: Provides insights including circular dependencies, entry points, and complexity metrics

## Installation

### Global Installation

```bash
npm install -g code-map
```

### Local Development

```bash
# Clone the repository
git clone <repository-url>
cd code-map

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

## Usage

### Command Line Interface

#### Scan a Project

```bash
# Scan current directory
code-map scan

# Scan specific directory
code-map scan /path/to/project

# Scan with progress output
code-map scan --verbose

# Output to specific file
code-map scan --output project-index.json
```

#### Update Index

```bash
# Update a specific file
code-map update src/components/Button.tsx

# Update from existing index
code-map update src/utils.ts --index existing-index.json
```

#### Query Project

```bash
# Find functions
code-map query --type function --name "calculateSum"

# Find classes
code-map query --type class --name "UserService"

# Find files with specific patterns
code-map query --file "*.service.ts"

# Get project statistics
code-map query --stats
```

### Programmatic API

#### Basic Usage

```typescript
import { CodeIndexer } from 'code-map';

// Create indexer instance
const indexer = new CodeIndexer('/path/to/project');

// Process entire project
const projectIndex = await indexer.processProject();

// Update a single file
const updatedIndex = await indexer.updateFile('src/file.ts', projectIndex);

// Remove a file
const cleanedIndex = indexer.removeFile('src/old-file.ts', projectIndex);

// Get project statistics
const stats = CodeIndexer.getProjectStats(projectIndex);
```

#### Progress Tracking

```typescript
const indexer = new CodeIndexer('/path/to/project');

const projectIndex = await indexer.processProject((progress) => {
  console.log(`${progress.step}: ${progress.current}/${progress.total}`);
});
```

#### Working with Results

```typescript
// Access parsed functions
projectIndex.files['src/utils.ts'].functions.forEach(func => {
  console.log(`Function: ${func.name}`);
  console.log(`Parameters: ${func.params.map(p => p.name).join(', ')}`);
  console.log(`Async: ${func.isAsync}`);
  console.log(`Exported: ${func.isExported}`);
});

// Access classes
projectIndex.files['src/User.ts'].classes.forEach(cls => {
  console.log(`Class: ${cls.name}`);
  console.log(`Methods: ${cls.methods.map(m => m.name).join(', ')}`);
  console.log(`Properties: ${cls.properties.map(p => p.name).join(', ')}`);
});

// Access dependencies
projectIndex.files['src/index.ts'].dependencies.forEach(dep => {
  console.log(`Depends on: ${dep}`);
});
```

## Output Format

### Project Index Structure

```typescript
interface ProjectIndex {
  metadata: {
    version: number;           // Schema version
    root: string;             // Project root path
    createdAt: string;        // ISO timestamp
    updatedAt: string;        // ISO timestamp
    totalFiles: number;       // Number of indexed files
  };
  tree: TreeNode;             // Hierarchical project structure
  nodes: string[];            // Array of all file paths
  edges: Array<{              // Dependency relationships
    from: string;
    to: string;
  }>;
  files: Record<string, FileInfo>; // Detailed file information
}
```

### File Information Structure

```typescript
interface FileInfo {
  imports: ImportInfo[];      // Import/export statements
  dependencies: string[];     // Resolved file dependencies
  functions: FuncSig[];       // Function signatures
  classes: ClassInfo[];       // Class definitions
  constants: ConstInfo[];     // Constant/variable declarations
}

interface FuncSig {
  name: string;
  params: Array<{
    name: string;
    type?: string;
    optional?: boolean;
    rest?: boolean;
  }>;
  returnType?: string;
  isAsync: boolean;
  isExported: boolean;
  isGenerator?: boolean;
}

interface ClassInfo {
  name: string;
  isExported: boolean;
  isAbstract?: boolean;
  extends?: string;
  implements?: string[];
  methods: Array<{
    name: string;
    params: Array<{ name: string; type?: string }>;
    returnType?: string;
    isAsync: boolean;
    isStatic?: boolean;
    isPrivate?: boolean;
    isProtected?: boolean;
    isAbstract?: boolean;
  }>;
  properties: Array<{
    name: string;
    type?: string;
    isStatic?: boolean;
    isPrivate?: boolean;
    isProtected?: boolean;
    isReadonly?: boolean;
  }>;
}
```

## Configuration

### Supported File Types

- `.ts` - TypeScript files
- `.tsx` - TypeScript JSX files
- `.js` - JavaScript files
- `.jsx` - JavaScript JSX files

### Excluded Directories

By default, the following directories are excluded:

- `node_modules/`
- `dist/`
- `build/`
- `.next/`
- `.turbo/`
- `.git/`
- `coverage/`
- `.nyc_output/`

### Git Integration

Code Map respects your `.gitignore` file and applies the following default ignore patterns:

- IDE files (`.vscode/`, `.idea/`, `*.swp`)
- System files (`.DS_Store`, `Thumbs.db`)
- Log files (`*.log`, `logs/`)
- Environment files (`.env*`)
- Lock files (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`)

## Performance

### Benchmarks

- **Small projects** (< 100 files): ~1-2 seconds
- **Medium projects** (100-1000 files): ~5-10 seconds
- **Large projects** (1000+ files): ~30-60 seconds

### Optimization Features

- **Parallel processing**: Files are parsed in batches for optimal performance
- **Incremental updates**: Only modified files need re-processing
- **Memory efficient**: Large projects are processed in chunks
- **Fast discovery**: Uses optimized glob patterns for file discovery

## Statistics and Analysis

### Available Metrics

```typescript
interface ProjectStats {
  totalFiles: number;
  totalDependencies: number;
  averageDependenciesPerFile: number;
  circularDependencies: string[][];  // Circular dependency chains
  entryPoints: string[];             // Files with no dependencies
  leafFiles: string[];               // Files not imported by others
}
```

### Example Analysis

```typescript
const stats = CodeIndexer.getProjectStats(projectIndex);

console.log(`Total files: ${stats.totalFiles}`);
console.log(`Average dependencies per file: ${stats.averageDependenciesPerFile}`);

if (stats.circularDependencies.length > 0) {
  console.log('Circular dependencies found:');
  stats.circularDependencies.forEach(cycle => {
    console.log(`  ${cycle.join(' → ')}`);
  });
}

console.log(`Entry points: ${stats.entryPoints.join(', ')}`);
console.log(`Leaf files: ${stats.leafFiles.join(', ')}`);
```

## Troubleshooting

### Common Issues

#### "No TypeScript/JavaScript files found"

- Check that your project contains `.ts`, `.tsx`, `.js`, or `.jsx` files
- Verify the project path is correct
- Check if files are being excluded by `.gitignore` patterns

#### "Failed to parse file"

- The file may have syntax errors
- Check if the file is valid TypeScript/JavaScript
- Files with syntax errors are processed but return empty signatures

#### "Dependency resolution failed"

- This typically indicates issues with relative import paths
- The current implementation works best with standard relative imports (`./`, `../`)
- Absolute imports and module resolution may not work perfectly

#### Performance Issues

- For very large projects, consider excluding certain directories
- Use incremental updates instead of full re-indexing when possible
- Ensure sufficient memory is available for processing

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
# Enable debug output
DEBUG=code-map* code-map scan

# Verbose CLI output
code-map scan --verbose --debug
```

### Memory Usage

For large projects, you may need to increase Node.js memory:

```bash
# Increase memory limit
node --max-old-space-size=8192 code-map scan
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- src/core/indexer.test.ts

# Watch mode
npm run test:watch
```

### Building

```bash
# Build TypeScript
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check
```

### Architecture

The codebase is organized into several key modules:

- **FileDiscovery**: Finds and filters project files
- **ASTParser**: Parses TypeScript/JavaScript using the TypeScript compiler API
- **DependencyResolver**: Resolves import relationships between files
- **TreeBuilder**: Creates hierarchical project structures
- **CodeIndexer**: Main orchestration class that coordinates all components

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Code Standards

- TypeScript strict mode enabled
- ESLint configuration enforced
- Prettier formatting required
- Test coverage >80% for core modules
- All exports must be documented

## Roadmap

### Planned Features

- **Enhanced dependency resolution**: Better support for absolute imports and module resolution
- **Plugin system**: Support for custom parsers and analyzers
- **Visual output**: Generate dependency graphs and visualizations
- **Integration APIs**: Support for CI/CD and development workflows
- **Performance improvements**: Faster processing for very large codebases
- **Configuration files**: Support for project-specific configuration

### Known Limitations

- **Path Resolution**: Current implementation has limitations with complex import resolution
- **Dynamic Imports**: Limited support for dynamic imports and require statements
- **Type Information**: Doesn't extract detailed type information beyond basic signatures
- **JSX Analysis**: Limited analysis of JSX component relationships

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

For questions, issues, or contributions:

- **Issues**: [GitHub Issues](../../issues)
- **Discussions**: [GitHub Discussions](../../discussions)
- **Documentation**: This README and inline code documentation

---

**Code Map** - Understanding your codebase, one file at a time.