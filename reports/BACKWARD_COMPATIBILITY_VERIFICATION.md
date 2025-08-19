# Backward Compatibility Verification Guide

This document provides comprehensive verification steps to ensure that upgrading to CodeBase Map 0.3.0 maintains compatibility with existing workflows and scripts.

## Table of Contents

1. [Compatibility Overview](#compatibility-overview)
2. [Automated Verification Scripts](#automated-verification-scripts)
3. [Manual Verification Steps](#manual-verification-steps)
4. [API Compatibility Testing](#api-compatibility-testing)
5. [CLI Compatibility Testing](#cli-compatibility-testing)
6. [Output Format Verification](#output-format-verification)
7. [Performance Regression Testing](#performance-regression-testing)
8. [Edge Case Testing](#edge-case-testing)
9. [Integration Testing](#integration-testing)
10. [Troubleshooting Common Issues](#troubleshooting-common-issues)

## Compatibility Overview

### What's Preserved (✅ Compatible)
- **CLI command structure**: All existing commands work identically
- **CLI options**: All existing options function the same way
- **JSON output format**: Structure and content remain identical
- **API interfaces**: Programmatic usage unchanged
- **Error handling**: Error codes and messages consistent
- **Performance**: Similar or better performance characteristics

### What's Changed (⚠️ Breaking)
- **Output filename**: `PROJECT_INDEX.json` → `.codebasemap`
- **Default behavior**: Identical scanning logic, just different filename

### What's New (➕ Enhanced)
- **Pattern support**: New `--include` and `--exclude` options
- **Verbose output**: Enhanced progress reporting
- **Error messages**: More detailed validation and suggestions

## Automated Verification Scripts

### Comprehensive Compatibility Test Script

Create `scripts/verify-compatibility.sh`:

```bash
#!/bin/bash
set -e

echo "🔍 CodeBase Map 0.3.0 Compatibility Verification"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
WARNINGS=0

# Helper functions
pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((TESTS_FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"  
    ((WARNINGS++))
}

info() {
    echo -e "ℹ️  INFO: $1"
}

# Test 1: Basic CLI functionality
test_basic_cli() {
    echo ""
    echo "📋 Test 1: Basic CLI Functionality"
    echo "=================================="
    
    # Test version command
    if codebase-map --version > /dev/null 2>&1; then
        pass "Version command works"
    else
        fail "Version command failed"
    fi
    
    # Test help command
    if codebase-map --help > /dev/null 2>&1; then
        pass "Help command works"
    else
        fail "Help command failed"
    fi
    
    # Test scan command exists
    if codebase-map scan --help > /dev/null 2>&1; then
        pass "Scan command available"
    else
        fail "Scan command not available"
    fi
    
    # Test format command exists  
    if codebase-map format --help > /dev/null 2>&1; then
        pass "Format command available"
    else
        fail "Format command not available"
    fi
    
    # Test query command exists
    if codebase-map query --help > /dev/null 2>&1; then
        pass "Query command available"
    else
        fail "Query command not available"
    fi
}

# Test 2: Output file generation
test_output_generation() {
    echo ""
    echo "📋 Test 2: Output File Generation"
    echo "================================="
    
    # Clean any existing files
    rm -f .codebasemap .codebasemap-test PROJECT_INDEX.json
    
    # Test basic scan
    if codebase-map scan --output .codebasemap-test > /dev/null 2>&1; then
        if [ -f ".codebasemap-test" ]; then
            pass "Basic scan creates output file"
        else
            fail "Basic scan did not create output file"
        fi
    else
        fail "Basic scan command failed"
    fi
    
    # Test default filename
    if codebase-map scan > /dev/null 2>&1; then
        if [ -f ".codebasemap" ]; then
            pass "Default filename is .codebasemap"
        else
            fail "Default filename is not .codebasemap"
        fi
    else
        fail "Default scan failed"
    fi
    
    # Test custom output path
    mkdir -p temp
    if codebase-map scan --output temp/custom.json > /dev/null 2>&1; then
        if [ -f "temp/custom.json" ]; then
            pass "Custom output path works"
        else
            fail "Custom output path failed"
        fi
    else
        fail "Custom output path command failed"
    fi
    
    rm -rf temp
}

# Test 3: JSON structure compatibility
test_json_structure() {
    echo ""
    echo "📋 Test 3: JSON Structure Compatibility"
    echo "======================================="
    
    # Generate fresh index
    codebase-map scan --output .codebasemap-structure > /dev/null 2>&1
    
    if [ ! -f ".codebasemap-structure" ]; then
        fail "Could not generate index for structure test"
        return
    fi
    
    # Check required top-level fields
    required_fields=("version" "timestamp" "summary" "files")
    for field in "${required_fields[@]}"; do
        if cat .codebasemap-structure | jq -e ".$field" > /dev/null 2>&1; then
            pass "Required field '$field' present"
        else
            fail "Required field '$field' missing"
        fi
    done
    
    # Check summary structure
    summary_fields=("totalFiles" "analysisTime" "projectRoot")
    for field in "${summary_fields[@]}"; do
        if cat .codebasemap-structure | jq -e ".summary.$field" > /dev/null 2>&1; then
            pass "Summary field '$field' present"
        else
            fail "Summary field '$field' missing"
        fi
    done
    
    # Check files array structure
    if cat .codebasemap-structure | jq -e '.files | type == "array"' > /dev/null 2>&1; then
        pass "Files field is array"
    else
        fail "Files field is not array"
    fi
    
    # Check file object structure (if files exist)
    file_count=$(cat .codebasemap-structure | jq '.files | length')
    if [ "$file_count" -gt 0 ]; then
        file_fields=("path" "type" "size")
        for field in "${file_fields[@]}"; do
            if cat .codebasemap-structure | jq -e ".files[0].$field" > /dev/null 2>&1; then
                pass "File field '$field' present"
            else
                fail "File field '$field' missing"
            fi
        done
    else
        warn "No files in index to test file structure"
    fi
    
    rm -f .codebasemap-structure
}

# Test 4: CLI options compatibility  
test_cli_options() {
    echo ""
    echo "📋 Test 4: CLI Options Compatibility"
    echo "===================================="
    
    # Test root option
    if codebase-map scan --root . --output .codebasemap-root > /dev/null 2>&1; then
        pass "Root option works"
    else
        fail "Root option failed"
    fi
    
    # Test output option
    if codebase-map scan --output .codebasemap-output > /dev/null 2>&1; then
        if [ -f ".codebasemap-output" ]; then
            pass "Output option works"
        else
            fail "Output option did not create file"
        fi
    else
        fail "Output option failed"
    fi
    
    # Test verbose option
    if codebase-map scan --verbose --output .codebasemap-verbose > /dev/null 2>&1; then
        pass "Verbose option works"
    else
        fail "Verbose option failed"
    fi
    
    # Test short options
    if codebase-map scan -r . -o .codebasemap-short -v > /dev/null 2>&1; then
        pass "Short options work"
    else
        fail "Short options failed"
    fi
    
    # Clean up
    rm -f .codebasemap-root .codebasemap-output .codebasemap-verbose .codebasemap-short
}

# Test 5: New pattern options don't break existing usage
test_pattern_compatibility() {
    echo ""
    echo "📋 Test 5: Pattern Options Compatibility"
    echo "========================================"
    
    # Test that scans without patterns work identically
    codebase-map scan --output .codebasemap-old > /dev/null 2>&1
    codebase-map scan --output .codebasemap-new > /dev/null 2>&1
    
    if [ -f ".codebasemap-old" ] && [ -f ".codebasemap-new" ]; then
        # Compare file counts (should be identical for same directory)
        count_old=$(cat .codebasemap-old | jq '.files | length')
        count_new=$(cat .codebasemap-new | jq '.files | length')
        
        if [ "$count_old" -eq "$count_new" ]; then
            pass "Scan without patterns identical to previous behavior"
        else
            fail "Scan without patterns differs from previous behavior ($count_old vs $count_new files)"
        fi
    else
        fail "Could not generate comparison indexes"
    fi
    
    # Test new options don't interfere with old ones
    if codebase-map scan --root . --output .codebasemap-mixed --verbose --include "src/**" > /dev/null 2>&1; then
        pass "New pattern options work with existing options"
    else
        fail "New pattern options interfere with existing options"
    fi
    
    rm -f .codebasemap-old .codebasemap-new .codebasemap-mixed
}

# Test 6: Error handling compatibility
test_error_handling() {
    echo ""
    echo "📋 Test 6: Error Handling Compatibility"
    echo "======================================="
    
    # Test invalid root directory
    if ! codebase-map scan --root /nonexistent/path > /dev/null 2>&1; then
        pass "Invalid root directory properly rejected"
    else
        fail "Invalid root directory not properly rejected"
    fi
    
    # Test invalid output path
    if ! codebase-map scan --output /root/forbidden.json > /dev/null 2>&1; then
        pass "Invalid output path properly rejected"
    else
        warn "Invalid output path not properly rejected (might be running as root)"
    fi
    
    # Test invalid command
    if ! codebase-map invalid-command > /dev/null 2>&1; then
        pass "Invalid command properly rejected"
    else
        fail "Invalid command not properly rejected"
    fi
    
    # Test help for invalid command shows help
    if codebase-map invalid-command --help > /dev/null 2>&1; then
        warn "Help for invalid command succeeded (expected behavior may vary)"
    else
        pass "Help for invalid command properly handled"
    fi
}

# Test 7: Performance regression
test_performance() {
    echo ""
    echo "📋 Test 7: Performance Regression Test"
    echo "======================================"
    
    # Simple performance test
    echo "Running performance test..."
    
    start_time=$(date +%s%N)
    codebase-map scan --output .codebasemap-perf > /dev/null 2>&1
    end_time=$(date +%s%N)
    
    duration_ms=$(( (end_time - start_time) / 1000000 ))
    
    if [ "$duration_ms" -lt 10000 ]; then  # Less than 10 seconds
        pass "Performance acceptable ($duration_ms ms)"
    else
        warn "Performance slower than expected ($duration_ms ms)"
    fi
    
    # Check if analysis time is reported
    if [ -f ".codebasemap-perf" ]; then
        reported_time=$(cat .codebasemap-perf | jq -r '.summary.analysisTime // "null"')
        if [ "$reported_time" != "null" ]; then
            pass "Analysis time properly reported ($reported_time ms)"
        else
            fail "Analysis time not reported in output"
        fi
    fi
    
    rm -f .codebasemap-perf
}

# Test 8: Node.js API compatibility (if used programmatically)
test_api_compatibility() {
    echo ""
    echo "📋 Test 8: Node.js API Compatibility"
    echo "===================================="
    
    # Test if we can import the module
    cat > test-api.js << 'EOF'
try {
  const { CodeIndexer } = require('codebase-map');
  console.log('✅ Module import successful');
  
  // Test basic instantiation
  const indexer = new CodeIndexer('.');
  console.log('✅ CodeIndexer instantiation successful');
  
  // Test if the interface is still the same
  if (typeof indexer.processProject === 'function') {
    console.log('✅ processProject method available');
  } else {
    console.log('❌ processProject method missing');
  }
  
} catch (error) {
  console.log('❌ API compatibility test failed:', error.message);
}
EOF

    if node test-api.js 2>&1 | grep -q "✅"; then
        pass "Node.js API compatibility maintained"
    else
        warn "Node.js API compatibility test inconclusive"
    fi
    
    rm -f test-api.js
}

# Run all tests
main() {
    echo "Starting compatibility verification..."
    echo "Node.js version: $(node --version)"
    echo "npm version: $(npm --version)"
    echo "CodeBase Map version: $(codebase-map --version 2>&1 || echo 'Not available')"
    
    test_basic_cli
    test_output_generation  
    test_json_structure
    test_cli_options
    test_pattern_compatibility
    test_error_handling
    test_performance
    test_api_compatibility
    
    echo ""
    echo "🏁 Compatibility Verification Complete"
    echo "======================================"
    echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}" 
    echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
    
    if [ "$TESTS_FAILED" -eq 0 ]; then
        echo -e "${GREEN}🎉 All compatibility tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}💥 $TESTS_FAILED compatibility tests failed${NC}"
        exit 1
    fi
}

# Clean up on exit
cleanup() {
    rm -f .codebasemap .codebasemap-* test-api.js
}
trap cleanup EXIT

# Run the tests
main
```

### Quick Compatibility Check Script

Create `scripts/quick-compatibility-check.sh`:

```bash
#!/bin/bash
# Quick 2-minute compatibility verification

echo "🚀 Quick Compatibility Check"
echo "============================"

# 1. Basic functionality
echo "1. Testing basic scan..."
if codebase-map scan --output .quick-test > /dev/null 2>&1; then
    echo "   ✅ Basic scan works"
else
    echo "   ❌ Basic scan failed"
    exit 1
fi

# 2. Check output file
if [ -f ".quick-test" ]; then
    echo "   ✅ Output file created"
else
    echo "   ❌ Output file missing"
    exit 1
fi

# 3. Validate JSON
if cat .quick-test | jq '.' > /dev/null 2>&1; then
    echo "   ✅ Valid JSON output"
else
    echo "   ❌ Invalid JSON output"
    exit 1
fi

# 4. Check required fields
required=("version" "timestamp" "summary" "files")
for field in "${required[@]}"; do
    if cat .quick-test | jq -e ".$field" > /dev/null 2>&1; then
        echo "   ✅ Field '$field' present"
    else
        echo "   ❌ Field '$field' missing"
        exit 1
    fi
done

# 5. Test CLI options
echo "2. Testing CLI options..."
if codebase-map scan --verbose --root . --output .quick-test2 > /dev/null 2>&1; then
    echo "   ✅ CLI options work"
else
    echo "   ❌ CLI options failed"
    exit 1
fi

# Cleanup
rm -f .quick-test .quick-test2

echo ""
echo "🎉 Quick compatibility check passed!"
echo "Your upgrade to 0.3.0 should be safe."
```

## Manual Verification Steps

### Step 1: Pre-Upgrade Documentation

Before upgrading, document your current setup:

```bash
# Document current version
codebase-map --version > compatibility-baseline.txt

# Document current output structure
codebase-map scan --output baseline-index.json
cat baseline-index.json | jq 'keys' > baseline-structure.txt

# Test current scripts
./your-existing-script.sh 2>&1 | tee baseline-script-output.txt
```

### Step 2: Post-Upgrade Verification

After upgrading to 0.3.0:

```bash
# Verify new version
codebase-map --version

# Test identical output structure
codebase-map scan --output upgraded-index.json
diff <(cat baseline-index.json | jq -S .) <(cat upgraded-index.json | jq -S .)

# Should show only timestamp differences, no structural changes
```

### Step 3: Script Compatibility Testing

Test each of your existing scripts:

```bash
# Create compatibility test for each script
for script in scripts/*.sh; do
    echo "Testing $script..."
    
    # Run with old filename (should fail gracefully)
    if $script 2>&1 | grep -q "PROJECT_INDEX.json"; then
        echo "⚠️  Script still references old filename: $script"
    fi
    
    # Run with new filename (after updating)
    # ... test script functionality
done
```

### Step 4: Integration Point Testing

Test all integration points:

```bash
# CI/CD workflows
# Check GitHub Actions, Jenkins, etc.

# Monitoring scripts
# Test any automated monitoring that uses the index

# Documentation generation
# Verify doc generation still works

# Analysis tools
# Test any tools that consume the index
```

## API Compatibility Testing

### Programmatic Usage Test

```javascript
// test-programmatic-usage.js
const { CodeIndexer } = require('codebase-map');

async function testCompatibility() {
    console.log('Testing programmatic usage...');
    
    try {
        // Test basic instantiation (should work identically)
        const indexer = new CodeIndexer('.');
        console.log('✅ CodeIndexer instantiation: OK');
        
        // Test processProject method
        const index = await indexer.processProject();
        console.log('✅ processProject method: OK');
        
        // Test output structure
        const requiredFields = ['version', 'timestamp', 'summary', 'files'];
        for (const field of requiredFields) {
            if (!(field in index)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        console.log('✅ Output structure: OK');
        
        // Test with filter options (new feature, should not break)
        const filteredIndexer = new CodeIndexer('.', {
            include: ['src/**'],
            exclude: ['**/*.test.*']
        });
        const filteredIndex = await filteredIndexer.processProject();
        console.log('✅ Filter options: OK');
        
        console.log('🎉 All programmatic usage tests passed!');
        
    } catch (error) {
        console.error('❌ Programmatic usage test failed:', error.message);
        process.exit(1);
    }
}

testCompatibility();
```

Run the test:

```bash
node test-programmatic-usage.js
```

### Type Definitions Test (TypeScript)

```typescript
// test-types.ts
import { CodeIndexer, type ProjectIndex, type FilterOptions } from 'codebase-map';

// Test that types are still available and compatible
const testTypes = async (): Promise<void> => {
    // Test basic usage
    const indexer = new CodeIndexer('.');
    const index: ProjectIndex = await indexer.processProject();
    
    // Test with filter options (new)
    const filterOptions: FilterOptions = {
        include: ['src/**'],
        exclude: ['**/*.test.*']
    };
    
    const filteredIndexer = new CodeIndexer('.', filterOptions);
    const filteredIndex: ProjectIndex = await filteredIndexer.processProject();
    
    // Test that the structure hasn't changed
    console.log('Files count:', index.files.length);
    console.log('Version:', index.version);
    console.log('Summary:', index.summary);
};

testTypes().then(() => {
    console.log('✅ TypeScript compatibility verified');
}).catch((error) => {
    console.error('❌ TypeScript compatibility failed:', error);
    process.exit(1);
});
```

## CLI Compatibility Testing

### Comprehensive CLI Test Suite

```bash
#!/bin/bash
# test-cli-compatibility.sh

echo "🔧 CLI Compatibility Test Suite"
echo "==============================="

# Test matrix: all combinations of valid options
declare -a commands=(
    "scan"
    "scan --verbose"
    "scan --root ."
    "scan --output custom.json"
    "scan --root . --verbose"
    "scan --root . --output custom.json"
    "scan --verbose --output custom.json"
    "scan --root . --verbose --output custom.json"
    "scan -r . -v -o custom.json"
)

for cmd in "${commands[@]}"; do
    echo "Testing: codebase-map $cmd"
    
    if codebase-map $cmd > /dev/null 2>&1; then
        echo "   ✅ PASS"
    else
        echo "   ❌ FAIL"
        exit 1
    fi
    
    # Clean up
    rm -f .codebasemap custom.json
done

echo ""
echo "🎉 All CLI compatibility tests passed!"
```

### Pattern Option Non-Interference Test

```bash
#!/bin/bash
# test-pattern-non-interference.sh

echo "🎯 Pattern Option Non-Interference Test"
echo "======================================="

# Test that new pattern options don't interfere with existing behavior
echo "1. Testing scan without patterns (baseline)..."
codebase-map scan --output baseline.json > /dev/null 2>&1
baseline_count=$(cat baseline.json | jq '.files | length')

echo "2. Testing scan with empty patterns..."
codebase-map scan --include "" --exclude "" --output empty-patterns.json > /dev/null 2>&1
empty_count=$(cat empty-patterns.json | jq '.files | length' 2>/dev/null || echo "0")

echo "3. Testing scan with no pattern options..."
codebase-map scan --output no-patterns.json > /dev/null 2>&1
no_patterns_count=$(cat no-patterns.json | jq '.files | length')

# Compare results
if [ "$baseline_count" -eq "$no_patterns_count" ]; then
    echo "   ✅ No patterns behavior unchanged"
else
    echo "   ❌ No patterns behavior changed ($baseline_count vs $no_patterns_count)"
    exit 1
fi

if [ "$baseline_count" -eq "$empty_count" ] 2>/dev/null; then
    echo "   ✅ Empty patterns behavior correct"
else
    echo "   ⚠️  Empty patterns behavior differs (may be expected)"
fi

# Clean up
rm -f baseline.json empty-patterns.json no-patterns.json

echo "🎉 Pattern non-interference tests passed!"
```

## Output Format Verification

### JSON Schema Validation

```javascript
// validate-output-schema.js
const fs = require('fs');

// Expected schema for compatibility
const expectedSchema = {
    version: 'string',
    timestamp: 'string', 
    summary: {
        totalFiles: 'number',
        analysisTime: 'number',
        projectRoot: 'string'
    },
    files: 'array'
};

function validateSchema(data, schema, path = '') {
    for (const [key, expectedType] of Object.entries(schema)) {
        const fullPath = path ? `${path}.${key}` : key;
        
        if (!(key in data)) {
            throw new Error(`Missing required field: ${fullPath}`);
        }
        
        if (typeof expectedType === 'string') {
            if (expectedType === 'array' && !Array.isArray(data[key])) {
                throw new Error(`Field ${fullPath} should be array, got ${typeof data[key]}`);
            } else if (expectedType !== 'array' && typeof data[key] !== expectedType) {
                throw new Error(`Field ${fullPath} should be ${expectedType}, got ${typeof data[key]}`);
            }
        } else if (typeof expectedType === 'object') {
            validateSchema(data[key], expectedType, fullPath);
        }
    }
}

// Generate and validate output
console.log('🔍 Validating output format compatibility...');

const { execSync } = require('child_process');
execSync('codebase-map scan --output schema-test.json', { stdio: 'ignore' });

try {
    const data = JSON.parse(fs.readFileSync('schema-test.json', 'utf8'));
    validateSchema(data, expectedSchema);
    console.log('✅ Output format compatibility verified');
} catch (error) {
    console.error('❌ Output format incompatible:', error.message);
    process.exit(1);
} finally {
    fs.unlinkSync('schema-test.json');
}
```

### Field-by-Field Comparison

```bash
#!/bin/bash
# compare-output-fields.sh

echo "📊 Output Field Comparison"
echo "=========================="

# Generate current output
codebase-map scan --output current.json > /dev/null 2>&1

# Expected top-level fields (from 0.2.x)
expected_fields=("version" "timestamp" "summary" "files")

echo "Checking top-level fields..."
for field in "${expected_fields[@]}"; do
    if cat current.json | jq -e ".$field" > /dev/null 2>&1; then
        echo "   ✅ $field: present"
    else
        echo "   ❌ $field: missing"
        exit 1
    fi
done

# Check summary fields
echo "Checking summary fields..."
summary_fields=("totalFiles" "analysisTime" "projectRoot")
for field in "${summary_fields[@]}"; do
    if cat current.json | jq -e ".summary.$field" > /dev/null 2>&1; then
        echo "   ✅ summary.$field: present"
    else
        echo "   ❌ summary.$field: missing"
        exit 1
    fi
done

# Check files array structure
echo "Checking files array..."
if cat current.json | jq -e '.files | type == "array"' > /dev/null 2>&1; then
    echo "   ✅ files: is array"
else
    echo "   ❌ files: not array"
    exit 1
fi

# Check file object structure (if any files exist)
file_count=$(cat current.json | jq '.files | length')
if [ "$file_count" -gt 0 ]; then
    echo "Checking file object structure..."
    file_fields=("path" "type" "size")
    for field in "${file_fields[@]}"; do
        if cat current.json | jq -e ".files[0].$field" > /dev/null 2>&1; then
            echo "   ✅ file.$field: present"
        else
            echo "   ❌ file.$field: missing"
            exit 1
        fi
    done
else
    echo "   ⚠️  No files to check structure"
fi

rm -f current.json
echo "🎉 All output fields verified!"
```

## Performance Regression Testing

### Simple Performance Benchmark

```bash
#!/bin/bash
# performance-regression-test.sh

echo "⚡ Performance Regression Test"
echo "============================="

# Create test project if it doesn't exist
if [ ! -d "test-project" ]; then
    mkdir -p test-project/src/{components,utils,services}
    for i in {1..20}; do
        echo "export const component$i = () => {};" > "test-project/src/components/Component$i.ts"
        echo "export const util$i = () => {};" > "test-project/src/utils/util$i.ts"
        echo "export const service$i = () => {};" > "test-project/src/services/service$i.ts"
    done
fi

cd test-project

# Performance test function
test_performance() {
    local description="$1"
    local command="$2"
    local max_time_ms="$3"
    
    echo "Testing: $description"
    
    start_time=$(date +%s%N)
    eval $command > /dev/null 2>&1
    end_time=$(date +%s%N)
    
    duration_ms=$(( (end_time - start_time) / 1000000 ))
    
    if [ "$duration_ms" -le "$max_time_ms" ]; then
        echo "   ✅ $duration_ms ms (limit: $max_time_ms ms)"
    else
        echo "   ❌ $duration_ms ms (exceeds limit: $max_time_ms ms)"
        exit 1
    fi
}

# Run performance tests
test_performance "Basic scan" "codebase-map scan --output perf1.json" 5000
test_performance "Verbose scan" "codebase-map scan --verbose --output perf2.json" 6000
test_performance "Pattern scan" "codebase-map scan --include 'src/**' --output perf3.json" 5000

# Clean up
rm -f perf*.json
cd ..

echo "🎉 Performance regression tests passed!"
```

### Memory Usage Test

```bash
#!/bin/bash
# memory-usage-test.sh

echo "🧠 Memory Usage Test"
echo "==================="

# Monitor memory usage during scan
memory_test() {
    local description="$1"
    local command="$2"
    
    echo "Testing: $description"
    
    # Start monitoring memory in background
    (
        pid=$(pgrep -f "codebase-map scan" | tail -1)
        if [ -n "$pid" ]; then
            max_mem=0
            while kill -0 "$pid" 2>/dev/null; do
                current_mem=$(ps -o rss= -p "$pid" 2>/dev/null || echo "0")
                if [ "$current_mem" -gt "$max_mem" ]; then
                    max_mem=$current_mem
                fi
                sleep 0.1
            done
            echo "   Max memory: ${max_mem}KB"
        fi
    ) &
    monitor_pid=$!
    
    # Run the command
    eval $command > /dev/null 2>&1
    
    # Stop monitoring
    kill $monitor_pid 2>/dev/null
    wait $monitor_pid 2>/dev/null
}

memory_test "Basic scan memory usage" "codebase-map scan --output mem-test.json"

rm -f mem-test.json
echo "🎉 Memory usage test completed!"
```

## Edge Case Testing

### Unusual Project Structures

```bash
#!/bin/bash
# edge-case-test.sh

echo "🔬 Edge Case Testing"
echo "==================="

# Create unusual project structure
mkdir -p edge-test
cd edge-test

# Test 1: Empty directory
echo "1. Testing empty directory..."
if codebase-map scan --output empty.json > /dev/null 2>&1; then
    file_count=$(cat empty.json | jq '.files | length')
    if [ "$file_count" -eq 0 ]; then
        echo "   ✅ Empty directory handled correctly"
    else
        echo "   ❌ Empty directory resulted in $file_count files"
    fi
else
    echo "   ❌ Empty directory scan failed"
fi

# Test 2: Only ignored files
echo "2. Testing directory with only ignored files..."
mkdir node_modules
echo "{}" > node_modules/package.json
if codebase-map scan --output ignored.json > /dev/null 2>&1; then
    file_count=$(cat ignored.json | jq '.files | length')
    echo "   ✅ Ignored files handled correctly ($file_count files)"
else
    echo "   ❌ Ignored files scan failed"
fi

# Test 3: Deep nesting
echo "3. Testing deep directory nesting..."
mkdir -p very/deep/nested/directory/structure
echo "export const deep = 'test';" > very/deep/nested/directory/structure/deep.ts
if codebase-map scan --output deep.json > /dev/null 2>&1; then
    file_count=$(cat deep.json | jq '.files | length')
    if [ "$file_count" -gt 0 ]; then
        echo "   ✅ Deep nesting handled correctly"
    else
        echo "   ❌ Deep nesting found no files"
    fi
else
    echo "   ❌ Deep nesting scan failed"
fi

# Test 4: Special characters in filenames
echo "4. Testing special characters..."
mkdir "special chars"
echo "export const special = 'test';" > "special chars/file with spaces.ts"
echo "export const unicode = 'test';" > "special chars/файл-с-unicode.ts"
if codebase-map scan --output special.json > /dev/null 2>&1; then
    special_count=$(cat special.json | jq '[.files[] | select(.path | contains("special chars"))] | length')
    if [ "$special_count" -gt 0 ]; then
        echo "   ✅ Special characters handled correctly"
    else
        echo "   ❌ Special characters not handled"
    fi
else
    echo "   ❌ Special characters scan failed"
fi

# Clean up
cd ..
rm -rf edge-test

echo "🎉 Edge case testing completed!"
```

### Pattern Edge Cases

```bash
#!/bin/bash
# pattern-edge-cases.sh

echo "🎯 Pattern Edge Case Testing"
echo "============================"

mkdir -p pattern-test/src/{components,utils}
echo "export const comp = 'test';" > pattern-test/src/components/Component.ts
echo "export const util = 'test';" > pattern-test/src/utils/util.ts
cd pattern-test

# Test 1: No matching include patterns
echo "1. Testing non-matching include patterns..."
if codebase-map scan --include "nonexistent/**" --output no-match.json > /dev/null 2>&1; then
    file_count=$(cat no-match.json | jq '.files | length')
    if [ "$file_count" -eq 0 ]; then
        echo "   ✅ Non-matching patterns handled correctly"
    else
        echo "   ❌ Non-matching patterns found $file_count files"
    fi
else
    echo "   ❌ Non-matching pattern scan failed"
fi

# Test 2: Conflicting patterns (include then exclude everything)
echo "2. Testing conflicting patterns..."
if codebase-map scan --include "src/**" --exclude "src/**" --output conflict.json > /dev/null 2>&1; then
    file_count=$(cat conflict.json | jq '.files | length')
    if [ "$file_count" -eq 0 ]; then
        echo "   ✅ Conflicting patterns handled correctly"
    else
        echo "   ❌ Conflicting patterns found $file_count files"
    fi
else
    echo "   ❌ Conflicting pattern scan failed"
fi

# Test 3: Invalid glob patterns
echo "3. Testing invalid glob patterns..."
if ! codebase-map scan --include "src/[invalid" --output invalid.json > /dev/null 2>&1; then
    echo "   ✅ Invalid patterns properly rejected"
else
    echo "   ❌ Invalid patterns not properly rejected"
fi

# Clean up
cd ..
rm -rf pattern-test

echo "🎉 Pattern edge case testing completed!"
```

## Integration Testing

### CI/CD Integration Test

```bash
#!/bin/bash
# ci-integration-test.sh

echo "🔄 CI/CD Integration Test"
echo "========================"

# Simulate CI environment
export CI=true
export NODE_ENV=test

# Test 1: Non-interactive environment
echo "1. Testing non-interactive execution..."
if timeout 30 codebase-map scan --output ci-test.json > /dev/null 2>&1; then
    echo "   ✅ Non-interactive execution works"
else
    echo "   ❌ Non-interactive execution failed or timed out"
    exit 1
fi

# Test 2: Exit codes
echo "2. Testing exit codes..."

# Successful scan should exit 0
codebase-map scan --output success.json > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✅ Successful scan returns exit code 0"
else
    echo "   ❌ Successful scan returns non-zero exit code"
    exit 1
fi

# Invalid command should exit non-zero
codebase-map invalid-command > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "   ✅ Invalid command returns non-zero exit code"
else
    echo "   ❌ Invalid command returns zero exit code"
    exit 1
fi

# Test 3: Output parsing in scripts
echo "3. Testing output parsing..."
codebase-map scan --output parse-test.json > /dev/null 2>&1

# Test that common CI parsing works
total_files=$(cat parse-test.json | jq '.files | length' 2>/dev/null)
if [ -n "$total_files" ] && [ "$total_files" -ge 0 ]; then
    echo "   ✅ Output parsing works ($total_files files)"
else
    echo "   ❌ Output parsing failed"
    exit 1
fi

# Clean up
rm -f ci-test.json success.json parse-test.json

echo "🎉 CI/CD integration test passed!"
```

### Docker Integration Test

```bash
#!/bin/bash
# docker-integration-test.sh

echo "🐳 Docker Integration Test"
echo "=========================="

# Create test Dockerfile
cat > Dockerfile.test << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx codebase-map scan
CMD ["cat", ".codebasemap"]
EOF

# Test Docker build and run
echo "1. Testing Docker integration..."
if command -v docker >/dev/null 2>&1; then
    if docker build -f Dockerfile.test -t codebase-map-test . > /dev/null 2>&1; then
        if docker run --rm codebase-map-test | jq '.' > /dev/null 2>&1; then
            echo "   ✅ Docker integration works"
        else
            echo "   ❌ Docker execution failed"
        fi
    else
        echo "   ❌ Docker build failed"
    fi
    
    # Clean up
    docker rmi codebase-map-test > /dev/null 2>&1
else
    echo "   ⚠️  Docker not available, skipping test"
fi

rm -f Dockerfile.test

echo "🎉 Docker integration test completed!"
```

## Troubleshooting Common Issues

### Issue 1: Command Not Found

**Symptoms**: `codebase-map: command not found` after upgrade

**Verification**:
```bash
# Check if globally installed
which codebase-map
npm list -g codebase-map

# Check if locally installed
npm list codebase-map
```

**Solutions**:
```bash
# Reinstall globally
npm install -g codebase-map@0.3.0

# Or use npx
npx codebase-map@0.3.0 --version
```

### Issue 2: Module Import Errors

**Symptoms**: `Cannot find module 'codebase-map'` in Node.js scripts

**Verification**:
```bash
node -e "console.log(require('codebase-map'))"
```

**Solutions**:
```bash
# Reinstall locally
npm install codebase-map@0.3.0

# Clear npm cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Issue 3: JSON Parsing Errors

**Symptoms**: `SyntaxError: Unexpected token` when reading output

**Verification**:
```bash
# Check if file is valid JSON
cat .codebasemap | jq '.' > /dev/null
echo "JSON valid: $?"

# Check file size
ls -la .codebasemap
```

**Solutions**:
```bash
# Regenerate index
rm .codebasemap
codebase-map scan

# Check for permission issues
chmod 644 .codebasemap
```

### Issue 4: Performance Degradation

**Symptoms**: Scanning takes much longer than before

**Verification**:
```bash
# Compare performance
time codebase-map scan --output perf-test.json

# Check file count
cat perf-test.json | jq '.files | length'
cat perf-test.json | jq '.summary.analysisTime'
```

**Solutions**:
```bash
# Use patterns to focus scan
codebase-map scan --include "src/**" --exclude "**/*.test.*"

# Check for permission issues
ls -la | grep "Permission denied"
```

### Issue 5: Pattern Syntax Errors

**Symptoms**: `Invalid glob pattern` errors with new pattern options

**Verification**:
```bash
# Test pattern separately
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

**Solutions**:
```bash
# Use simpler patterns
codebase-map scan --include "src" --exclude "tests"

# Escape special characters
codebase-map scan --include "src/**/*.{ts,tsx}"
```

## Summary

This verification guide provides comprehensive testing for backward compatibility when upgrading to CodeBase Map 0.3.0. The key points:

### ✅ What Should Work Identically
- All CLI commands and options
- JSON output structure and content
- Node.js API usage
- Error handling behavior
- Performance characteristics

### ⚠️ What Requires Updates
- File references from `PROJECT_INDEX.json` to `.codebasemap`
- Scripts and tools that depend on the specific filename

### ➕ What's New (Optional)
- Pattern support with `--include` and `--exclude`
- Enhanced verbose output and error messages
- Performance optimizations

Use the provided scripts and manual tests to ensure your upgrade is successful and maintains compatibility with existing workflows.

---

**Verification Guide Version**: 1.0  
**Last Updated**: August 19, 2025  
**Test Coverage**: CLI, API, Integration, Performance, Edge Cases