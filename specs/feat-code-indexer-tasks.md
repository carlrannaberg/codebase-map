# Task Breakdown: Code Indexer
Generated: August 14, 2025
Source: specs/feat-code-indexer.md

## Overview
Build a lightweight TypeScript/JavaScript code indexing tool that generates a comprehensive project map including file trees, dependencies, and code signatures without requiring compilation.

## Execution Strategy
- **Parallel Work**: Phase 1 tasks can run in parallel after initial setup
- **Critical Path**: Setup → Core modules → Commands → Testing
- **Risk Mitigation**: Each module has isolated tests to catch issues early

---

## Phase 1: Foundation & Setup

### Task 1.1: Initialize Node.js Project
**Description**: Set up Node.js project with ESM support and TypeScript configuration
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: None (must complete first)

**Technical Requirements**:
- Node.js 18+ with native ESM support
- TypeScript 5.x for AST parsing only
- Package.json with "type": "module"

**Implementation Steps**:
1. Initialize package.json with npm init
2. Set "type": "module" in package.json
3. Add scripts for scan and update commands
4. Create src directory structure

**Acceptance Criteria**:
- [ ] package.json configured with ESM support
- [ ] Node version requirement documented
- [ ] Scripts added for CLI commands
- [ ] Directory structure created

### Task 1.2: Install Dependencies
**Description**: Install and configure required npm packages
**Size**: Small
**Priority**: High  
**Dependencies**: Task 1.1
**Can run parallel with**: None

**Technical Requirements**:
- fast-glob ^3.x for file traversal
- ignore ^7.x for gitignore parsing
- tsx ^4.x for TypeScript execution
- typescript ^5.x for AST parsing

**Implementation Steps**:
1. Run: npm install fast-glob ignore tsx typescript
2. Add to package.json dependencies
3. Verify all packages installed correctly
4. Document version requirements

**Acceptance Criteria**:
- [ ] All dependencies installed with correct versions
- [ ] No peer dependency warnings
- [ ] Package-lock.json created
- [ ] Dependencies documented in package.json

---

## Phase 2: Core Modules

### Task 2.1: Type Definitions Module
**Description**: Create TypeScript type definitions for all data structures
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.2
**Can run parallel with**: Task 2.2, 2.3, 2.4

**Technical Requirements**:
```typescript
type TreeNode = { 
  name: string; 
  type: "dir" | "file"; 
  children?: TreeNode[] 
};

type Param = { name: string; type?: string };
type FuncSig = { name: string; params: Param[]; returnType?: string; isAsync?: boolean };
type ClassInfo = { name: string; methods: FuncSig[] };
type ConstInfo = { name: string; type?: string; initKind?: string };
type ImportInfo = { from: string; kind: "import"|"export"|"dynamic"|"require" };

type FileInfo = {
  imports: ImportInfo[];
  dependencies: string[];
  functions: FuncSig[];
  classes: ClassInfo[];
  constants: ConstInfo[];
};

type ProjectIndex = {
  metadata: {
    version: number;
    root: string;
    createdAt: string;
    updatedAt: string;
    totalFiles: number;
  };
  tree: TreeNode;
  nodes: string[];
  edges: { from: string; to: string }[];
  files: Record<string, FileInfo>;
};
```

**Implementation Steps**:
1. Create src/types.ts file
2. Define all type interfaces
3. Export types for use in other modules
4. Add JSDoc comments for clarity

**Acceptance Criteria**:
- [ ] All types defined as per specification
- [ ] Types exported for module use
- [ ] No TypeScript errors
- [ ] JSDoc comments added

### Task 2.2: File Discovery Module  
**Description**: Implement file discovery with gitignore support
**Size**: Large
**Priority**: High
**Dependencies**: Task 1.2
**Can run parallel with**: Task 2.1, 2.3, 2.4

**Technical Requirements**:
- Use fast-glob for traversal
- Parse .gitignore with ignore library
- Filter by extensions: .ts, .tsx, .js, .jsx
- Exclude build directories
- Convert to POSIX paths

**Implementation from spec**:
```typescript
function loadGitignore(root: string) {
  const ig = ignore();
  const gi = path.join(root, ".gitignore");
  if (fs.existsSync(gi)) ig.add(fs.readFileSync(gi, "utf8"));
  return ig;
}

function listFiles(root: string, ig = loadGitignore(root)): string[] {
  return fg.sync("**/*", { cwd: root, dot: false, followSymbolicLinks: false })
    .filter(f => isCode(f))
    .filter(f => !ig.ignores(f))
    .filter(f => !/^(?:node_modules|dist|build|\.next|\.turbo)\b/.test(f))
    .map(posix)
    .sort();
}
```

**Implementation Steps**:
1. Create loadGitignore function
2. Create listFiles function with filtering
3. Implement POSIX path conversion
4. Add deterministic sorting

**Acceptance Criteria**:
- [ ] Respects .gitignore patterns
- [ ] Filters correct file extensions
- [ ] Excludes build directories
- [ ] Returns sorted POSIX paths
- [ ] Unit tests pass for various scenarios

### Task 2.3: Tree Building Module
**Description**: Build hierarchical tree structure from flat file list
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.2
**Can run parallel with**: Task 2.1, 2.2, 2.4

**Technical Requirements**:
- Convert flat file list to tree
- Handle nested directories
- Mark files vs directories
- Maintain parent-child relationships

**Implementation from spec**:
```typescript
function buildTree(root: string, files: string[]): TreeNode {
  const rootNode: TreeNode = { name: posix(path.basename(root)), type: "dir", children: [] };
  const byPath = new Map<string, TreeNode>([["", rootNode]]);
  for (const rel of files) {
    const parts = rel.split("/");
    let cur = ""; let parent = rootNode;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      cur = cur ? `${cur}/${name}` : name;
      let node = byPath.get(cur);
      if (!node) {
        node = { name, type: isLast ? "file" : "dir", children: isLast ? undefined : [] };
        parent.children!.push(node);
        byPath.set(cur, node);
      }
      if (!isLast) parent = node;
    }
  }
  return rootNode;
}
```

**Implementation Steps**:
1. Create buildTree function
2. Implement path splitting logic
3. Build parent-child relationships
4. Handle edge cases (empty dirs, single files)

**Acceptance Criteria**:
- [ ] Correct tree structure generated
- [ ] Files and directories properly marked
- [ ] Handles nested structures
- [ ] Performance < 1ms for 1000 files
- [ ] Unit tests for various tree shapes

### Task 2.4: AST Parsing Module
**Description**: Parse TypeScript/JavaScript files to extract code signatures
**Size**: Large
**Priority**: High
**Dependencies**: Task 1.2
**Can run parallel with**: Task 2.1, 2.2, 2.3

**Technical Requirements**:
- Use TypeScript compiler API for parsing
- Extract functions, classes, constants
- Capture textual type annotations
- Handle different file types (ts, tsx, js, jsx)

**Key functions from spec**:
```typescript
function scriptKindFor(file: string): ts.ScriptKind
function textOf(node: ts.Node | undefined, sf: ts.SourceFile): string | undefined
function paramInfo(p: ts.ParameterDeclaration, sf: ts.SourceFile): Param
function initKindOf(init: ts.Expression | undefined): string | undefined
function collectImportsAndCode(sf: ts.SourceFile): { imports: ImportInfo[]; funcs: FuncSig[]; classes: ClassInfo[]; consts: ConstInfo[]; specs: string[] }
```

**Implementation Steps**:
1. Create AST parsing utilities
2. Implement collectImportsAndCode function
3. Handle top-level declarations
4. Walk tree for dynamic imports
5. Extract type annotations as text

**Acceptance Criteria**:
- [ ] Extracts all function signatures
- [ ] Captures class methods correctly
- [ ] Identifies constant types and init kinds
- [ ] Handles all file types (ts/tsx/js/jsx)
- [ ] Gracefully handles syntax errors
- [ ] Unit tests for each extraction type

### Task 2.5: Dependency Resolution Module
**Description**: Resolve relative imports to actual file paths
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.1
**Can run parallel with**: None (depends on other modules)

**Technical Requirements**:
- Resolve relative specifiers only
- Try multiple extension candidates
- Handle index file resolution
- Create dependency edges

**Implementation from spec**:
```typescript
function resolveRelative(fromFile: string, spec: string, fileSet: Set<string>): string | null {
  if (!spec.startsWith(".")) return null;
  const basedir = path.posix.dirname(fromFile);
  const base = path.posix.normalize(path.posix.join(basedir, spec));

  for (const ext of CANDIDATE_EXTS) {
    const cand = path.posix.normalize(base + ext);
    if (fileSet.has(cand)) return cand;
  }
  for (const ix of CANDIDATE_INDEXES) {
    const cand = path.posix.join(base, ix);
    if (fileSet.has(cand)) return cand;
  }
  return null;
}
```

**Implementation Steps**:
1. Create resolveRelative function
2. Implement extension inference
3. Handle index file patterns
4. Build dependency edges

**Acceptance Criteria**:
- [ ] Resolves relative imports correctly
- [ ] Tries all extension candidates
- [ ] Handles index files
- [ ] Ignores external packages
- [ ] Unit tests for resolution scenarios

---

## Phase 3: Command Implementation

### Task 3.1: Core Processing Pipeline
**Description**: Integrate all modules into processing pipeline
**Size**: Large
**Priority**: High
**Dependencies**: Tasks 2.1-2.5
**Can run parallel with**: None

**Technical Requirements**:
- Combine file discovery, parsing, and resolution
- Generate complete ProjectIndex structure
- Handle errors gracefully

**Implementation from spec**:
```typescript
function parseOne(root: string, rel: string, fileSet: Set<string>): { info: FileInfo; edges: { from: string; to: string }[] } {
  const abs = path.join(root, rel);
  const src = fs.readFileSync(abs, "utf8");
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.ES2022, true, scriptKindFor(rel));

  const { imports, funcs, classes, consts, specs } = collectImportsAndCode(sf);
  const deps: string[] = [];
  const edges: { from: string; to: string }[] = [];

  for (const s of specs) {
    const to = resolveRelative(rel, s, fileSet);
    if (to) { deps.push(to); edges.push({ from: rel, to }); }
  }

  const info: FileInfo = {
    imports,
    dependencies: Array.from(new Set(deps)).sort(),
    functions: funcs,
    classes,
    constants: consts
  };
  return { info, edges };
}
```

**Implementation Steps**:
1. Create parseOne function
2. Integrate all processing modules
3. Build complete index structure
4. Handle file read errors

**Acceptance Criteria**:
- [ ] Processes files correctly
- [ ] Generates complete FileInfo
- [ ] Creates dependency edges
- [ ] Error handling works
- [ ] Integration tests pass

### Task 3.2: Scan Command
**Description**: Implement full project scanning command
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.1
**Can run parallel with**: Task 3.3

**Technical Requirements**:
- Full project traversal
- Generate PROJECT_INDEX.JSON
- Create metadata with timestamps

**Implementation from spec**:
```typescript
function scan(root: string) {
  const files = listFiles(root);
  const fileSet = new Set(files);
  const tree = buildTree(root, files);

  const ix: ProjectIndex = {
    metadata: {
      version: VERSION,
      root,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalFiles: files.length
    },
    tree,
    nodes: files,
    edges: [],
    files: Object.create(null)
  };

  for (const rel of files) {
    const { info, edges } = parseOne(root, rel, fileSet);
    ix.files[rel] = info;
    ix.edges.push(...edges);
  }
  writeIndex(ix);
}
```

**Implementation Steps**:
1. Create scan function
2. Process all files
3. Generate complete index
4. Write to PROJECT_INDEX.JSON

**Acceptance Criteria**:
- [ ] Scans entire project
- [ ] Generates valid JSON output
- [ ] Performance < 1s for 100 files
- [ ] Creates all metadata fields
- [ ] E2E test passes

### Task 3.3: Update Command
**Description**: Implement incremental file update command
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.1
**Can run parallel with**: Task 3.2

**Technical Requirements**:
- Load existing index
- Update single file entry
- Handle file deletion
- Preserve other entries

**Implementation from spec**:
```typescript
function updateOne(root: string, relOrAbs: string) {
  if (!fs.existsSync(INDEX_PATH)) {
    console.error(`ERROR: ${INDEX_PATH} not found. Run 'scan' first.`);
    process.exit(1);
  }
  const ix: ProjectIndex = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  const rel = posix(path.isAbsolute(relOrAbs) ? path.relative(root, relOrAbs) : relOrAbs);

  const exists = fs.existsSync(path.join(root, rel));
  const nodes = new Set(ix.nodes);

  if (!exists) {
    if (nodes.has(rel)) nodes.delete(rel);
    delete ix.files[rel];
    ix.edges = ix.edges.filter(e => e.from !== rel);
    ix.nodes = Array.from(nodes).sort();
    ix.metadata.totalFiles = ix.nodes.length;
    ix.tree = buildTree(root, ix.nodes);
    writeIndex(ix);
    console.log(`Removed missing file from index: ${rel}`);
    return;
  }

  nodes.add(rel);
  ix.nodes = Array.from(nodes).sort();
  ix.metadata.totalFiles = ix.nodes.length;

  const fileSet = new Set(ix.nodes);
  const { info, edges } = parseOne(root, rel, fileSet);
  ix.files[rel] = info;
  ix.edges = ix.edges.filter(e => e.from !== rel).concat(edges);
  ix.tree = buildTree(root, ix.nodes);

  writeIndex(ix);
  console.log(`Updated: ${rel}`);
}
```

**Implementation Steps**:
1. Create updateOne function
2. Handle file addition/modification
3. Handle file deletion
4. Rebuild tree structure

**Acceptance Criteria**:
- [ ] Updates single file correctly
- [ ] Handles file deletion
- [ ] Preserves other entries
- [ ] Updates metadata
- [ ] Integration tests pass

### Task 3.4: CLI Entry Point
**Description**: Create main CLI entry point with command routing
**Size**: Small
**Priority**: High
**Dependencies**: Tasks 3.2, 3.3
**Can run parallel with**: None

**Technical Requirements**:
- Parse command line arguments
- Route to scan/update commands
- Show usage information
- Handle errors gracefully

**Implementation from spec**:
```typescript
const cmd = process.argv[2] as "scan"|"update"|undefined;
const argPath = process.argv[3];
const ROOT = path.resolve(process.argv[4] || process.cwd());

(async function main() {
  if (!cmd || (cmd !== "scan" && cmd !== "update")) { usage(); process.exit(1); }
  if (cmd === "scan") scan(ROOT);
  else if (cmd === "update") {
    if (!argPath) { usage(); process.exit(1); }
    updateOne(ROOT, argPath);
  }
})();
```

**Implementation Steps**:
1. Create main entry point
2. Parse CLI arguments
3. Route to appropriate command
4. Add usage documentation

**Acceptance Criteria**:
- [ ] CLI arguments parsed correctly
- [ ] Routes to correct command
- [ ] Shows usage when needed
- [ ] Error codes returned properly
- [ ] Works with npm scripts

---

## Phase 4: Testing & Documentation

### Task 4.1: Unit Tests - File Discovery
**Description**: Write comprehensive unit tests for file discovery module
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.2
**Can run parallel with**: Tasks 4.2, 4.3, 4.4

**Test Requirements**:
- Test gitignore patterns
- Test extension filtering
- Test directory exclusion
- Test POSIX conversion
- Test sorting

**Test Cases**:
```javascript
// Purpose: Verify gitignore patterns are respected
test('respects gitignore patterns', () => {
  // Test that files in gitignore are excluded
});

// Purpose: Ensure only supported extensions are included
test('filters by correct extensions', () => {
  // Test .ts, .tsx, .js, .jsx included
  // Test other extensions excluded
});

// Purpose: Validate build directories are excluded
test('excludes standard build directories', () => {
  // Test node_modules, dist, build excluded
});
```

**Acceptance Criteria**:
- [ ] Tests can fail to reveal bugs
- [ ] All edge cases covered
- [ ] Tests document their purpose
- [ ] 100% function coverage

### Task 4.2: Unit Tests - AST Parsing
**Description**: Write unit tests for AST parsing module
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.4
**Can run parallel with**: Tasks 4.1, 4.3, 4.4

**Test Requirements**:
- Test function extraction
- Test class extraction
- Test constant extraction
- Test import detection
- Test error handling

**Test Cases**:
```javascript
// Purpose: Verify function signatures are extracted correctly
test('extracts function signatures with types', () => {
  // Test async functions, arrow functions, regular functions
});

// Purpose: Ensure classes and methods are captured
test('extracts class definitions with methods', () => {
  // Test class methods, getters, setters
});

// Purpose: Validate handling of malformed code
test('handles syntax errors gracefully', () => {
  // Test parsing continues despite errors
});
```

**Acceptance Criteria**:
- [ ] All code patterns tested
- [ ] Error cases handled
- [ ] Tests are meaningful
- [ ] Can detect regressions

### Task 4.3: Unit Tests - Dependency Resolution
**Description**: Write unit tests for dependency resolution
**Size**: Small
**Priority**: High
**Dependencies**: Task 2.5
**Can run parallel with**: Tasks 4.1, 4.2, 4.4

**Test Requirements**:
- Test relative import resolution
- Test extension inference
- Test index file resolution
- Test non-existent imports

**Test Cases**:
```javascript
// Purpose: Verify relative imports resolve correctly
test('resolves relative imports with extensions', () => {
  // Test ./file, ../file, ./dir/file patterns
});

// Purpose: Ensure index files are found
test('resolves directory imports to index files', () => {
  // Test ./utils resolves to ./utils/index.ts
});
```

**Acceptance Criteria**:
- [ ] All resolution patterns tested
- [ ] Edge cases covered
- [ ] Tests validate correctness
- [ ] Performance benchmarked

### Task 4.4: Integration Tests
**Description**: Write end-to-end integration tests
**Size**: Large
**Priority**: High
**Dependencies**: Tasks 3.2, 3.3
**Can run parallel with**: Tasks 4.1, 4.2, 4.3

**Test Requirements**:
- Test full scan on sample project
- Test incremental updates
- Test file deletion handling
- Test output format validation

**Test Cases**:
```javascript
// Purpose: Validate complete scanning process
test('scans entire project correctly', () => {
  // Create sample project
  // Run scan
  // Verify output structure
});

// Purpose: Ensure incremental updates work
test('updates single file without full rescan', () => {
  // Modify file
  // Run update
  // Verify only that file changed
});

// Purpose: Validate deletion handling
test('removes deleted files from index', () => {
  // Delete file
  // Run update
  // Verify removal from index
});
```

**Acceptance Criteria**:
- [ ] E2E scenarios tested
- [ ] Output format validated
- [ ] Performance benchmarked
- [ ] Edge cases covered

### Task 4.5: Documentation
**Description**: Create comprehensive documentation
**Size**: Medium
**Priority**: Medium
**Dependencies**: All implementation tasks
**Can run parallel with**: None

**Documentation Requirements**:
- README with installation steps
- Usage examples
- Output format documentation
- Troubleshooting guide
- API documentation

**Sections to write**:
1. Installation guide
2. Quick start tutorial
3. Command reference
4. Output format specification
5. Integration examples
6. Troubleshooting section

**Acceptance Criteria**:
- [ ] README complete
- [ ] All commands documented
- [ ] Examples provided
- [ ] JSON schema documented
- [ ] Common issues addressed

---

## Summary Statistics

**Total Tasks**: 14
- Phase 1 (Foundation): 2 tasks
- Phase 2 (Core Modules): 5 tasks
- Phase 3 (Commands): 4 tasks
- Phase 4 (Testing & Docs): 5 tasks

**Complexity Breakdown**:
- Small: 3 tasks
- Medium: 8 tasks
- Large: 5 tasks

**Parallel Execution Opportunities**:
- Phase 2: Tasks 2.1-2.4 can run in parallel
- Phase 3: Tasks 3.2-3.3 can run in parallel
- Phase 4: Tasks 4.1-4.4 can run in parallel

**Critical Path**:
Setup (1.1, 1.2) → Core Modules (2.1-2.5) → Processing (3.1) → Commands (3.2-3.4) → Testing (4.1-4.5)

**Estimated Timeline**:
- Phase 1: 0.5 days
- Phase 2: 2 days (with parallel work)
- Phase 3: 1.5 days
- Phase 4: 2 days
- **Total**: ~6 days with one developer

**Risk Areas**:
1. AST parsing complexity - Mitigated by using TypeScript compiler API
2. Performance with large codebases - Mitigated by optimization strategies
3. Edge cases in dependency resolution - Mitigated by comprehensive testing