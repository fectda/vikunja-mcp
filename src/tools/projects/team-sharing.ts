/**
 * Project Team Sharing Module
 * Handles team-based project sharing operations (different from link sharing)
 */

import type { AuthManager } from '../../auth/AuthManager';
import { MCPError, ErrorCode, createStandardResponse } from '../../types';
import { getClientFromContext } from '../../client';
import { wrapToolError } from '../../utils/error-handler';
import { formatAorpAsMarkdown } from '../../utils/response-factory';

// MCP response type - local definition matching MCP protocol
type McpResponse = {
  content: Array<{
    type: 'text';
    text: string;
  }>;
};

export interface ShareTeamArgs {
  projectId: number;
  teamId: number;
  right: 'read' | 'write' | 'admin' | 0 | 1 | 2;
}

export interface ListTeamSharesArgs {
  projectId: number;
  page?: number;
  perPage?: number;
}

export interface GetTeamShareArgs {
  projectId: number;
  teamId: number;
}

export interface UpdateTeamShareArgs {
  projectId: number;
  teamId: number;
  right: 'read' | 'write' | 'admin' | 0 | 1 | 2;
}

export interface RemoveTeamShareArgs {
  projectId: number;
  teamId: number;
}

/**
 * Convert permission to numeric value
 */
export function normalizeRight(right: 'read' | 'write' | 'admin' | 0 | 1 | 2): number {
  if (typeof right === 'number') {
    if (![0, 1, 2].includes(right)) {
      throw new MCPError(
        ErrorCode.VALIDATION_ERROR,
        'Invalid permission level. Valid numeric values are: 0=Read, 1=Write, 2=Admin',
      );
    }
    return right;
  }

  const rightMap: Record<string, number> = { read: 0, write: 1, admin: 2 };
  const normalizedRight = right.trim().toLowerCase();

  if (!(normalizedRight in rightMap)) {
    throw new MCPError(
      ErrorCode.VALIDATION_ERROR,
      'Invalid permission level. Valid options are: read, write, admin',
    );
  }

  return rightMap[normalizedRight] ?? 0;
}

/**
 * Share a project with a team (or update existing share)
 *
 * Vikunja API requires TWO steps:
 * 1. PUT /projects/{id}/teams with {team_id: id} -> creates share (default permission=0/read)
 * 2. POST /projects/{id}/teams/{teamId} with {permission: right} -> updates to desired permission
 */
export async function shareTeam(
  args: ShareTeamArgs,
  authManager: AuthManager,
): Promise<McpResponse> {
  const { projectId, teamId, right } = args;

  try {
    // Validate IDs
    if (!projectId || projectId <= 0) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Project ID must be a positive integer');
    }
    if (!teamId || teamId <= 0) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Team ID must be a positive integer');
    }
    if (right === undefined) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Permission right is required');
    }

    const numericRight = normalizeRight(right);
    await getClientFromContext();
    const session = authManager.getSession();

    // STEP 1: Create share with team_id in body (NOT in URL)
    const createResponse = await fetch(`${session.apiUrl}/projects/${projectId}/teams`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${session.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ team_id: teamId }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();

      // Handle specific error codes
      if (createResponse.status === 404) {
        // Check if it's project or team not found
        const projectResponse = await fetch(`${session.apiUrl}/projects/${projectId}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${session.apiToken}` },
        });

        if (!projectResponse.ok) {
          throw new MCPError(ErrorCode.NOT_FOUND, `Project with ID ${projectId} not found`);
        }
        throw new MCPError(ErrorCode.NOT_FOUND, `Team with ID ${teamId} not found`);
      }

      if (createResponse.status === 403) {
        throw new MCPError(
          ErrorCode.PERMISSION_DENIED,
          `You don't have permission to share project ${projectId}`,
        );
      }

      throw new MCPError(ErrorCode.API_ERROR, `Failed to share project with team: ${errorText}`, {
        statusCode: createResponse.status,
        endpoint: `/projects/${projectId}/teams`,
      });
    }

    const createResult = (await createResponse.json()) as { right: number; message?: string };

    // STEP 2: If right is not "read" (0), update the permission
    // Default permission after creation is 0 (read), so skip if user wants read
    if (numericRight !== 0) {
      const updateResponse = await fetch(
        `${session.apiUrl}/projects/${projectId}/teams/${teamId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.apiToken}`,
            'Content-Type': 'application/json',
          },
          // Vikunja expects NUMBER for permission: 0=read, 1=write, 2=admin
          body: JSON.stringify({ permission: numericRight }),
        },
      );

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new MCPError(
          ErrorCode.API_ERROR,
          `Failed to update team share permissions: ${errorText}`,
          {
            statusCode: updateResponse.status,
            endpoint: `/projects/${projectId}/teams/${teamId}`,
          },
        );
      }

      const updateResult = (await updateResponse.json()) as { right: number };
      createResult.right = updateResult.right;
    }

    const standardResponse = createStandardResponse(
      'share-team',
      `Project shared with team successfully`,
      { right: createResult.right },
      { projectId, teamId, right: numericRight },
    );

    return {
      content: [
        {
          type: 'text',
          text: formatAorpAsMarkdown(standardResponse),
        },
      ],
    };
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw wrapToolError(error, 'vikunja_projects_team_sharing', 'share-team', projectId);
  }
}

/**
 * List all team shares for a project
 */
export async function listTeamShares(
  args: ListTeamSharesArgs,
  authManager: AuthManager,
): Promise<McpResponse> {
  const { projectId, page = 1, perPage = 50 } = args;

  try {
    if (!projectId || projectId <= 0) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Project ID must be a positive integer');
    }

    await getClientFromContext();
    const session = authManager.getSession();

    const queryParams = new URLSearchParams();
    if (page !== 1) queryParams.set('page', String(page));
    if (perPage !== 50) queryParams.set('per_page', String(perPage));

    const url = `${session.apiUrl}/projects/${projectId}/teams${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 404) {
        throw new MCPError(ErrorCode.NOT_FOUND, `Project with ID ${projectId} not found`);
      }

      throw new MCPError(ErrorCode.API_ERROR, `Failed to list team shares: ${errorText}`, {
        statusCode: response.status,
        endpoint: `/projects/${projectId}/teams`,
      });
    }

    const teamShares = (await response.json()) as Array<{
      team: { id: number; name: string };
      right: number;
    }>;

    const standardResponse = createStandardResponse(
      'list-team-shares',
      `Retrieved ${teamShares.length} team share${teamShares.length !== 1 ? 's' : ''} for project`,
      { teamShares },
      { projectId, count: teamShares.length, page, perPage },
    );

    return {
      content: [
        {
          type: 'text',
          text: formatAorpAsMarkdown(standardResponse),
        },
      ],
    };
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw wrapToolError(error, 'vikunja_projects_team_sharing', 'list-team-shares', projectId);
  }
}

/**
 * Get a specific team share
 */
export async function getTeamShare(
  args: GetTeamShareArgs,
  authManager: AuthManager,
): Promise<McpResponse> {
  const { projectId, teamId } = args;

  try {
    if (!projectId || projectId <= 0) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Project ID must be a positive integer');
    }
    if (!teamId || teamId <= 0) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Team ID must be a positive integer');
    }

    await getClientFromContext();
    const session = authManager.getSession();

    const response = await fetch(`${session.apiUrl}/projects/${projectId}/teams/${teamId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 404) {
        throw new MCPError(
          ErrorCode.NOT_FOUND,
          `Team share not found for team ${teamId} on project ${projectId}`,
        );
      }

      throw new MCPError(ErrorCode.API_ERROR, `Failed to get team share: ${errorText}`, {
        statusCode: response.status,
        endpoint: `/projects/${projectId}/teams/${teamId}`,
      });
    }

    const teamShare = (await response.json()) as {
      team: { id: number; name: string };
      right: number;
    };

    const standardResponse = createStandardResponse(
      'get-team-share',
      `Retrieved team share`,
      { teamShare },
      { projectId, teamId, right: teamShare.right },
    );

    return {
      content: [
        {
          type: 'text',
          text: formatAorpAsMarkdown(standardResponse),
        },
      ],
    };
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw wrapToolError(error, 'vikunja_projects_team_sharing', 'get-team-share', teamId);
  }
}

/**
 * Update team share permissions
 *
 * For existing shares, use POST with "permission" field (NOT PUT with "right")
 */
export async function updateTeamShare(
  args: UpdateTeamShareArgs,
  authManager: AuthManager,
): Promise<McpResponse> {
  const { projectId, teamId, right } = args;

  try {
    if (!projectId || projectId <= 0) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Project ID must be a positive integer');
    }
    if (!teamId || teamId <= 0) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Team ID must be a positive integer');
    }
    if (right === undefined) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Permission right is required');
    }

    const numericRight = normalizeRight(right);
    await getClientFromContext();
    const session = authManager.getSession();

    // Vikunja API expects NUMBER for permission: 0=read, 1=write, 2=admin
    // Use POST (not PUT) with "permission" field (not "right")
    const response = await fetch(`${session.apiUrl}/projects/${projectId}/teams/${teamId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ permission: numericRight }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 404) {
        throw new MCPError(
          ErrorCode.NOT_FOUND,
          `Team share not found for team ${teamId} on project ${projectId}`,
        );
      }

      throw new MCPError(ErrorCode.API_ERROR, `Failed to update team share: ${errorText}`, {
        statusCode: response.status,
        endpoint: `/projects/${projectId}/teams/${teamId}`,
      });
    }

    const result = (await response.json()) as { right: number };

    const standardResponse = createStandardResponse(
      'update-team-share',
      `Team share permissions updated successfully`,
      { right: result.right },
      { projectId, teamId, right: numericRight },
    );

    return {
      content: [
        {
          type: 'text',
          text: formatAorpAsMarkdown(standardResponse),
        },
      ],
    };
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw wrapToolError(error, 'vikunja_projects_team_sharing', 'update-team-share', projectId);
  }
}

/**
 * Remove a team share from a project
 */
export async function removeTeamShare(
  args: RemoveTeamShareArgs,
  authManager: AuthManager,
): Promise<McpResponse> {
  const { projectId, teamId } = args;

  try {
    if (!projectId || projectId <= 0) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Project ID must be a positive integer');
    }
    if (!teamId || teamId <= 0) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Team ID must be a positive integer');
    }

    await getClientFromContext();
    const session = authManager.getSession();

    const response = await fetch(`${session.apiUrl}/projects/${projectId}/teams/${teamId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session.apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 404) {
        throw new MCPError(
          ErrorCode.NOT_FOUND,
          `Team share not found for team ${teamId} on project ${projectId}`,
        );
      }

      throw new MCPError(ErrorCode.API_ERROR, `Failed to remove team share: ${errorText}`, {
        statusCode: response.status,
        endpoint: `/projects/${projectId}/teams/${teamId}`,
      });
    }

    const standardResponse = createStandardResponse(
      'remove-team-share',
      `Team share removed successfully`,
      { removed: true },
      { projectId, teamId },
    );

    return {
      content: [
        {
          type: 'text',
          text: formatAorpAsMarkdown(standardResponse),
        },
      ],
    };
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw wrapToolError(error, 'vikunja_projects_team_sharing', 'remove-team-share', projectId);
  }
}

