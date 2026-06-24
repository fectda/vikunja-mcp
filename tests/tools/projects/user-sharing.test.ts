import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthManager } from '../../../src/auth/AuthManager';
import { registerProjectsTool } from '../../../src/tools/projects/index';
import {
  shareUser,
  listUserShares,
  getUserShare,
  updateUserShare,
  removeUserShare,
} from '../../../src/tools/projects/user-sharing';

import { getClientFromContext } from '../../../src/client';

jest.mock('../../../src/client', () => ({
  getClientFromContext: jest.fn(),
}));

describe('User Sharing Tool', () => {
  let mockServer: MockServer;
  let mockAuthManager: MockAuthManager;
  let toolHandler: (args: any) => Promise<any>;

  interface MockServer {
    tool: jest.Mock<(name: string, description: string, schema: any, handler: any) => void>;
  }

  interface MockAuthManager {
    isAuthenticated: jest.Mock;
    getSession: jest.Mock;
  }

  async function callTool(subcommand: string, args: Record<string, any> = {}) {
    return toolHandler({ subcommand, ...args });
  }

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthManager = {
      isAuthenticated: jest.fn().mockReturnValue(true),
      getSession: jest.fn().mockReturnValue({
        apiUrl: 'https://vikunja.example.com/api/v1',
        apiToken: 'test-token',
      }),
    } as unknown as MockAuthManager;

    mockServer = {
      tool: jest.fn() as jest.Mock<
        (name: string, description: string, schema: any, handler: any) => void
      >,
    } as unknown as MockServer;

    (getClientFromContext as jest.Mock).mockResolvedValue({});

    registerProjectsTool(mockServer, mockAuthManager);

    const calls = mockServer.tool.mock.calls;
    const projectToolCall = calls.find((c) => c[0] === 'vikunja_projects');

    if (projectToolCall && projectToolCall.length > 3) {
      toolHandler = projectToolCall[3];
    } else {
      throw new Error('vikunja_projects tool handler not found');
    }
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      mockAuthManager.isAuthenticated.mockReturnValue(false);

      await expect(
        callTool('share-user', { projectId: 1, userId: 5, right: 'read' }),
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('share-user subcommand', () => {
    it('should require projectId', async () => {
      await expect(callTool('share-user', { userId: 5, right: 'read' })).rejects.toThrow(
        'Project ID',
      );
    });

    it('should require userId', async () => {
      await expect(callTool('share-user', { projectId: 1, right: 'read' })).rejects.toThrow(
        'User ID',
      );
    });

    it('should require right', async () => {
      await expect(callTool('share-user', { projectId: 1, userId: 5 })).rejects.toThrow('right');
    });

    it('should reject invalid right string', async () => {
      await expect(
        callTool('share-user', { projectId: 1, userId: 5, right: 'invalid' as any }),
      ).rejects.toThrow('read, write, admin');
    });

    it('should reject invalid numeric right', async () => {
      await expect(
        callTool('share-user', { projectId: 1, userId: 5, right: 3 as any }),
      ).rejects.toThrow('0=Read, 1=Write, 2=Admin');
    });
  });

  describe('list-user-shares subcommand', () => {
    it('should require projectId', async () => {
      await expect(callTool('list-user-shares', {})).rejects.toThrow('Project ID');
    });
  });

  describe('get-user-share subcommand', () => {
    it('should require projectId', async () => {
      await expect(callTool('get-user-share', { userId: 5 })).rejects.toThrow('Project ID');
    });

    it('should require userId', async () => {
      await expect(callTool('get-user-share', { projectId: 1 })).rejects.toThrow('User ID');
    });
  });

  describe('update-user-share subcommand', () => {
    it('should require projectId', async () => {
      await expect(callTool('update-user-share', { userId: 5, right: 'read' })).rejects.toThrow(
        'Project ID',
      );
    });

    it('should require userId', async () => {
      await expect(callTool('update-user-share', { projectId: 1, right: 'read' })).rejects.toThrow(
        'User ID',
      );
    });

    it('should require right', async () => {
      await expect(callTool('update-user-share', { projectId: 1, userId: 5 })).rejects.toThrow(
        'right',
      );
    });
  });

  describe('remove-user-share subcommand', () => {
    it('should require projectId', async () => {
      await expect(callTool('remove-user-share', { userId: 5 })).rejects.toThrow('Project ID');
    });

    it('should require userId', async () => {
      await expect(callTool('remove-user-share', { projectId: 1 })).rejects.toThrow('User ID');
    });
  });

  describe('API request format — single-step PUT (share-user)', () => {
    it('should send admin permission as single PUT with {right: number}', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ right: 2 }),
      });

      await callTool('share-user', { projectId: 1, userId: 5, right: 'admin' });

      // Single API call, not two-step
      expect(global.fetch).toHaveBeenCalledTimes(1);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://vikunja.example.com/api/v1/projects/1/users/5',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ right: 2 }),
        }),
      );
    });

    it('should send write permission with numeric right as number', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ right: 1 }),
      });

      await callTool('share-user', { projectId: 1, userId: 5, right: 1 });

      expect(global.fetch).toHaveBeenCalledTimes(1);

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(callBody).toEqual({ right: 1 });
      expect(typeof callBody.right).toBe('number');
    });

    it('should send read permission correctly', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ right: 0 }),
      });

      await callTool('share-user', { projectId: 1, userId: 5, right: 'read' });

      expect(global.fetch).toHaveBeenCalledTimes(1);

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(callBody).toEqual({ right: 0 });
    });
  });

  describe('API request format — list-user-shares', () => {
    it('should list user shares with GET', async () => {
      const mockShares = [
        { id: 1, username: 'user1', right: 0 },
        { id: 2, username: 'user2', right: 2 },
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockShares),
      });

      const result = await callTool('list-user-shares', { projectId: 1 });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(typeof result.content[0].text).toBe('string');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://vikunja.example.com/api/v1/projects/1/users',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should include pagination params when non-default', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue([]),
      });

      await callTool('list-user-shares', { projectId: 1, page: 2, perPage: 10 });

      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain('page=2');
      expect(callUrl).toContain('per_page=10');
    });

    it('should return empty array for project with no user shares', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue([]),
      });

      const result = await callTool('list-user-shares', { projectId: 1 });

      expect(result.content[0].text).toContain('0 user share');
    });
  });

  describe('API request format — get-user-share (direct GET)', () => {
    it('should get user share directly from GET endpoint', async () => {
      const mockShare = { id: 5, username: 'user5', right: 1 };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockShare),
      });

      const result = await callTool('get-user-share', { projectId: 1, userId: 5 });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(typeof result.content[0].text).toBe('string');

      // Should call direct GET endpoint, not list+filter
      expect(global.fetch).toHaveBeenCalledWith(
        'https://vikunja.example.com/api/v1/projects/1/users/5',
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });

  describe('API request format — update-user-share', () => {
    it('should first check share exists then PUT to update', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 5, username: 'user5', right: 0 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ right: 2 }),
        });

      await callTool('update-user-share', { projectId: 1, userId: 5, right: 'admin' });

      // Step 1: GET to check exists
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        'https://vikunja.example.com/api/v1/projects/1/users/5',
        expect.objectContaining({ method: 'GET' }),
      );

      // Step 2: PUT to update
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        'https://vikunja.example.com/api/v1/projects/1/users/5',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ right: 2 }),
        }),
      );
    });

    it('should update with write permission as number', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 5, username: 'user5', right: 0 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ right: 1 }),
        });

      await callTool('update-user-share', { projectId: 1, userId: 5, right: 1 });

      expect(global.fetch).toHaveBeenCalledTimes(2);

      const secondCallBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
      expect(secondCallBody.right).toBe(1);
    });
  });

  describe('API request format — remove-user-share', () => {
    it('should remove user share with DELETE', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      });

      const result = await callTool('remove-user-share', { projectId: 1, userId: 5 });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(typeof result.content[0].text).toBe('string');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://vikunja.example.com/api/v1/projects/1/users/5',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('share-user error handling', () => {
    beforeEach(() => {
      mockAuthManager.isAuthenticated.mockReturnValue(true);
      mockAuthManager.getSession.mockReturnValue({
        apiUrl: 'https://vikunja.example.com/api/v1',
        apiToken: 'test-token',
      });
    });

    afterEach(() => {
      delete (global as any).fetch;
    });

    it('should handle 404 from API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue('Not found'),
      });

      await expect(
        callTool('share-user', { projectId: 1, userId: 999, right: 'read' }),
      ).rejects.toThrow('not found');
    });

    it('should handle 403 permission denied', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: jest.fn().mockResolvedValue('Forbidden'),
      });

      await expect(
        callTool('share-user', { projectId: 1, userId: 5, right: 'read' }),
      ).rejects.toThrow("You don't have permission");
    });

    it('should handle generic API error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal server error'),
      });

      await expect(
        callTool('share-user', { projectId: 1, userId: 5, right: 'read' }),
      ).rejects.toThrow('Failed to share project with user');
    });
  });

  describe('list-user-shares error handling', () => {
    beforeEach(() => {
      mockAuthManager.isAuthenticated.mockReturnValue(true);
      mockAuthManager.getSession.mockReturnValue({
        apiUrl: 'https://vikunja.example.com/api/v1',
        apiToken: 'test-token',
      });
    });

    afterEach(() => {
      delete (global as any).fetch;
    });

    it('should handle 404', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue('Not found'),
      });

      await expect(callTool('list-user-shares', { projectId: 999 })).rejects.toThrow(
        'Project with ID 999 not found',
      );
    });

    it('should handle generic API error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Server error'),
      });

      await expect(callTool('list-user-shares', { projectId: 1 })).rejects.toThrow(
        'Failed to list user shares',
      );
    });
  });

  describe('get-user-share error handling', () => {
    beforeEach(() => {
      mockAuthManager.isAuthenticated.mockReturnValue(true);
      mockAuthManager.getSession.mockReturnValue({
        apiUrl: 'https://vikunja.example.com/api/v1',
        apiToken: 'test-token',
      });
    });

    afterEach(() => {
      delete (global as any).fetch;
    });

    it('should handle 404', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue('Not found'),
      });

      await expect(callTool('get-user-share', { projectId: 1, userId: 999 })).rejects.toThrow(
        'not found',
      );
    });

    it('should handle generic API error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Server error'),
      });

      await expect(callTool('get-user-share', { projectId: 1, userId: 5 })).rejects.toThrow(
        'Failed to get user share',
      );
    });
  });

  describe('update-user-share error handling', () => {
    beforeEach(() => {
      mockAuthManager.isAuthenticated.mockReturnValue(true);
      mockAuthManager.getSession.mockReturnValue({
        apiUrl: 'https://vikunja.example.com/api/v1',
        apiToken: 'test-token',
      });
    });

    afterEach(() => {
      delete (global as any).fetch;
    });

    it('should handle 404 when share does not exist (GET check fails)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue('Not found'),
      });

      await expect(
        callTool('update-user-share', { projectId: 1, userId: 999, right: 'write' }),
      ).rejects.toThrow('not found');
    });

    it('should handle generic API error on update step', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 5, username: 'user5', right: 0 }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: jest.fn().mockResolvedValue('Permission update failed'),
        });

      await expect(
        callTool('update-user-share', { projectId: 1, userId: 5, right: 'admin' }),
      ).rejects.toThrow('Failed to update user share');
    });

    it('should handle 404 when share does not exist and GET returns ok but user not found in API', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 5, username: 'other', right: 0 }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: jest.fn().mockResolvedValue('Not found'),
        });

      await expect(
        callTool('update-user-share', { projectId: 1, userId: 5, right: 'admin' }),
      ).rejects.toThrow('Failed to update user share');
    });
  });

  describe('remove-user-share error handling', () => {
    beforeEach(() => {
      mockAuthManager.isAuthenticated.mockReturnValue(true);
      mockAuthManager.getSession.mockReturnValue({
        apiUrl: 'https://vikunja.example.com/api/v1',
        apiToken: 'test-token',
      });
    });

    afterEach(() => {
      delete (global as any).fetch;
    });

    it('should handle 404', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue('Not found'),
      });

      await expect(callTool('remove-user-share', { projectId: 1, userId: 999 })).rejects.toThrow(
        'not found',
      );
    });

    it('should handle generic API error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Server error'),
      });

      await expect(callTool('remove-user-share', { projectId: 1, userId: 5 })).rejects.toThrow(
        'Failed to remove user share',
      );
    });
  });

  describe('defensive validation (direct handler call, bypassing Zod)', () => {
    const mockAuth = {
      isAuthenticated: () => true,
      getSession: () => ({
        apiUrl: 'https://vikunja.example.com/api/v1',
        apiToken: 'test-token',
      }),
    } as unknown as AuthManager;

    afterEach(() => {
      delete (global as any).fetch;
    });

    it('shareUser rejects non-positive projectId', async () => {
      await expect(shareUser({ projectId: 0, userId: 5, right: 'read' }, mockAuth)).rejects.toThrow(
        'Project ID must be a positive integer',
      );
    });

    it('shareUser rejects non-positive userId', async () => {
      await expect(shareUser({ projectId: 1, userId: 0, right: 'read' }, mockAuth)).rejects.toThrow(
        'User ID must be a positive integer',
      );
    });

    it('shareUser rejects missing right', async () => {
      await expect(
        shareUser({ projectId: 1, userId: 5, right: undefined as any }, mockAuth),
      ).rejects.toThrow('Permission right is required');
    });

    it('shareUser wraps unexpected error via wrapToolError', async () => {
      (getClientFromContext as jest.Mock).mockRejectedValueOnce(
        new Error('Unexpected network error'),
      );

      await expect(shareUser({ projectId: 1, userId: 5, right: 'read' }, mockAuth)).rejects.toThrow(
        'Unexpected network error',
      );
    });

    it('listUserShares rejects non-positive projectId', async () => {
      await expect(listUserShares({ projectId: 0 }, mockAuth)).rejects.toThrow(
        'Project ID must be a positive integer',
      );
    });

    it('listUserShares wraps unexpected error', async () => {
      (getClientFromContext as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));

      await expect(listUserShares({ projectId: 1 }, mockAuth)).rejects.toThrow('Network failure');
    });

    it('getUserShare rejects non-positive projectId', async () => {
      await expect(getUserShare({ projectId: 0, userId: 5 }, mockAuth)).rejects.toThrow(
        'Project ID must be a positive integer',
      );
    });

    it('getUserShare rejects non-positive userId', async () => {
      await expect(getUserShare({ projectId: 1, userId: 0 }, mockAuth)).rejects.toThrow(
        'User ID must be a positive integer',
      );
    });

    it('getUserShare wraps unexpected error', async () => {
      (getClientFromContext as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));

      await expect(getUserShare({ projectId: 1, userId: 5 }, mockAuth)).rejects.toThrow(
        'Network failure',
      );
    });

    it('updateUserShare rejects non-positive projectId', async () => {
      await expect(
        updateUserShare({ projectId: 0, userId: 5, right: 'read' }, mockAuth),
      ).rejects.toThrow('Project ID must be a positive integer');
    });

    it('updateUserShare rejects non-positive userId', async () => {
      await expect(
        updateUserShare({ projectId: 1, userId: 0, right: 'read' }, mockAuth),
      ).rejects.toThrow('User ID must be a positive integer');
    });

    it('updateUserShare rejects missing right', async () => {
      await expect(
        updateUserShare({ projectId: 1, userId: 5, right: undefined as any }, mockAuth),
      ).rejects.toThrow('Permission right is required');
    });

    it('updateUserShare wraps unexpected error', async () => {
      (getClientFromContext as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));

      await expect(
        updateUserShare({ projectId: 1, userId: 5, right: 'write' }, mockAuth),
      ).rejects.toThrow('Network failure');
    });

    it('removeUserShare rejects non-positive projectId', async () => {
      await expect(removeUserShare({ projectId: 0, userId: 5 }, mockAuth)).rejects.toThrow(
        'Project ID must be a positive integer',
      );
    });

    it('removeUserShare rejects non-positive userId', async () => {
      await expect(removeUserShare({ projectId: 1, userId: 0 }, mockAuth)).rejects.toThrow(
        'User ID must be a positive integer',
      );
    });

    it('removeUserShare wraps unexpected error', async () => {
      (getClientFromContext as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));

      await expect(removeUserShare({ projectId: 1, userId: 5 }, mockAuth)).rejects.toThrow(
        'Network failure',
      );
    });
  });
});
