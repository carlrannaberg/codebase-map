# Using codebase-map with Claude Code Hooks

## Installation

```bash
npm install -g codebase-map
# or in your project
npm install --save-dev codebase-map
```

## Basic Usage

### 1. Generate the index
```bash
# Run from anywhere in your project
codebase-map scan
```

### 2. Format for Claude (outputs to stdout)
```bash
# Auto-format based on project size
codebase-map format

# Specific format
codebase-map format --format dsl
codebase-map format --format graph  # For large projects
codebase-map format --format markdown  # Human-readable

# With filtering (scan once, format many times)
codebase-map format --include "src/**" --exclude "**/*.test.ts"
codebase-map format --include "packages/core/**" --format dsl
codebase-map format --include "docs/**" --format tree

# With statistics (to stderr, doesn't affect output)
codebase-map format --stats
```

## Using in Claude Hooks

### Example: .claude/hooks/project-context.sh
```bash
#!/bin/bash
# Automatically provide project context to Claude

# Generate fresh index
codebase-map scan > /dev/null 2>&1

# Output formatted index
echo "=== PROJECT STRUCTURE ==="
codebase-map format
echo "=== END PROJECT STRUCTURE ==="
```

### Example: Claude settings.json hook

Best practice - include project structure at session start:
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

Alternative - focused on source code only:
```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {"type": "command", "command": "codebase-map format --include 'src/**' --exclude '**/*.test.ts'"}
        ]
      }
    ]
  }
}
```

Project-specific hook (focus on main packages):
```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {"type": "command", "command": "codebase-map format --include 'packages/{core,utils}/**' --format dsl"}
        ]
      }
    ]
  }
}
```

Alternative - add to every prompt (more overhead):
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {"type": "command", "command": "codebase-map format"}
        ]
      }
    ]
  }
}
```

## Command-Line Usage Patterns

### Copy to clipboard
```bash
# macOS - full project
codebase-map format | pbcopy

# macOS - source code only
codebase-map format --include "src/**" --exclude "**/*.test.ts" | pbcopy

# macOS - specific component
codebase-map format --include "src/components/**" --format dsl | pbcopy
```

### Save to file
```bash
# Full project structure
codebase-map format --format dsl > project-structure.txt

# Source code only (no tests)
codebase-map format --include "src/**" --exclude "**/*.test.ts" > src-structure.txt

# Documentation structure
codebase-map format --include "docs/**" --include "*.md" --format tree > docs-structure.txt
```

### Filtered Analysis Workflows
```bash
# Scan once, analyze multiple views
codebase-map scan

# View 1: Overall structure
codebase-map format --format tree

# View 2: Source code analysis for AI context
codebase-map format --include "src/**" --exclude "**/*.test.ts" --format dsl

# View 3: API analysis
codebase-map format --include "src/api/**" --include "src/routes/**" --format graph

# View 4: Component documentation
codebase-map format --include "src/components/**" --format markdown
```

### Use in scripts
```bash
#!/bin/bash
# Generate filtered structure for different purposes
PROJECT_INDEX=$(codebase-map format --include "src/**")
echo "Source files structure: $(echo "$PROJECT_INDEX" | wc -l) lines"

# Focus on specific package in monorepo
CORE_STRUCTURE=$(codebase-map format --include "packages/core/**" --format dsl)
echo "Core package structure ready for analysis"
```

### Pipe to other tools
```bash
# Count dependencies in source code only
codebase-map format --include "src/**" --format json | jq '.edges | length'

# Extract function names from components
codebase-map format --include "src/components/**" --format json | jq '.files[].functions[].name'

# Get file list for specific patterns
codebase-map format --include "**/*.ts" --exclude "**/*.test.ts" --format json | jq -r '.nodes[]'

# Statistics for different views
codebase-map format --include "src/**" --stats 2> src-stats.txt
codebase-map format --include "tests/**" --stats 2> test-stats.txt
```

## Format Selection

The `format` command automatically selects the best format based on project size:

| Project Size | Auto Format | Token Usage |
|-------------|-------------|-------------|
| ≤2000 files | DSL | ~21 tokens/file |
| >2000 files | Graph | ~9 tokens/file |

You can override with `--format`:
- `json` - Full JSON (original)
- `mini` - Minified JSON
- `dsl` - Domain-specific language (recommended)
- `graph` - Ultra-compact graph notation
- `markdown` - Human-readable markdown
- `typescript` - TypeScript-style definitions

## Why stdout?

Outputting to stdout follows Unix philosophy and enables:
- Piping to other tools
- Easy integration with hooks
- No file management needed
- Single source of truth (.codebasemap)
- Composable with other commands

## Examples for Different Project Sizes

### Small project (100 files)
```bash
codebase-map format  # Uses DSL, ~2,100 tokens
```

### Large project (1000 files)
```bash
codebase-map format  # Uses DSL, ~21,000 tokens
```

### Huge project (3000+ files)
```bash
codebase-map format  # Auto-switches to graph, ~27,000 tokens
```

### Force compact for any size
```bash
codebase-map format --format graph  # Maximum compression
```