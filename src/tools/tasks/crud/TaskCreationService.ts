/**
 * Task Creation Service
 * Handles task creation with label/assignee management and rollback logic
 */

import { MCPError, ErrorCode } from '../../../types';
import { getClientFromContext } from '../../../client';
import type { Task, VikunjaClient } from 'node-vikunja';
import { logger } from '../../../utils/logger';
import { isAuthenticationError } from '../../../utils/auth-error-handler';
import { withRetry, RETRY_CONFIG } from '../../../utils/retry';
import { transformApiError, handleFetchError } from '../../../utils/error-handler';
import { sanitizeString } from '../../../utils/validation';
import { AUTH_ERROR_MESSAGES } from '../constants';
import { validateDateString, validateId, convertRepeatConfiguration } from '../validation';
import { createTaskResponse } from './TaskResponseFormatter';
import { formatAorpAsMarkdown } from '../../../utils/response-factory';

export interface CreateTaskArgs {
  projectId?: number;
  title?: string;
  description?: string;
  dueDate?: string;
  priority?: number;
  labels?: number[];
  assignees?: number[];
  percentDone?: number;
  startDate?: string;
  endDate?: string;
  hexColor?: string;
  repeatAfter?: number;
  repeatMode?: 'day' | 'week' | 'month' | 'year';
  // Session ID for AORP response tracking
  sessionId?: string;
}

/**
 * Internal interface for tracking creation state during rollback scenarios
 */
interface CreationState {
  createdTask: Task;
  labelsAdded: boolean;
  assigneesAdded: boolean;
}

/**
 * Creates a new task with comprehensive error handling and rollback support
 */
export async function createTask(
  args: CreateTaskArgs,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    // Validate required fields
    if (!args.projectId) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'projectId is required to create a task');
    }
    validateId(args.projectId, 'projectId');

    if (!args.title) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'title is required to create a task');
    }

    // Sanitize and validate user inputs for comprehensive security
    const sanitizedTitle = sanitizeString(args.title);
    // Preserve empty strings as they are valid descriptions
    const sanitizedDescription =
      args.description !== undefined ? sanitizeString(args.description) : undefined;

    // Validate optional date fields
    if (args.dueDate) {
      validateDateString(args.dueDate, 'dueDate');
    }

    // Validate assignee IDs upfront with enhanced validation
    if (args.assignees && args.assignees.length > 0) {
      logger.debug('Assignee IDs received', { assignees: args.assignees });

      // Enhanced validation: ensure all assignees are valid positive integers
      for (let i = 0; i < args.assignees.length; i++) {
        const assigneeId = args.assignees[i];

        // Check if it's a number
        if (typeof assigneeId !== 'number' || !Number.isInteger(assigneeId) || assigneeId <= 0) {
          logger.error('Invalid assignee ID', {
            index: i,
            value: assigneeId,
            type: typeof assigneeId,
          });
          throw new MCPError(
            ErrorCode.VALIDATION_ERROR,
            `Invalid assignee at position ${i}: must be a positive integer ID, got ${typeof assigneeId === 'number' ? assigneeId : typeof assigneeId} "${assigneeId}". Assignees must be numeric user IDs, not usernames.`,
          );
        }
      }
    }

    const client = await getClientFromContext();

    // Build the initial task object with sanitized values
    const newTask: Task = {
      title: sanitizedTitle,
      project_id: args.projectId,
    };

    // Add optional fields with sanitized values
    if (sanitizedDescription !== undefined) newTask.description = sanitizedDescription;
    if (args.dueDate !== undefined) newTask.due_date = args.dueDate;
    if (args.priority !== undefined) newTask.priority = args.priority;
    if (args.percentDone !== undefined) newTask.percent_done = args.percentDone;
    if (args.startDate !== undefined) newTask.start_date = args.startDate;
    if (args.endDate !== undefined) newTask.end_date = args.endDate;
    if (args.hexColor !== undefined) newTask.hex_color = args.hexColor.replace(/^#/, '');

    // Handle repeat configuration
    if (args.repeatAfter !== undefined || args.repeatMode !== undefined) {
      const repeatConfig = convertRepeatConfiguration(args.repeatAfter, args.repeatMode);
      if (repeatConfig.repeat_after !== undefined) newTask.repeat_after = repeatConfig.repeat_after;
      if (repeatConfig.repeat_mode !== undefined) {
        // Use index signature to bypass type mismatch - API expects number but node-vikunja types expect string
        (newTask as Record<string, unknown>).repeat_mode = repeatConfig.repeat_mode;
      }
    }

    // Create the base task
    const createdTask = await client.tasks.createTask(args.projectId, newTask);

    // Track creation state for potential rollback
    const creationState: CreationState = {
      createdTask,
      labelsAdded: false,
      assigneesAdded: false,
    };

    try {
      // Add labels if provided
      if (args.labels && args.labels.length > 0 && createdTask.id) {
        await addLabelsToTask(client, createdTask.id, args.labels);
        creationState.labelsAdded = true;
      }

      // Add assignees if provided
      if (args.assignees && args.assignees.length > 0 && createdTask.id) {
        await addAssigneesToTask(client, createdTask.id, args.assignees);
        creationState.assigneesAdded = true;
      }
    } catch (updateError) {
      // Attempt to clean up the partially created task
      await rollbackTaskCreation(client, creationState, updateError);
      // The rollback function will re-throw the original error with context
    }

    // Fetch the complete task with labels and assignees
    const completeTask = createdTask.id ? await client.tasks.getTask(createdTask.id) : createdTask;

    const response = createTaskResponse(
      'create-task',
      'Task created successfully',
      { task: completeTask },
      {
        timestamp: new Date().toISOString(),
        projectId: args.projectId,
        labelsAdded: args.labels ? args.labels.length > 0 : false,
        assigneesAdded: args.assignees ? args.assignees.length > 0 : false,
      },
      undefined, // verbosity (ignored - using standard AORP)
      undefined, // useOptimizedFormat (ignored - using standard AORP)
      undefined, // useAorp (ignored - always using AORP)
      undefined, // aorpConfig (using auto-generated)
      args.sessionId,
    );

    logger.debug('Tasks tool response', {
      subcommand: 'create',
      taskId: completeTask.id,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: formatAorpAsMarkdown(response.response),
        },
      ],
    };
  } catch (error) {
    // Re-throw MCPError instances without modification
    if (error instanceof MCPError) {
      throw error;
    }

    // Handle fetch/connection errors with helpful guidance
    if (
      error instanceof Error &&
      (error.message.includes('fetch failed') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND'))
    ) {
      throw handleFetchError(error, 'create task');
    }

    // Use standardized error transformation for all other errors
    throw transformApiError(error, 'Failed to create task');
  }
}

/**
 * Adds labels to a task with retry logic for authentication errors
 */
async function addLabelsToTask(
  client: VikunjaClient,
  taskId: number,
  labelIds: number[],
): Promise<void> {
  try {
    await withRetry(
      () =>
        client.tasks.updateTaskLabels(taskId, {
          label_ids: labelIds,
        }),
      {
        ...RETRY_CONFIG.AUTH_ERRORS,
        shouldRetry: (error) => isAuthenticationError(error),
      },
    );
  } catch (labelError) {
    // Check if it's an auth error after retries
    if (isAuthenticationError(labelError)) {
      throw new MCPError(
        ErrorCode.API_ERROR,
        `${AUTH_ERROR_MESSAGES.LABEL_CREATE} (Retried ${RETRY_CONFIG.AUTH_ERRORS.maxRetries} times). Task ID: ${taskId}`,
      );
    }
    throw labelError;
  }
}

/**
 * Adds assignees to a task with retry logic for authentication errors
 * Uses single assign endpoint as bulk assign (POST /bulk) doesn't work in Vikunja
 */
async function addAssigneesToTask(
  client: VikunjaClient,
  taskId: number,
  assigneeIds: number[],
): Promise<void> {
  try {
    // Debug log what we're sending to the API
    logger.debug('Calling assignUserToTask for each user', {
      taskId,
      user_ids: assigneeIds,
    });

    // Assign each user individually (bulk endpoint doesn't work in Vikunja)
    for (const userId of assigneeIds) {
      try {
        await withRetry(() => client.tasks.assignUserToTask(taskId, userId), {
          ...RETRY_CONFIG.AUTH_ERRORS,
          shouldRetry: (error) => isAuthenticationError(error),
        });
      } catch (userError) {
        // Check for specific Vikunja error codes
        const errorObj = userError as { code?: number; message?: string };

        if (errorObj.code === 7003) {
          // User does not have access to the project
          throw new MCPError(
            ErrorCode.PERMISSION_DENIED,
            `Cannot assign user ${userId} to task: This user does not have access to the project. ` +
              `Share the project with the user first before assigning them to tasks.`,
          );
        }

        if (errorObj.code === 1005) {
          // User does not exist
          throw new MCPError(
            ErrorCode.NOT_FOUND,
            `Cannot assign user ${userId} to task: User does not exist.`,
          );
        }

        // Log other errors for debugging
        logger.error('Failed to assign user to task', {
          taskId,
          userId,
          error: userError instanceof Error ? userError.message : String(userError),
          errorCode: errorObj.code,
        });
        throw userError;
      }
    }
  } catch (assigneeError) {
    // Check if it's an auth error after retries
    if (isAuthenticationError(assigneeError)) {
      throw new MCPError(
        ErrorCode.API_ERROR,
        `Assignee operation failed due to authentication issue. Task ID: ${taskId}. ` +
          `Please verify your API token has permission to assign users.`,
      );
    }
    throw assigneeError;
  }
}

/**
 * Attempts to roll back a partially created task and throws enhanced error context
 */
async function rollbackTaskCreation(
  client: VikunjaClient,
  creationState: CreationState,
  originalError: unknown,
): Promise<never> {
  // Attempt to clean up the partially created task
  let rollbackSucceeded = false;
  if (creationState.createdTask.id) {
    try {
      await client.tasks.deleteTask(creationState.createdTask.id);
      rollbackSucceeded = true;
    } catch (deleteError) {
      // Log the cleanup failure but throw the original error
      logger.error('Failed to clean up partially created task:', deleteError);
    }
  }

  // Re-throw the original error with context
  const errorMessage = `Failed to complete task creation: ${originalError instanceof Error ? originalError.message : String(originalError)}. ${
    rollbackSucceeded
      ? 'Task was successfully rolled back.'
      : 'Task rollback also failed - manual cleanup may be required.'
  }`;

  throw new MCPError(ErrorCode.API_ERROR, errorMessage, {
    vikunjaError: {
      taskId: creationState.createdTask.id,
      partiallyCreated: true,
      labelsAdded: creationState.labelsAdded,
      assigneesAdded: creationState.assigneesAdded,
      rollbackSucceeded,
    },
  });
}
