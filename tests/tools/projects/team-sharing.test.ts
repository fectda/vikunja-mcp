import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthManager } from '../../../src/auth/AuthManager';
import { registerProjectsTool } from '../../../src/tools/projects/index';
import {
  shareTeam,
  listTeamShares,
  getTeamShare,
  updateTeamShare,
  removeTeamShare,
} from '../../../src/tools/projects/team-sharing';

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

  describe('share-team error handling', () => {
    beforeEach(() => {
      // Ensure auth always works for error tests
      mockAuthManager.isAuthenticated.mockReturnValue(true);
      mockAuthManager.getSession.mockReturnValue({
        apiUrl: 'https://vikunja.example.com/api/v1',
        apiToken: 'test-token',
      });
    });

    afterEach(() => {
      delete (global as any).fetch;
    });

    it('should handle 404 from project create response and check if project exists', async () => {
      // First call returns 404, then project check returns 200 (project exists)
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: jest.fn().mockResolvedValue('Not found'),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 1 }),
        });

      await expect(
        callTool('share-team', { projectId: 1, teamId: 5, right: 'read' }),
      ).rejects.toThrow('Team with ID 5 not found');
    });

    it('should handle 404 when project does not exist', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: jest.fn().mockResolvedValue('Not found'),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: jest.fn().mockResolvedValue('Not found'),
        });

      await expect(
        callTool('share-team', { projectId: 1, teamId: 5, right: 'read' }),
      ).rejects.toThrow('Project with ID 1 not found');
    });

    it('should handle 403 permission denied', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: jest.fn().mockResolvedValue('Forbidden'),
      });

      await expect(
        callTool('share-team', { projectId: 1, teamId: 5, right: 'read' }),
      ).rejects.toThrow("You don't have permission to share project 1");
    });

    it('should handle generic API error on share creation', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal server error'),
      });

      await expect(
        callTool('share-team', { projectId: 1, teamId: 5, right: 'read' }),
      ).rejects.toThrow('Failed to share project with team');
    });

    it('should handle step 2 upgrade error', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: jest.fn().mockResolvedValue({ team_id: 5, right: 0 }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: jest.fn().mockResolvedValue('Permission update failed'),
        });

      await expect(callTool('share-team', { projectId: 1, teamId: 5, right: 2 })).rejects.toThrow(
        'Failed to update team share permissions',
      );
    });
  });

  describe('list-team-shares subcommand', () => {
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

    it('should list team shares successfully', async () => {
      const mockShares = [
        { team: { id: 1, name: 'Team Alpha' }, right: 0 },
        { team: { id: 2, name: 'Team Beta' }, right: 2 },
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockShares),
      });

      const result = await callTool('list-team-shares', { projectId: 1 });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(typeof result.content[0].text).toBe('string');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://vikunja.example.com/api/v1/projects/1/teams',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should include pagination params when non-default', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue([]),
      });

      await callTool('list-team-shares', { projectId: 1, page: 2, perPage: 10 });

      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain('page=2');
      expect(callUrl).toContain('per_page=10');
    });

    it('should handle 404', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue('Not found'),
      });

      await expect(callTool('list-team-shares', { projectId: 999 })).rejects.toThrow(
        'Project with ID 999 not found',
      );
    });

    it('should handle generic API error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Server error'),
      });

      await expect(callTool('list-team-shares', { projectId: 1 })).rejects.toThrow(
        'Failed to list team shares',
      );
    });
  });

  describe('get-team-share subcommand', () => {
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

    it('should get a team share successfully', async () => {
      const mockShare = { team: { id: 5, name: 'Team Five' }, right: 1 };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockShare),
      });

      const result = await callTool('get-team-share', { projectId: 1, teamId: 5 });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(typeof result.content[0].text).toBe('string');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://vikunja.example.com/api/v1/projects/1/teams/5',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should handle 404', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue('Not found'),
      });

      await expect(callTool('get-team-share', { projectId: 1, teamId: 99 })).rejects.toThrow(
        'Team share not found for team 99 on project 1',
      );
    });

    it('should handle generic API error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Server error'),
      });

      await expect(callTool('get-team-share', { projectId: 1, teamId: 5 })).rejects.toThrow(
        'Failed to get team share',
      );
    });
  });

  describe('update-team-share subcommand', () => {
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

    it('should update team share permissions successfully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ right: 2 }),
      });

      const result = await callTool('update-team-share', {
        projectId: 1,
        teamId: 5,
        right: 'admin',
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(typeof result.content[0].text).toBe('string');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://vikunja.example.com/api/v1/projects/1/teams/5',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ permission: 2 }),
        }),
      );
    });

    it('should handle 404 on update', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue('Not found'),
      });

      await expect(
        callTool('update-team-share', { projectId: 1, teamId: 99, right: 'write' }),
      ).rejects.toThrow('Team share not found for team 99 on project 1');
    });

    it('should handle generic API error on update', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Server error'),
      });

      await expect(
        callTool('update-team-share', { projectId: 1, teamId: 5, right: 'write' }),
      ).rejects.toThrow('Failed to update team share');
    });
  });

  describe('remove-team-share subcommand', () => {
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

    it('should remove team share successfully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      });

      const result = await callTool('remove-team-share', { projectId: 1, teamId: 5 });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(typeof result.content[0].text).toBe('string');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://vikunja.example.com/api/v1/projects/1/teams/5',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('should handle 404', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue('Not found'),
      });

      await expect(callTool('remove-team-share', { projectId: 1, teamId: 99 })).rejects.toThrow(
        'Team share not found for team 99 on project 1',
      );
    });

    it('should handle generic API error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Server error'),
      });

      await expect(callTool('remove-team-share', { projectId: 1, teamId: 5 })).rejects.toThrow(
        'Failed to remove team share',
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

    it('shareTeam rejects non-positive projectId', async () => {
      await expect(shareTeam({ projectId: 0, teamId: 5, right: 'read' }, mockAuth)).rejects.toThrow(
        'Project ID must be a positive integer',
      );
    });

    it('shareTeam rejects non-positive teamId', async () => {
      await expect(shareTeam({ projectId: 1, teamId: 0, right: 'read' }, mockAuth)).rejects.toThrow(
        'Team ID must be a positive integer',
      );
    });

    it('shareTeam rejects missing right', async () => {
      await expect(
        shareTeam({ projectId: 1, teamId: 5, right: undefined as any }, mockAuth),
      ).rejects.toThrow('Permission right is required');
    });

    it('shareTeam wraps unexpected error via wrapToolError', async () => {
      // Mock getClientFromContext to throw a non-MCP error
      (getClientFromContext as jest.Mock).mockRejectedValueOnce(
        new Error('Unexpected network error'),
      );

      await expect(shareTeam({ projectId: 1, teamId: 5, right: 'read' }, mockAuth)).rejects.toThrow(
        'Unexpected network error',
      );
    });

    it('listTeamShares rejects non-positive projectId', async () => {
      await expect(listTeamShares({ projectId: 0 }, mockAuth)).rejects.toThrow(
        'Project ID must be a positive integer',
      );
    });

    it('listTeamShares wraps unexpected error', async () => {
      (getClientFromContext as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));

      await expect(listTeamShares({ projectId: 1 }, mockAuth)).rejects.toThrow('Network failure');
    });

    it('getTeamShare rejects non-positive projectId', async () => {
      await expect(getTeamShare({ projectId: 0, teamId: 5 }, mockAuth)).rejects.toThrow(
        'Project ID must be a positive integer',
      );
    });

    it('getTeamShare rejects non-positive teamId', async () => {
      await expect(getTeamShare({ projectId: 1, teamId: 0 }, mockAuth)).rejects.toThrow(
        'Team ID must be a positive integer',
      );
    });

    it('getTeamShare wraps unexpected error', async () => {
      (getClientFromContext as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));

      await expect(getTeamShare({ projectId: 1, teamId: 5 }, mockAuth)).rejects.toThrow(
        'Network failure',
      );
    });

    it('updateTeamShare rejects non-positive projectId', async () => {
      await expect(
        updateTeamShare({ projectId: 0, teamId: 5, right: 'read' }, mockAuth),
      ).rejects.toThrow('Project ID must be a positive integer');
    });

    it('updateTeamShare rejects non-positive teamId', async () => {
      await expect(
        updateTeamShare({ projectId: 1, teamId: 0, right: 'read' }, mockAuth),
      ).rejects.toThrow('Team ID must be a positive integer');
    });

    it('updateTeamShare rejects missing right', async () => {
      await expect(
        updateTeamShare({ projectId: 1, teamId: 5, right: undefined as any }, mockAuth),
      ).rejects.toThrow('Permission right is required');
    });

    it('updateTeamShare wraps unexpected error', async () => {
      (getClientFromContext as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));

      await expect(
        updateTeamShare({ projectId: 1, teamId: 5, right: 'write' }, mockAuth),
      ).rejects.toThrow('Network failure');
    });

    it('removeTeamShare rejects non-positive projectId', async () => {
      await expect(removeTeamShare({ projectId: 0, teamId: 5 }, mockAuth)).rejects.toThrow(
        'Project ID must be a positive integer',
      );
    });

    it('removeTeamShare rejects non-positive teamId', async () => {
      await expect(removeTeamShare({ projectId: 1, teamId: 0 }, mockAuth)).rejects.toThrow(
        'Team ID must be a positive integer',
      );
    });

    it('removeTeamShare wraps unexpected error', async () => {
      (getClientFromContext as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));

      await expect(removeTeamShare({ projectId: 1, teamId: 5 }, mockAuth)).rejects.toThrow(
        'Network failure',
      );
    });
  });
});
