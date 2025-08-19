# Migration Examples: Real-World Scenarios

This document provides detailed before/after examples for migrating from CodeBase Map 0.2.x to 0.3.0 across different project types and usage patterns.

## Table of Contents

1. [React TypeScript Project](#react-typescript-project)
2. [Node.js API Server](#nodejs-api-server)
3. [Monorepo with Multiple Packages](#monorepo-with-multiple-packages)
4. [Documentation Site](#documentation-site)
5. [GitHub Actions Workflows](#github-actions-workflows)
6. [Docker Builds](#docker-builds)
7. [Custom Analysis Scripts](#custom-analysis-scripts)
8. [IDE Integration](#ide-integration)

## React TypeScript Project

**Project Structure**:
```
react-app/
├── src/
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   └── __tests__/
├── public/
├── docs/
├── package.json
└── scripts/
    └── analyze.sh
```

### Before (0.2.x)

**package.json**:
```json
{
  "scripts": {
    "analyze": "codebase-map scan && cat PROJECT_INDEX.json | jq '.summary'",
    "docs:generate": "codebase-map scan && node scripts/generate-docs.js PROJECT_INDEX.json",
    "pre-commit": "codebase-map scan && node scripts/validate-structure.js PROJECT_INDEX.json"
  }
}
```

**scripts/analyze.sh**:
```bash
#!/bin/bash
echo "🔍 Analyzing React codebase..."
codebase-map scan

if [ -f "PROJECT_INDEX.json" ]; then
    echo "📊 Components: $(cat PROJECT_INDEX.json | jq '[.files[] | select(.path | contains("components/"))] | length')"
    echo "🧪 Tests: $(cat PROJECT_INDEX.json | jq '[.files[] | select(.path | contains("__tests__/"))] | length')"
    echo "🔧 Utils: $(cat PROJECT_INDEX.json | jq '[.files[] | select(.path | contains("utils/"))] | length')"
fi
```

**scripts/generate-docs.js**:
```javascript
const fs = require('fs');
const path = require('path');

function generateDocs() {
  const indexPath = path.join(process.cwd(), 'PROJECT_INDEX.json');
  
  if (!fs.existsSync(indexPath)) {
    console.error('❌ PROJECT_INDEX.json not found');
    process.exit(1);
  }
  
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  
  // Generate component documentation
  const components = index.files.filter(f => 
    f.path.includes('components/') && f.path.endsWith('.tsx')
  );
  
  console.log(`Found ${components.length} components`);
  // ... rest of doc generation
}

generateDocs();
```

### After (0.3.0)

**package.json**:
```json
{
  "scripts": {
    "analyze": "codebase-map scan --include 'src/**' --exclude '**/__tests__/**' && cat .codebasemap | jq '.summary'",
    "analyze:full": "codebase-map scan && cat .codebasemap | jq '.summary'",
    "analyze:components": "codebase-map scan --include 'src/components/**' --exclude '**/*.test.*'",
    "analyze:tests": "codebase-map scan --include '**/__tests__/**' --include '**/*.test.*'",
    "docs:generate": "codebase-map scan --include 'src/**' --exclude '**/__tests__/**' && node scripts/generate-docs.js .codebasemap",
    "pre-commit": "codebase-map scan --include 'src/**' && node scripts/validate-structure.js .codebasemap"
  }
}
```

**scripts/analyze.sh**:
```bash
#!/bin/bash
echo "🔍 Analyzing React codebase..."

# Source code only (faster)
codebase-map scan --include "src/**" --exclude "**/__tests__/**" --exclude "**/*.test.*"

if [ -f ".codebasemap" ]; then
    echo "📊 Components: $(cat .codebasemap | jq '[.files[] | select(.path | contains("components/"))] | length')"
    echo "🔧 Utils: $(cat .codebasemap | jq '[.files[] | select(.path | contains("utils/"))] | length')"
    echo "🎣 Hooks: $(cat .codebasemap | jq '[.files[] | select(.path | contains("hooks/"))] | length')"
    
    # Separate test analysis
    echo ""
    echo "🧪 Running test analysis..."
    codebase-map scan --include "**/__tests__/**" --include "**/*.test.*" --output .codebasemap-tests
    echo "🧪 Tests: $(cat .codebasemap-tests | jq '.files | length')"
fi
```

**scripts/generate-docs.js**:
```javascript
const fs = require('fs');
const path = require('path');

function generateDocs(indexFilename = '.codebasemap') {
  const indexPath = path.join(process.cwd(), indexFilename);
  
  if (!fs.existsSync(indexPath)) {
    console.error(`❌ ${indexFilename} not found`);
    process.exit(1);
  }
  
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  
  // Generate component documentation
  const components = index.files.filter(f => 
    f.path.includes('components/') && f.path.endsWith('.tsx')
  );
  
  console.log(`Found ${components.length} components`);
  // ... rest of doc generation
}

// Support both old and new filename for transition period
const indexFile = process.argv[2] || '.codebasemap';
generateDocs(indexFile);
```

### Benefits After Migration

```bash
# 🚀 Performance improvements
# Before: Scan 150+ files including tests
time codebase-map scan  # ~2.5s

# After: Focus on source code
time codebase-map scan --include "src/**" --exclude "**/__tests__/**"  # ~1.2s

# 🎯 Targeted analysis
npm run analyze:components  # Only components
npm run analyze:tests      # Only tests
```

## Node.js API Server

**Project Structure**:
```
api-server/
├── src/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   └── utils/
├── tests/
├── docs/
├── scripts/
└── docker/
```

### Before (0.2.x)

**scripts/api-docs.sh**:
```bash
#!/bin/bash
# Generate API documentation

echo "📋 Generating API documentation..."
codebase-map scan

# Extract API endpoints
cat PROJECT_INDEX.json | jq -r '.files[] 
  | select(.path | contains("routes/") or contains("controllers/")) 
  | .path' > api-files.txt

echo "Found $(wc -l < api-files.txt) API files"

# Process each file for documentation
while IFS= read -r file; do
  echo "Processing $file..."
  # ... extract API documentation
done < api-files.txt

rm api-files.txt
```

**Dockerfile**:
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Generate index for production monitoring
RUN npx codebase-map scan
RUN cp PROJECT_INDEX.json /app/metadata/

CMD ["npm", "start"]
```

### After (0.3.0)

**scripts/api-docs.sh**:
```bash
#!/bin/bash
# Generate API documentation with improved performance

echo "📋 Generating API documentation..."

# Focus only on API-related files
codebase-map scan \
  --include "src/routes/**" \
  --include "src/controllers/**" \
  --include "src/middleware/**" \
  --exclude "**/*.test.*" \
  --output .codebasemap-api

# Extract API endpoints (faster with smaller file)
cat .codebasemap-api | jq -r '.files[].path' > api-files.txt

echo "Found $(wc -l < api-files.txt) API files"
echo "⚡ Analysis completed $(cat .codebasemap-api | jq '.summary.analysisTime')ms faster"

# Process each file for documentation
while IFS= read -r file; do
  echo "Processing $file..."
  # ... extract API documentation
done < api-files.txt

rm api-files.txt
```

**package.json** (new scripts):
```json
{
  "scripts": {
    "map:api": "codebase-map scan --include 'src/{routes,controllers,middleware}/**' --exclude '**/*.test.*'",
    "map:models": "codebase-map scan --include 'src/models/**'", 
    "map:tests": "codebase-map scan --include 'tests/**' --include '**/*.test.*'",
    "docs:api": "npm run map:api && node scripts/generate-api-docs.js .codebasemap",
    "health:check": "npm run map:api && node scripts/validate-api-structure.js .codebasemap"
  }
}
```

**Dockerfile**:
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Generate focused index for production monitoring (faster)
RUN npx codebase-map scan \
    --include "src/**" \
    --exclude "**/*.test.*" \
    --exclude "tests/**" \
    --exclude "docs/**"

RUN cp .codebasemap /app/metadata/

CMD ["npm", "start"]
```

### Benefits

```bash
# 📈 Performance comparison
# Before: Full scan ~3.2s (120 files)
time codebase-map scan

# After: API-only scan ~0.8s (35 files)  
time npm run map:api

# 🎯 Focused analysis
npm run map:models    # Database layer only
npm run map:tests     # Test coverage analysis
npm run health:check  # API structure validation
```

## Monorepo with Multiple Packages

**Project Structure**:
```
monorepo/
├── packages/
│   ├── api/
│   │   ├── src/
│   │   └── tests/
│   ├── ui/
│   │   ├── src/
│   │   └── __tests__/
│   ├── shared/
│   │   └── src/
│   └── tools/
├── apps/
│   ├── web/
│   └── mobile/
├── docs/
└── .github/workflows/
```

### Before (0.2.x)

**.github/workflows/analyze.yml**:
```yaml
name: Code Analysis
on: [push, pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Generate codebase map
        run: npx codebase-map scan
        
      - name: Analyze structure
        run: |
          echo "Total files: $(cat PROJECT_INDEX.json | jq '.files | length')"
          echo "API files: $(cat PROJECT_INDEX.json | jq '[.files[] | select(.path | startswith("packages/api/"))] | length')"
          echo "UI files: $(cat PROJECT_INDEX.json | jq '[.files[] | select(.path | startswith("packages/ui/"))] | length')"
          
      - name: Upload index
        uses: actions/upload-artifact@v3
        with:
          name: codebase-index
          path: PROJECT_INDEX.json
```

**scripts/package-analysis.sh**:
```bash
#!/bin/bash
echo "📦 Analyzing monorepo packages..."

codebase-map scan

for package in packages/*/; do
  package_name=$(basename "$package")
  echo "📊 $package_name:"
  cat PROJECT_INDEX.json | jq -r --arg pkg "$package" '
    [.files[] | select(.path | startswith($pkg))] | length
  '
done
```

### After (0.3.0)

**.github/workflows/analyze.yml**:
```yaml
name: Code Analysis
on: [push, pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: [api, ui, shared]
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Analyze ${{ matrix.package }}
        run: |
          npx codebase-map scan \
            --include "packages/${{ matrix.package }}/src/**" \
            --exclude "**/*.test.*" \
            --exclude "**/__tests__/**" \
            --output .codebasemap-${{ matrix.package }}
            
      - name: Package statistics
        run: |
          echo "${{ matrix.package }} files: $(cat .codebasemap-${{ matrix.package }} | jq '.files | length')"
          echo "${{ matrix.package }} dependencies: $(cat .codebasemap-${{ matrix.package }} | jq '[.files[].dependencies[]?] | unique | length')"
          
      - name: Upload package index
        uses: actions/upload-artifact@v3
        with:
          name: codebase-index-${{ matrix.package }}
          path: .codebasemap-${{ matrix.package }}

  full-analysis:
    needs: analyze
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Full monorepo analysis
        run: |
          npx codebase-map scan \
            --include "packages/*/src/**" \
            --include "apps/*/src/**" \
            --exclude "**/node_modules/**" \
            --exclude "**/*.test.*"
          echo "Total source files: $(cat .codebasemap | jq '.files | length')"
```

**package.json** (root):
```json
{
  "scripts": {
    "map:all": "codebase-map scan --include 'packages/*/src/**' --include 'apps/*/src/**' --exclude '**/*.test.*'",
    "map:api": "codebase-map scan --include 'packages/api/src/**' --output .codebasemap-api",
    "map:ui": "codebase-map scan --include 'packages/ui/src/**' --exclude '**/*.stories.*' --output .codebasemap-ui",
    "map:shared": "codebase-map scan --include 'packages/shared/src/**' --output .codebasemap-shared",
    "map:apps": "codebase-map scan --include 'apps/*/src/**' --exclude '**/*.test.*'",
    "analyze:dependencies": "npm run map:all && node scripts/analyze-dependencies.js .codebasemap",
    "health:packages": "npm run map:all && node scripts/validate-package-structure.js .codebasemap"
  }
}
```

**scripts/package-analysis.sh**:
```bash
#!/bin/bash
echo "📦 Analyzing monorepo packages with focused scanning..."

# Parallel analysis for better performance
packages=("api" "ui" "shared")

for package in "${packages[@]}"; do
  {
    echo "🔍 Analyzing $package..."
    codebase-map scan \
      --include "packages/$package/src/**" \
      --exclude "**/*.test.*" \
      --output ".codebasemap-$package"
    
    files=$(cat ".codebasemap-$package" | jq '.files | length')
    deps=$(cat ".codebasemap-$package" | jq '[.files[].dependencies[]?] | unique | length')
    echo "📊 $package: $files files, $deps unique dependencies"
  } &
done

# Wait for all background jobs
wait

echo "✅ Package analysis complete!"

# Generate combined report
echo "📋 Generating combined analysis..."
codebase-map scan \
  --include "packages/*/src/**" \
  --exclude "**/*.test.*" \
  --output ".codebasemap-combined"

echo "🎯 Total monorepo source files: $(cat .codebasemap-combined | jq '.files | length')"
```

### Benefits

```bash
# ⚡ Performance improvements
# Before: Full monorepo scan ~15s (500+ files)
time codebase-map scan

# After: Package-specific scans ~2-4s each
time npm run map:api     # ~2.1s (45 files)
time npm run map:ui      # ~3.2s (78 files)  
time npm run map:shared  # ~1.8s (23 files)

# 🔄 Parallel CI/CD
# Before: Sequential 15s scan
# After: Parallel 3s per package + 6s combined = 9s total

# 🎯 Focused development
npm run map:api && code .codebasemap-api    # API development
npm run map:ui && code .codebasemap-ui      # UI development
```

## Documentation Site

**Project Structure**:
```
docs-site/
├── content/
│   ├── guides/
│   ├── api/
│   ├── examples/
│   └── blog/
├── src/
│   ├── components/
│   ├── generators/
│   └── utils/
├── static/
└── scripts/
```

### Before (0.2.x)

**scripts/build-docs.sh**:
```bash
#!/bin/bash
echo "📚 Building documentation site..."

# Analyze entire project
codebase-map scan

# Extract content files
cat PROJECT_INDEX.json | jq -r '.files[] 
  | select(.path | startswith("content/")) 
  | .path' > content-files.txt

# Extract generator files  
cat PROJECT_INDEX.json | jq -r '.files[]
  | select(.path | startswith("src/generators/"))
  | .path' > generator-files.txt

echo "Content files: $(wc -l < content-files.txt)"
echo "Generator files: $(wc -l < generator-files.txt)"

# Build documentation
node src/generators/index.js PROJECT_INDEX.json

rm content-files.txt generator-files.txt
```

### After (0.3.0)

**scripts/build-docs.sh**:
```bash
#!/bin/bash
echo "📚 Building documentation site..."

# Separate content and generator analysis
echo "🔍 Analyzing content..."
codebase-map scan \
  --include "content/**" \
  --exclude "**/drafts/**" \
  --exclude "**/.DS_Store" \
  --output .codebasemap-content

echo "🔍 Analyzing generators..."  
codebase-map scan \
  --include "src/generators/**" \
  --include "src/components/**" \
  --include "src/utils/**" \
  --exclude "**/*.test.*" \
  --output .codebasemap-generators

echo "📊 Content files: $(cat .codebasemap-content | jq '.files | length')"
echo "📊 Generator files: $(cat .codebasemap-generators | jq '.files | length')"

# Build with focused indexes
node src/generators/index.js .codebasemap-content .codebasemap-generators
```

**package.json**:
```json
{
  "scripts": {
    "map:content": "codebase-map scan --include 'content/**' --exclude '**/drafts/**' --output .codebasemap-content",
    "map:generators": "codebase-map scan --include 'src/**' --exclude '**/*.test.*' --output .codebasemap-generators", 
    "map:examples": "codebase-map scan --include 'content/examples/**' --output .codebasemap-examples",
    "build": "npm run map:content && npm run map:generators && node src/generators/index.js",
    "dev": "npm run map:content && npm run map:generators && node src/dev-server.js",
    "validate:content": "npm run map:content && node scripts/validate-content.js .codebasemap-content"
  }
}
```

**src/generators/index.js**:
```javascript
const fs = require('fs');

function buildDocs(contentIndex = '.codebasemap-content', generatorIndex = '.codebasemap-generators') {
  console.log('📚 Building documentation...');
  
  // Load focused indexes
  const content = JSON.parse(fs.readFileSync(contentIndex, 'utf8'));
  const generators = JSON.parse(fs.readFileSync(generatorIndex, 'utf8'));
  
  console.log(`📄 Processing ${content.files.length} content files`);
  console.log(`⚙️  Using ${generators.files.length} generator files`);
  
  // Process content by type
  const guides = content.files.filter(f => f.path.includes('guides/'));
  const api = content.files.filter(f => f.path.includes('api/'));
  const examples = content.files.filter(f => f.path.includes('examples/'));
  const blog = content.files.filter(f => f.path.includes('blog/'));
  
  console.log(`📖 Guides: ${guides.length}`);
  console.log(`🔧 API docs: ${api.length}`);
  console.log(`💡 Examples: ${examples.length}`);
  console.log(`📝 Blog posts: ${blog.length}`);
  
  // Build each section
  buildGuides(guides);
  buildAPI(api);
  buildExamples(examples);
  buildBlog(blog);
}

if (require.main === module) {
  const contentIndex = process.argv[2] || '.codebasemap-content';
  const generatorIndex = process.argv[3] || '.codebasemap-generators';
  buildDocs(contentIndex, generatorIndex);
}
```

### Benefits

```bash
# 🚀 Build performance
# Before: Analyze 200+ files including static assets ~4.5s
time codebase-map scan

# After: Focused analysis ~1.8s total
time npm run map:content      # ~0.8s (65 content files)
time npm run map:generators   # ~1.0s (28 generator files)

# 🎯 Development workflow
npm run map:examples && code .codebasemap-examples  # Work on examples
npm run validate:content                            # Content validation
```

## GitHub Actions Workflows

### Before (0.2.x)

**.github/workflows/ci.yml**:
```yaml
name: CI
on: [push, pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install
        run: npm ci
        
      - name: Generate index
        run: npx codebase-map scan
        
      - name: Validate structure  
        run: |
          if [ ! -f "PROJECT_INDEX.json" ]; then
            echo "❌ Index generation failed"
            exit 1
          fi
          
          file_count=$(cat PROJECT_INDEX.json | jq '.files | length')
          echo "📊 Total files: $file_count"
          
          if [ "$file_count" -lt 10 ]; then
            echo "⚠️  Suspiciously low file count"
            exit 1
          fi
          
      - name: Check dependencies
        run: |
          deps=$(cat PROJECT_INDEX.json | jq '[.files[].dependencies[]?] | unique | length')
          echo "🔗 Unique dependencies: $deps"
          
      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: codebase-index
          path: PROJECT_INDEX.json
```

### After (0.3.0)

**.github/workflows/ci.yml**:
```yaml
name: CI
on: [push, pull_request]

jobs:
  analyze-source:
    runs-on: ubuntu-latest
    outputs:
      source-files: ${{ steps.analyze.outputs.source-files }}
      test-files: ${{ steps.analyze.outputs.test-files }}
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install
        run: npm ci
        
      - name: Analyze source code
        id: analyze
        run: |
          # Source code analysis
          npx codebase-map scan \
            --include "src/**" \
            --exclude "**/*.test.*" \
            --exclude "**/__tests__/**" \
            --output .codebasemap-source
            
          # Test analysis
          npx codebase-map scan \
            --include "**/*.test.*" \
            --include "**/__tests__/**" \
            --output .codebasemap-tests
            
          source_files=$(cat .codebasemap-source | jq '.files | length')
          test_files=$(cat .codebasemap-tests | jq '.files | length')
          
          echo "source-files=$source_files" >> $GITHUB_OUTPUT
          echo "test-files=$test_files" >> $GITHUB_OUTPUT
          echo "📊 Source files: $source_files"
          echo "🧪 Test files: $test_files"
          
      - name: Validate structure  
        run: |
          if [ ! -f ".codebasemap-source" ]; then
            echo "❌ Source analysis failed"
            exit 1
          fi
          
          if [ "${{ steps.analyze.outputs.source-files }}" -lt 5 ]; then
            echo "⚠️  Suspiciously low source file count"
            exit 1
          fi
          
      - name: Check test coverage
        run: |
          source_count=${{ steps.analyze.outputs.source-files }}
          test_count=${{ steps.analyze.outputs.test-files }}
          
          if [ "$test_count" -eq 0 ]; then
            echo "⚠️  No test files found"
          else
            ratio=$(echo "scale=2; $test_count / $source_count" | bc)
            echo "🧪 Test ratio: $ratio"
          fi
          
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: codebase-analysis
          path: |
            .codebasemap-source
            .codebasemap-tests

  security-scan:
    runs-on: ubuntu-latest
    needs: analyze-source
    if: needs.analyze-source.outputs.source-files > 0
    steps:
      - uses: actions/checkout@v3
      
      - name: Security-focused analysis
        run: |
          npx codebase-map scan \
            --include "src/**" \
            --exclude "**/*.test.*" \
            --exclude "**/node_modules/**" \
            --exclude "**/dist/**" \
            --output .codebasemap-security
            
      - name: Check for sensitive patterns
        run: |
          # Download previous artifact
          # Check for security issues in the codebase
          cat .codebasemap-security | jq -r '.files[].path' | while read file; do
            if grep -q "password\|secret\|key" "$file" 2>/dev/null; then
              echo "⚠️  Potential sensitive data in $file"
            fi
          done
```

### Benefits

```bash
# 🚀 CI Performance
# Before: Single 8s scan analyzing everything
# After: Parallel focused scans
#   - Source analysis: 3s
#   - Test analysis: 2s  
#   - Security scan: 2s
# Total: 4s (with parallelization) vs 8s

# 🎯 Better insights
# - Separate source/test metrics
# - Test coverage ratios
# - Security-focused scanning
# - Conditional workflows based on analysis
```

## Migration Checklist

Use this checklist to ensure complete migration:

### Pre-Migration
- [ ] **Audit current usage**: Find all `PROJECT_INDEX.json` references
- [ ] **Backup existing setup**: Save current scripts and configs
- [ ] **Test environment**: Ensure you can rollback if needed

### Core Migration  
- [ ] **Update package**: Install codebase-map@0.3.0
- [ ] **Update scripts**: Change filename references to `.codebasemap`
- [ ] **Update CI/CD**: Modify workflow files
- [ ] **Update documentation**: Reflect new filename in docs

### Optimization (Optional)
- [ ] **Add pattern support**: Use `--include`/`--exclude` for better performance
- [ ] **Create focused scripts**: Separate analysis for different purposes
- [ ] **Optimize CI/CD**: Use parallel pattern-based analysis
- [ ] **Update .gitignore**: Add `.codebasemap` if you ignore the index

### Verification
- [ ] **Test basic functionality**: Ensure scanning works
- [ ] **Test existing scripts**: Verify all scripts still work
- [ ] **Test CI/CD**: Ensure workflows complete successfully
- [ ] **Performance check**: Verify performance improvements
- [ ] **Rollback test**: Ensure you can rollback if needed

---

**Examples Document Version**: 1.0  
**Last Updated**: August 19, 2025  
**Coverage**: 8 common migration scenarios with before/after examples