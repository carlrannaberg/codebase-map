# codebase-map Pattern Guide

**Complete reference for include/exclude patterns and file filtering**

## Table of Contents

1. [Quick Start](#quick-start)
2. [Pattern Syntax Reference](#pattern-syntax-reference)
3. [Include vs Exclude Patterns](#include-vs-exclude-patterns)
4. [Common Use Cases](#common-use-cases)
5. [Monorepo Patterns](#monorepo-patterns)
6. [Performance Optimization](#performance-optimization)
7. [Troubleshooting](#troubleshooting)
8. [Advanced Techniques](#advanced-techniques)
9. [Format Command Filtering](#format-command-filtering)

## Quick Start

### Basic Commands

```bash
# Include only source directories
codebase-map scan --include "src/**" --include "lib/**"

# Exclude test files
codebase-map scan --exclude "**/*.test.ts" --exclude "**/*.spec.ts"

# Combine patterns (include first, then exclude)
codebase-map scan --include "src/**" --exclude "**/*.test.ts"
```

### Pattern Precedence

1. **Include patterns** define which files to consider
2. **Exclude patterns** filter out files from the include set
3. **Gitignore rules** are applied last
4. **No include patterns** = include all supported files

## Pattern Syntax Reference

### Wildcards

| Pattern | Description | Examples |
|---------|-------------|----------|
| `*` | Match any characters except `/` | `*.ts` → `index.ts`, `utils.ts` |
| `**` | Match any number of directories | `src/**` → all files in src tree |
| `?` | Match single character | `test?.ts` → `test1.ts`, `testa.ts` |

### Character Sets

| Pattern | Description | Examples |
|---------|-------------|----------|
| `[abc]` | Match any character in set | `test[123].ts` → `test1.ts`, `test2.ts` |
| `[a-z]` | Match character range | `file[a-c].ts` → `filea.ts`, `fileb.ts` |
| `[!abc]` | Match any character NOT in set | `file[!0-9].ts` → `filea.ts` (not `file1.ts`) |

### Alternation

| Pattern | Description | Examples |
|---------|-------------|----------|
| `{a,b,c}` | Match any alternative | `**/*.{ts,js}` → all TypeScript and JavaScript files |
| `{src,lib}/**` | Multiple directories | Files from either src or lib directories |

### Extended Glob Patterns (Extglob)

| Pattern | Description | Examples |
|---------|-------------|----------|
| `@(pattern1\|pattern2)` | Match exactly one pattern | `@(*.ts\|*.tsx)` → TypeScript files |
| `!(pattern)` | Match anything except pattern | `!(*.test.ts)` → all except test files |
| `*(pattern)` | Match zero or more occurrences | `*(.[jt]s)` → `.js`, `.ts`, `.js.ts` |
| `+(pattern)` | Match one or more occurrences | `+(.[jt]s)` → `.js`, `.ts`, `.js.ts` |
| `?(pattern)` | Match zero or one occurrence | `test?(s).ts` → `test.ts`, `tests.ts` |

```bash
# Examples
--include "src/**/@(*.ts|*.tsx)"  # TypeScript source files only
--include "**/*.@(min|bundle).js"  # Minified or bundled JavaScript
--exclude "**/!(*.test).ts"        # Exclude non-test TypeScript files
```

### Escaping Special Characters

```bash
# Escape special characters with backslash
--include "file\\[test\\].ts"  # Match literal "file[test].ts"
--include "path\\{with\\}.ts"  # Match literal "path{with}.ts"
```

## Include vs Exclude Patterns

### Include Patterns (`--include`)

**Purpose**: Define which files to analyze
**Default**: All supported files (`.ts`, `.tsx`, `.js`, `.jsx`)
**Logic**: OR operation (any matching pattern includes the file)

```bash
# Include files from multiple directories
--include "src/**" --include "lib/**" --include "utils/**"

# Include specific file types only
--include "**/*.ts" --include "**/*.tsx"

# Include specific files
--include "src/index.ts" --include "lib/main.js"
```

### Exclude Patterns (`--exclude`)

**Purpose**: Remove files from the include set
**Default**: None (no exclusions beyond gitignore)
**Logic**: OR operation (any matching pattern excludes the file)

```bash
# Exclude test files
--exclude "**/*.test.ts" --exclude "**/*.spec.ts"

# Exclude directories
--exclude "docs/**" --exclude "examples/**"

# Exclude build outputs
--exclude "dist/**" --exclude "build/**" --exclude ".next/**"
```

### Pattern Interaction Examples

```bash
# Example 1: Include src, exclude tests
--include "src/**" --exclude "**/*.test.ts"
# Result: All files in src/ except test files

# Example 2: Multiple includes with exclusion
--include "src/**" --include "lib/**" --exclude "**/*.spec.ts"
# Result: All files in src/ and lib/ except spec files

# Example 3: Specific includes override defaults
--include "src/api/**"
# Result: Only files in src/api/ (other src/ files excluded)
```

## Common Use Cases

### 1. Test File Management

#### Exclude All Test Files
```bash
codebase-map scan \
  --exclude "**/*.{test,spec}.{ts,tsx,js,jsx}" \
  --exclude "**/tests/**" \
  --exclude "**/__tests__/**" \
  --exclude "**/test/**" \
  --exclude "**/__mocks__/**"
```

#### Include Only Test Files
```bash
codebase-map scan \
  --include "**/*.{test,spec}.{ts,tsx,js,jsx}" \
  --include "**/tests/**" \
  --include "**/__tests__/**"
```

#### Separate Unit and Integration Tests
```bash
# Only unit tests
codebase-map scan --include "**/*.test.ts" --exclude "**/integration/**"

# Only integration tests  
codebase-map scan --include "**/integration/**/*.test.ts"
```

### 2. Documentation and Examples

#### Exclude Documentation
```bash
codebase-map scan \
  --exclude "docs/**" \
  --exclude "*.md" \
  --exclude "examples/**" \
  --exclude "demo/**" \
  --exclude "samples/**"
```

#### Include Only Documentation Files
```bash
codebase-map scan \
  --include "docs/**" \
  --include "*.md" \
  --include "README*" \
  --include "CHANGELOG*"
```

### 3. Build and Generated Files

#### Exclude Build Outputs
```bash
codebase-map scan \
  --exclude "dist/**" \
  --exclude "build/**" \
  --exclude "out/**" \
  --exclude ".next/**" \
  --exclude ".nuxt/**" \
  --exclude "coverage/**"
```

#### Exclude Generated Files
```bash
codebase-map scan \
  --exclude "**/*.generated.{ts,js}" \
  --exclude "**/generated/**" \
  --exclude "**/*.d.ts" \
  --exclude "**/node_modules/**"
```

### 4. Source Code Organization

#### Frontend vs Backend
```bash
# Frontend only
codebase-map scan --include "src/client/**" --include "src/components/**"

# Backend only
codebase-map scan --include "src/server/**" --include "src/api/**"

# Shared code
codebase-map scan --include "src/shared/**" --include "src/common/**"
```

#### Feature-based Analysis
```bash
# Specific feature
codebase-map scan --include "src/features/auth/**"

# Multiple features
codebase-map scan \
  --include "src/features/auth/**" \
  --include "src/features/user/**" \
  --include "src/features/billing/**"
```

## Monorepo Patterns

### Workspace Structure Analysis

#### All Packages
```bash
# Include source from all packages
codebase-map scan --include "packages/*/src/**"

# Include all TypeScript files across packages
codebase-map scan --include "packages/**/*.ts" --exclude "**/node_modules/**"
```

#### Specific Packages
```bash
# Single package
codebase-map scan --include "packages/core/**"

# Multiple related packages
codebase-map scan \
  --include "packages/core/**" \
  --include "packages/utils/**" \
  --include "packages/shared/**"

# Package pattern matching
codebase-map scan --include "packages/*-api/**"  # All API packages
```

#### Cross-package Dependencies
```bash
# Public API files only
codebase-map scan \
  --include "packages/*/src/index.ts" \
  --include "packages/*/src/public/**"

# Internal implementation
codebase-map scan \
  --include "packages/*/src/**" \
  --exclude "packages/*/src/index.ts" \
  --exclude "packages/*/src/public/**"
```

### Complex Monorepo Examples

#### Lerna/Yarn Workspaces
```bash
# Standard workspace structure
codebase-map scan \
  --include "packages/*/src/**" \
  --include "apps/*/src/**" \
  --exclude "**/*.{test,spec}.ts" \
  --exclude "**/stories/**"
```

#### Nx Monorepo
```bash
# Libraries only
codebase-map scan --include "libs/*/src/**"

# Applications only
codebase-map scan --include "apps/*/src/**"

# Specific domain
codebase-map scan \
  --include "libs/shared/**" \
  --include "libs/ui/**" \
  --include "apps/web/**"
```

#### Rush Monorepo
```bash
# All packages excluding tooling
codebase-map scan \
  --include "packages/*/src/**" \
  --exclude "tools/**" \
  --exclude "scripts/**" \
  --exclude "common/**"
```

## Performance Optimization

### Pattern Efficiency Guidelines

#### ✅ Efficient Patterns
```bash
# Specific directory prefixes
--include "src/**/*.ts"           # Good: specific path + extension
--include "packages/core/**"      # Good: specific package

# Targeted exclusions
--exclude "**/*.test.ts"          # Good: specific file pattern
--exclude "dist/**"               # Good: specific directory
```

#### ❌ Inefficient Patterns
```bash
# Overly broad patterns
--include "**/*"                  # Bad: matches everything
--exclude "**/*"                  # Bad: excludes everything

# Complex nested wildcards
--include "**/deep/**/nested/**"  # Bad: many recursive wildcards
--exclude "**/*/**/test/**"       # Bad: complex nesting
```

### Pattern Ordering

```bash
# Good: Restrictive includes first
codebase-map scan \
  --include "src/core/**" \
  --include "src/utils/**" \
  --exclude "**/*.test.ts"

# Less optimal: Broad includes require more exclusions
codebase-map scan \
  --include "src/**" \
  --exclude "src/tests/**" \
  --exclude "src/examples/**" \
  --exclude "src/docs/**"
```

### Caching Benefits

The tool automatically caches compiled patterns:

```bash
# First run: Compiles patterns
codebase-map scan --include "src/**" --exclude "**/*.test.ts"

# Subsequent runs: Uses cached patterns (faster)
codebase-map scan --include "src/**" --exclude "**/*.test.ts"

# Clear cache if needed
codebase-map scan --include "src/**" --exclude "**/*.test.ts" --no-cache
```

### Performance Monitoring

Use `--verbose` to see performance metrics:

```bash
codebase-map scan --include "src/**" --verbose
```

Output includes:
- Pattern compilation time
- File matching duration  
- Cache hit rates
- Memory usage statistics

## Troubleshooting

### Common Issues

#### No Files Found
```bash
# Problem: Include patterns too restrictive
codebase-map scan --include "nonexistent/**"
# ❌ Warning: Include patterns matched 0 files

# Solution: Check paths and patterns
codebase-map scan --include "src/**" --verbose  # See what's matched
```

#### All Files Excluded
```bash
# Problem: Exclude patterns cancel include patterns
codebase-map scan --include "src/**" --exclude "src/**"
# ❌ Warning: All included files were excluded

# Solution: Make excludes more specific
codebase-map scan --include "src/**" --exclude "src/**/*.test.ts"
```

#### Pattern Syntax Errors
```bash
# Problem: Invalid glob syntax
codebase-map scan --include "src/[invalid"
# ❌ Invalid pattern: src/[invalid - Invalid glob syntax

# Solution: Escape special characters or fix syntax
codebase-map scan --include "src/**"  # Use valid glob
```

### Debugging Patterns

#### Verbose Mode Analysis
```bash
codebase-map scan --include "src/**" --exclude "**/*.test.ts" --verbose
```

Shows:
- Files considered by each pattern
- Pattern match statistics
- Performance warnings
- Optimization suggestions

#### Pattern Testing
```bash
# Test include patterns only
codebase-map scan --include "src/**" --dry-run

# Test exclude patterns only  
codebase-map scan --exclude "**/*.test.ts" --dry-run

# See all pattern effects
codebase-map scan --include "src/**" --exclude "**/*.test.ts" --dry-run --verbose
```

### Security Considerations

**Pattern Validation**: The tool validates patterns to prevent security issues:
- **No directory traversal**: Patterns with `../` are blocked
- **No absolute paths**: Patterns starting with `/` are rejected
- **No shell injection**: Command sequences like `$(`, backticks, and bare pipes are blocked
- **Safe extglob**: Pipe characters (`|`) are allowed only within parentheses for extglob patterns

```bash
# These patterns are BLOCKED for security:
--include "../../../etc/passwd"  # Directory traversal
--include "/etc/passwd"           # Absolute path
--include "file$(rm -rf /)"      # Command injection
--include "file|grep secret"     # Shell pipe

# These patterns are ALLOWED:
--include "@(*.ts|*.tsx)"        # Extglob with pipe inside parentheses
--include "src/**/*.ts"          # Safe relative paths
```

### Error Messages and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid pattern` | Malformed glob syntax | Check brackets, quotes, escaping |
| `No files matched` | Include patterns too restrictive | Broaden patterns or check paths |
| `All files excluded` | Exclude cancels include | Make exclude patterns more specific |
| `Pattern too complex` | Too many recursive wildcards | Simplify pattern structure |
| `Permission denied` | File access issues | Check file permissions and paths |
| `Security violation` | Dangerous pattern detected | Remove directory traversal, absolute paths, or shell commands |
| `Pipe outside parentheses` | Bare pipe character for shell command | Use extglob syntax `@(a|b)` or escape the pipe |

## Advanced Techniques

### Pattern Composition

#### Layered Filtering
```bash
# Step 1: Include broad categories
--include "src/**" --include "lib/**"

# Step 2: Exclude specific types
--exclude "**/*.{test,spec}.ts"

# Step 3: Exclude directories
--exclude "**/fixtures/**" --exclude "**/mocks/**"
```

#### Conditional Patterns
```bash
# Development vs Production
if [ "$NODE_ENV" = "development" ]; then
  # Include test files in development
  codebase-map scan --include "src/**"
else
  # Exclude test files in production
  codebase-map scan --include "src/**" --exclude "**/*.test.ts"
fi
```

### Integration with CI/CD

#### Changed Files Only
```bash
# Git integration: analyze only changed files
CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD | grep -E '\.(ts|tsx|js|jsx)$')
if [ -n "$CHANGED_FILES" ]; then
  codebase-map scan --include $CHANGED_FILES
fi
```

#### Branch-based Analysis
```bash
# Feature branch analysis
FEATURE_FILES=$(git diff --name-only main...HEAD | grep src/)
codebase-map scan --include $FEATURE_FILES
```

### Custom Pattern Scripts

#### Reusable Pattern Sets
```bash
#!/bin/bash
# patterns/frontend.sh

codebase-map scan \
  --include "src/components/**" \
  --include "src/pages/**" \
  --include "src/hooks/**" \
  --exclude "**/*.test.tsx" \
  --exclude "**/*.stories.tsx"
```

```bash
#!/bin/bash  
# patterns/backend.sh

codebase-map scan \
  --include "src/api/**" \
  --include "src/services/**" \
  --include "src/models/**" \
  --exclude "**/*.test.ts" \
  --exclude "**/*.spec.ts"
```

#### Pattern Validation Script
```bash
#!/bin/bash
# validate-patterns.sh

# Test pattern effectiveness
codebase-map scan "$@" --verbose --dry-run | grep -E "(Warning|Error)"
```

### Dynamic Pattern Generation

#### Package.json Based Patterns
```javascript
// generate-patterns.js
const pkg = require('./package.json');
const workspaces = pkg.workspaces || [];

const includePatterns = workspaces.map(ws => `${ws}/src/**`);
console.log('--include', includePatterns.join(' --include '));
```

```bash
# Use generated patterns
PATTERNS=$(node generate-patterns.js)
codebase-map scan $PATTERNS
```

#### Directory Structure Detection
```bash
#!/bin/bash
# auto-patterns.sh

# Detect common directories and create patterns
if [ -d "src" ]; then
  INCLUDE_PATTERNS="$INCLUDE_PATTERNS --include src/**"
fi

if [ -d "lib" ]; then
  INCLUDE_PATTERNS="$INCLUDE_PATTERNS --include lib/**"
fi

if [ -d "packages" ]; then
  INCLUDE_PATTERNS="$INCLUDE_PATTERNS --include packages/*/src/**"
fi

codebase-map scan $INCLUDE_PATTERNS --exclude "**/*.{test,spec}.{ts,js}"
```

## Format Command Filtering

The `format` command supports the same pattern syntax as the `scan` command, enabling powerful "scan once, format many times" workflows.

### Basic Format Filtering

```bash
# Generate comprehensive index once
codebase-map scan

# Create focused views without re-scanning
codebase-map format --include "src/**" --exclude "**/*.test.ts"
codebase-map format --include "docs/**" --format tree
codebase-map format --include "packages/core/**" --format dsl
```

### Workflow Benefits

**Performance advantages:**
- No file system scanning during format (instant filtering)
- Apply different filters to same index data
- Combine with any output format type

**Analysis flexibility:**
- Focus on specific components or packages
- Generate multiple views for different audiences
- Exclude test files or build artifacts on demand

### Format Filtering Examples

#### Source Code Analysis
```bash
# Full scan once
codebase-map scan

# Different filtered views
codebase-map format --include "src/**" --exclude "**/*.test.ts" --format dsl > src-analysis.txt
codebase-map format --include "src/components/**" --format markdown > components-docs.md
codebase-map format --include "src/api/**" --format graph > api-structure.txt
```

#### Monorepo Package Views
```bash
# Comprehensive scan
codebase-map scan --include "packages/**" --exclude "**/node_modules/**"

# Package-specific analyses
codebase-map format --include "packages/core/**" --format dsl > core-package.txt
codebase-map format --include "packages/ui/**" --format tree > ui-structure.txt
codebase-map format --include "packages/{utils,shared}/**" --format graph > shared-deps.txt
```

#### Documentation Workflows
```bash
# Full project scan
codebase-map scan

# Generate different documentation views
codebase-map format --include "docs/**" --format tree > docs-structure.md
codebase-map format --include "**/*.md" --format markdown > all-markdown.md
codebase-map format --include "src/**" --exclude "**/*.test.ts" --format markdown > src-docs.md
```

### Filter Statistics

The format command shows filtering impact to stderr:

```bash
codebase-map format --include "src/**" --exclude "**/*.test.ts" --stats

# Output to stderr:
# --- Filtering Applied ---
# Files: 1,234 → 456 (63.0% reduction)
# Dependencies: 2,100 → 980 (53.3% reduction)
# Include patterns: src/**
# Exclude patterns: **/*.test.ts
```

### Format + Filter Combinations

#### Component Analysis Pipeline
```bash
# Scan everything once
codebase-map scan

# Generate component views
codebase-map format --include "**/*.{tsx,jsx}" --exclude "**/*.test.*" --format dsl | pbcopy
codebase-map format --include "src/components/**" --format tree > component-structure.txt
codebase-map format --include "src/hooks/**" --format markdown > hooks-docs.md
```

#### Multi-team Workflows
```bash
# Backend team view
codebase-map format --include "src/{api,services,models}/**" --format graph > backend-view.txt

# Frontend team view  
codebase-map format --include "src/{components,pages,hooks}/**" --format dsl > frontend-view.txt

# DevOps team view
codebase-map format --include "scripts/**" --include "*.{yml,yaml}" --format tree > devops-view.txt
```

## Best Practices Summary

### Pattern Design
1. **Start specific**: Use targeted include patterns rather than broad exclusions
2. **Layer progressively**: Apply includes first, then refine with excludes
3. **Test iteratively**: Use `--verbose` and `--dry-run` to validate patterns
4. **Document patterns**: Save common pattern combinations as scripts

### Performance
1. **Use path prefixes**: `src/**/*.ts` is faster than `**/*.ts`
2. **Limit wildcards**: Avoid excessive `**` nesting
3. **Cache awareness**: Reuse patterns for better performance
4. **Monitor metrics**: Use `--verbose` to track pattern efficiency

### Maintenance
1. **Version control**: Include pattern scripts in your repository
2. **Team standards**: Document common patterns for your team
3. **CI integration**: Automate pattern validation in builds
4. **Regular review**: Periodically audit pattern effectiveness

---

For more examples and advanced use cases, see the [main README](../README.md) and [troubleshooting guide](./TROUBLESHOOTING_GUIDE.md).