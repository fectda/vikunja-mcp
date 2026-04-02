import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthManager } from '../../../src/auth/AuthManager';
import { registerProjectTeamSharingTool } from '../../../src/tools/projects/team-sharing';
import type { User } from 'node-vikunja';

import { getClientFromContext } from '../../../src/client';

jest.mock('../../../src/client', () => ({
  getClientFromContext: jest.fn(),
}));

describe('Team Sharing Tool', () => {
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

    registerProjectTeamSharingTool(mockServer, mockAuthManager);

    const calls = mockServer.tool.mock.calls;
    if (calls.length > 0 && calls[0] && calls[0].length > 3) {
      toolHandler = calls[0][3];
    } else {
      throw new Error('Tool handler not found');
    }
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      mockAuthManager.isAuthenticated.mockReturnValue(false);

      await expect(
        callTool('share-team', { projectId: 1, teamId: 5, right: 'read' }),
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('share-team subcommand', () => {
    it('should require projectId', async () => {
      await expect(callTool('share-team', { teamId: 5, right: 'read' })).rejects.toThrow(
        'Project ID',
      );
    });

    it('should require teamId', async () => {
      await expect(callTool('share-team', { projectId: 1, right: 'read' })).rejects.toThrow(
        'Team ID',
      );
    });

    it('should require right', async () => {
      await expect(callTool('share-team', { projectId: 1, teamId: 5 })).rejects.toThrow('right');
    });

    it('should reject invalid right string', async () => {
      await expect(
        callTool('share-team', { projectId: 1, teamId: 5, right: 'invalid' as any }),
      ).rejects.toThrow('read, write, admin');
    });

    it('should reject invalid numeric right', async () => {
      await expect(
        callTool('share-team', { projectId: 1, teamId: 5, right: 3 as any }),
      ).rejects.toThrow('0=Read, 1=Write, 2=Admin');
    });
  });

  describe('list-team-shares subcommand', () => {
    it('should require projectId', async () => {
      await expect(callTool('list-team-shares', {})).rejects.toThrow('Project ID');
    });
  });

  describe('get-team-share subcommand', () => {
    it('should require projectId', async () => {
      await expect(callTool('get-team-share', { teamId: 5 })).rejects.toThrow('Project ID');
    });

    it('should require teamId', async () => {
      await expect(callTool('get-team-share', { projectId: 1 })).rejects.toThrow('Team ID');
    });
  });

  describe('update-team-share subcommand', () => {
    it('should require projectId', async () => {
      await expect(callTool('update-team-share', { teamId: 5, right: 'read' })).rejects.toThrow(
        'Project ID',
      );
    });

    it('should require teamId', async () => {
      await expect(callTool('update-team-share', { projectId: 1, right: 'read' })).rejects.toThrow(
        'Team ID',
      );
    });

    it('should require right', async () => {
      await expect(callTool('update-team-share', { projectId: 1, teamId: 5 })).rejects.toThrow(
        'right',
      );
    });
  });

  describe('remove-team-share subcommand', () => {
    it('should require projectId', async () => {
      await expect(callTool('remove-team-share', { teamId: 5 })).rejects.toThrow('Project ID');
    });

    it('should require teamId', async () => {
      await expect(callTool('remove-team-share', { projectId: 1 })).rejects.toThrow('Team ID');
    });
  });

  describe('API request format', () => {
    it('should send right as string "admin" not number 2', async () => {
      // This test verifies the fix: API expects "admin" not 2
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 1, right: 'admin', team_id: 5 }),
      } as any);

      await callTool('share-team', { projectId: 1, teamId: 5, right: 'admin' });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://vikunja.example.com/api/v1/projects/1/teams/5',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ right: 'admin' }),
        }),
      );
    });

    it('should send right as string "write" when numeric 1 is provided', async () => {
      // Test that numeric right is converted to string
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 1, right: 'write', team_id: 5 }),
      } as any);

      await callTool('share-team', { projectId: 1, teamId: 5, right: 1 });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://vikunja.example.com/api/v1/projects/1/teams/5',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ right: 'write' }),
        }),
      );
    });

    it('should send right as string "read" when numeric 0 is provided', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 1, right: 'read', team_id: 5 }),
      } as any);

      await callTool('share-team', { projectId: 1, teamId: 5, right: 0 });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://vikunja.example.com/api/v1/projects/1/teams/5',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ right: 'read' }),
        }),
      );
    });
  });
});
