# codebase-map Pattern Troubleshooting Guide

**Comprehensive guide for diagnosing and fixing pattern-related issues**

## Table of Contents

1. [Common Error Messages](#common-error-messages)
2. [Pattern Matching Issues](#pattern-matching-issues)
3. [Performance Problems](#performance-problems)
4. [Configuration Issues](#configuration-issues)
5. [Debug Tools and Techniques](#debug-tools-and-techniques)
6. [Platform-Specific Issues](#platform-specific-issues)
7. [Advanced Troubleshooting](#advanced-troubleshooting)

## Common Error Messages

### Pattern Syntax Errors

#### Error: `Invalid glob pattern`
```bash
❌ Invalid pattern "src/[invalid": Invalid glob syntax
```

**Causes:**
- Unmatched brackets `[`, `]`
- Unmatched braces `{`, `}`
- Invalid character sets

**Solutions:**
```bash
# ❌ Wrong: Unmatched bracket
--include "src/[invalid"

# ✅ Correct: Properly matched brackets
--include "src/[a-z]*.ts"

# ❌ Wrong: Unmatched brace
--include "src/**/*.{ts"

# ✅ Correct: Properly matched braces
--include "src/**/*.{ts,js}"
```

#### Error: `Directory traversal patterns (..) are not allowed`
```bash
❌ Invalid pattern "../src/**": Directory traversal patterns (..) are not allowed for security reasons
```

**Causes:**
- Using `../` in patterns for security reasons

**Solutions:**
```bash
# ❌ Wrong: Directory traversal
--include "../other-project/src/**"

# ✅ Correct: Specify full project path
--root "/path/to/other-project" --include "src/**"

# ✅ Correct: Use relative path from correct root
cd /path/to/parent && codebase-map scan --include "other-project/src/**"
```

#### Error: `Absolute paths (/) are not allowed`
```bash
❌ Invalid pattern "/usr/local/src/**": Absolute paths (/) are not allowed for security reasons
```

**Causes:**
- Using absolute paths in patterns

**Solutions:**
```bash
# ❌ Wrong: Absolute path in pattern
--include "/usr/local/src/**"

# ✅ Correct: Use --root for absolute paths
--root "/usr/local" --include "src/**"
```

### Pattern Logic Errors

#### Error: `Pattern conflict: All files would be excluded`
```bash
❌ Pattern conflict: All files would be excluded by the current patterns
```

**Causes:**
- Include patterns too restrictive
- Exclude patterns cancel out include patterns
- Typos in patterns

**Solutions:**
```bash
# ❌ Wrong: Conflicting patterns
--include "src/**" --exclude "src/**"

# ✅ Correct: Specific exclusions
--include "src/**" --exclude "src/**/*.test.ts"

# ❌ Wrong: Typo in include pattern
--include "srs/**"  # Should be "src/**"

# ✅ Correct: Fix typo
--include "src/**"
```

#### Warning: `Include patterns matched 0 files`
```bash
⚠️ Warning: Include patterns matched 0 files
```

**Causes:**
- Incorrect directory names
- Wrong file extensions
- Case sensitivity issues

**Solutions:**
```bash
# Check if directory exists
ls -la | grep src

# Check actual file extensions
find . -name "*.ts" | head -5

# Use verbose mode to debug
codebase-map scan --include "src/**" --verbose
```

### File System Errors

#### Error: `ENOENT: no such file or directory`
```bash
❌ ENOENT: no such file or directory, scandir '/nonexistent/path'
```

**Solutions:**
```bash
# Check if path exists
ls -la /path/to/project

# Use correct project root
codebase-map scan --root /correct/path

# Use auto-detection from project directory
cd /path/to/project && codebase-map scan
```

#### Error: `EACCES: permission denied`
```bash
❌ EACCES: permission denied, open '/restricted/file'
```

**Solutions:**
```bash
# Check permissions
ls -la /path/to/project

# Run with appropriate permissions
sudo codebase-map scan  # Only if necessary

# Exclude restricted directories
--exclude "restricted/**"
```

## Pattern Matching Issues

### No Files Found

#### Symptoms
- Command completes but finds 0 files
- Expected files not in output
- Empty index generated

#### Diagnosis
```bash
# Enable verbose mode
codebase-map scan --include "src/**" --verbose

# Test without patterns first
codebase-map scan

# Check what files exist
find . -name "*.ts" -o -name "*.js" | head -10
```

#### Common Causes & Fixes

**Case Sensitivity**
```bash
# ❌ Wrong: Case mismatch
--include "SRC/**"  # Directory is actually "src"

# ✅ Correct: Match exact case
--include "src/**"
```

**Wrong Extensions**
```bash
# ❌ Wrong: Missing extensions
--include "src/**/*"  # Only includes files with no extension

# ✅ Correct: Include extensions or use supported types
--include "src/**/*.ts"
# OR let default discovery handle extensions
--include "src/**"
```

**Incorrect Directory Structure**
```bash
# Check actual structure
tree src/  # or ls -R src/

# ❌ Wrong: Assumed structure
--include "src/main/**"  # No "main" directory

# ✅ Correct: Match actual structure
--include "src/components/**"
```

### Too Many Files Found

#### Symptoms
- More files than expected
- Unwanted files in output
- Performance issues due to large file count

#### Solutions
```bash
# Add specific exclusions
--exclude "**/*.test.ts" --exclude "**/*.spec.ts"

# Use more specific includes
--include "src/main/**" instead of "src/**"

# Exclude build directories
--exclude "dist/**" --exclude "build/**" --exclude "node_modules/**"

# Check gitignore integration
cat .gitignore  # Ensure it's working
```

### Pattern Order Issues

#### Problem: Exclude patterns not working
```bash
# ❌ Wrong: This doesn't work as expected
--exclude "test/**" --include "src/**"
```

**Explanation**: Include patterns are processed first, then exclude patterns filter the results.

**Solution**: Order doesn't matter for CLI options, but ensure logical pattern design:
```bash
# ✅ Correct: Be specific with includes
--include "src/**" --exclude "src/**/test/**"

# ✅ Correct: Use separate patterns
--include "src/main/**" --include "src/utils/**"  # Exclude test dirs implicitly
```

## Performance Problems

### Slow Pattern Evaluation

#### Symptoms
- Long scanning times
- High CPU usage
- Memory consumption

#### Diagnosis
```bash
# Enable verbose mode to see timing
codebase-map scan --include "**/**/**/**/**/*.ts" --verbose

# Check pattern cache stats
# (Enable debug mode if available)
```

#### Solutions

**Simplify Complex Patterns**
```bash
# ❌ Slow: Too many recursive wildcards
--include "**/**/**/**/*.ts"

# ✅ Fast: More specific
--include "src/**/*.ts"
```

**Use Specific Directory Prefixes**
```bash
# ❌ Slow: Searches entire filesystem
--include "**/*.ts"

# ✅ Fast: Limited scope
--include "src/**/*.ts" --include "lib/**/*.ts"
```

**Optimize Exclude Patterns**
```bash
# ❌ Slow: Complex exclude pattern
--exclude "**/node_modules/**" --exclude "**/dist/**" --exclude "**/build/**"

# ✅ Fast: Built-in exclusions handle common directories
# Just use specific exclusions for your project
--exclude "**/*.test.ts"
```

### Memory Issues

#### Symptoms
- Out of memory errors
- Process killed by system
- Slow performance with large codebases

#### Solutions
```bash
# Use more specific patterns to reduce file count
--include "src/critical/**" instead of "**/*"

# Clear pattern cache if running multiple scans
# (Use programmatic API for cache control)

# Process in smaller chunks
codebase-map scan --include "src/module1/**"
codebase-map scan --include "src/module2/**"
```

## Configuration Issues

### Gitignore Not Working

#### Symptoms
- Files that should be ignored are included
- `.gitignore` rules seem to be ignored

#### Diagnosis
```bash
# Check if .gitignore exists
ls -la .gitignore

# Test gitignore manually
git check-ignore src/some-file.ts

# Check file permissions
ls -la .gitignore
```

#### Solutions
```bash
# Ensure .gitignore is in project root
mv path/to/.gitignore ./

# Check .gitignore syntax
# Ensure no trailing spaces or invalid patterns

# Test with minimal patterns first
echo "*.log" > .gitignore
```

### Working Directory Issues

#### Problem: Patterns work in one directory but not another

**Cause**: Relative patterns are relative to the scan root, not current directory.

**Solution**:
```bash
# ❌ Wrong: Patterns relative to current dir
cd src/ && codebase-map scan --include "components/**"

# ✅ Correct: Patterns relative to project root
codebase-map scan --include "src/components/**"

# ✅ Correct: Specify root explicitly
cd anywhere/ && codebase-map scan --root /project/path --include "src/**"
```

## Debug Tools and Techniques

### Using Verbose Mode

```bash
# Basic verbose output
codebase-map scan --include "src/**" --exclude "**/*.test.ts" --verbose
```

**Verbose Output Includes:**
- Pattern compilation time
- File matching statistics
- Individual file evaluation (with `discoverFilesWithVerbose`)
- Performance metrics
- Warning and suggestions

### Manual Pattern Testing

```bash
# Test include patterns only
codebase-map scan --include "src/**" --dry-run

# Test exclude patterns only
codebase-map scan --exclude "**/*.test.ts" --dry-run

# Compare with and without patterns
codebase-map scan  # Default behavior
codebase-map scan --include "src/**"  # With patterns
```

### File System Verification

```bash
# Check what files actually exist
find . -name "*.ts" -o -name "*.js" | sort

# Check directory structure
tree -I 'node_modules|dist|build'

# Verify file extensions
find . -name "*" -type f | grep -o '\.[^.]*$' | sort | uniq -c
```

### Pattern Cache Debugging

If you're using the programmatic API:

```javascript
import { FileDiscovery } from 'codebase-map';

// Check cache statistics
const stats = FileDiscovery.getPatternCacheStats();
console.log('Cache stats:', stats);

// Clear cache if needed
FileDiscovery.clearPatternCache();
```

## Platform-Specific Issues

### Windows Path Issues

#### Problem: Patterns don't work on Windows

**Cause**: Glob patterns use forward slashes, Windows uses backslashes.

**Solution**: Always use forward slashes in patterns:
```bash
# ✅ Correct: Use forward slashes on all platforms
--include "src/**/*.ts"

# ❌ Wrong: Don't use backslashes
--include "src\\**\\*.ts"
```

### Case Sensitivity

#### macOS/Windows (Case-Insensitive) vs Linux (Case-Sensitive)

```bash
# Test case sensitivity
ls -la | grep -i src  # See actual case

# ❌ Might fail on Linux
--include "SRC/**"  # If directory is "src"

# ✅ Correct: Use exact case
--include "src/**"
```

### File Permission Issues

#### Linux/macOS Permissions

```bash
# Check permissions
ls -la src/

# Fix permissions if needed
chmod -R 755 src/

# Run with minimal permissions needed
codebase-map scan --include "src/**"  # Don't use sudo unless necessary
```

## Advanced Troubleshooting

### Complex Pattern Debugging

#### Test Patterns Individually

```bash
# Test each pattern separately
codebase-map scan --include "src/**" --verbose
codebase-map scan --include "lib/**" --verbose
codebase-map scan --exclude "**/*.test.ts" --verbose

# Combine incrementally
codebase-map scan --include "src/**" --include "lib/**" --verbose
codebase-map scan --include "src/**" --include "lib/**" --exclude "**/*.test.ts" --verbose
```

#### Pattern Simplification

```bash
# Start simple and add complexity
--include "src/*"                    # Single level
--include "src/**"                   # All levels
--include "src/**/*.ts"              # Specific extension
--include "src/**/*.{ts,tsx}"        # Multiple extensions
```

### Debugging Integration Issues

#### CI/CD Pipeline Issues

```bash
# Check environment
echo $PWD
ls -la

# Use absolute paths
--root "$GITHUB_WORKSPACE/src"

# Debug patterns in CI
--verbose
```

#### Monorepo Issues

```bash
# Test from different directories
cd packages/package1 && codebase-map scan --include "src/**"
cd packages/package2 && codebase-map scan --include "src/**"

# Use workspace patterns
--include "packages/*/src/**"
```

### Performance Profiling

#### Timing Different Approaches

```bash
# Time full scan
time codebase-map scan

# Time with patterns
time codebase-map scan --include "src/**"

# Time with complex patterns
time codebase-map scan --include "src/**" --exclude "**/*.test.ts"
```

#### Memory Profiling

If using Node.js programmatically:

```javascript
process.memoryUsage(); // Before
await FileDiscovery.discoverFiles(root, options);
process.memoryUsage(); // After
```

## Getting Help

### Information to Include in Bug Reports

1. **Command Used**:
   ```bash
   codebase-map scan --include "src/**" --exclude "**/*.test.ts" --verbose
   ```

2. **Error Output**:
   ```
   ❌ Pattern conflict: All files would be excluded by the current patterns
   ```

3. **Environment**:
   ```bash
   node --version
   npm list codebase-map
   uname -a  # OS info
   ```

4. **Project Structure**:
   ```bash
   tree -I 'node_modules|dist' -L 3
   ```

5. **Files Expected vs Found**:
   ```bash
   # Expected: 50 TypeScript files in src/
   # Found: 0 files
   find src/ -name "*.ts" | wc -l  # Actual count
   ```

### Community Resources

- **GitHub Issues**: Report bugs and feature requests
- **Discussions**: Ask questions and share patterns
- **Documentation**: Refer to pattern guide and examples

### Quick Reference Commands

```bash
# Diagnosis commands
codebase-map scan --verbose                    # See detailed output
codebase-map scan --dry-run                    # Test without processing
find . -name "*.ts" -o -name "*.js" | head    # See actual files
tree -I 'node_modules|dist' -L 2              # See structure

# Common fixes
--include "src/**"                             # Basic include
--exclude "**/*.{test,spec}.{ts,js}"          # Exclude tests
--root /absolute/path                          # Specify root
```

---

For more detailed information, see the [Pattern Guide](./PATTERN_GUIDE.md) and [main README](../README.md).