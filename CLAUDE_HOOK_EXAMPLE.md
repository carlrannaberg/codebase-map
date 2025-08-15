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
# macOS
codebase-map format | pbcopy
```

### Save to file
```bash
codebase-map format --format dsl > project-structure.txt
```

### Use in scripts
```bash
#!/bin/bash
PROJECT_INDEX=$(codebase-map format)
echo "Project has $(echo "$PROJECT_INDEX" | wc -l) structure lines"
```

### Pipe to other tools
```bash
# Count dependencies
codebase-map format --format json | jq '.edges | length'

# Extract function names
codebase-map format --format json | jq '.files[].functions[].name'

# Get file list
codebase-map format --format json | jq -r '.nodes[]'
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