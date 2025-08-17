# AGENT.md
This file provides guidance to AI coding assistants working in this repository.

**Note:** CLAUDE.md, .clinerules, .cursorrules, .windsurfrules, and other AI config files are symlinks to AGENT.md in this project.

# Code Map - TypeScript Code Indexer

A lightweight, self-contained TypeScript/JavaScript code indexing tool that generates comprehensive maps of project structure, dependencies, and code signatures. This tool provides fast analysis of codebases by extracting file trees, inter-file dependencies, and essential code metadata without requiring a TypeScript compiler or complex toolchain.

## Build & Commands

### Initial Setup (REQUIRED FIRST)
**CRITICAL**: This project is not yet initialized. You must first set up the Node.js project:

```bash
# Initialize Node.js project with ESM support
npm init -y

# Update package.json to include type: "module" and required scripts
# Install core dependencies
npm install fast-glob@^3 ignore@^7 tsx@^4 typescript@^5

# Install development dependencies
npm install --save-dev @types/node vitest @vitest/coverage-v8 eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier
```

### Development Commands (After Setup)
**Note**: These commands will be available after initializing the project:

- **Development**: `npm run dev` (run with tsx)
- **Build**: `npm run build` (compile TypeScript)
- **Test**: `npm test` (run Vitest tests)
- **Test with coverage**: `npm run test:coverage`
- **Type check**: `npm run typecheck` (tsc --noEmit)
- **Lint**: `npm run lint` (ESLint)
- **Format**: `npm run format` (Prettier)
- **Clean**: `npm run clean` (remove build artifacts)

### CLI Usage (Planned)
```bash
# Full project scan
npx tsx src/indexer.ts scan [root]

# Update single file in index
npx tsx src/indexer.ts update <file>
```

### Script Command Consistency
**Important**: When modifying npm scripts in package.json, ensure all references are updated:
- GitHub Actions workflows (.github/workflows/*.yml)
- README.md documentation
- Contributing guides
- Claude Code hooks in .claude/settings.json

## Code Style

### Language & Framework
- **Language**: TypeScript 5.x with strict mode
- **Module System**: ESM (ECMAScript Modules) - use `import`/`export`
- **Runtime**: Node.js 18+ with native ESM support
- **Execution**: tsx for development (no compilation needed)

### TypeScript Configuration
```typescript
// Recommended tsconfig.json settings
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowJs": false,
    "noEmit": true,
    "types": ["node", "vitest/globals"]
  }
}
```

### Import Conventions
- Use ESM imports exclusively (no `require()`)
- Prefer named exports over default exports
- Group imports: external deps, then internal modules
- Use `.js` extensions for relative imports in TypeScript files
```typescript
// External dependencies
import { glob } from 'fast-glob';
import ignore from 'ignore';

// Internal modules (note .js extension even for .ts files)
import { parseFile } from './parser.js';
import type { FileNode, ProjectIndex } from './types.js';
```

### Naming Conventions
- **Files**: kebab-case (`file-discovery.ts`, `ast-parser.ts`)
- **Classes**: PascalCase (`FileDiscovery`, `AstParser`)
- **Interfaces/Types**: PascalCase with descriptive names
- **Functions**: camelCase, verb-prefixed (`parseFile`, `buildTree`)
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Private methods**: prefix with underscore (`_processNode`)

### Error Handling
- Use structured error types for different failure modes
- Provide context in error messages (file path, line number)
- Never swallow errors silently
- Log warnings for recoverable issues
```typescript
class ParseError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly line?: number
  ) {
    super(`${filePath}${line ? `:${line}` : ''}: ${message}`);
    this.name = 'ParseError';
  }
}
```

### Type Usage Patterns
- Prefer interfaces for object shapes
- Use type aliases for unions, intersections, and complex types
- Always specify return types explicitly
- Use `readonly` for immutable properties
- Leverage discriminated unions for state
```typescript
interface FileNode {
  readonly path: string;
  readonly type: 'file' | 'directory';
  dependencies?: string[];
}

type ParseResult = 
  | { success: true; data: FileNode }
  | { success: false; error: Error };
```

## Testing

### Testing Framework
- **Framework**: Vitest (Jest-compatible API)
- **Test files**: `*.test.ts` or `*.spec.ts` alongside source files
- **Coverage**: Vitest with v8 coverage provider
- **Assertions**: Use Vitest's `expect` API

### Testing Conventions
```typescript
// File: src/parser.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { parseFile } from './parser.js';

describe('parseFile', () => {
  it('should extract function signatures', async () => {
    const result = await parseFile('test.ts');
    expect(result.functions).toHaveLength(2);
  });
});
```

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm test src/parser.test.ts
```

### Testing Philosophy
**When tests fail, fix the code, not the test.**

Key principles:
- **Tests should be meaningful** - Test actual functionality, not implementation details
- **Test edge cases** - Empty files, malformed syntax, circular dependencies
- **Mock file system** - Use virtual file system for file operations
- **Test in isolation** - Each module should be testable independently
- **Document test purpose** - Each test should have a clear description

## Security

### Data Protection
- **Read-only operations**: Scanner only reads files, never modifies
- **Path validation**: Prevent directory traversal attacks
- **Ignore sensitive files**: Respect `.gitignore` and add security patterns
- **No code execution**: Only static analysis, never eval or dynamic imports

### Secret Management
- Never log file contents that might contain secrets
- Exclude common secret file patterns (`.env`, `*.key`, `*.pem`)
- Add security-focused ignore patterns by default

## Directory Structure & File Organization

### Project Structure
```
code-map/
├── src/                      # Source code
│   ├── indexer.ts           # CLI entry point
│   ├── commands/            # Command implementations
│   │   ├── scan.ts         # Full scan command
│   │   └── update.ts       # Incremental update
│   ├── modules/             # Core modules
│   │   ├── file-discovery.ts
│   │   ├── ast-parser.ts
│   │   ├── dependency-resolver.ts
│   │   └── tree-builder.ts
│   ├── types/               # TypeScript type definitions
│   │   └── index.ts        # Centralized type exports
│   └── utils/               # Utility functions
├── tests/                    # Integration tests
├── reports/                  # All project reports
├── temp/                     # Temporary files (gitignored)
└── .codebasemap             # Generated index file
```

### Reports Directory
ALL project reports and documentation should be saved to the `reports/` directory:

```
code-map/
├── reports/              # All project reports and documentation
│   └── *.md             # Various report types
├── temp/                # Temporary files and debugging
└── [other directories]
```

### Report Generation Guidelines
**Important**: ALL reports should be saved to the `reports/` directory with descriptive names:

**Implementation Reports:**
- Phase validation: `PHASE_X_VALIDATION_REPORT.md`
- Implementation summaries: `IMPLEMENTATION_SUMMARY_[FEATURE].md`
- Feature completion: `FEATURE_[NAME]_REPORT.md`

**Testing & Analysis Reports:**
- Test results: `TEST_RESULTS_[DATE].md`
- Coverage reports: `COVERAGE_REPORT_[DATE].md`
- Performance analysis: `PERFORMANCE_ANALYSIS_[SCENARIO].md`

**Report Naming Conventions:**
- Use descriptive names: `[TYPE]_[SCOPE]_[DATE].md`
- Include dates: `YYYY-MM-DD` format
- Group with prefixes: `TEST_`, `PERFORMANCE_`, `IMPLEMENTATION_`
- Markdown format: All reports end in `.md`

### Temporary Files & Debugging
All temporary files, debugging scripts, and test artifacts should be organized in a `/temp` folder:

**Temporary File Organization:**
- **Debug scripts**: `temp/debug-*.js`, `temp/analyze-*.ts`
- **Test artifacts**: `temp/test-results/`, `temp/coverage/`
- **Generated files**: `temp/generated/`, `temp/build-artifacts/`
- **Logs**: `temp/logs/debug.log`, `temp/logs/error.log`

**Guidelines:**
- Never commit files from `/temp` directory
- Use `/temp` for all debugging and analysis scripts
- Clean up `/temp` directory regularly
- Include `/temp/` in `.gitignore`

### Example `.gitignore` patterns
```gitignore
# Dependencies
node_modules/

# Build outputs
dist/
build/
*.js
*.js.map
*.d.ts
!src/types/*.d.ts

# Temporary files and debugging
/temp/
temp/
**/temp/
debug-*.js
test-*.ts
analyze-*.sh
*-debug.*
*.debug

# Claude settings
.claude/settings.local.json

# Simple Task Master
.simple-task-master/tasks/
.simple-task-master/lock

# Generated index
.codebasemap

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Don't ignore reports directory
!reports/
!reports/**
```

### Claude Code Settings (.claude Directory)

The `.claude` directory contains Claude Code configuration with automated development workflows:

#### Version Controlled Files (commit these):
- `.claude/settings.json` - Team hooks for linting, type checking, testing
- `.claude/agents/` - Specialized AI agent configurations
- `.claude/commands/*.md` - Custom slash commands

#### Ignored Files (do NOT commit):
- `.claude/settings.local.json` - Personal preferences
- Any `*.local.json` files - Personal configuration

**Current Hooks Configuration:**
- **PostToolUse**: Automatically runs after file edits:
  - Lint changed files
  - Type check changed files
  - Run tests for changed files
  - Check for comment replacements
- **Stop**: Runs when session ends:
  - Full project type check
  - Full project lint
  - Full test suite
  - TODO checking
  - Create checkpoint

## Configuration

### Environment Setup

1. **Node.js Version**: Requires Node.js 18+ for native ESM support
   ```bash
   node --version  # Should be >= 18.0.0
   ```

2. **Package Configuration**: Ensure `package.json` includes:
   ```json
   {
     "type": "module",
     "engines": {
       "node": ">=18.0.0"
     }
   }
   ```

3. **TypeScript Configuration**: Create `tsconfig.json` with strict settings (see Code Style section)

4. **ESLint Configuration**: Set up for TypeScript and ESM

5. **Vitest Configuration**: Configure for TypeScript and coverage

### Dependencies

**Core Dependencies:**
- `fast-glob@^3`: File system traversal
- `ignore@^7`: Gitignore parsing
- `tsx@^4`: TypeScript execution
- `typescript@^5`: AST parsing

**Development Dependencies:**
- `@types/node`: Node.js type definitions
- `vitest`: Testing framework
- `@vitest/coverage-v8`: Coverage reporting
- `eslint` & TypeScript plugins: Linting
- `prettier`: Code formatting

## Implementation Roadmap

The project has a detailed task breakdown in `.simple-task-master/tasks/`. Key implementation phases:

1. **Setup Phase**: Initialize project, install dependencies
2. **Core Modules**: Implement file discovery, AST parsing, dependency resolution
3. **Command Implementation**: Build scan and update commands
4. **Testing**: Unit tests for each module, integration tests
5. **Documentation**: Generate comprehensive documentation

## Git Commit Conventions

Based on the project's commit history:
- **Format**: Simple imperative mood messages
- **Structure**: `<verb> <what>`
- **Examples**: 
  - "Add code indexer specification"
  - "Implement file discovery module"
  - "Fix dependency resolution bug"
- **Length**: Keep under 50 characters
- **No prefixes**: No conventional commit prefixes needed

## Contributing Guidelines

1. **Before coding**: Read the specifications in `specs/` directory
2. **Follow the task breakdown**: Use `.simple-task-master/tasks/` as a guide
3. **Test everything**: Write tests alongside implementation
4. **Document changes**: Update this file if adding new patterns
5. **Use the hooks**: Let Claude Code hooks validate your changes

## Notes for AI Assistants

- This project is in early development - check if basic setup is complete before coding
- The detailed specifications in `specs/` are the source of truth
- Use the task breakdown in `.simple-task-master/tasks/` to guide implementation
- Always use ESM imports with `.js` extensions for TypeScript files
- Run type checking and tests frequently during development
- Generate reports in the `reports/` directory for significant work