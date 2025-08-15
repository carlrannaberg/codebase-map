# Code Index Format Examples

All examples show the same 3 files with their dependencies and content.

## Original JSON Format (Verbose)
**Size: ~1,800 characters | ~500 tokens**

```json
{
  "metadata": {
    "version": 1,
    "root": "/project",
    "createdAt": "2025-08-15T12:00:00Z",
    "updatedAt": "2025-08-15T12:00:00Z",
    "totalFiles": 3
  },
  "tree": {
    "name": "src",
    "type": "dir",
    "children": [
      {
        "name": "index.ts",
        "type": "file"
      },
      {
        "name": "utils.ts",
        "type": "file"
      },
      {
        "name": "api.ts",
        "type": "file"
      }
    ]
  },
  "edges": [
    {
      "from": "src/index.ts",
      "to": "src/utils.ts"
    },
    {
      "from": "src/index.ts",
      "to": "src/api.ts"
    },
    {
      "from": "src/api.ts",
      "to": "src/utils.ts"
    }
  ],
  "files": {
    "src/index.ts": {
      "imports": [
        {
          "from": "./utils.js",
          "kind": "import",
          "imported": ["formatDate", "parseQuery"]
        },
        {
          "from": "./api.js",
          "kind": "import",
          "imported": ["fetchUser"]
        }
      ],
      "dependencies": ["src/utils.ts", "src/api.ts"],
      "functions": [
        {
          "name": "main",
          "params": [],
          "returnType": "Promise<void>",
          "isAsync": true,
          "isExported": false
        },
        {
          "name": "initialize",
          "params": [
            {
              "name": "config",
              "type": "Config"
            }
          ],
          "returnType": "void",
          "isAsync": false,
          "isExported": true
        }
      ],
      "classes": [],
      "constants": [
        {
          "name": "VERSION",
          "type": "string",
          "initKind": "literal"
        }
      ]
    },
    "src/utils.ts": {
      "imports": [],
      "dependencies": [],
      "functions": [
        {
          "name": "formatDate",
          "params": [
            {
              "name": "date",
              "type": "Date"
            }
          ],
          "returnType": "string",
          "isAsync": false,
          "isExported": true
        },
        {
          "name": "parseQuery",
          "params": [
            {
              "name": "query",
              "type": "string"
            }
          ],
          "returnType": "Record<string, string>",
          "isAsync": false,
          "isExported": true
        }
      ],
      "classes": [],
      "constants": []
    },
    "src/api.ts": {
      "imports": [
        {
          "from": "./utils.js",
          "kind": "import",
          "imported": ["formatDate"]
        }
      ],
      "dependencies": ["src/utils.ts"],
      "functions": [
        {
          "name": "fetchUser",
          "params": [
            {
              "name": "id",
              "type": "string"
            }
          ],
          "returnType": "Promise<User>",
          "isAsync": true,
          "isExported": true
        }
      ],
      "classes": [
        {
          "name": "ApiClient",
          "methods": [
            {
              "name": "get",
              "isAsync": true
            },
            {
              "name": "post",
              "isAsync": true
            }
          ],
          "properties": [
            {
              "name": "baseUrl",
              "type": "string",
              "isPrivate": true
            }
          ]
        }
      ],
      "constants": []
    }
  }
}
```

---

## DSL Format (Recommended Default)
**Size: ~300 characters | ~85 tokens | 94% reduction**

```
src/index.ts > utils,api
  fn main():Promise<void> async
  fn initialize(config:Config):void
  cn VERSION:string
src/utils.ts > 
  fn formatDate(date:Date):string
  fn parseQuery(query:string):Record<string, string>
src/api.ts > utils
  fn fetchUser(id:string):Promise<User> async
  cl ApiClient(2m,1p)
```

**How to read:**
- `>` means "depends on"
- `fn` = function, `cl` = class, `cn` = constant
- `(2m,1p)` = 2 methods, 1 property
- `async` indicator when present

---

## Graph Format (Maximum Compression)
**Size: ~150 characters | ~43 tokens | 97% reduction**

```
EDGES:
0→1,2
2→1

SIGS:
0:index|main():P,initialize(c):v|VERSION
1:utils|formatDate(d):s,parseQuery(q):R
2:api|fetchUser(i):P|ApiClient{2m,1p}
```

**How to read:**
- Files are numbered (0=index, 1=utils, 2=api)
- `→` shows dependencies
- `|` separates file name, functions, classes, constants
- Ultra-abbreviated types: P=Promise, v=void, s=string, R=Record

---

## Markdown Format (Human-Friendly)
**Size: ~400 characters | ~115 tokens | 92% reduction**

```markdown
# Project Structure

## src/

### index.ts → utils, api
**Functions:** async main(), initialize()  
**Constants:** VERSION

### utils.ts
**Functions:** formatDate(), parseQuery()

### api.ts → utils
**Functions:** async fetchUser()  
**Classes:** ApiClient(2m/1p)

## Dependencies
- **Total files:** 3
- **Dependencies:** 3
- **Avg per file:** 1.0
```

---

## TypeScript Style Format
**Size: ~350 characters | ~100 tokens | 93% reduction**

```typescript
// src/index.ts → utils, api
async main(): Promise<void>
export initialize(config: Config): void
const VERSION: string

// src/utils.ts
export formatDate(date: Date): string
export parseQuery(query: string): Record<string, string>

// src/api.ts → utils
export async fetchUser(id: string): Promise<User>
class ApiClient { get(); post(); baseUrl: string }
```

---

## Minified JSON Format
**Size: ~250 characters | ~71 tokens | 95% reduction**

```json
{"m":{"v":1,"f":3},"e":[["src/index.ts","src/utils.ts"],["src/index.ts","src/api.ts"],["src/api.ts","src/utils.ts"]],"f":{"src/index.ts":{"d":["src/utils.ts","src/api.ts"],"fn":[{"n":"main","r":"Promise<void>","a":1},{"n":"initialize"}],"c":["VERSION"]},"src/utils.ts":{"fn":[{"n":"formatDate"},{"n":"parseQuery"}]},"src/api.ts":{"d":["src/utils.ts"],"fn":[{"n":"fetchUser","a":1}],"cl":[{"n":"ApiClient","m":2,"p":1}]}}}
```

---

## Comparison Table

| Format | Characters | Tokens | Reduction | Readability | Best Use Case |
|--------|------------|--------|-----------|-------------|---------------|
| **Original JSON** | 1,800 | 500 | 0% | 📊 Verbose but complete | Tools/debugging |
| **DSL** | 300 | 85 | 94% | ✅ Good balance | **Default choice** |
| **Graph** | 150 | 43 | 97% | 🤖 Machine-optimal | Massive codebases |
| **Markdown** | 400 | 115 | 92% | 👤 Human-friendly | Documentation |
| **TypeScript** | 350 | 100 | 93% | 💻 Developer-familiar | Code reviews |
| **Mini JSON** | 250 | 71 | 95% | 🔧 Tool-compatible | API integration |

## Recommendations

### For Claude Code Context:
1. **Use DSL format as default** - Best compression while maintaining readability
2. **Switch to Graph only if** - Project has 1000+ files and tokens are critical
3. **Use Markdown if** - You want to review the index yourself

### Token Scaling:
- **100 files**: DSL = 2,100 tokens, Graph = 900 tokens
- **500 files**: DSL = 10,500 tokens, Graph = 4,500 tokens  
- **1000 files**: DSL = 21,000 tokens, Graph = 9,000 tokens

The DSL format hits the sweet spot - 94% smaller than JSON but still readable by both humans and Claude.