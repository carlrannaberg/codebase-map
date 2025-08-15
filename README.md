# codebase-map

A lightweight TypeScript/JavaScript code indexer that generates comprehensive project maps optimized for LLMs like Claude.

## Features

- **AST-based analysis** - Accurate extraction of functions, classes, and constants
- **Dependency resolution** - Tracks imports/exports and builds a complete dependency graph
- **Multiple output formats** - Optimized for different project sizes and use cases
- **LLM-optimized** - Formats designed to minimize token usage while preserving structure
- **Fast incremental updates** - Update individual files without full re-scan
- **Works from any directory** - Automatically finds project root

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
Analyzes your codebase and generates a PROJECT_INDEX.json file.

```bash
codebase-map scan [options]

Options:
  -r, --root <path>    Root directory to scan (default: auto-detect)
  -o, --output <path>  Output file path (default: PROJECT_INDEX.json)
  -v, --verbose        Show detailed progress
```

### `format`
Formats the index for LLM consumption (outputs to stdout).

```bash
codebase-map format [options]

Options:
  -f, --format <type>  Output format: auto|json|dsl|graph|markdown|mini
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

## Output Formats

The tool automatically selects the best format based on project size, or you can specify one:

| Format | Description | Best For | Compression |
|--------|-------------|----------|-------------|
| `dsl` | Domain-specific language | Small-medium projects (≤2000 files) | ~95% |
| `graph` | Ultra-compact graph notation | Large projects (>2000 files) | ~98% |
| `markdown` | Human-readable markdown | Documentation | ~96% |
| `mini` | Minified JSON | Structured data | ~92% |
| `json` | Full JSON | Complete information | 0% |

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

## Example Output (DSL Format)

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
- Generates ~28 tokens/file in DSL format
- Generates ~11 tokens/file in graph format
- 92-98% size reduction vs full JSON

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