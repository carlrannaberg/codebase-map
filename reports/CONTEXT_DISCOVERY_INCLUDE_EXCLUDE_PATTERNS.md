# Context Discovery: Include/Exclude Pattern Support

**Date**: August 18, 2025  
**Scope**: Adding include/exclude pattern support to codebase-map tool  
**Analysis of**: `/Users/carl/Development/agents/code-map`  

## Executive Summary

The codebase-map tool currently has limited file filtering capabilities but provides an excellent foundation for adding comprehensive include/exclude pattern support. Key findings:

1. **Infrastructure Ready**: The project uses `fast-glob` and `ignore` libraries which fully support glob patterns
2. **Type Definition Exists**: `CodeMapConfig` interface already defines `include` and `exclude` properties
3. **No Active Implementation**: The defined config interface is not currently used anywhere
4. **Clear Extension Points**: The `FileDiscovery` class is well-structured for pattern integration

## Current File Filtering Analysis

### Existing Filtering Mechanisms

**1. Hard-coded Extension Filtering**
- Location: `src/core/file-discovery.ts:11`
- Supported: `.ts`, `.tsx`, `.js`, `.jsx`
- Implementation: Static array `SUPPORTED_EXTENSIONS`

**2. Hard-coded Directory Exclusions**
- Location: `src/core/file-discovery.ts:12-21`
- Excluded dirs: `node_modules`, `dist`, `build`, `.next`, `.turbo`, `.git`, `coverage`, `.nyc_output`
- Used in fast-glob `ignore` option

**3. Gitignore Integration**
- Location: `src/core/file-discovery.ts:61-104`
- Loads `.gitignore` from project root
- Applies additional default ignore patterns
- Uses `ignore` library for filtering

**4. Default Ignore Patterns**
- Location: `src/core/file-discovery.ts:76-101`
- Includes IDE files, logs, env files, package locks
- Hard-coded array of patterns

### Current CLI Structure

**CLI Framework**: Uses `commander` for argument parsing
- Location: `src/cli.ts`
- Current commands: `scan`, `update`, `format`, `list`
- Pattern: Options are parsed and passed to core modules

**Current Scan Command Options**:
```bash
-r, --root <path>     # root directory to scan
-o, --output <path>   # output file path
-v, --verbose         # show detailed progress
```

## Existing Type Definitions

### CodeMapConfig Interface (READY BUT UNUSED)
```typescript
// src/types/common.ts:5-12
export interface CodeMapConfig {
  rootPath: string;
  outputPath: string;
  include: string[];    // ← Already defined!
  exclude: string[];    // ← Already defined!
  maxFileSize: number;
  verbose: boolean;
}
```

**Status**: ✅ Type definition exists but is **never used** in the codebase.

### Technical Dependencies Analysis

**Current Dependencies** (from package.json):
- `commander: ^14.0.0` - CLI argument parsing ✅
- `fast-glob: ^3.3.3` - File pattern matching ✅
- `ignore: ^7.0.5` - Gitignore-style filtering ✅
- `typescript: ^5.9.2` - AST parsing ✅

**Assessment**: All required dependencies are already installed and ready for advanced pattern support.

## Potential Conflicts and Issues

### 1. Hard-coded vs Dynamic Filtering Conflicts

**Issue**: Current `FileDiscovery.discoverFiles()` method uses hard-coded patterns
```typescript
// Current implementation
const patterns = this.SUPPORTED_EXTENSIONS.map(ext => `**/*${ext}`);
const globOptions = {
  ignore: this.EXCLUDED_DIRS.map(dir => `${dir}/**`),
  // ...
};
```

**Conflict**: Custom include patterns might conflict with hard-coded extension filtering.

**Resolution Strategy**: Make extension filtering configurable while keeping sensible defaults.

### 2. Gitignore vs Exclude Pattern Precedence

**Issue**: Unclear precedence between:
- `.gitignore` rules
- Default ignore patterns  
- User-provided exclude patterns
- User-provided include patterns

**Current Behavior**: Gitignore + defaults are applied via `ignore` library, then passed to `fast-glob`

**Required Decision**: Define clear precedence order for multiple filtering layers.

### 3. Pattern Format Compatibility

**Issue**: Different pattern formats supported by dependencies:
- `fast-glob`: Supports full glob syntax (`**/*.ts`, `src/{utils,core}/*.js`)
- `ignore`: Supports gitignore syntax (simpler, no `**` for recursive)

**Resolution**: Standardize on glob patterns for include/exclude, convert when needed.

## Technical Feasibility Assessment

### ✅ High Feasibility Areas

1. **CLI Integration**: Commander.js makes adding new options trivial
2. **Pattern Matching**: `fast-glob` already supports all needed glob features
3. **Type Safety**: TypeScript interface already defined
4. **Testing**: Comprehensive test suite exists with mocking infrastructure

### ⚠️ Medium Complexity Areas

1. **Configuration Loading**: Need to decide on config file vs CLI-only approach
2. **Pattern Precedence**: Design clear rules for multiple filter types
3. **Performance**: Need to ensure pattern complexity doesn't impact performance

### 🔍 Low Risk Areas

1. **Backward Compatibility**: Current behavior can be preserved as defaults
2. **Error Handling**: Existing error patterns are well-established

## Required Changes Analysis

### 1. CLI Argument Parsing Changes

**File**: `src/cli.ts`
**Changes Needed**:
```bash
# New options for scan command
--include <patterns...>   # Include patterns (can be repeated)  
--exclude <patterns...>   # Exclude patterns (can be repeated)
--config <path>          # Optional config file path
```

**Implementation Approach**:
- Add options to existing scan command
- Support multiple values (array options)
- Consider short flags (`-i`, `-e`)

### 2. FileDiscovery Class Changes

**File**: `src/core/file-discovery.ts`
**Changes Required**:

1. **Method Signature Update**:
```typescript
// Current
static async discoverFiles(rootPath: string): Promise<string[]>

// Proposed
static async discoverFiles(
  rootPath: string, 
  options?: {
    include?: string[];
    exclude?: string[];
  }
): Promise<string[]>
```

2. **Pattern Processing**:
   - Merge user include patterns with default extension patterns
   - Combine user exclude patterns with default directory exclusions
   - Apply pattern precedence rules

3. **Glob Options Construction**:
   - Build dynamic glob patterns from include options
   - Build dynamic ignore patterns from exclude options

### 3. Data Model Changes

**Current State**: `CodeMapConfig` exists but unused
**Required Action**: 
1. Actually use the interface in the codebase
2. Possibly extend with pattern-specific options:
```typescript
interface CodeMapConfig {
  // ... existing fields
  include: string[];
  exclude: string[];
  includeDefaultExtensions?: boolean;  // New: whether to add .ts,.js etc
  respectGitignore?: boolean;          // New: whether to load .gitignore
}
```

### 4. Configuration File Support (Optional)

**File**: New file or extend existing
**Purpose**: Allow patterns to be specified in config file (e.g., `.codebasemap.config.json`)
**Priority**: Nice-to-have, CLI options are sufficient for MVP

## Implementation Prerequisites

### 1. Decision Points Requiring Clarification

1. **Pattern Precedence Order**: What happens when include/exclude patterns conflict?
   - Recommended: Include patterns processed first, then exclude patterns applied
   - Gitignore should probably have lower precedence than explicit exclude

2. **Default Behavior**: Should defaults be preserved when custom patterns are provided?
   - Recommended: Additive approach (custom patterns add to defaults)
   - Provide override flags if needed

3. **Configuration Loading**: CLI-only vs config file support?
   - Recommended: Start with CLI-only, add config file later if needed

### 2. Testing Strategy

**Extend Existing Tests**: `src/core/file-discovery.test.ts` has comprehensive mocking
**New Test Cases Needed**:
- Include pattern filtering
- Exclude pattern filtering  
- Pattern precedence scenarios
- Invalid pattern handling
- Performance with complex patterns

### 3. Breaking Changes Assessment

**Backward Compatibility**: ✅ No breaking changes required
- All changes can be additive
- Default behavior preserved
- Existing API signatures can remain unchanged

## Recommended Implementation Approach

### Phase 1: Core Pattern Support (MVP)
1. Add CLI options for `--include` and `--exclude`
2. Extend `FileDiscovery.discoverFiles()` with optional pattern parameters
3. Implement pattern merging logic with sensible defaults
4. Add comprehensive tests

### Phase 2: Advanced Features
1. Add configuration file support
2. Add pattern validation and helpful error messages
3. Add pattern debugging/dry-run capabilities
4. Performance optimization for complex patterns

### Phase 3: Polish & Documentation
1. Update all documentation and help text
2. Add examples and common use cases
3. Consider additional pattern features based on user feedback

## Risk Assessment

### Low Risk ✅
- All required dependencies already available
- Existing architecture supports the changes well
- Comprehensive test suite exists
- No breaking changes required

### Medium Risk ⚠️
- Pattern precedence logic could become complex
- Performance impact of complex patterns needs validation
- User experience for pattern syntax needs careful design

### High Risk ❌
- None identified

## Conclusion

The codebase-map project is exceptionally well-positioned for adding include/exclude pattern support:

- **Strong Foundation**: TypeScript interface already defined, required dependencies installed
- **Clean Architecture**: FileDiscovery class is well-structured and testable  
- **No Conflicts**: Implementation can be purely additive without breaking changes
- **Comprehensive Testing**: Existing test infrastructure can be extended easily

This is a straightforward feature addition with minimal risk and high user value potential.