# Ultra-Compact Index Format Proposals for Claude Context

## Problem Analysis
Current JSON format for 20 files: **39KB / ~3,300 tokens**
- Projected for 100 files: ~16,500 tokens
- Projected for 1000 files: ~165,000 tokens (**exceeds context window!**)

## Compression Strategies

### 1. **Abbreviated JSON Format** (60% reduction)
```json
{
  "f": {
    "src/index.ts": {
      "i": ["./utils.js", "./types.js"],
      "d": ["src/utils.ts", "src/types.ts"],
      "fn": [{"n":"main","r":"Promise<void>","a":1}],
      "cl": [{"n":"App","m":3,"p":2}],
      "c": [{"n":"VERSION","t":"string"}]
    }
  }
}
```
- Single letter keys: f=files, i=imports, d=deps, fn=functions, cl=classes, c=constants
- Minimal metadata: n=name, r=return, a=async, m=methods, p=props
- ~1,320 tokens for 20 files

### 2. **Custom DSL Format** (75% reduction)
```
src/index.ts > utils,types
  fn main():Promise<void> async
  cl App(3m,2p)
  cn VERSION:string

src/utils.ts > 
  fn helper(s:string):number
  fn process(data:any[]):void async
```
- Ultra-compact notation
- ~825 tokens for 20 files
- Human-readable

### 3. **TypeScript Definition Style** (70% reduction)
```typescript
// src/index.ts → utils, types
async main(): Promise<void>
class App { render(); mount(); state: State; config: Config }
const VERSION: string

// src/utils.ts
helper(s: string): number
async process(data: any[]): void
```
- Familiar syntax for developers
- ~990 tokens for 20 files
- Natural for Claude to understand

### 4. **Graph + Signatures Hybrid** (80% reduction)
```
EDGES:
1→2,3
2→4
3→4,5

SIGS:
1:index|main():P<void>|App{3m,2p}|VERSION:s
2:utils|helper(s):n|process(a[]):v
3:types|FileInfo{5p}|ProjectIndex{4p}
```
- Separate concerns: structure vs content
- Use indices for files
- ~660 tokens for 20 files

### 5. **Markdown Table Format** (65% reduction)
```markdown
| File | Deps | Functions | Classes | Constants |
|------|------|-----------|---------|-----------|
| index.ts | utils,types | main():Promise<void> | App(3m,2p) | VERSION |
| utils.ts | - | helper(s:string):number | - | - |
```
- Tabular, scannable
- ~1,155 tokens for 20 files

## Recommended Solution: **Multi-Level Compression**

```typescript
interface CompressionLevel {
  FULL: 'json',        // Original JSON (debugging)
  COMPACT: 'mini',     // Minified JSON (tools)
  ULTRA: 'dsl',        // Custom DSL (Claude small projects)
  EXTREME: 'graph'     // Graph notation (Claude large projects)
}
```

### Implementation Approach:

1. **For Small Projects (<50 files)**: Use TypeScript Definition Style
   - Readable, familiar, ~50 tokens per file

2. **For Medium Projects (50-500 files)**: Use Custom DSL
   - Compact but parseable, ~40 tokens per file

3. **For Large Projects (500+ files)**: Use Graph + Signatures
   - Extreme compression, ~30 tokens per file

### Token Estimates by Project Size:

| Files | Current JSON | Mini JSON | DSL Format | Graph Format |
|-------|-------------|-----------|------------|--------------|
| 20    | 3,300       | 1,320     | 825        | 660          |
| 100   | 16,500      | 6,600     | 4,125      | 3,300        |
| 500   | 82,500      | 33,000    | 20,625     | 16,500       |
| 1000  | 165,000     | 66,000    | 41,250     | 33,000       |

## Proposed API:

```bash
# Generate ultra-compact index for Claude
npm run index:compact --format=dsl

# Generate different formats
npm run index:compact --format=json  # Minified JSON
npm run index:compact --format=dsl   # Custom DSL
npm run index:compact --format=graph # Graph notation
npm run index:compact --format=auto  # Auto-select based on size
```

## Example DSL Parser for Claude:

```typescript
// Simple DSL format:
// file > dep1,dep2
//   fn name(params):return [async]
//   cl Name(Xm,Yp) [extends Base]
//   cn NAME:type

function parseDSL(dsl: string) {
  const files = {};
  let currentFile = null;
  
  for (const line of dsl.split('\n')) {
    if (!line.startsWith('  ')) {
      // File declaration
      const [file, deps] = line.split(' > ');
      currentFile = file;
      files[file] = {
        deps: deps?.split(',') || [],
        functions: [],
        classes: [],
        constants: []
      };
    } else {
      // Entity declaration
      const trimmed = line.trim();
      if (trimmed.startsWith('fn ')) {
        files[currentFile].functions.push(parseFn(trimmed));
      } else if (trimmed.startsWith('cl ')) {
        files[currentFile].classes.push(parseClass(trimmed));
      } else if (trimmed.startsWith('cn ')) {
        files[currentFile].constants.push(parseConst(trimmed));
      }
    }
  }
  return files;
}
```

## Benefits:

1. **Claude Context Efficiency**: 
   - 5x more files in same context window
   - Entire 1000-file project in ~33K tokens (Graph format)

2. **Human Readable**: 
   - DSL format is scannable
   - Natural abbreviations

3. **Progressive Loading**:
   - Load graph first (structure)
   - Load signatures on demand
   - Load full JSON only when needed

4. **Backwards Compatible**:
   - Keep PROJECT_INDEX.json for tools
   - Generate PROJECT_INDEX.compact for Claude

## Next Steps:

1. Implement format converters in `src/core/index-formatter.ts`
2. Add CLI flags for format selection
3. Create Claude-specific loader function
4. Add streaming/chunking for huge projects
5. Consider binary formats for extreme cases (MessagePack, CBOR)