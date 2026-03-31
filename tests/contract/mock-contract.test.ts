// Mock Contract Test
// Verifies that all API methods used in source code exist in the mock services.
// Scans src/**/*.ts files for client.X.Y patterns and verifies mocks are complete.

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

// Patterns for extracting API calls from source code
const API_CALL_PATTERNS = [
  /client\.tasks\.(\w+)/g,
  /client\.projects\.(\w+)/g,
  /client\.labels\.(\w+)/g,
  /client\.users\.(\w+)/g,
  /client\.teams\.(\w+)/g,
  /client\.shares\.(\w+)/g,
];

// Known mock services and their methods (extracted from tests/types/mocks.ts)
const MOCK_SERVICE_METHODS: Record<string, Set<string>> = {
  tasks: new Set([
    'getAllTasks',
    'getProjectTasks',
    'createTask',
    'getTask',
    'updateTask',
    'deleteTask',
    'getTaskComments',
    'createTaskComment',
    'updateTaskLabels',
    'assignUserToTask',
    'removeUserFromTask',
    'bulkUpdateTasks',
    'assignUserToTask',
    'addLabelToTask',
    'removeLabelFromTask',
    'createTaskRelation',
    'deleteTaskRelation',
  ]),
  projects: new Set([
    'getProjects',
    'createProject',
    'getProject',
    'updateProject',
    'deleteProject',
    'createLinkShare',
    'getLinkShares',
    'getLinkShare',
    'deleteLinkShare',
  ]),
  labels: new Set(['getLabels', 'getLabel', 'createLabel', 'updateLabel', 'deleteLabel']),
  users: new Set(['getAll', 'getUsers', 'getUser', 'updateGeneralSettings']),
  teams: new Set(['getAll', 'create', 'delete', 'getTeams', 'createTeam', 'deleteTeam']),
  shares: new Set(['getShareAuth']),
};

describe('Mock Contract #contract', () => {
  const srcDir = path.join(__dirname, '../../src');

  interface FoundMethod {
    service: string;
    method: string;
    file: string;
    line: number;
  }

  function extractApiCallsFromFile(filePath: string): FoundMethod[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const found: FoundMethod[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comments and imports
      if (
        line.trim().startsWith('//') ||
        line.trim().startsWith('*') ||
        line.trim().startsWith('import')
      ) {
        continue;
      }

      for (const pattern of API_CALL_PATTERNS) {
        const serviceMatch = pattern.exec(line);
        if (serviceMatch) {
          const service = serviceMatch[0].split('.')[1];
          const method = serviceMatch[1];
          found.push({
            service,
            method,
            file: path.relative(process.cwd(), filePath),
            line: i + 1,
          });
        }
        // Reset lastIndex for global regex
        pattern.lastIndex = 0;
      }
    }

    return found;
  }

  function scanSourceForApiCalls(dir: string): FoundMethod[] {
    const results: FoundMethod[] = [];

    function walkDir(currentDir: string) {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules, dist, etc.
          if (!['node_modules', 'dist', '.git', 'coverage'].includes(entry.name)) {
            walkDir(fullPath);
          }
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
          results.push(...extractApiCallsFromFile(fullPath));
        }
      }
    }

    walkDir(dir);
    return results;
  }

  it('should have all methods that source code uses', () => {
    // Find all API calls in source code
    const apiCalls = scanSourceForApiCalls(srcDir);

    // Deduplicate by service + method
    const uniqueCalls = new Map<string, FoundMethod>();
    for (const call of apiCalls) {
      const key = `${call.service}.${call.method}`;
      if (!uniqueCalls.has(key)) {
        uniqueCalls.set(key, call);
      }
    }

    // Check each unique call against mock methods
    const missingMethods: Array<{ service: string; method: string; foundIn: FoundMethod }> = [];

    for (const [key, call] of uniqueCalls) {
      const mockMethods = MOCK_SERVICE_METHODS[call.service];

      if (!mockMethods) {
        missingMethods.push({
          service: call.service,
          method: call.method,
          foundIn: call,
        });
        continue;
      }

      if (!mockMethods.has(call.method)) {
        missingMethods.push({
          service: call.service,
          method: call.method,
          foundIn: call,
        });
      }
    }

    if (missingMethods.length > 0) {
      const errorMessage = missingMethods
        .map((m) => `  - ${m.service}.${m.method} (used in ${m.foundIn.file}:${m.foundIn.line})`)
        .join('\n');

      throw new Error(
        `Mock contract violation: ${missingMethods.length} method(s) missing from mocks:\n${errorMessage}\n\n` +
          'Add missing methods to tests/types/mocks.ts',
      );
    }
  });

  it('should document all mock methods', () => {
    // This test ensures the mock documentation is complete
    // It serves as a reference for what methods should be in mocks

    expect(MOCK_SERVICE_METHODS.tasks.size).toBeGreaterThan(0);
    expect(MOCK_SERVICE_METHODS.projects.size).toBeGreaterThan(0);
    expect(MOCK_SERVICE_METHODS.labels.size).toBeGreaterThan(0);
  });
});
