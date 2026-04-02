import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthManager } from '../../../src/auth/AuthManager';
import { registerProjectTeamSharingTool } from '../../../src/tools/projects/team-sharing';

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

  describe('API request format - two-step flow', () => {
    it('should send admin permission correctly with two-step flow', async () => {
      // With the fix:
      // Step 1: PUT /projects/{id}/teams with {team_id: id}
      // Step 2: POST /projects/{id}/teams/{teamId} with {permission: 2} (NUMBER)
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: jest.fn().mockResolvedValue({ team_id: 5, right: 0 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ team_id: 5, right: 2 }),
        });

      await callTool('share-team', { projectId: 1, teamId: 5, right: 'admin' });

      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Step 1: Create share
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        'https://vikunja.example.com/api/v1/projects/1/teams',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ team_id: 5 }),
        }),
      );

      // Step 2: Update permission - Vikunja expects NUMBER not string
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        'https://vikunja.example.com/api/v1/projects/1/teams/5',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ permission: 2 }),
        }),
      );
    });

    it('should send write permission correctly with two-step flow', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: jest.fn().mockResolvedValue({ team_id: 5, right: 0 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ team_id: 5, right: 1 }),
        });

      await callTool('share-team', { projectId: 1, teamId: 5, right: 1 });

      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Step 2 should use NUMBER for permission (1=write)
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        'https://vikunja.example.com/api/v1/projects/1/teams/5',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ permission: 1 }),
        }),
      );
    });

    it('should only call API once when right is read (0)', async () => {
      // When right is "read" (0), no second call needed - default permission is already read
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: jest.fn().mockResolvedValue({ team_id: 5, right: 0 }),
      } as any);

      await callTool('share-team', { projectId: 1, teamId: 5, right: 0 });

      // Only 1 call needed - default permission is already read
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Should use /teams endpoint with team_id in body
      expect(global.fetch).toHaveBeenCalledWith(
        'https://vikunja.example.com/api/v1/projects/1/teams',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ team_id: 5 }),
        }),
      );
    });

    // === TDD: Tests that FAIL with buggy code, PASS after fix ===

    /**
     * Bug 1: Wrong endpoint
     * Current: PUT /projects/{id}/teams/{teamId} (WRONG - returns 405)
     * Correct: PUT /projects/{id}/teams with {team_id: teamId}
     */
    it('should use PUT /projects/{id}/teams with team_id in body', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ team_id: 5, right: 0 }),
      } as any);

      await callTool('share-team', { projectId: 1, teamId: 5, right: 'read' });

      // Should call /projects/1/teams (NOT /projects/1/teams/5)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://vikunja.example.com/api/v1/projects/1/teams',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ team_id: 5 }),
        }),
      );
    });

    /**
     * Bug 2: Wrong field name
     * Current: { right: 'admin' } (WRONG - Vikunja ignores 'right')
     * Correct: { permission: 2 } with NUMBER
     */
    it('should use "permission" field not "right" field in step 2', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: jest.fn().mockResolvedValue({ team_id: 5, right: 0 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ team_id: 5, right: 2 }),
        });

      await callTool('share-team', { projectId: 1, teamId: 5, right: 'admin' });

      // Step 2 should use 'permission' field with NUMBER, not 'right'
      const secondCallBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);

      // Should contain 'permission' field, not 'right'
      expect(secondCallBody).toHaveProperty('permission');
      expect(secondCallBody).not.toHaveProperty('right');
      expect(secondCallBody.permission).toBe(2); // NUMBER: 0=read, 1=write, 2=admin
    });

    /**
     * Bug 1 (consolidated): permission should be NUMBER not string
     * Vikunja API expects numeric permission: 0=read, 1=write, 2=admin
     */
    it('should send permission as NUMBER not string in step 2', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: jest.fn().mockResolvedValue({ team_id: 5, right: 0 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ team_id: 5, right: 2 }),
        });

      await callTool('share-team', { projectId: 1, teamId: 5, right: 'admin' });

      // Step 2 should use NUMBER for permission, not string
      const secondCallBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);

      // permission should be a number (2=admin), not string "admin"
      expect(secondCallBody.permission).toBe(2);
      expect(typeof secondCallBody.permission).toBe('number');
    });

    /**
     * Bug 3: Missing step 2 - update permissions
     * After creating share, need second API call to set the desired permission
     * Step 1: PUT /projects/{id}/teams with {team_id: id} -> creates with permission=0
     * Step 2: POST /projects/{id}/teams/{teamId} with {permission: right} -> updates permission
     */
    it('should make two API calls when right is not "read" (0)', async () => {
      // First call returns 201 (created), second returns 200 (updated)
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: jest.fn().mockResolvedValue({ team_id: 5, right: 0 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ team_id: 5, right: 2 }),
        });

      await callTool('share-team', { projectId: 1, teamId: 5, right: 'admin' });

      // Should have 2 fetch calls
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Step 1: Create share
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        'https://vikunja.example.com/api/v1/projects/1/teams',
        expect.objectContaining({ method: 'PUT' }),
      );

      // Step 2: Update permission - Vikunja expects NUMBER not string
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        'https://vikunja.example.com/api/v1/projects/1/teams/5',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ permission: 2 }),
        }),
      );
    });

    it('should NOT make second API call when right is "read" (default)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: jest.fn().mockResolvedValue({ team_id: 5, right: 0 }),
      } as any);

      await callTool('share-team', { projectId: 1, teamId: 5, right: 'read' });

      // Only 1 call needed - default permission is already read
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should use "permission" field in step 2 API call', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: jest.fn().mockResolvedValue({ team_id: 5, right: 0 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ team_id: 5, right: 1 }),
        });

      await callTool('share-team', { projectId: 1, teamId: 5, right: 'write' });

      // Step 2 should use 'permission' field with NUMBER
      const secondCallBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
      expect(secondCallBody).toHaveProperty('permission');
      expect(secondCallBody.permission).toBe(1); // NUMBER: 0=read, 1=write, 2=admin
    });
  });
});
