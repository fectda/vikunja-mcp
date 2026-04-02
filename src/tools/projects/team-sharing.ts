/**
 * Project Team Sharing Module
 * Handles team-based project sharing operations (different from link sharing)
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AuthManager } from '../../auth/AuthManager';
import type { VikunjaClientFactory } from '../../client/VikunjaClientFactory';
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
function normalizeRight(right: 'read' | 'write' | 'admin' | 0 | 1 | 2): number {
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
 */
async function shareTeam(args: ShareTeamArgs, authManager: AuthManager): Promise<McpResponse> {
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

    const response = await fetch(`${session.apiUrl}/projects/${projectId}/teams/${teamId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${session.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ right: numericRight }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      // Handle specific error codes
      if (response.status === 404) {
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

      if (response.status === 403) {
        throw new MCPError(
          ErrorCode.PERMISSION_DENIED,
          `You don't have permission to share project ${projectId}`,
        );
      }

      throw new MCPError(ErrorCode.API_ERROR, `Failed to share project with team: ${errorText}`, {
        statusCode: response.status,
        endpoint: `/projects/${projectId}/teams/${teamId}`,
      });
    }

    const result = (await response.json()) as { right: number; message?: string };

    const standardResponse = createStandardResponse(
      'share-team',
      `Project shared with team successfully`,
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
    throw wrapToolError(error, 'vikunja_projects_team_sharing', 'share-team', projectId);
  }
}

/**
 * List all team shares for a project
 */
async function listTeamShares(
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
async function getTeamShare(
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
 */
async function updateTeamShare(
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

    const response = await fetch(`${session.apiUrl}/projects/${projectId}/teams/${teamId}`, {
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
async function removeTeamShare(
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

/**
 * Register the team sharing tool with the MCP server
 */
export function registerProjectTeamSharingTool(
  server: McpServer,
  authManager: AuthManager,
  _clientFactory?: VikunjaClientFactory,
): void {
  server.tool(
    'vikunja_projects_team_sharing',
    'Manage team-based project sharing (share-team, list-team-shares, get-team-share, update-team-share, remove-team-share)',
    {
      subcommand: z.enum([
        'share-team',
        'list-team-shares',
        'get-team-share',
        'update-team-share',
        'remove-team-share',
      ]),
      projectId: z.number().positive().optional(),
      teamId: z.number().positive().optional(),
      right: z.union([z.enum(['read', 'write', 'admin']), z.number()]).optional(),
      page: z.number().min(1).optional(),
      perPage: z.number().min(1).max(100).optional(),
      verbosity: z.enum(['minimal', 'standard', 'detailed']).optional(),
      useOptimizedFormat: z.boolean().optional(),
      useAorp: z.boolean().optional(),
    },
    async (args) => {
      if (!authManager.isAuthenticated()) {
        throw new MCPError(
          ErrorCode.AUTH_REQUIRED,
          'Authentication required. Please use vikunja_auth.connect first.',
        );
      }

      try {
        const result = await (async (): Promise<McpResponse> => {
          switch (args.subcommand) {
            case 'share-team': {
              if (!args.projectId) {
                throw new MCPError(
                  ErrorCode.VALIDATION_ERROR,
                  'Project ID is required for share-team operation',
                );
              }
              if (!args.teamId) {
                throw new MCPError(
                  ErrorCode.VALIDATION_ERROR,
                  'Team ID is required for share-team operation',
                );
              }
              if (!args.right) {
                throw new MCPError(
                  ErrorCode.VALIDATION_ERROR,
                  'Permission right is required for share-team operation',
                );
              }
              return await shareTeam(
                {
                  projectId: args.projectId,
                  teamId: args.teamId,
                  right: args.right as 'read' | 'write' | 'admin' | 0 | 1 | 2,
                },
                authManager,
              );
            }

            case 'list-team-shares': {
              if (!args.projectId) {
                throw new MCPError(
                  ErrorCode.VALIDATION_ERROR,
                  'Project ID is required for list-team-shares operation',
                );
              }
              const listArgs: ListTeamSharesArgs = { projectId: args.projectId };
              if (args.page !== undefined) listArgs.page = args.page;
              if (args.perPage !== undefined) listArgs.perPage = args.perPage;
              return await listTeamShares(listArgs, authManager);
            }

            case 'get-team-share': {
              if (!args.projectId) {
                throw new MCPError(
                  ErrorCode.VALIDATION_ERROR,
                  'Project ID is required for get-team-share operation',
                );
              }
              if (!args.teamId) {
                throw new MCPError(
                  ErrorCode.VALIDATION_ERROR,
                  'Team ID is required for get-team-share operation',
                );
              }
              return await getTeamShare(
                {
                  projectId: args.projectId,
                  teamId: args.teamId,
                },
                authManager,
              );
            }

            case 'update-team-share': {
              if (!args.projectId) {
                throw new MCPError(
                  ErrorCode.VALIDATION_ERROR,
                  'Project ID is required for update-team-share operation',
                );
              }
              if (!args.teamId) {
                throw new MCPError(
                  ErrorCode.VALIDATION_ERROR,
                  'Team ID is required for update-team-share operation',
                );
              }
              if (!args.right) {
                throw new MCPError(
                  ErrorCode.VALIDATION_ERROR,
                  'Permission right is required for update-team-share operation',
                );
              }
              return await updateTeamShare(
                {
                  projectId: args.projectId,
                  teamId: args.teamId,
                  right: args.right as 'read' | 'write' | 'admin' | 0 | 1 | 2,
                },
                authManager,
              );
            }

            case 'remove-team-share': {
              if (!args.projectId) {
                throw new MCPError(
                  ErrorCode.VALIDATION_ERROR,
                  'Project ID is required for remove-team-share operation',
                );
              }
              if (!args.teamId) {
                throw new MCPError(
                  ErrorCode.VALIDATION_ERROR,
                  'Team ID is required for remove-team-share operation',
                );
              }
              return await removeTeamShare(
                {
                  projectId: args.projectId,
                  teamId: args.teamId,
                },
                authManager,
              );
            }

            default:
              throw new MCPError(
                ErrorCode.VALIDATION_ERROR,
                `Unknown subcommand: ${String(args.subcommand)}`,
              );
          }
        })();

        return result;
      } catch (error) {
        throw wrapToolError(
          error,
          'vikunja_projects_team_sharing',
          String(args.subcommand),
          args.projectId || args.teamId,
        );
      }
    },
  );
}
