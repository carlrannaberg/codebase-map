# Format Command Filtering Documentation Update

**Date:** 2025-08-20  
**Author:** Claude Code  
**Version:** Documentation update for format command filtering functionality

## Overview

Updated all relevant documentation to explain the new filtering functionality for the `format` command, which now supports:
- `--include <patterns...>` to include only files matching patterns
- `--exclude <patterns...>` to exclude files matching patterns  
- Works with all format types (json, dsl, graph, markdown, tree)
- Shows filtering statistics to stderr

## Files Updated

### 1. README.md

**Major Changes:**
- **Updated format command options**: Added `--include` and `--exclude` options to the command documentation
- **Added comprehensive "Filtering on Format" section**: New major section explaining the workflow benefits and practical examples
- **Enhanced workflow documentation**: Added "scan once, format many times" workflow explanation
- **Added filtering examples**: Comprehensive examples for different use cases (source code, monorepo, documentation, components)
- **Added filtering statistics explanation**: Documented how filtering statistics are shown to stderr

**Key Additions:**
- Basic filtering examples with common patterns
- Monorepo package analysis workflows
- Documentation focus filtering
- Component analysis patterns  
- Advanced filtering pattern combinations
- Statistics output explanation with sample output

### 2. CHANGELOG.md

**Changes:**
- **Added version 0.6.0 entry**: New version section documenting the format filtering feature
- **Comprehensive feature documentation**: Listed all new filtering capabilities
- **Enhanced workflow description**: Explained the "scan once, format many times" benefit
- **Added practical examples**: Included common filtering patterns in changelog

### 3. CLAUDE_HOOK_EXAMPLE.md

**Major Updates:**
- **Enhanced format examples**: Added filtering examples alongside existing format commands
- **Updated Claude hooks examples**: Added project-specific hooks using filtering
- **Comprehensive usage patterns**: Updated all command-line patterns with filtering options
- **Enhanced workflow examples**: Added "Filtered Analysis Workflows" section
- **Updated piping examples**: Enhanced tool integration examples with filtering

**Key Additions:**
- Filtering in clipboard copy commands
- Filtered save-to-file examples
- Multi-view analysis workflows
- Enhanced scripting examples with filtering
- Project-specific Claude hook configurations

### 4. reports/PATTERN_GUIDE.md

**Major Addition:**
- **New "Format Command Filtering" section**: Complete section documenting format filtering
- **Updated Table of Contents**: Added new section to navigation
- **Comprehensive examples**: Source code analysis, monorepo workflows, documentation generation
- **Performance benefits documentation**: Explained instant filtering without file scanning
- **Multi-team workflow examples**: Backend, frontend, and DevOps focused views

**Key Features:**
- Basic format filtering syntax
- Workflow benefits explanation
- Filter statistics documentation
- Component analysis pipelines
- Multi-team collaboration examples

### 5. Minor Updates

- **Fixed filename references**: Updated old `PROJECT_INDEX.json` references to `.codebasemap`
- **Enhanced CLI help documentation**: Reflected in multiple files

## Documentation Structure

### Workflow Focus

The documentation emphasizes the key workflow benefit:
1. **Scan once**: `codebase-map scan` (comprehensive index generation)
2. **Format many times**: `codebase-map format` with different filters (instant filtering)

### Use Case Coverage

**Comprehensive coverage of filtering scenarios:**
- Source code analysis (excluding tests)
- Monorepo package-specific analysis
- Documentation structure visualization
- Component-focused analysis
- API and service layer analysis
- Multi-team collaboration workflows

### Integration Examples

**Practical integration guidance:**
- Command-line usage patterns
- Claude Code hook configurations
- Script automation examples
- Pipeline and workflow integrations

## Benefits Highlighted

### Performance
- No file system scanning during format operations
- Instant filtering from cached index data
- Multiple filtered views from single scan

### Flexibility
- Combine filtering with any output format
- Apply different filters to same index
- Generate team-specific or component-specific views

### Workflow Efficiency
- Single comprehensive scan
- Multiple targeted outputs
- Reduced token usage through focused filtering

## User Experience Improvements

### Clear Examples
- Practical, copy-paste ready commands
- Real-world use case scenarios
- Progressive complexity from basic to advanced

### Statistics Transparency
- Filtering impact shown clearly
- Reduction percentages for files and dependencies
- Pattern effectiveness feedback

### Integration Guidance
- Claude Code hooks with filtering
- Script automation examples
- Team workflow recommendations

## Implementation Notes

The documentation update maintains consistency across all files while providing:
- **Comprehensive coverage**: All aspects of the filtering functionality
- **Practical examples**: Real-world scenarios and commands
- **Clear benefits**: Performance and workflow advantages
- **Integration guidance**: How to use filtering in different contexts

## Verification

All documentation changes have been applied and are ready for user consumption. The filtering functionality is fully documented with:
- Command syntax and options
- Practical examples for common use cases
- Integration with existing workflows
- Performance benefits explanation
- Team collaboration scenarios

The documentation provides a complete guide for users to understand and effectively use the new format command filtering capabilities.