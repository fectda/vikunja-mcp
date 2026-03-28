/**
 * Assignee operations for tasks
 * Refactored to use modular service architecture
 */

import { MCPError, ErrorCode } from '../../../types';
import { AssigneeOperationsService } from './AssigneeOperationsService';
import { AssigneeValidationService } from './AssigneeValidationService';
import { AssigneeResponseFormatter } from './AssigneeResponseFormatter';
import { isAuthenticationError } from '../../../utils/auth-error-handler';
import { logger } from '../../../utils/logger';

/**
 * Assign users to a task
 */
export async function assignUsers(args: {
  id?: number;
  assignees?: number[];
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    const { taskId, assigneeIds } = AssigneeValidationService.validateAssignInput(args);

    // Perform the assignment operation
    await AssigneeOperationsService.assignUsersToTask(taskId, assigneeIds);

    // Fetch updated task data
    const task = await AssigneeOperationsService.fetchTaskWithAssignees(taskId);

    // Format and return response
    const response = AssigneeResponseFormatter.formatAssignResponse(task);
    return AssigneeResponseFormatter.formatMcpResponse(response);
  } catch (error) {
    // Preserve MCPError to keep specific error messages
    if (error instanceof MCPError) {
      throw error;
    }

    // Check if it's an authentication error - provide specific guidance
    if (isAuthenticationError(error)) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('Assign operation failed with auth error: %s', errorMessage);

      throw new MCPError(
        ErrorCode.PERMISSION_DENIED,
        'Assignment failed: API tokens (tk_*) do not support assignee operations in Vikunja.\n\n' +
          'Solutions (choose one):\n' +
          '1. Enable auto-login JWT: Set VIKUNJA_USER and VIKUNJA_PASSWORD in .env\n' +
          '2. Use JWT token directly: Connect with a JWT token starting with "eyJ"\n' +
          '3. Login via MCP: Use vikunja_auth.login({ apiUrl, username, password })\n\n' +
          `Original error: ${errorMessage}`,
      );
    }

    throw new MCPError(
      ErrorCode.API_ERROR,
      `Failed to assign users to task: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Unassign users from a task
 */
export async function unassignUsers(args: {
  id?: number;
  assignees?: number[];
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    const { taskId, userIds } = AssigneeValidationService.validateUnassignInput(args);

    // Perform the unassignment operation
    await AssigneeOperationsService.removeUsersFromTask(taskId, userIds);

    // Fetch updated task data
    const task = await AssigneeOperationsService.fetchTaskWithAssignees(taskId);

    // Format and return response
    const response = AssigneeResponseFormatter.formatUnassignResponse(task);
    return AssigneeResponseFormatter.formatMcpResponse(response);
  } catch (error) {
    // Preserve MCPError to keep specific error messages
    if (error instanceof MCPError) {
      throw error;
    }

    // Check if it's an authentication error - provide specific guidance
    if (isAuthenticationError(error)) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('Unassign operation failed with auth error: %s', errorMessage);

      throw new MCPError(
        ErrorCode.PERMISSION_DENIED,
        'Unassignment failed: API tokens (tk_*) do not support assignee operations in Vikunja.\n\n' +
          'Solutions (choose one):\n' +
          '1. Enable auto-login JWT: Set VIKUNJA_USER and VIKUNJA_PASSWORD in .env\n' +
          '2. Use JWT token directly: Connect with a JWT token starting with "eyJ"\n' +
          '3. Login via MCP: Use vikunja_auth.login({ apiUrl, username, password })\n\n' +
          `Original error: ${errorMessage}`,
      );
    }

    throw new MCPError(
      ErrorCode.API_ERROR,
      `Failed to remove users from task: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * List assignees of a task
 */
export async function listAssignees(args: {
  id?: number;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    const { taskId } = AssigneeValidationService.validateListInput(args);

    // Fetch task data
    const task = await AssigneeOperationsService.fetchTaskWithAssignees(taskId);

    // Create minimal task representation with assignees
    const minimalTask = AssigneeOperationsService.createMinimalTaskWithAssignees(task);
    const assigneeCount = AssigneeOperationsService.extractAssignees(task).length;

    // Format and return response
    const response = AssigneeResponseFormatter.formatListAssigneesResponse(
      minimalTask,
      assigneeCount,
    );
    return AssigneeResponseFormatter.formatMcpResponse(response);
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw new MCPError(
      ErrorCode.API_ERROR,
      `Failed to list task assignees: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
