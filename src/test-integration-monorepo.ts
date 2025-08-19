/**
 * Monorepo Integration Tests
 * 
 * Tests complex monorepo scenarios with nested patterns,
 * workspace configurations, and cross-package dependencies.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestProjectBuilder, runCLI, loadIndex } from './test-integration.js';

describe('Monorepo Integration Tests', () => {
  let testProject: TestProjectBuilder;
  let projectPath: string;

  beforeEach(() => {
    testProject = new TestProjectBuilder();
  });

  afterEach(() => {
    if (testProject) {
      testProject.cleanup();
    }
  });

  describe('Multi-Package Structures', () => {
    it('should handle monorepo with complex nested patterns', () => {
      projectPath = testProject
        .addFile('package.json', JSON.stringify({
          name: 'monorepo-root',
          workspaces: ['packages/*', 'apps/*']
        }, null, 2))
        .addFile('packages/core/package.json', JSON.stringify({
          name: '@monorepo/core',
          main: 'dist/index.js',
          types: 'dist/index.d.ts'
        }, null, 2))
        .addFile('packages/core/src/index.ts', `
export class CoreService {
  getMessage(): string {
    return 'Hello from core';
  }
}
        `)
        .addFile('packages/core/src/utils/helpers.ts', `
export function formatMessage(msg: string): string {
  return \`[CORE] \${msg}\`;
}
        `)
        .addFile('packages/ui/package.json', JSON.stringify({
          name: '@monorepo/ui',
          dependencies: { '@monorepo/core': 'workspace:*' }
        }, null, 2))
        .addFile('packages/ui/src/components/Button.tsx', `
import { CoreService } from '@monorepo/core';

export function Button() {
  const core = new CoreService();
  return <button>{core.getMessage()}</button>;
}
        `)
        .addFile('packages/ui/src/components/Input.tsx', `
export function Input() {
  return <input placeholder="Enter text" />;
}
        `)
        .addFile('apps/web/package.json', JSON.stringify({
          name: 'web-app',
          dependencies: {
            '@monorepo/core': 'workspace:*',
            '@monorepo/ui': 'workspace:*'
          }
        }, null, 2))
        .addFile('apps/web/src/App.tsx', `
import { Button } from '@monorepo/ui';
import { CoreService } from '@monorepo/core';

export function App() {
  return <div><Button /></div>;
}
        `)
        .addFile('apps/mobile/src/App.tsx', `
export function MobileApp() {
  return <div>Mobile App</div>;
}
        `)
        .build();

      // Test package-specific filtering
      const result = runCLI([
        'scan',
        '--include', 'packages/*/src/**/*.{ts,tsx}',
        '--exclude', '**/*.test.*',
        '--verbose'
      ], projectPath);

      expect(result.exitCode).toBe(0);
      
      const index = loadIndex(result.indexPath);
      
      // Should include packages but not apps
      expect(index.nodes).toContain('packages/core/src/index.ts');
      expect(index.nodes).toContain('packages/core/src/utils/helpers.ts');
      expect(index.nodes).toContain('packages/ui/src/components/Button.tsx');
      expect(index.nodes).toContain('packages/ui/src/components/Input.tsx');
      
      // Should exclude apps
      expect(index.nodes).not.toContain('apps/web/src/App.tsx');
      expect(index.nodes).not.toContain('apps/mobile/src/App.tsx');
    });

    it('should handle selective workspace inclusion', () => {
      projectPath = testProject
        .addFile('package.json', JSON.stringify({
          name: 'monorepo-root',
          workspaces: ['packages/*']
        }, null, 2))
        .addFile('packages/core/src/index.ts', 'export const core = true;')
        .addFile('packages/ui/src/index.ts', 'export const ui = true;')
        .addFile('packages/utils/src/index.ts', 'export const utils = true;')
        .addFile('packages/legacy/src/index.ts', 'export const legacy = true;')
        .build();

      // Include only specific packages
      const result = runCLI([
        'scan',
        '--include', 'packages/{core,ui}/src/**/*.ts'
      ], projectPath);

      expect(result.exitCode).toBe(0);
      
      const index = loadIndex(result.indexPath);
      
      // Should include core and ui
      expect(index.nodes).toContain('packages/core/src/index.ts');
      expect(index.nodes).toContain('packages/ui/src/index.ts');
      
      // Should exclude utils and legacy
      expect(index.nodes).not.toContain('packages/utils/src/index.ts');
      expect(index.nodes).not.toContain('packages/legacy/src/index.ts');
    });

    it('should handle cross-package dependency tracking', () => {
      projectPath = testProject
        .addFile('packages/core/src/index.ts', `
export class BaseService {
  protected name = 'base';
}
        `)
        .addFile('packages/auth/src/auth-service.ts', `
import { BaseService } from '@monorepo/core';

export class AuthService extends BaseService {
  login() {
    return \`\${this.name} auth\`;
  }
}
        `)
        .addFile('packages/api/src/api-service.ts', `
import { AuthService } from '@monorepo/auth';

export class ApiService {
  private auth = new AuthService();
  
  makeRequest() {
    return this.auth.login();
  }
}
        `)
        .build();

      const result = runCLI([
        'scan',
        '--include', 'packages/*/src/**/*.ts'
      ], projectPath);

      expect(result.exitCode).toBe(0);
      
      const index = loadIndex(result.indexPath);
      
      // Verify cross-package dependencies are tracked
      expect(index.files['packages/auth/src/auth-service.ts']?.dependencies).toEqual([]);
      expect(index.files['packages/api/src/api-service.ts']?.dependencies).toEqual([]);
      
      // Should have all files
      expect(index.nodes).toHaveLength(3);
    });
  });

  describe('Complex Pattern Combinations', () => {
    it('should handle nested include/exclude for monorepo', () => {
      projectPath = testProject
        .addFile('packages/core/src/index.ts', 'export const core = true;')
        .addFile('packages/core/src/utils.ts', 'export const utils = true;')
        .addFile('packages/core/src/__tests__/core.test.ts', 'test core')
        .addFile('packages/core/src/stories/core.stories.ts', 'stories')
        .addFile('packages/ui/src/Button.tsx', 'export function Button() {}')
        .addFile('packages/ui/src/Input.tsx', 'export function Input() {}')
        .addFile('packages/ui/src/__tests__/Button.test.tsx', 'test button')
        .addFile('packages/ui/dist/bundle.js', 'compiled output')
        .addFile('packages/ui/node_modules/react/index.js', 'dependency')
        .build();

      const result = runCLI([
        'scan',
        '--include', 'packages/*/src/**/*.{ts,tsx}',
        '--exclude', 
          '**/__tests__/**',
          '**/stories/**',
          '**/dist/**',
          '**/node_modules/**',
        '--verbose'
      ], projectPath);

      expect(result.exitCode).toBe(0);
      
      const index = loadIndex(result.indexPath);
      
      // Should include source files
      expect(index.nodes).toContain('packages/core/src/index.ts');
      expect(index.nodes).toContain('packages/core/src/utils.ts');
      expect(index.nodes).toContain('packages/ui/src/Button.tsx');
      expect(index.nodes).toContain('packages/ui/src/Input.tsx');
      
      // Should exclude test files and build artifacts
      expect(index.nodes).not.toContain('packages/core/src/__tests__/core.test.ts');
      expect(index.nodes).not.toContain('packages/core/src/stories/core.stories.ts');
      expect(index.nodes).not.toContain('packages/ui/src/__tests__/Button.test.tsx');
      expect(index.nodes).not.toContain('packages/ui/dist/bundle.js');
      expect(index.nodes).not.toContain('packages/ui/node_modules/react/index.js');
    });

    it('should optimize patterns for monorepo development workflow', () => {
      projectPath = testProject
        .addFile('packages/core/src/index.ts', 'export const core = true;')
        .addFile('packages/core/src/types.ts', 'export interface CoreTypes {}')
        .addFile('packages/core/lib/compiled.js', 'compiled core')
        .addFile('packages/ui/src/components/Button.tsx', 'export function Button() {}')
        .addFile('packages/ui/src/hooks/useButton.ts', 'export function useButton() {}')
        .addFile('packages/ui/lib/compiled.js', 'compiled ui')
        .addFile('packages/utils/src/helpers.ts', 'export const helpers = {};')
        .addFile('tools/build.js', 'build script')
        .addFile('docs/README.md', 'documentation')
        .build();

      // Development mode: include source files only
      const result = runCLI([
        'scan',
        '--include', 'packages/*/src/**/*.{ts,tsx}',
        '--exclude', '**/lib/**', '**/tools/**'
      ], projectPath);

      expect(result.exitCode).toBe(0);
      
      const index = loadIndex(result.indexPath);
      
      // Should include all source files
      expect(index.nodes).toContain('packages/core/src/index.ts');
      expect(index.nodes).toContain('packages/core/src/types.ts');
      expect(index.nodes).toContain('packages/ui/src/components/Button.tsx');
      expect(index.nodes).toContain('packages/ui/src/hooks/useButton.ts');
      expect(index.nodes).toContain('packages/utils/src/helpers.ts');
      
      // Should exclude compiled and tool files
      expect(index.nodes).not.toContain('packages/core/lib/compiled.js');
      expect(index.nodes).not.toContain('packages/ui/lib/compiled.js');
      expect(index.nodes).not.toContain('tools/build.js');
      expect(index.nodes).not.toContain('docs/README.md');
    });
  });

  describe('Workspace-Specific Configuration', () => {
    it('should handle workspace-specific pattern optimization', () => {
      projectPath = testProject
        .addFile('package.json', JSON.stringify({
          name: 'monorepo',
          workspaces: {
            packages: ['packages/*'],
            nohoist: ['**/react', '**/react-dom']
          }
        }, null, 2))
        .addFile('packages/frontend/src/App.tsx', 'export function App() {}')
        .addFile('packages/frontend/src/components/Header.tsx', 'export function Header() {}')
        .addFile('packages/frontend/node_modules/react/index.js', 'nohoist react')
        .addFile('packages/backend/src/server.ts', 'export const server = {};')
        .addFile('packages/backend/src/routes/api.ts', 'export const routes = {};')
        .addFile('packages/shared/src/types.ts', 'export interface Shared {}')
        .addFile('packages/shared/src/utils.ts', 'export const utils = {};')
        .build();

      // Frontend-focused scan
      const frontendResult = runCLI([
        'scan',
        '--include', 'packages/frontend/src/**/*.{ts,tsx}', 'packages/shared/src/**/*.ts',
        '--exclude', '**/node_modules/**'
      ], projectPath);

      expect(frontendResult.exitCode).toBe(0);
      
      const frontendIndex = loadIndex(frontendResult.indexPath);
      
      // Should include frontend and shared
      expect(frontendIndex.nodes).toContain('packages/frontend/src/App.tsx');
      expect(frontendIndex.nodes).toContain('packages/frontend/src/components/Header.tsx');
      expect(frontendIndex.nodes).toContain('packages/shared/src/types.ts');
      expect(frontendIndex.nodes).toContain('packages/shared/src/utils.ts');
      
      // Should exclude backend and node_modules
      expect(frontendIndex.nodes).not.toContain('packages/backend/src/server.ts');
      expect(frontendIndex.nodes).not.toContain('packages/frontend/node_modules/react/index.js');
    });

    it('should handle performance optimization for large monorepo', () => {
      // Create a larger monorepo structure
      const builder = testProject
        .addFile('package.json', JSON.stringify({ workspaces: ['packages/*'] }, null, 2));

      // Add multiple packages with files
      for (let i = 0; i < 5; i++) {
        builder
          .addFile(`packages/package${i}/src/index.ts`, `export const package${i} = true;`)
          .addFile(`packages/package${i}/src/utils.ts`, `export const utils${i} = {};`)
          .addFile(`packages/package${i}/src/service.ts`, `export class Service${i} {}`)
          .addFile(`packages/package${i}/src/types.ts`, `export interface Types${i} {}`)
          .addFile(`packages/package${i}/test/index.test.ts`, `test package ${i}`)
          .addFile(`packages/package${i}/dist/index.js`, `compiled package ${i}`)
          .addFile(`packages/package${i}/node_modules/dep/index.js`, `dependency ${i}`);
      }

      projectPath = builder.build();

      const result = runCLI([
        'scan',
        '--include', 'packages/*/src/**/*.ts',
        '--exclude', '**/test/**', '**/dist/**', '**/node_modules/**',
        '--verbose'
      ], projectPath);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Pattern effectiveness');
      
      const index = loadIndex(result.indexPath);
      
      // Should have 4 files per package * 5 packages = 20 files
      expect(index.nodes).toHaveLength(20);
      
      // Verify performance stats are reasonable
      expect(result.stdout).toContain('Files processed: 20');
      expect(result.stdout).toMatch(/Processing time: \d+\.\d+s/);
    });
  });
});

export { };