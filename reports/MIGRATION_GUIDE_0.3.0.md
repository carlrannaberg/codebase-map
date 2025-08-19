# Migration Guide: Upgrading to CodeBase Map 0.3.0

**Target Audience**: Existing users upgrading from versions 0.2.x to 0.3.0  
**Migration Complexity**: Low (one breaking change, mostly backward compatible)  
**Estimated Migration Time**: 15-30 minutes for most projects  
**Date**: August 19, 2025

## Table of Contents

1. [Overview](#overview)
2. [Breaking Changes](#breaking-changes)
3. [Pre-Migration Checklist](#pre-migration-checklist)
4. [Step-by-Step Migration](#step-by-step-migration)
5. [Backward Compatibility Verification](#backward-compatibility-verification)
6. [New Features Overview](#new-features-overview)
7. [Migration Examples](#migration-examples)
8. [Troubleshooting](#troubleshooting)
9. [Rollback Instructions](#rollback-instructions)
10. [Post-Migration Optimization](#post-migration-optimization)

## Overview

CodeBase Map 0.3.0 introduces powerful pattern support for include/exclude filtering while maintaining high backward compatibility. The primary breaking change is the output filename, which affects file references but not functionality.

### What's New in 0.3.0
- **Pattern Support**: Include/exclude files with glob patterns (`--include`, `--exclude`)
- **Enhanced Performance**: Optimized file discovery and pattern caching
- **Better UX**: Improved error messages and verbose output
- **Comprehensive Testing**: Extensive test coverage for reliability

### Breaking Changes Summary
- **Output filename**: `PROJECT_INDEX.json` → `.codebasemap`
- **No API changes**: All commands and options remain compatible

## Breaking Changes

### 1. Output Filename Change

**Impact**: Scripts, tools, and workflows that reference the output file

| Before (0.2.x) | After (0.3.0) | Impact Level |
|----------------|---------------|--------------|
| `PROJECT_INDEX.json` | `.codebasemap` | **HIGH** |

**Why Changed**: 
- Follows Unix convention for hidden config files
- Prevents clutter in project root
- More consistent with other tools (`.gitignore`, `.eslintrc`)

**Migration Required**: Yes - Update all file references

## Pre-Migration Checklist

Before upgrading, complete this checklist:

### Current Environment Audit
- [ ] **Document current usage**: List all scripts using `PROJECT_INDEX.json`
- [ ] **Check CI/CD pipelines**: Identify automation referencing the output file
- [ ] **Backup existing data**: Save current `PROJECT_INDEX.json` if needed
- [ ] **Test environment**: Ensure you can rollback if needed

### Dependency Verification
- [ ] **Node.js version**: Ensure Node.js >= 18.0.0
- [ ] **npm/yarn version**: Update package manager if needed
- [ ] **Project dependencies**: Check for conflicts

### Script Inventory
Create an inventory of affected scripts:

```bash
# Find references to old filename
grep -r "PROJECT_INDEX.json" . --exclude-dir=node_modules
grep -r "PROJECT_INDEX" . --exclude-dir=node_modules --include="*.sh" --include="*.yml" --include="*.yaml"

# Check CI files specifically
find . -name "*.yml" -o -name "*.yaml" | xargs grep -l "PROJECT_INDEX"
```

## Step-by-Step Migration

### Step 1: Backup Current State

```bash
# Backup existing output file
cp PROJECT_INDEX.json PROJECT_INDEX.json.backup 2>/dev/null || echo "No existing index found"

# Backup package.json
cp package.json package.json.backup
```

### Step 2: Update Package

```bash
# Update to latest version
npm update codebase-map

# Or specific version
npm install codebase-map@0.3.0

# Verify installation
npx codebase-map --version
# Should output: 0.3.0
```

### Step 3: Update File References

#### A. Update Scripts

**Before (0.2.x)**:
```bash
#!/bin/bash
# generate-docs.sh
codebase-map scan
if [ -f "PROJECT_INDEX.json" ]; then
    echo "Index generated successfully"
    cat PROJECT_INDEX.json | jq '.files | length'
fi
```

**After (0.3.0)**:
```bash
#!/bin/bash
# generate-docs.sh
codebase-map scan
if [ -f ".codebasemap" ]; then
    echo "Index generated successfully"
    cat .codebasemap | jq '.files | length'
fi
```

#### B. Update CI/CD Pipelines

**GitHub Actions - Before**:
```yaml
name: Generate Documentation
on: [push]
jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Generate codebase map
        run: npx codebase-map scan
      - name: Process index
        run: cat PROJECT_INDEX.json | jq '.summary'
      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: codebase-index
          path: PROJECT_INDEX.json
```

**GitHub Actions - After**:
```yaml
name: Generate Documentation
on: [push]
jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Generate codebase map
        run: npx codebase-map scan
      - name: Process index
        run: cat .codebasemap | jq '.summary'
      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: codebase-index
          path: .codebasemap
```

#### C. Update Package.json Scripts

**Before**:
```json
{
  "scripts": {
    "map": "codebase-map scan && cat PROJECT_INDEX.json | jq '.summary'",
    "docs": "codebase-map scan && node scripts/process-index.js PROJECT_INDEX.json"
  }
}
```

**After**:
```json
{
  "scripts": {
    "map": "codebase-map scan && cat .codebasemap | jq '.summary'",
    "docs": "codebase-map scan && node scripts/process-index.js .codebasemap"
  }
}
```

#### D. Update Application Code

**Node.js - Before**:
```javascript
const fs = require('fs');
const path = require('path');

function loadCodebaseIndex() {
  const indexPath = path.join(process.cwd(), 'PROJECT_INDEX.json');
  if (fs.existsSync(indexPath)) {
    return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  }
  throw new Error('Codebase index not found');
}
```

**Node.js - After**:
```javascript
const fs = require('fs');
const path = require('path');

function loadCodebaseIndex() {
  const indexPath = path.join(process.cwd(), '.codebasemap');
  if (fs.existsSync(indexPath)) {
    return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  }
  throw new Error('Codebase index not found');
}
```

### Step 4: Update .gitignore

```bash
# Add new filename to .gitignore if you ignore the index
echo ".codebasemap" >> .gitignore

# Optionally remove old reference
sed -i '/PROJECT_INDEX.json/d' .gitignore
```

### Step 5: Test Migration

```bash
# Test basic functionality
codebase-map scan --verbose

# Verify output file exists
ls -la .codebasemap

# Test JSON structure
cat .codebasemap | jq '.version, .files | length'

# Test with your existing scripts
./scripts/your-script.sh  # If you have custom scripts
```

## Backward Compatibility Verification

### Core Functionality Tests

```bash
# 1. Basic scanning still works
codebase-map scan
echo "✅ Basic scan: $?"

# 2. Output format unchanged
cat .codebasemap | jq 'keys' > new_keys.txt
cat PROJECT_INDEX.json.backup | jq 'keys' > old_keys.txt 2>/dev/null
diff new_keys.txt old_keys.txt
echo "✅ Format compatibility: $?"

# 3. CLI options unchanged
codebase-map --help | grep -q "root\|output\|verbose"
echo "✅ CLI compatibility: $?"

# 4. Programmatic usage (if applicable)
node -e "
const { CodeIndexer } = require('codebase-map');
const indexer = new CodeIndexer('.');
console.log('✅ API compatibility: OK');
"
```

### Verification Checklist

- [ ] **Basic scanning works**: `codebase-map scan` completes successfully
- [ ] **Output file created**: `.codebasemap` exists and is valid JSON
- [ ] **JSON structure preserved**: Same keys and structure as before
- [ ] **CLI options work**: All previous options still function
- [ ] **Error handling**: Invalid commands still show appropriate errors
- [ ] **Help text**: `--help` shows comprehensive information
- [ ] **Verbose mode**: `--verbose` provides detailed output

## New Features Overview

After successful migration, you can leverage new pattern support:

### Basic Pattern Usage

```bash
# Include only source files
codebase-map scan --include "src/**"

# Exclude test files
codebase-map scan --exclude "**/*.test.ts" --exclude "**/*.spec.ts"

# Combine patterns
codebase-map scan --include "src/**" --exclude "**/*.test.*"
```

### Advanced Patterns

```bash
# Monorepo selective scanning
codebase-map scan --include "packages/*/src/**" --exclude "**/node_modules/**"

# Multiple file types
codebase-map scan --include "src/**/*.{ts,tsx}" --include "lib/**/*.js"

# Documentation focused
codebase-map scan --include "docs/**" --include "*.md" --exclude "**/node_modules/**"
```

### Pattern Validation

```bash
# Get pattern analysis (verbose mode)
codebase-map scan --include "src/**" --verbose
# Shows: pattern statistics, optimization suggestions, warnings
```

## Migration Examples

### Example 1: Basic Node.js Project

**Project Structure**:
```
my-project/
├── src/
│   ├── index.ts
│   ├── utils.ts
│   └── __tests__/
├── docs/
├── package.json
└── scripts/
    └── build.sh
```

**Migration Steps**:

1. **Update build script**:
   ```bash
   # Before: scripts/build.sh
   #!/bin/bash
   codebase-map scan
   cp PROJECT_INDEX.json dist/

   # After: scripts/build.sh  
   #!/bin/bash
   codebase-map scan
   cp .codebasemap dist/
   ```

2. **Test with patterns**:
   ```bash
   # Focus on source code only
   codebase-map scan --include "src/**" --exclude "**/__tests__/**"
   ```

### Example 2: Monorepo Project

**Project Structure**:
```
monorepo/
├── packages/
│   ├── api/src/
│   ├── ui/src/
│   └── shared/src/
├── tools/
├── docs/
└── .github/workflows/
```

**Migration Steps**:

1. **Update GitHub workflow**:
   ```yaml
   # Before: .github/workflows/docs.yml
   - name: Analyze codebase
     run: |
       codebase-map scan
       echo "Files: $(cat PROJECT_INDEX.json | jq '.files | length')"

   # After: .github/workflows/docs.yml
   - name: Analyze codebase
     run: |
       codebase-map scan --include "packages/*/src/**"
       echo "Files: $(cat .codebasemap | jq '.files | length')"
   ```

2. **Optimize with patterns**:
   ```bash
   # Package-specific analysis
   codebase-map scan --include "packages/api/src/**" --output api.codebasemap
   codebase-map scan --include "packages/ui/src/**" --output ui.codebasemap
   ```

### Example 3: Documentation Project

**Project Structure**:
```
docs-project/
├── content/
│   ├── guides/
│   ├── api/
│   └── examples/
├── src/
│   └── generators/
└── build/
```

**Migration Steps**:

1. **Update documentation build**:
   ```bash
   # Before
   codebase-map scan
   node src/generators/index.js PROJECT_INDEX.json

   # After with optimization
   codebase-map scan --include "content/**" --include "src/**" --exclude "build/**"
   node src/generators/index.js .codebasemap
   ```

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: "Command not found" after upgrade

**Symptoms**: `codebase-map: command not found`

**Solutions**:
```bash
# Reinstall globally
npm install -g codebase-map@0.3.0

# Or use npx
npx codebase-map@0.3.0 scan

# Check installation
which codebase-map
npm list -g codebase-map
```

#### Issue 2: Old filename still referenced

**Symptoms**: Scripts failing with "file not found" errors

**Solution**: 
```bash
# Find all references
grep -r "PROJECT_INDEX.json" . --exclude-dir=node_modules

# Create temporary symlink during transition
ln -s .codebasemap PROJECT_INDEX.json
```

#### Issue 3: JSON parsing errors

**Symptoms**: `SyntaxError: Unexpected token` when reading index

**Solution**:
```bash
# Validate JSON structure
cat .codebasemap | jq '.' > /dev/null
echo "JSON valid: $?"

# Compare with backup
diff <(cat .codebasemap | jq -S .) <(cat PROJECT_INDEX.json.backup | jq -S .) 2>/dev/null
```

#### Issue 4: Pattern syntax errors

**Symptoms**: `Invalid glob pattern` errors

**Solution**:
```bash
# Test patterns individually
codebase-map scan --include "src/**" --verbose

# Check pattern syntax
echo "src/**" | node -e "
const fastGlob = require('fast-glob');
try {
  fastGlob.generateTasks([require('fs').readFileSync(0, 'utf8').trim()]);
  console.log('✅ Pattern valid');
} catch (e) {
  console.log('❌ Pattern invalid:', e.message);
}
"
```

### Performance Issues

If scanning becomes slower after upgrade:

```bash
# Use pattern analysis to optimize
codebase-map scan --verbose --include "src/**"

# Profile large directories
time codebase-map scan --include "specific-dir/**"

# Check for complex patterns
codebase-map scan --include "**/*.{ts,tsx,js,jsx}" --verbose
```

### Emergency Debugging

Enable debug mode for troubleshooting:

```bash
# Verbose output
codebase-map scan --verbose

# Debug file discovery
NODE_DEBUG=codebase-map codebase-map scan

# Pattern analysis
codebase-map scan --include "src/**" --verbose | grep -A5 "Pattern Analysis"
```

## Rollback Instructions

If you encounter critical issues, here's how to rollback:

### Quick Rollback (5 minutes)

```bash
# 1. Downgrade package
npm install codebase-map@0.2.0

# 2. Restore old filename (if needed)
mv .codebasemap PROJECT_INDEX.json 2>/dev/null || echo "No file to rename"

# 3. Test basic functionality
codebase-map scan
ls -la PROJECT_INDEX.json

# 4. Verify with existing scripts
./your-existing-script.sh  # Should work as before
```

### Complete Rollback (15 minutes)

```bash
# 1. Restore package.json
cp package.json.backup package.json
npm install

# 2. Restore all file references
git checkout HEAD -- scripts/ .github/ 2>/dev/null || echo "No tracked changes"

# 3. Manual cleanup
rm .codebasemap 2>/dev/null
mv PROJECT_INDEX.json.backup PROJECT_INDEX.json 2>/dev/null

# 4. Verify complete rollback
codebase-map --version  # Should show 0.2.0
codebase-map scan
ls -la PROJECT_INDEX.json  # Should exist
```

### Emergency Recovery

If rollback fails:

```bash
# Nuclear option: complete reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install codebase-map@0.2.0

# Restore from backup
cp package.json.backup package.json
npm install
```

## Post-Migration Optimization

After successful migration, optimize your usage:

### 1. Leverage New Pattern Support

```bash
# Before: scan everything, filter later
codebase-map scan
cat .codebasemap | jq '.files[] | select(.path | startswith("src/"))'

# After: filter during scan (faster)
codebase-map scan --include "src/**"
```

### 2. Optimize CI/CD Performance

```bash
# Before: scan entire monorepo
codebase-map scan  # Slow for large monorepos

# After: scan specific packages
codebase-map scan --include "packages/$PACKAGE/src/**" --exclude "**/*.test.*"
```

### 3. Create Pattern Presets

Create reusable pattern configurations:

```bash
# package.json scripts
{
  "scripts": {
    "map:src": "codebase-map scan --include 'src/**' --exclude '**/*.test.*'",
    "map:docs": "codebase-map scan --include 'docs/**' --include '*.md'",
    "map:api": "codebase-map scan --include 'packages/api/src/**'"
  }
}
```

### 4. Update Documentation

Update your project documentation:

```markdown
# Development Guide

## Generate Codebase Map

```bash
# Basic usage
npm run map:src

# Custom patterns
codebase-map scan --include "src/**" --exclude "**/*.test.*"
```
```

### 5. Performance Monitoring

Monitor performance improvements:

```bash
# Benchmark different approaches
time codebase-map scan  # Full scan
time codebase-map scan --include "src/**"  # Focused scan

# Use verbose mode to see statistics
codebase-map scan --include "src/**" --verbose
```

## Conclusion

The migration to CodeBase Map 0.3.0 is straightforward with one primary breaking change (filename). The new pattern support provides powerful filtering capabilities that can significantly improve performance and focus for large codebases.

### Migration Success Indicators

- [ ] **Basic functionality works**: Scanning completes without errors
- [ ] **Output file correct**: `.codebasemap` exists with valid JSON
- [ ] **Scripts updated**: All references to old filename updated
- [ ] **CI/CD working**: Automated workflows complete successfully
- [ ] **No regressions**: Previous functionality preserved
- [ ] **Performance maintained**: Scanning time similar or better

### Next Steps

1. **Explore pattern features**: Try include/exclude patterns for your use cases
2. **Optimize workflows**: Use patterns to improve CI/CD performance
3. **Update documentation**: Reflect new capabilities in project docs
4. **Share feedback**: Report issues or suggestions to improve the tool

### Support Resources

- **Documentation**: [Pattern Guide](./PATTERN_GUIDE.md)
- **Performance**: [Performance Guide](./PERFORMANCE_GUIDE.md)  
- **Issues**: [GitHub Issues](https://github.com/carlrannaberg/codebase-map/issues)
- **Changelog**: [CHANGELOG.md](../CHANGELOG.md)

---

**Migration Guide Version**: 1.0  
**Last Updated**: August 19, 2025  
**Tested Environments**: Node.js 18+, npm 8+, various CI/CD platforms