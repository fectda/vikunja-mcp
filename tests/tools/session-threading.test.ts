/**
 * Tests for sessionId threading through tool handlers
 *
 * Verifies that all tool handlers properly extract extra?.sessionId
 * and pass it to authManager and getClientFromContext calls.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AuthManager } from '../../src/auth/AuthManager';

// Client module mocks
const mockGetClientFromContext = jest.fn();
jest.mock('../../src/client', () => ({
  getClientFromContext: (...args: any[]) => mockGetClientFromContext(...args),
  cleanupClientFromContext: jest.fn(),
  setGlobalClientFactory: jest.fn(),
  clearGlobalClientFactory: jest.fn(),
  createVikunjaClientFactory: jest.fn(),
  VikunjaClientFactory: jest.fn(),
}));

// Logger mock
jest.mock('../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Storage mock
const mockStorage = {
  list: jest.fn().mockResolvedValue([]),
  get: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue({ id: '1' }),
  update: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue(undefined),
  findByName: jest.fn().mockResolvedValue(null),
  getByProject: jest.fn().mockResolvedValue([]),
};
jest.mock('../../src/storage', () => ({
  storageManager: {
    getStorage: jest.fn(() => mockStorage),
  },
}));

// Security mock
jest.mock('../../src/utils/security', () => ({
  createSecureConnectionMessage: jest.fn((url: string) => `Connecting to ${url}`),
}));

// Rate limiter mock
jest.mock('../../src/middleware/simplified-rate-limit', () => ({
  withRateLimit: jest.fn((_toolName: string, handler: any) => handler),
}));

// Retry module mock
jest.mock('../../src/utils/retry', () => ({
  withRetry: jest.fn(<T>(fn: () => Promise<T>) => fn()),
  RETRY_CONFIG: {
    AUTH_ERRORS: { maxRetries: 3, baseDelay: 100 },
  },
}));

// Error handler mocks
const mockWrapToolError = jest.fn((error: any) => {
  throw error;
});
jest.mock('../../src/utils/error-handler', () => ({
  wrapToolError: (...args: any[]) => mockWrapToolError(...args),
  handleStatusCodeError: jest.fn(),
  createAuthRequiredError: jest.fn((msg: string) => new Error(msg)),
  handleFetchError: jest.fn((error: any) => error),
  wrapAuthError: jest.fn((error: any) => {
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }),
  createValidationError: jest.fn((msg: string) => new Error(msg)),
}));

// Response factory mock
const mockFormatAorp = jest.fn((response: any) => JSON.stringify(response));
const mockCreateStandardResponse = jest.fn((op: string, msg: string, data: any, meta?: any) => ({
  operation: op,
  message: msg,
  data,
  metadata: meta || {},
}));
jest.mock('../../src/utils/response-factory', () => ({
  formatAorpAsMarkdown: (...args: any[]) => mockFormatAorp(...args),
  createStandardResponse: (...args: any[]) => mockCreateStandardResponse(...args),
  createAorpResponse: jest.fn((_op: string, msg: string, _data: any, opts?: any) => ({
    content: msg,
    success: opts?.success ?? true,
  })),
  createAorpErrorResponse: jest.fn((op: string, msg: string) => ({
    content: `Error: ${msg}`,
    metadata: { operation: op, success: false },
  })),
  createTaskAorpResponse: jest.fn(() => ({
    response: {
      content: [{ type: 'text' as const, text: JSON.stringify({ tasks: [], metadata: {} }) }],
    },
  })),
}));

// Simple response mock
jest.mock('../../src/utils/simple-response', () => ({
  formatMcpResponse: jest.fn((response: any) => JSON.stringify(response)),
}));

jest.mock('../../src/utils/validation', () => ({
  validateAndConvertId: jest.fn((id: any) => Number(id)),
  validateId: jest.fn(() => true),
  sanitizeString: jest.fn((s: string) => s),
  MAX_STRING_LENGTH: 10000,
}));

jest.mock('../../src/utils/auth-error-handler', () => ({
  handleAuthError: jest.fn(),
  isAuthenticationError: jest.fn(() => false),
}));

// Mock global.fetch to prevent real API calls in tests
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: jest.fn().mockResolvedValue({ id: 1, name: 'Test Team' }),
  text: jest.fn().mockResolvedValue('{"id":1,"name":"Test Team"}'),
});

// Import modules after mocks
import { registerAuthTool } from '../../src/tools/auth';
import { registerLabelsTool } from '../../src/tools/labels';
import { registerTeamsTool } from '../../src/tools/teams';
import { registerUsersTool } from '../../src/tools/users';
import { registerFiltersTool } from '../../src/tools/filters';
import { registerTemplatesTool } from '../../src/tools/templates';
import { registerWebhooksTool } from '../../src/tools/webhooks';
import { registerExportTool } from '../../src/tools/export';
import { registerBatchImportTool } from '../../src/tools/batch-import';
import { getClientFromContext } from '../../src/client';
import { handleRelationSubcommands } from '../../src/tools/tasks-relations';
import { registerTasksTool } from '../../src/tools/tasks/index';
import { applyPermissions } from '../../src/middleware/direct-middleware';

// Import sub-module functions for direct testing
import { registerProjectsTool } from '../../src/tools/projects/index';
import { createTask } from '../../src/tools/tasks/crud/TaskCreationService';
import { getTask } from '../../src/tools/tasks/crud/TaskReadService';
import { updateTask } from '../../src/tools/tasks/crud/TaskUpdateService';
import { deleteTask } from '../../src/tools/tasks/crud/TaskDeletionService';
import { assignUsers, unassignUsers, listAssignees } from '../../src/tools/tasks/assignees/index';
import { handleComment, listComments } from '../../src/tools/tasks/comments/index';
import {
  createProject,
  getProject,
  updateProject,
  deleteProject,
} from '../../src/tools/projects/index';

// Import the real PermissionManager mock
jest.mock('../../src/auth/permissions', () => ({
  PermissionManager: {
    checkToolPermission: jest.fn().mockReturnValue({
      hasPermission: true,
      missingPermissions: [],
      errorMessage: null,
      suggestedAuthType: null,
    }),
  },
}));

interface MockAuthManager {
  isAuthenticated: jest.Mock;
  getAuthType: jest.Mock;
  getSession: jest.Mock;
  connect: jest.Mock;
  disconnect: jest.Mock;
  getStatus: jest.Mock;
  saveSession: jest.Mock;
  setTestUserId: jest.Mock;
  setTestTokenExpiry: jest.Mock;
}

const TEST_SESSION_ID = 'test-session-abc123';

function createMockAuthManager(overrides: Partial<MockAuthManager> = {}): MockAuthManager {
  return {
    isAuthenticated: jest.fn().mockReturnValue(true),
    getAuthType: jest.fn().mockReturnValue('api-token'),
    getSession: jest.fn().mockReturnValue({
      apiUrl: 'https://try.vikunja.io/api/v1',
      apiToken: 'test-token',
    }),
    connect: jest.fn(),
    disconnect: jest.fn(),
    getStatus: jest.fn().mockReturnValue({ authenticated: true }),
    saveSession: jest.fn(),
    setTestUserId: jest.fn(),
    setTestTokenExpiry: jest.fn(),
    ...overrides,
  };
}

function createMockClient(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    labels: {
      getLabels: jest.fn().mockResolvedValue([]),
      getLabel: jest.fn(),
      createLabel: jest.fn(),
      updateLabel: jest.fn(),
      deleteLabel: jest.fn(),
    },
    teams: {
      getTeams: jest.fn().mockResolvedValue([]),
      createTeam: jest.fn(),
      deleteTeam: jest.fn(),
      getTeam: jest.fn(),
    },
    users: {
      getUser: jest.fn().mockResolvedValue({ id: 1, username: 'test' }),
      getUsers: jest.fn().mockResolvedValue([]),
      updateGeneralSettings: jest.fn(),
    },
    projects: {
      getProject: jest.fn().mockResolvedValue({ id: 1, title: 'Test Project' }),
      getProjects: jest.fn().mockResolvedValue([]),
      createProject: jest.fn().mockResolvedValue({ id: 1, title: 'New Project' }),
      updateProject: jest.fn().mockResolvedValue({ id: 1, title: 'Updated Project' }),
      deleteProject: jest.fn().mockResolvedValue(undefined),
    },
    tasks: {
      getProjectTasks: jest.fn().mockResolvedValue([]),
      getAllTasks: jest.fn().mockResolvedValue([]),
      createTask: jest.fn().mockResolvedValue({ id: 1, title: 'Test Task' }),
      getTask: jest.fn().mockResolvedValue({ id: 1, title: 'Test Task', related_tasks: [] }),
      updateTask: jest.fn().mockResolvedValue({ id: 1, title: 'Updated Task' }),
      deleteTask: jest.fn().mockResolvedValue(undefined),
      createTaskRelation: jest.fn(),
      deleteTaskRelation: jest.fn(),
      updateTaskLabels: jest.fn(),
      assignUserToTask: jest.fn().mockResolvedValue(undefined),
      removeUserFromTask: jest.fn().mockResolvedValue(undefined),
      createTaskComment: jest.fn().mockResolvedValue({ id: 1, comment: 'test comment' }),
      getTaskComments: jest.fn().mockResolvedValue([]),
    },
    auth: { renewToken: jest.fn().mockResolvedValue({ token: 'new-token' }) },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetClientFromContext.mockResolvedValue(createMockClient());
});

// ============================================================================
// 2.1 auth.ts — thread extra?.sessionId to authManager calls
// ============================================================================
describe('2.1 - auth.ts session threading', () => {
  let mockServer: { tool: jest.Mock };
  let mockAuthManager: MockAuthManager;
  let toolHandler: (args: any, extra?: any) => Promise<any>;

  beforeEach(() => {
    mockServer = { tool: jest.fn() };
    mockAuthManager = createMockAuthManager();
    registerAuthTool(mockServer, mockAuthManager);
    toolHandler = mockServer.tool.mock.calls[0][3];
  });

  it('should pass sessionId to authManager.getStatus() when extra.sessionId is provided', async () => {
    mockAuthManager.getStatus.mockReturnValue({
      authenticated: true,
      apiUrl: 'https://try.vikunja.io/api/v1',
    });
    await toolHandler({ subcommand: 'status' }, { sessionId: TEST_SESSION_ID });
    expect(mockAuthManager.getStatus).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should pass sessionId to authManager.getAuthType()', async () => {
    await toolHandler(
      { subcommand: 'connect', apiUrl: 'https://try.vikunja.io', apiToken: 'test-token' },
      { sessionId: TEST_SESSION_ID },
    );
    expect(mockAuthManager.getAuthType).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should pass sessionId to authManager.disconnect()', async () => {
    await toolHandler({ subcommand: 'disconnect' }, { sessionId: TEST_SESSION_ID });
    expect(mockAuthManager.disconnect).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should pass sessionId to getClientFromContext for refresh', async () => {
    mockAuthManager.getStatus.mockReturnValue({
      authenticated: true,
      apiUrl: 'https://try.vikunja.io/api/v1',
      authType: 'jwt',
    });
    await toolHandler({ subcommand: 'refresh' }, { sessionId: TEST_SESSION_ID });
    expect(mockGetClientFromContext).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should use default when no extra provided', async () => {
    mockAuthManager.getStatus.mockReturnValue({
      authenticated: true,
      apiUrl: 'https://try.vikunja.io/api/v1',
    });
    await toolHandler({ subcommand: 'status' });
    expect(mockAuthManager.getStatus).toHaveBeenCalledWith(undefined);
  });
});

// ============================================================================
// 2.2 labels.ts, teams.ts, users.ts, filters.ts, templates.ts
// ============================================================================
describe('2.2 - labels.ts session threading', () => {
  let mockServer: { tool: jest.Mock };
  let mockAuthManager: MockAuthManager;
  let toolHandler: (args: any, extra?: any) => Promise<any>;

  beforeEach(() => {
    mockServer = { tool: jest.fn() };
    mockAuthManager = createMockAuthManager();
    registerLabelsTool(mockServer, mockAuthManager);
    toolHandler = mockServer.tool.mock.calls[0][3];
  });

  it('should pass sessionId to authManager.isAuthenticated()', async () => {
    await toolHandler({ subcommand: 'list' }, { sessionId: TEST_SESSION_ID });
    expect(mockAuthManager.isAuthenticated).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should pass sessionId to getClientFromContext', async () => {
    await toolHandler({ subcommand: 'list' }, { sessionId: TEST_SESSION_ID });
    expect(mockGetClientFromContext).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should use default when no extra', async () => {
    await toolHandler({ subcommand: 'list' });
    expect(mockAuthManager.isAuthenticated).toHaveBeenCalledWith(undefined);
    expect(mockGetClientFromContext).toHaveBeenCalledWith(undefined);
  });
});

describe('2.2 - teams.ts session threading', () => {
  let mockServer: { tool: jest.Mock };
  let mockAuthManager: MockAuthManager;
  let toolHandler: (args: any, extra?: any) => Promise<any>;

  beforeEach(() => {
    mockServer = { tool: jest.fn() };
    mockAuthManager = createMockAuthManager();
    registerTeamsTool(mockServer, mockAuthManager);
    toolHandler = mockServer.tool.mock.calls[0][3];
  });

  it('should pass sessionId to authManager.isAuthenticated()', async () => {
    await toolHandler({ subcommand: 'list' }, { sessionId: TEST_SESSION_ID });
    expect(mockAuthManager.isAuthenticated).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should pass sessionId to getClientFromContext', async () => {
    await toolHandler({ subcommand: 'list' }, { sessionId: TEST_SESSION_ID });
    expect(mockGetClientFromContext).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should pass sessionId to authManager.getSession()', async () => {
    await toolHandler({ subcommand: 'get', id: 1 }, { sessionId: TEST_SESSION_ID });
    expect(mockAuthManager.getSession).toHaveBeenCalledWith(TEST_SESSION_ID);
  });
});

describe('2.2 - users.ts session threading', () => {
  let mockServer: { tool: jest.Mock };
  let mockAuthManager: MockAuthManager;
  let toolHandler: (args: any, extra?: any) => Promise<any>;

  beforeEach(() => {
    mockServer = { tool: jest.fn() };
    mockAuthManager = createMockAuthManager({ getAuthType: jest.fn().mockReturnValue('jwt') });
    registerUsersTool(mockServer, mockAuthManager);
    toolHandler = mockServer.tool.mock.calls[0][3];
  });

  it('should pass sessionId to authManager.isAuthenticated()', async () => {
    await toolHandler({ subcommand: 'current' }, { sessionId: TEST_SESSION_ID });
    expect(mockAuthManager.isAuthenticated).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should pass sessionId to authManager.getAuthType()', async () => {
    await toolHandler({ subcommand: 'current' }, { sessionId: TEST_SESSION_ID });
    expect(mockAuthManager.getAuthType).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should pass sessionId to getClientFromContext', async () => {
    await toolHandler({ subcommand: 'current' }, { sessionId: TEST_SESSION_ID });
    expect(mockGetClientFromContext).toHaveBeenCalledWith(TEST_SESSION_ID);
  });
});

describe('2.2 - filters.ts session threading', () => {
  let mockServer: { tool: jest.Mock };
  let mockAuthManager: MockAuthManager;
  let toolHandler: (args: any, extra?: any) => Promise<any>;

  beforeEach(() => {
    mockServer = { tool: jest.fn() };
    mockAuthManager = createMockAuthManager();
    registerFiltersTool(mockServer, mockAuthManager);
    toolHandler = mockServer.tool.mock.calls[0][3];
  });

  it('should pass sessionId to authManager.getSession()', async () => {
    await toolHandler({ action: 'list' }, { sessionId: TEST_SESSION_ID });
    expect(mockAuthManager.getSession).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should use default when no extra', async () => {
    await toolHandler({ action: 'list' });
    expect(mockAuthManager.getSession).toHaveBeenCalledWith(undefined);
  });
});

describe('2.2 - templates.ts session threading', () => {
  let mockServer: { tool: jest.Mock };
  let mockAuthManager: MockAuthManager;
  let toolHandler: (args: any, extra?: any) => Promise<any>;

  beforeEach(() => {
    mockServer = { tool: jest.fn() };
    mockAuthManager = createMockAuthManager();
    registerTemplatesTool(mockServer, mockAuthManager);
    toolHandler = mockServer.tool.mock.calls[0][3];
  });

  it('should pass sessionId to authManager.isAuthenticated()', async () => {
    await toolHandler({ subcommand: 'list' }, { sessionId: TEST_SESSION_ID });
    expect(mockAuthManager.isAuthenticated).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should pass sessionId to authManager.getSession()', async () => {
    await toolHandler({ subcommand: 'list' }, { sessionId: TEST_SESSION_ID });
    expect(mockAuthManager.getSession).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should pass sessionId to getClientFromContext', async () => {
    await toolHandler({ subcommand: 'list' }, { sessionId: TEST_SESSION_ID });
    expect(mockGetClientFromContext).toHaveBeenCalledWith(TEST_SESSION_ID);
  });
});

// ============================================================================
// 2.3 webhooks.ts
// ============================================================================
describe('2.3 - webhooks.ts session threading', () => {
  let mockServer: { tool: jest.Mock };
  let mockAuthManager: MockAuthManager;
  let toolHandler: (args: any, extra?: any) => Promise<any>;

  beforeEach(() => {
    mockServer = { tool: jest.fn() };
    mockAuthManager = createMockAuthManager();
    registerWebhooksTool(mockServer, mockAuthManager);
    toolHandler = mockServer.tool.mock.calls[0][3];
  });

  it('should pass sessionId to authManager.isAuthenticated()', async () => {
    await toolHandler({ subcommand: 'list', projectId: 1 }, { sessionId: TEST_SESSION_ID });
    expect(mockAuthManager.isAuthenticated).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should pass sessionId to authManager.getSession()', async () => {
    await toolHandler({ subcommand: 'list', projectId: 1 }, { sessionId: TEST_SESSION_ID });
    expect(mockAuthManager.getSession).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should pass sessionId to getClientFromContext', async () => {
    await toolHandler({ subcommand: 'list', projectId: 1 }, { sessionId: TEST_SESSION_ID });
    expect(mockGetClientFromContext).toHaveBeenCalledWith(TEST_SESSION_ID);
  });
});

// ============================================================================
// 2.4 export.ts
// ============================================================================
describe('2.4 - export.ts session threading', () => {
  let mockServer: { tool: jest.Mock };
  let mockAuthManager: MockAuthManager;

  beforeEach(() => {
    mockServer = { tool: jest.fn() };
    mockAuthManager = createMockAuthManager({ getAuthType: jest.fn().mockReturnValue('jwt') });
    registerExportTool(mockServer, mockAuthManager);
  });

  it('should register 3 tools', () => {
    expect(mockServer.tool).toHaveBeenCalledTimes(3);
  });

  it('should pass sessionId to isAuthenticated from export_project handler', async () => {
    const handler = mockServer.tool.mock.calls[0][3];
    mockAuthManager.isAuthenticated.mockClear();
    await handler({ projectId: 1 }, { sessionId: TEST_SESSION_ID });
    expect(mockAuthManager.isAuthenticated).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should pass sessionId to getClientFromContext from export_project', async () => {
    const handler = mockServer.tool.mock.calls[0][3];
    await handler({ projectId: 1 }, { sessionId: TEST_SESSION_ID });
    expect(mockGetClientFromContext).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should pass sessionId to getAuthType from all handlers', async () => {
    for (let i = 0; i < 3; i++) {
      const handler = mockServer.tool.mock.calls[i][3];
      const toolName = mockServer.tool.mock.calls[i][0] as string;
      mockAuthManager.getAuthType.mockClear();
      if (toolName === 'vikunja_export_project') {
        await handler({ projectId: 1 }, { sessionId: TEST_SESSION_ID });
      } else {
        await handler({ password: 'test-pass' }, { sessionId: TEST_SESSION_ID });
      }
      expect(mockAuthManager.getAuthType).toHaveBeenCalledWith(TEST_SESSION_ID);
    }
  });

  it('should use default when no extra', async () => {
    const handler = mockServer.tool.mock.calls[0][3];
    await handler({ projectId: 1 });
    expect(mockAuthManager.isAuthenticated).toHaveBeenCalledWith(undefined);
  });
});

// ============================================================================
// 2.5 batch-import.ts
// ============================================================================
describe('2.5 - batch-import.ts session threading', () => {
  let mockServer: { tool: jest.Mock };
  let mockAuthManager: MockAuthManager;
  let toolHandler: (args: any, extra?: any) => Promise<any>;

  beforeEach(() => {
    mockServer = { tool: jest.fn() };
    mockAuthManager = createMockAuthManager();
    registerBatchImportTool(mockServer, mockAuthManager);
    toolHandler = mockServer.tool.mock.calls[0][3];
  });

  it('should pass sessionId to authManager.isAuthenticated()', async () => {
    await toolHandler(
      { projectId: 1, format: 'json', data: '[{"title": "test"}]', dryRun: true },
      { sessionId: TEST_SESSION_ID },
    );
    expect(mockAuthManager.isAuthenticated).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should pass sessionId to getClientFromContext', async () => {
    await toolHandler(
      { projectId: 1, format: 'json', data: '[{"title": "test"}]', dryRun: true },
      { sessionId: TEST_SESSION_ID },
    );
    expect(mockGetClientFromContext).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should use default when no extra', async () => {
    await toolHandler({ projectId: 1, format: 'json', data: '[{"title": "test"}]', dryRun: true });
    expect(mockAuthManager.isAuthenticated).toHaveBeenCalledWith(undefined);
  });
});

// ============================================================================
// 2.6 tasks-relations.ts
// ============================================================================
describe('2.6 - tasks-relations.ts session threading', () => {
  beforeEach(() => {
    mockGetClientFromContext.mockResolvedValue(createMockClient());
  });

  it('should pass sessionId to getClientFromContext', async () => {
    await handleRelationSubcommands({ subcommand: 'relations', id: 1 }, TEST_SESSION_ID);
    expect(mockGetClientFromContext).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should use undefined when sessionId not provided', async () => {
    await handleRelationSubcommands({ subcommand: 'relations', id: 1 });
    expect(mockGetClientFromContext).toHaveBeenCalledWith(undefined);
  });
});

// ============================================================================
// 2.7 tasks/index.ts
// ============================================================================
describe('2.7 - tasks/index.ts session threading', () => {
  let mockServer: { tool: jest.Mock };
  let mockAuthManager: MockAuthManager;
  let toolHandler: (args: any, extra?: any) => Promise<any>;

  beforeEach(() => {
    mockServer = { tool: jest.fn() };
    mockAuthManager = createMockAuthManager();
    registerTasksTool(mockServer, mockAuthManager);
    toolHandler = mockServer.tool.mock.calls[0][3];
  });

  it('should pass sessionId to authManager.isAuthenticated()', async () => {
    await toolHandler({ subcommand: 'list' }, { sessionId: TEST_SESSION_ID });
    expect(mockAuthManager.isAuthenticated).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should pass sessionId to getClientFromContext', async () => {
    await toolHandler({ subcommand: 'list' }, { sessionId: TEST_SESSION_ID });
    expect(mockGetClientFromContext).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should pass sessionId to authManager.getSession() for attachment', async () => {
    await toolHandler(
      { subcommand: 'attach', id: 1, fileContent: 'dGVzdA==' },
      { sessionId: TEST_SESSION_ID },
    );
    expect(mockAuthManager.getSession).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should use default when no extra', async () => {
    await toolHandler({ subcommand: 'list' });
    expect(mockAuthManager.isAuthenticated).toHaveBeenCalledWith(undefined);
  });
});

// ============================================================================
// 2.8 direct-middleware.ts
// ============================================================================
describe('2.8 - direct-middleware.ts session threading', () => {
  let mockAuthManager: MockAuthManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthManager = createMockAuthManager({
      getSession: jest.fn().mockReturnValue({
        apiUrl: 'https://try.vikunja.io/api/v1',
        apiToken: 'test-token',
        authType: 'api-token',
      }),
    });
  });

  it('should pass sessionId to authManager.isAuthenticated()', async () => {
    const handler = jest.fn().mockResolvedValue({ content: [] });
    const wrapped = applyPermissions('test_tool', mockAuthManager, handler);
    await wrapped({ someArg: 'value' }, { sessionId: TEST_SESSION_ID });
    expect(mockAuthManager.isAuthenticated).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should pass sessionId to authManager.getSession() when authenticated', async () => {
    const handler = jest.fn().mockResolvedValue({ content: [] });
    const wrapped = applyPermissions('test_tool', mockAuthManager, handler);
    await wrapped({ someArg: 'value' }, { sessionId: TEST_SESSION_ID });
    expect(mockAuthManager.getSession).toHaveBeenCalledWith(TEST_SESSION_ID);
  });

  it('should use default when no extra', async () => {
    const handler = jest.fn().mockResolvedValue({ content: [] });
    const wrapped = applyPermissions('test_tool', mockAuthManager, handler);
    await wrapped({ someArg: 'value' });
    expect(mockAuthManager.isAuthenticated).toHaveBeenCalledWith(undefined);
    expect(mockAuthManager.getSession).toHaveBeenCalledWith(undefined);
  });
});

// ============================================================================
// 3.7a — tasks/crud/ service session threading
//   RED: these should FAIL because CRUD services call getClientFromContext()
//   without sessionId (no args.sessionId used)
//   GREEN: after fixing, getClientFromContext(args.sessionId) is called
// ============================================================================
describe('3.7a - tasks/crud service session threading (RED - should fail)', () => {
  beforeEach(() => {
    mockGetClientFromContext.mockResolvedValue(createMockClient());
  });

  // TaskCreationService — getClientFromContext() without args.sessionId
  describe('createTask', () => {
    it('should pass sessionId from args to getClientFromContext', async () => {
      await createTask({ projectId: 1, title: 'test', sessionId: TEST_SESSION_ID });
      expect(mockGetClientFromContext).toHaveBeenCalledWith(TEST_SESSION_ID);
    });

    it('should use default when no sessionId provided', async () => {
      await createTask({ projectId: 1, title: 'test' });
      expect(mockGetClientFromContext).toHaveBeenCalledWith(undefined);
    });
  });

  // TaskReadService — getClientFromContext() without args.sessionId
  describe('getTask', () => {
    it('should pass sessionId from args to getClientFromContext', async () => {
      await getTask({ id: 1, sessionId: TEST_SESSION_ID });
      expect(mockGetClientFromContext).toHaveBeenCalledWith(TEST_SESSION_ID);
    });

    it('should use default when no sessionId provided', async () => {
      await getTask({ id: 1 });
      expect(mockGetClientFromContext).toHaveBeenCalledWith(undefined);
    });
  });

  // TaskUpdateService — getClientFromContext() without args.sessionId
  describe('updateTask', () => {
    it('should pass sessionId from args to getClientFromContext', async () => {
      await updateTask({ id: 1, title: 'updated', sessionId: TEST_SESSION_ID });
      expect(mockGetClientFromContext).toHaveBeenCalledWith(TEST_SESSION_ID);
    });

    it('should use default when no sessionId provided', async () => {
      await updateTask({ id: 1, title: 'updated' });
      expect(mockGetClientFromContext).toHaveBeenCalledWith(undefined);
    });
  });

  // TaskDeletionService — getClientFromContext() without args.sessionId
  describe('deleteTask', () => {
    it('should pass sessionId from args to getClientFromContext', async () => {
      await deleteTask({ id: 1, sessionId: TEST_SESSION_ID });
      expect(mockGetClientFromContext).toHaveBeenCalledWith(TEST_SESSION_ID);
    });

    it('should use default when no sessionId provided', async () => {
      await deleteTask({ id: 1 });
      expect(mockGetClientFromContext).toHaveBeenCalledWith(undefined);
    });
  });
});

// ============================================================================
// 3.7b — tasks/assignees/ session threading
//   Should PASS in RED — assignees already threads sessionId to services
// ============================================================================
describe('3.7b - tasks/assignees session threading (should PASS)', () => {
  beforeEach(() => {
    mockGetClientFromContext.mockResolvedValue(createMockClient());
  });

  describe('assignUsers', () => {
    it('should pass sessionId to getClientFromContext', async () => {
      await assignUsers({ id: 1, assignees: [2] }, TEST_SESSION_ID);
      expect(mockGetClientFromContext).toHaveBeenCalledWith(TEST_SESSION_ID);
    });

    it('should use default when no sessionId provided', async () => {
      await assignUsers({ id: 1, assignees: [2] });
      expect(mockGetClientFromContext).toHaveBeenCalledWith(undefined);
    });
  });

  describe('unassignUsers', () => {
    it('should pass sessionId to getClientFromContext', async () => {
      await unassignUsers({ id: 1, assignees: [2] }, TEST_SESSION_ID);
      expect(mockGetClientFromContext).toHaveBeenCalledWith(TEST_SESSION_ID);
    });

    it('should use default when no sessionId provided', async () => {
      await unassignUsers({ id: 1, assignees: [2] });
      expect(mockGetClientFromContext).toHaveBeenCalledWith(undefined);
    });
  });

  describe('listAssignees', () => {
    it('should pass sessionId to getClientFromContext', async () => {
      await listAssignees({ id: 1 }, TEST_SESSION_ID);
      expect(mockGetClientFromContext).toHaveBeenCalledWith(TEST_SESSION_ID);
    });

    it('should use default when no sessionId provided', async () => {
      await listAssignees({ id: 1 });
      expect(mockGetClientFromContext).toHaveBeenCalledWith(undefined);
    });
  });
});

// ============================================================================
// 3.7c — tasks/comments/ session threading
//   Should PASS in RED — comments already threads sessionId to services
// ============================================================================
describe('3.7c - tasks/comments session threading (should PASS)', () => {
  beforeEach(() => {
    mockGetClientFromContext.mockResolvedValue(createMockClient());
  });

  describe('handleComment (create comment)', () => {
    it('should pass sessionId to getClientFromContext', async () => {
      await handleComment({ id: 1, comment: 'test comment' }, TEST_SESSION_ID);
      expect(mockGetClientFromContext).toHaveBeenCalledWith(TEST_SESSION_ID);
    });

    it('should use default when no sessionId provided', async () => {
      await handleComment({ id: 1, comment: 'test comment' });
      expect(mockGetClientFromContext).toHaveBeenCalledWith(undefined);
    });
  });

  describe('listComments', () => {
    it('should pass sessionId to getClientFromContext', async () => {
      await listComments({ id: 1 }, TEST_SESSION_ID);
      expect(mockGetClientFromContext).toHaveBeenCalledWith(TEST_SESSION_ID);
    });

    it('should use default when no sessionId provided', async () => {
      await listComments({ id: 1 });
      expect(mockGetClientFromContext).toHaveBeenCalledWith(undefined);
    });
  });
});

// ============================================================================
// 3.7d — projects/crud session threading
//   Should PASS in RED — projects already threads sessionId to getClientFromContext
// ============================================================================
describe('3.7d - projects/crud session threading (should PASS)', () => {
  beforeEach(() => {
    mockGetClientFromContext.mockResolvedValue(createMockClient());
  });

  describe('createProject', () => {
    it('should pass sessionId to getClientFromContext', async () => {
      await createProject({ title: 'Test Project' }, TEST_SESSION_ID);
      expect(mockGetClientFromContext).toHaveBeenCalledWith(TEST_SESSION_ID);
    });

    it('should use default when no sessionId provided', async () => {
      await createProject({ title: 'Test Project' });
      expect(mockGetClientFromContext).toHaveBeenCalledWith(undefined);
    });
  });

  describe('getProject', () => {
    it('should pass sessionId to getClientFromContext', async () => {
      await getProject({ id: 1 }, TEST_SESSION_ID);
      expect(mockGetClientFromContext).toHaveBeenCalledWith(TEST_SESSION_ID);
    });

    it('should use default when no sessionId provided', async () => {
      await getProject({ id: 1 });
      expect(mockGetClientFromContext).toHaveBeenCalledWith(undefined);
    });
  });

  describe('updateProject', () => {
    it('should pass sessionId to getClientFromContext', async () => {
      await updateProject({ id: 1, title: 'Updated' }, TEST_SESSION_ID);
      expect(mockGetClientFromContext).toHaveBeenCalledWith(TEST_SESSION_ID);
    });

    it('should use default when no sessionId provided', async () => {
      await updateProject({ id: 1, title: 'Updated' });
      expect(mockGetClientFromContext).toHaveBeenCalledWith(undefined);
    });
  });

  describe('deleteProject', () => {
    it('should pass sessionId to getClientFromContext', async () => {
      await deleteProject({ id: 1 }, TEST_SESSION_ID);
      expect(mockGetClientFromContext).toHaveBeenCalledWith(TEST_SESSION_ID);
    });

    it('should use default when no sessionId provided', async () => {
      await deleteProject({ id: 1 });
      expect(mockGetClientFromContext).toHaveBeenCalledWith(undefined);
    });
  });
});
