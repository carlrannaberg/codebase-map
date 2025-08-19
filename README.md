# codebase-map

A lightweight TypeScript/JavaScript code indexer that generates comprehensive project maps optimized for LLMs like Claude.

## Features

- **AST-based analysis** - Accurate extraction of functions, classes, and constants
- **Dependency resolution** - Tracks imports/exports and builds a complete dependency graph
- **Multiple output formats** - Optimized for different project sizes and use cases
- **LLM-optimized** - Formats designed to minimize token usage while preserving structure
- **Fast incremental updates** - Update individual files without full re-scan
- **Works from any directory** - Automatically finds project root
- **Flexible file filtering** - Include/exclude patterns using glob syntax for precise control
- **Performance optimized** - Built-in pattern caching and analysis tools

## Installation

```bash
npm install -g codebase-map
```

Or add to your project:

```bash
npm install --save-dev codebase-map
```

## Quick Start

```bash
# Generate index for your project
codebase-map scan

# Output formatted structure to stdout
codebase-map format

# Copy to clipboard (macOS)
codebase-map format | pbcopy
```

## Commands

### `scan`
Analyzes your codebase and generates a .codebasemap file.

```bash
codebase-map scan [options]

Options:
  -r, --root <path>      Root directory to scan (default: auto-detect)
  -o, --output <path>    Output file path (default: .codebasemap)
  -v, --verbose          Show detailed progress
  --include <patterns>   Include file patterns (glob syntax)
  --exclude <patterns>   Exclude file patterns (glob syntax)
```

### `format`
Formats the index for LLM consumption (outputs to stdout).

```bash
codebase-map format [options]

Options:
  -f, --format <type>  Output format: auto|json|dsl|graph|markdown|tree
  -s, --stats          Show statistics to stderr
```

### `update`
Updates the index for a specific file.

```bash
codebase-map update <file> [options]

Options:
  -r, --root <path>    Root directory
```

### `list`
Lists files in the index with various filters.

```bash
codebase-map list [options]

Options:
  -d, --deps     Show files with most dependencies
  -e, --entries  Show entry point files
  -l, --leaves   Show leaf files (no dependencies)
```

## Pattern Support

Control which files are analyzed using powerful glob patterns:

### Basic Usage

```bash
# Include only specific directories
codebase-map scan --include "src/**" --include "lib/**"

# Exclude test files and documentation
codebase-map scan --exclude "**/*.test.ts" --exclude "**/*.spec.ts" --exclude "docs/**"

# Combine include and exclude patterns
codebase-map scan --include "src/**" --exclude "**/*.test.ts"
```

### Advanced Examples

```bash
# Focus on specific packages in a monorepo
codebase-map scan --include "packages/*/src/**" --exclude "**/*.test.ts"

# Analyze only TypeScript files, exclude build outputs
codebase-map scan --include "**/*.ts" --include "**/*.tsx" --exclude "dist/**" --exclude "build/**"

# Complex filtering with multiple criteria
codebase-map scan \
  --include "src/**" \
  --include "lib/**" \
  --exclude "**/*.test.ts" \
  --exclude "**/*.spec.ts" \
  --exclude "**/fixtures/**" \
  --exclude "**/mocks/**"
```

### Pattern Syntax

| Pattern | Description | Example |
|---------|-------------|---------|
| `**` | Match any number of directories | `src/**` matches all files in src and subdirectories |
| `*` | Match any characters except `/` | `*.ts` matches all TypeScript files |
| `?` | Match single character | `test?.ts` matches `test1.ts`, `testa.ts` |
| `[abc]` | Match any character in brackets | `test[123].ts` matches `test1.ts`, `test2.ts`, `test3.ts` |
| `{a,b}` | Match any of the alternatives | `**/*.{ts,js}` matches all TypeScript and JavaScript files |

### Common Use Cases

#### Monorepo Analysis
```bash
# Analyze specific packages
codebase-map scan --include "packages/core/**" --include "packages/utils/**"

# Exclude all test files across packages
codebase-map scan --include "packages/*/src/**" --exclude "**/*.{test,spec}.{ts,js}"
```

#### Test File Filtering
```bash
# Exclude all test-related files
codebase-map scan --exclude "**/*.{test,spec}.{ts,tsx,js,jsx}" --exclude "**/tests/**" --exclude "**/__tests__/**"

# Include only test files for test coverage analysis
codebase-map scan --include "**/*.{test,spec}.{ts,tsx,js,jsx}"
```

#### Library Development
```bash
# Focus on source code, exclude examples and documentation
codebase-map scan --include "src/**" --exclude "examples/**" --exclude "docs/**"

# Include only public API files
codebase-map scan --include "src/public/**" --include "src/index.ts"
```

### Pattern Performance Tips

- **Use specific patterns**: `src/**/*.ts` is faster than `**/*.ts` for large codebases
- **Order matters**: Place more restrictive include patterns first
- **Avoid overly broad excludes**: Specific exclusions perform better than `**/*`
- **Cache benefits**: Repeated pattern usage is automatically optimized

### Pattern Analysis

Use `--verbose` mode to see pattern effectiveness:

```bash
codebase-map scan --include "src/**" --exclude "**/*.test.ts" --verbose
```

Output includes:
- Pattern match statistics
- Performance metrics
- Warnings for ineffective patterns
- Suggestions for optimization

## Output Formats

The tool automatically selects the best format based on project size, or you can specify one:

| Format | Description | Best For | Token Reduction |
|--------|-------------|----------|-----------------|
| `tree` | ASCII art directory structure | Structure visualization (any size) | ~97% |
| `dsl` | Domain-specific language | Most projects (≤5000 files) | ~90% |
| `graph` | Dependency graph with signatures | Very large projects (>5000 files) | ~92% |
| `markdown` | Human-readable markdown | Documentation | ~93% |
| `json` | Compact JSON | Baseline | 0% |

### Format Selection Guide

Choose the right format for your use case:

#### Tree Format (`tree`)
**Best for:** Visualizing project structure, understanding file organization
- **Token reduction:** 97% (most efficient for structure)
- **Readability:** Excellent visual hierarchy
- **Use cases:** Understanding project layout, presenting structure to stakeholders, exploring unfamiliar codebases
- **Selection:** Manual only - complements other formats by showing structure rather than code content

```bash
# Ideal for understanding project structure, exploring new codebases
codebase-map format --format tree
```

#### DSL Format (`dsl`) 
**Best for:** Most development workflows, AI context
- **Token reduction:** 90% (excellent balance)
- **Readability:** High - shows functions, classes, dependencies clearly
- **Use cases:** Code analysis, AI assistance, dependency tracking
- **Automatic selection:** Projects with ≤5000 files (default choice)

```bash
# Perfect for typical applications and libraries
codebase-map format --format dsl
```

#### Graph Format (`graph`)
**Best for:** Large codebases, dependency analysis
- **Token reduction:** 92% (maximum compression for content)
- **Readability:** Good - focuses on relationships
- **Use cases:** Large projects, dependency debugging, architecture analysis
- **Automatic selection:** Projects with >5000 files

```bash
# Essential for large monorepos and enterprise applications
codebase-map format --format graph
```

#### Markdown Format (`markdown`)
**Best for:** Documentation, reports, human reading
- **Token reduction:** 93% (great for docs)
- **Readability:** Excellent - formatted for humans
- **Use cases:** Project documentation, README generation, reports
- **Manual selection only**

```bash
# Great for generating project documentation
codebase-map format --format markdown > PROJECT_STRUCTURE.md
```

### Project Size Examples

```bash
# Understanding any project's structure
codebase-map format --format tree
# └── Shows clear visual hierarchy

# Typical web application (100-500 files)
codebase-map format --format dsl  
# └── Shows functions, dependencies, classes compactly

# Large enterprise application (1000-5000 files)
codebase-map format --format dsl --stats
# └── Monitor token usage with --stats

# Massive monorepo (>5000 files)
codebase-map format --format graph
# └── Maximum compression for context limits
```

### Token Budget Planning

**Recommended token allocations for AI context:**
- **Small projects (<100 files):** DSL format, ~2,100 tokens
- **Medium projects (100-1000 files):** DSL format, ~2,100-21,000 tokens
- **Large projects (1000-2000 files):** DSL format, ~21,000-42,000 tokens ⚠️
- **Very large projects (2000-5000 files):** DSL format, approaching context limits
- **Enterprise projects (>5000 files):** Graph format, auto-switches for maximum efficiency
- **Structure visualization (any size):** Tree format, manual choice for exploring layout

**Context window usage guidelines:**
- Keep project structure under 25% of available context
- Use `--stats` flag to monitor token usage
- Consider using pattern filtering for large projects

## Integration with Claude

### Using with Claude Code Hooks

Configure hooks in `.claude/settings.json` to automatically include project structure when starting a session:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {"type": "command", "command": "codebase-map format"}
        ]
      }
    ]
  }
}
```

### Direct Usage

```bash
# Generate and copy structure to clipboard
codebase-map format | pbcopy
# Then paste into Claude conversation
```

## Example Output

### Tree Format (Structure Visualization)

```
project/
├── src/
│   ├── components/
│   │   ├── Button.tsx
│   │   └── Input.tsx
│   ├── utils/
│   │   └── helpers.ts
│   ├── index.ts
│   └── types.ts
├── tests/
│   └── setup.ts
└── package.json
```

### DSL Format (Most Projects)

```
src/core/dependency-resolver.ts > types/index.ts
  cl DependencyResolver(9m,2p)
src/core/index-formatter.ts > types/index.ts
  fn toMinifiedJSON(index:ProjectIndex):string
  fn toDSL(index:ProjectIndex):string
  fn toGraph(index:ProjectIndex):string
  fn formatAuto(index:ProjectIndex):{ format: FormatType; content: string }
src/utils/find-project-root.ts > 
  fn findProjectRoot(startDir:string):string | null
  fn findIndexFile(startDir:string):string | null
```

## Performance

- Processes ~400 files/second
- Generates ~3 tokens/file in tree format (97% reduction)
- Generates ~29 tokens/file in DSL format (90% reduction)  
- Generates ~24 tokens/file in graph format (92% reduction)
- Generates ~23 tokens/file in markdown format (93% reduction)
- 90-97% token reduction vs compact JSON

## Upgrading

### From 0.2.x to 0.3.0

Version 0.3.0 includes pattern support and a breaking change to the output filename:

#### Breaking Change
- **Output filename changed**: `PROJECT_INDEX.json` → `.codebasemap`

#### Quick Migration
```bash
# 1. Update package
npm update codebase-map

# 2. Update scripts that reference PROJECT_INDEX.json
sed -i 's/PROJECT_INDEX\.json/.codebasemap/g' your-scripts.sh

# 3. Update CI/CD workflows
# Replace PROJECT_INDEX.json with .codebasemap in workflow files

# 4. Test migration
codebase-map scan --verbose
ls -la .codebasemap  # Should exist
```

#### New Features (Optional)
After upgrading, you can use pattern support for better performance:

```bash
# Focus on source code only
codebase-map scan --include "src/**" --exclude "**/*.test.ts"

# Monorepo package analysis  
codebase-map scan --include "packages/*/src/**"
```

#### Version Compatibility
| Feature | 0.2.x | 0.3.0 | Migration Required |
|---------|-------|-------|-------------------|
| Basic scanning | ✅ | ✅ | No |
| CLI options | ✅ | ✅ | No |
| Output format | ✅ | ✅ | No |
| **Filename** | `PROJECT_INDEX.json` | `.codebasemap` | **Yes** |
| Pattern support | ❌ | ✅ | Optional |

#### Rollback (if needed)
```bash
# Downgrade to previous version
npm install codebase-map@0.2.0

# Rename file if it exists
mv .codebasemap PROJECT_INDEX.json
```

#### Migration Resources
- **[Migration Guide](./reports/MIGRATION_GUIDE_0.3.0.md)**: Complete step-by-step guide
- **[Examples](./reports/MIGRATION_EXAMPLES.md)**: Real-world migration scenarios
- **[Compatibility](./reports/BACKWARD_COMPATIBILITY_VERIFICATION.md)**: Verification testing
- **[Changelog](./CHANGELOG.md)**: Detailed version history

## Requirements

- Node.js ≥ 18.0.0
- TypeScript/JavaScript project

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Links

- [GitHub Repository](https://github.com/carlrannaberg/codebase-map)
- [Issue Tracker](https://github.com/carlrannaberg/codebase-map/issues)