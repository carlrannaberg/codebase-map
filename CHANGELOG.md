# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-08-17

### Breaking Changes
- **BREAKING**: Changed default output filename from `PROJECT_INDEX.json` to `.codebasemap`
  - This affects scripts and tools that depend on the specific filename
  - See [Migration Guide](#migration-from-0.2.x-to-0.3.0) for upgrade instructions

### Added
- **Pattern Support**: Added comprehensive include/exclude pattern support via CLI options
  - `--include <patterns...>` - Include files matching glob patterns
  - `--exclude <patterns...>` - Exclude files matching glob patterns
  - Support for complex glob syntax: `**/*.ts`, `src/{utils,core}/**`, `packages/*/src/**`
  - Pattern validation with helpful error messages
  - Pattern analysis and optimization suggestions in verbose mode
- **Enhanced File Discovery**: Extended `FileDiscovery` class with pattern filtering capabilities
- **Performance Optimizations**: Added pattern caching and performance benchmarking
- **Comprehensive Testing**: Added extensive test suite for pattern functionality
  - Unit tests for pattern matching logic
  - Integration tests for complex monorepo scenarios
  - Performance tests for large codebases
- **Documentation**: Added comprehensive pattern usage guide and troubleshooting documentation

### Changed
- **Output Filename**: Default output file changed from `PROJECT_INDEX.json` to `.codebasemap`
- **CLI Help**: Enhanced help text with pattern examples and usage guidance
- **Error Handling**: Improved error messages for pattern validation and file discovery
- **Performance**: Optimized file discovery for large codebases with pattern filtering

### Removed
- **TypeScript Format**: Removed experimental TypeScript format output (was causing issues)

### Security
- **Pattern Validation**: Added security measures to prevent directory traversal and malicious patterns
- **Path Sanitization**: Enhanced path validation and relative path enforcement

## [0.2.0] - 2025-08-14

### Added
- Enhanced project indexing capabilities
- Improved dependency resolution
- Better error handling and validation
- Comprehensive test suite

### Changed
- Refined output format and structure
- Improved performance for large codebases

## Migration Guides

### Migration from 0.2.x to 0.3.0

#### Breaking Changes Overview
1. **Output filename changed** from `PROJECT_INDEX.json` to `.codebasemap`
2. **New CLI options** for pattern support (backward compatible)

#### Quick Migration Steps

1. **Update output filename references**:
   ```bash
   # Before (0.2.x)
   codebase-map scan
   # Creates: PROJECT_INDEX.json
   
   # After (0.3.0)
   codebase-map scan
   # Creates: .codebasemap
   ```

2. **Update scripts and tools**:
   ```bash
   # Old script
   if [ -f "PROJECT_INDEX.json" ]; then
     cat PROJECT_INDEX.json | jq '.files | length'
   fi
   
   # New script
   if [ -f ".codebasemap" ]; then
     cat .codebasemap | jq '.files | length'
   fi
   ```

3. **Update CI/CD pipelines**:
   ```yaml
   # Old GitHub Actions
   - name: Generate codebase map
     run: codebase-map scan
   - name: Upload artifact
     uses: actions/upload-artifact@v3
     with:
       path: PROJECT_INDEX.json
   
   # New GitHub Actions
   - name: Generate codebase map
     run: codebase-map scan
   - name: Upload artifact
     uses: actions/upload-artifact@v3
     with:
       path: .codebasemap
   ```

#### Backward Compatibility
- **CLI commands**: All existing commands work without changes
- **Output format**: JSON structure remains identical
- **API compatibility**: Programmatic usage unchanged
- **Configuration**: No configuration file changes needed

#### New Features (Optional)
After upgrading, you can optionally use the new pattern support:

```bash
# Focus on source code only
codebase-map scan --include "src/**" --exclude "**/*.test.ts"

# Monorepo package analysis
codebase-map scan --include "packages/*/src/**" --exclude "**/node_modules/**"

# Documentation-focused scan
codebase-map scan --include "docs/**" --include "*.md" --exclude "**/node_modules/**"
```

#### Rollback Instructions
If you need to revert to 0.2.x:

1. **Downgrade package**:
   ```bash
   npm install codebase-map@0.2.0
   ```

2. **Update filename references back**:
   ```bash
   # Rename existing file if needed
   mv .codebasemap PROJECT_INDEX.json
   ```

3. **Remove pattern options** from scripts:
   ```bash
   # Remove --include and --exclude options
   codebase-map scan  # Basic command only
   ```

#### Version Compatibility Matrix

| Feature | 0.2.x | 0.3.0 | Notes |
|---------|-------|-------|-------|
| Basic scanning | ✅ | ✅ | Fully compatible |
| Output format | ✅ | ✅ | JSON structure unchanged |
| Filename | `PROJECT_INDEX.json` | `.codebasemap` | **Breaking change** |
| CLI options | Basic | Enhanced | New options available |
| Pattern support | ❌ | ✅ | New feature |
| Performance | Good | Better | Optimized |

#### Verification Steps
After upgrading, verify the migration:

1. **Test basic functionality**:
   ```bash
   codebase-map scan --verbose
   ls -la .codebasemap  # Should exist
   ```

2. **Validate output format**:
   ```bash
   cat .codebasemap | jq '.version, .files | length'
   ```

3. **Test pattern support**:
   ```bash
   codebase-map scan --include "src/**" --verbose
   ```

### Emergency Rollback
If you encounter issues after upgrading:

1. **Immediate rollback**:
   ```bash
   npm install codebase-map@0.2.0
   mv .codebasemap PROJECT_INDEX.json  # If file exists
   ```

2. **Verify rollback**:
   ```bash
   codebase-map scan
   ls -la PROJECT_INDEX.json  # Should exist
   ```

## Support

- **Issues**: Report problems at [GitHub Issues](https://github.com/carlrannaberg/codebase-map/issues)
- **Discussions**: Ask questions in [GitHub Discussions](https://github.com/carlrannaberg/codebase-map/discussions)
- **Documentation**: See [README.md](./README.md) for detailed usage

## Links

- [GitHub Repository](https://github.com/carlrannaberg/codebase-map)
- [NPM Package](https://www.npmjs.com/package/codebase-map)
- [Pattern Guide](./reports/PATTERN_GUIDE.md)
- [Performance Guide](./reports/PERFORMANCE_GUIDE.md)