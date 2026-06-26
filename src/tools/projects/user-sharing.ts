/**
 * Project User Sharing Module
 * Handles user-based project sharing operations (different from team/link sharing)
 *
 * Key API difference from team sharing: single-step PUT /projects/:id/users/:userId
 * with { right: number } body — no two-step flow like teams.
 */

import type { AuthManager } from '../../auth/AuthManager';
import { MCPError, ErrorCode, createStandardResponse } from '../../types';
import { getClientFromContext } from '../../client';
import { wrapToolError } from '../../utils/error-handler';
import { formatAorpAsMarkdown } from '../../utils/response-factory';
import { normalizeRight } from './team-sharing';

// MCP response type - local definition matching MCP protocol
type McpResponse = {
  content: Array<{
    type: 'text';
    text: string;
  }>;
};

export interface ShareUserArgs {
  projectId: number;
  userId: number;
  right: 'read' | 'write' | 'admin' | 0 | 1 | 2;
}

export interface ListUserSharesArgs {
  projectId: number;
  page?: number;
  perPage?: number;
}

export interface GetUserShareArgs {
  projectId: number;
  userId: number;
}

export type UpdateUserShareArgs = ShareUserArgs;

export type RemoveUserShareArgs = {
  projectId: number;
  userId: number;
};

/**
 * Share a project with a user (single-step PUT)
 *
 * Vikunja API uses a SINGLE-STEP upsert model:
 * PUT /projects/{id}/users/{userId} with { right: numericRight }
 * This differs from team sharing which requires two steps.
 */
export async function shareUser(
  args: ShareUserArgs,
  authManager: AuthManager,
  sessionId?: string,
): Promise<McpResponse> {
  const { projectId, userId, right } = args;

  try {
    // Validate IDs
    if (!projectId || projectId <= 0) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Project ID must be a positive integer');
    }
    if (!userId || userId <= 0) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'User ID must be a positive integer');
    }
    if (right === undefined) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Permission right is required');
    }

    const numericRight = normalizeRight(right);
    await getClientFromContext(sessionId);
    const session = authManager.getSession(sessionId);

    const response = await fetch(`${session.apiUrl}/projects/${projectId}/users/${userId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${session.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ right: numericRight }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 404) {
        // Check if it's project or user not found
        const projectResponse = await fetch(`${session.apiUrl}/projects/${projectId}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${session.apiToken}` },
        });

        if (!projectResponse.ok) {
          throw new MCPError(ErrorCode.NOT_FOUND, `Project with ID ${projectId} not found`);
        }
        throw new MCPError(ErrorCode.NOT_FOUND, `User with ID ${userId} not found`);
      }

      if (response.status === 403) {
        throw new MCPError(
          ErrorCode.PERMISSION_DENIED,
          `You don't have permission to share project ${projectId}`,
        );
      }

      throw new MCPError(ErrorCode.API_ERROR, `Failed to share project with user: ${errorText}`, {
        statusCode: response.status,
        endpoint: `/projects/${projectId}/users/${userId}`,
      });
    }

    const result = (await response.json()) as { right: number; message?: string };

    const standardResponse = createStandardResponse(
      'share-user',
      'Project shared with user successfully',
      { right: result.right },
      { projectId, userId, right: numericRight },
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
    throw wrapToolError(error, 'vikunja_projects_user_sharing', 'share-user', projectId);
  }
}

/**
 * List all user shares for a project
 */
export async function listUserShares(
  args: ListUserSharesArgs,
  authManager: AuthManager,
  sessionId?: string,
): Promise<McpResponse> {
  const { projectId, page = 1, perPage = 50 } = args;

  try {
    if (!projectId || projectId <= 0) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Project ID must be a positive integer');
    }

    await getClientFromContext(sessionId);
    const session = authManager.getSession(sessionId);

    const queryParams = new URLSearchParams();
    if (page !== 1) queryParams.set('page', String(page));
    if (perPage !== 50) queryParams.set('per_page', String(perPage));

    const url = `${session.apiUrl}/projects/${projectId}/users${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

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

      throw new MCPError(ErrorCode.API_ERROR, `Failed to list user shares: ${errorText}`, {
        statusCode: response.status,
        endpoint: `/projects/${projectId}/users`,
      });
    }

    const userShares = (await response.json()) as Array<{
      id: number;
      username: string;
      right: number;
    }>;

    const standardResponse = createStandardResponse(
      'list-user-shares',
      `Retrieved ${userShares.length} user share${userShares.length !== 1 ? 's' : ''} for project`,
      { userShares },
      { projectId, count: userShares.length, page, perPage },
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
    throw wrapToolError(error, 'vikunja_projects_user_sharing', 'list-user-shares', projectId);
  }
}

/**
 * Get a specific user share (direct GET endpoint)
 *
 * Vikunja API supports direct GET /projects/{id}/users/{userId}
 * unlike team sharing which requires list+filter.
 */
export async function getUserShare(
  args: GetUserShareArgs,
  authManager: AuthManager,
  sessionId?: string,
): Promise<McpResponse> {
  const { projectId, userId } = args;

  try {
    if (!projectId || projectId <= 0) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Project ID must be a positive integer');
    }
    if (!userId || userId <= 0) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'User ID must be a positive integer');
    }

    await getClientFromContext(sessionId);
    const session = authManager.getSession(sessionId);

    const response = await fetch(`${session.apiUrl}/projects/${projectId}/users/${userId}`, {
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
          `User share not found for user ${userId} on project ${projectId}`,
        );
      }

      throw new MCPError(ErrorCode.API_ERROR, `Failed to get user share: ${errorText}`, {
        statusCode: response.status,
        endpoint: `/projects/${projectId}/users/${userId}`,
      });
    }

    const userShare = (await response.json()) as {
      id: number;
      username: string;
      right: number;
    };

    const standardResponse = createStandardResponse(
      'get-user-share',
      'Retrieved user share',
      { userShare },
      { projectId, userId, right: userShare.right },
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
    throw wrapToolError(error, 'vikunja_projects_user_sharing', 'get-user-share', userId);
  }
}

/**
 * Update user share permissions
 *
 * For existing shares, verify the share exists with a GET first,
 * then use PUT to update the permission.
 */
export async function updateUserShare(
  args: UpdateUserShareArgs,
  authManager: AuthManager,
  sessionId?: string,
): Promise<McpResponse> {
  const { projectId, userId, right } = args;

  try {
    if (!projectId || projectId <= 0) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Project ID must be a positive integer');
    }
    if (!userId || userId <= 0) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'User ID must be a positive integer');
    }
    if (right === undefined) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Permission right is required');
    }

    const numericRight = normalizeRight(right);
    await getClientFromContext(sessionId);
    const session = authManager.getSession(sessionId);

    // Step 1: Verify the share exists
    const checkResponse = await fetch(`${session.apiUrl}/projects/${projectId}/users/${userId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!checkResponse.ok) {
      const errorText = await checkResponse.text();

      if (checkResponse.status === 404) {
        throw new MCPError(
          ErrorCode.NOT_FOUND,
          `User share not found for user ${userId} on project ${projectId}`,
        );
      }

      throw new MCPError(ErrorCode.API_ERROR, `Failed to get user share: ${errorText}`, {
        statusCode: checkResponse.status,
        endpoint: `/projects/${projectId}/users/${userId}`,
      });
    }

    // Step 2: Update the permission
    const updateResponse = await fetch(`${session.apiUrl}/projects/${projectId}/users/${userId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${session.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ right: numericRight }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();

      throw new MCPError(ErrorCode.API_ERROR, `Failed to update user share: ${errorText}`, {
        statusCode: updateResponse.status,
        endpoint: `/projects/${projectId}/users/${userId}`,
      });
    }

    const result = (await updateResponse.json()) as { right: number };

    const standardResponse = createStandardResponse(
      'update-user-share',
      'User share permissions updated successfully',
      { right: result.right },
      { projectId, userId, right: numericRight },
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
    throw wrapToolError(error, 'vikunja_projects_user_sharing', 'update-user-share', projectId);
  }
}

/**
 * Remove a user share from a project
 */
export async function removeUserShare(
  args: RemoveUserShareArgs,
  authManager: AuthManager,
  sessionId?: string,
): Promise<McpResponse> {
  const { projectId, userId } = args;

  try {
    if (!projectId || projectId <= 0) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Project ID must be a positive integer');
    }
    if (!userId || userId <= 0) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'User ID must be a positive integer');
    }

    await getClientFromContext(sessionId);
    const session = authManager.getSession(sessionId);

    const response = await fetch(`${session.apiUrl}/projects/${projectId}/users/${userId}`, {
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
          `User share not found for user ${userId} on project ${projectId}`,
        );
      }

      throw new MCPError(ErrorCode.API_ERROR, `Failed to remove user share: ${errorText}`, {
        statusCode: response.status,
        endpoint: `/projects/${projectId}/users/${userId}`,
      });
    }

    const standardResponse = createStandardResponse(
      'remove-user-share',
      'User share removed successfully',
      { removed: true },
      { projectId, userId },
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
    throw wrapToolError(error, 'vikunja_projects_user_sharing', 'remove-user-share', projectId);
  }
}
