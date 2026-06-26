/**
 * Assignee operations service
 * Handles core business logic for task assignee management
 */

import type { MinimalTask, TaskWithAssignees, Assignee } from '../../../types';
import { MCPError, ErrorCode } from '../../../types';
import { getClientFromContext } from '../../../client';
import { isAuthenticationError } from '../../../utils/auth-error-handler';
import { withRetry, RETRY_CONFIG } from '../../../utils/retry';
import { AUTH_ERROR_MESSAGES } from '../constants';

/**
 * Service for managing task assignee operations
 */
export const AssigneeOperationsService = {
  /**
   * Assign multiple users to a task using individual API calls.
   * Individual calls work reliably with JWT auth, unlike the bulk endpoint.
   * The bulk endpoint (`bulkAssignUsersToTask`) doesn't persist with JWT.
   */
  async assignUsersToTask(
    taskId: number,
    assigneeIds: number[],
    sessionId?: string,
  ): Promise<void> {
    const client = await getClientFromContext(sessionId);

    // Use individual assignUserToTask calls instead of bulk endpoint
    // The bulk endpoint doesn't persist with JWT - this is a known Vikunja issue
    for (const userId of assigneeIds) {
      try {
        await withRetry(() => client.tasks.assignUserToTask(taskId, userId), {
          ...RETRY_CONFIG.AUTH_ERRORS,
          shouldRetry: (error) => isAuthenticationError(error),
        });
      } catch (assigneeError) {
        // Check for specific Vikunja error codes
        const errorObj = assigneeError as { code?: number; message?: string };

        if (errorObj.code === 7003) {
          throw new MCPError(
            ErrorCode.PERMISSION_DENIED,
            `Cannot assign user ${userId}: User does not have access to the project.`,
          );
        }

        if (errorObj.code === 1005) {
          throw new MCPError(
            ErrorCode.NOT_FOUND,
            `Cannot assign user ${userId}: User does not exist.`,
          );
        }

        // Check if it's an auth error after retries
        if (isAuthenticationError(assigneeError)) {
          throw new MCPError(
            ErrorCode.API_ERROR,
            `Assignee operation failed due to authentication issue. Task ID: ${taskId}, User ID: ${userId}. ` +
              `Please verify your API token has permission to assign users.`,
          );
        }
        throw assigneeError;
      }
    }
  },

  /**
   * Remove multiple users from a task
   */
  async removeUsersFromTask(taskId: number, userIds: number[], sessionId?: string): Promise<void> {
    const client = await getClientFromContext(sessionId);

    // Remove users from the task with retry logic
    for (const userId of userIds) {
      try {
        await withRetry(() => client.tasks.removeUserFromTask(taskId, userId), {
          ...RETRY_CONFIG.AUTH_ERRORS,
          shouldRetry: (error) => isAuthenticationError(error),
        });
      } catch (removeError) {
        // Check if it's an auth error after retries
        if (isAuthenticationError(removeError)) {
          throw new MCPError(
            ErrorCode.API_ERROR,
            `${AUTH_ERROR_MESSAGES.ASSIGNEE_REMOVE} (Retried ${RETRY_CONFIG.AUTH_ERRORS.maxRetries} times)`,
          );
        }
        throw removeError;
      }
    }
  },

  /**
   * Fetch task data to get current assignees
   */
  async fetchTaskWithAssignees(taskId: number, sessionId?: string): Promise<TaskWithAssignees> {
    const client = await getClientFromContext(sessionId);
    const task = await client.tasks.getTask(taskId);
    // Ensure required properties exist for TaskWithAssignees
    if (!task.id) {
      throw new MCPError(
        ErrorCode.INTERNAL_ERROR,
        'Task returned from API is missing required id field',
      );
    }
    return {
      ...task,
      id: task.id,
      title: task.title || '',
      assignees: task.assignees || [],
    };
  },

  /**
   * Extract assignee information from task
   */
  extractAssignees(task: TaskWithAssignees): Assignee[] {
    return task.assignees || [];
  },

  /**
   * Create minimal task representation with assignees
   */
  createMinimalTaskWithAssignees(task: TaskWithAssignees): MinimalTask {
    const assignees = AssigneeOperationsService.extractAssignees(task);

    return {
      ...(task.id !== undefined && { id: task.id }),
      title: task.title,
      assignees: assignees,
    };
  },
};
