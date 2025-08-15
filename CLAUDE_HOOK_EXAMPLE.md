# Using code-map with Claude Code Hooks

## Installation

```bash
npm install -g code-map
# or in your project
npm install --save-dev code-map
```

## Basic Usage

### 1. Generate the index
```bash
# Run from anywhere in your project
code-map scan
```

### 2. Format for Claude (outputs to stdout)
```bash
# Auto-format based on project size
code-map format

# Specific format
code-map format --format dsl
code-map format --format graph  # For large projects
code-map format --format markdown  # Human-readable

# With statistics (to stderr, doesn't affect output)
code-map format --stats
```

## Using in Claude Hooks

### Example: .claude/hooks/project-context.sh
```bash
#!/bin/bash
# Automatically provide project context to Claude

# Generate fresh index
code-map scan > /dev/null 2>&1

# Output formatted index
echo "=== PROJECT STRUCTURE ==="
code-map format
echo "=== END PROJECT STRUCTURE ==="
```

### Example: Claude settings.json hook
```json
{
  "hooks": {
    "prePrompt": [
      {
        "command": "code-map format",
        "description": "Include project structure"
      }
    ]
  }
}
```

## Command-Line Usage Patterns

### Copy to clipboard
```bash
# macOS
code-map format | pbcopy

# Linux
code-map format | xclip -selection clipboard

# Windows
code-map format | clip
```

### Save to file
```bash
code-map format --format dsl > project-structure.txt
```

### Use in scripts
```bash
#!/bin/bash
PROJECT_INDEX=$(code-map format)
echo "Project has $(echo "$PROJECT_INDEX" | wc -l) structure lines"
```

### Pipe to other tools
```bash
# Count dependencies
code-map format --format json | jq '.edges | length'

# Extract function names
code-map format --format json | jq '.files[].functions[].name'

# Get file list
code-map format --format json | jq -r '.nodes[]'
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
- Single source of truth (PROJECT_INDEX.json)
- Composable with other commands

## Examples for Different Project Sizes

### Small project (100 files)
```bash
code-map format  # Uses DSL, ~2,100 tokens
```

### Large project (1000 files)
```bash
code-map format  # Uses DSL, ~21,000 tokens
```

### Huge project (3000+ files)
```bash
code-map format  # Auto-switches to graph, ~27,000 tokens
```

### Force compact for any size
```bash
code-map format --format graph  # Maximum compression
```