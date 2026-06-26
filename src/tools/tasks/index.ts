/**
 * Tasks Tool
 * Handles task operations for Vikunja
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AuthManager } from '../../auth/AuthManager';
import type { VikunjaClientFactory } from '../../client/VikunjaClientFactory';
import { MCPError, ErrorCode } from '../../types';
import { getClientFromContext, setGlobalClientFactory } from '../../client';
import { logger } from '../../utils/logger';
import { storageManager } from '../../storage';
import { relationSchema, handleRelationSubcommands } from '../tasks-relations';
import { TaskFilteringOrchestrator } from './filtering';
import type { TaskListingArgs } from './types/filters';
import { createAuthRequiredError, handleFetchError } from '../../utils/error-handler';
import { formatAorpAsMarkdown } from '../../utils/response-factory';

// Import all operation handlers
import { createTask, getTask, updateTask, deleteTask, createTaskResponse } from './crud';
import { bulkCreateTasks, bulkUpdateTasks, bulkDeleteTasks } from './bulk-operations';
import { assignUsers, unassignUsers, listAssignees } from './assignees';
import { handleComment } from './comments';
import { addReminder, removeReminder, listReminders } from './reminders';
import { applyLabels, removeLabels, listTaskLabels } from './labels';

/**
 * Get session-scoped storage instance
 */
async function getSessionStorage(
  authManager: AuthManager,
  sessionId?: string,
): ReturnType<typeof storageManager.getStorage> {
  const session = authManager.getSession(sessionId);
  const storageKey = session.apiToken
    ? `${session.apiUrl}:${session.apiToken.substring(0, 8)}`
    : 'anonymous';
  return storageManager.getStorage(storageKey, session.userId, session.apiUrl);
}

/**
 * List tasks with optional filtering
 */
async function listTasks(
  args: TaskListingArgs,
  storage: Awaited<ReturnType<typeof storageManager.getStorage>>,
  sessionId?: string,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    // Execute the complete filtering workflow using the orchestrator
    const filteringResult = await TaskFilteringOrchestrator.executeTaskFiltering(
      args,
      storage,
      sessionId,
    );

    // Determine filtering method message
    let filteringMessage = '';
    if (args.filter) {
      if (filteringResult.metadata?.serverSideFilteringUsed) {
        filteringMessage = ' (filtered server-side)';
      } else if (filteringResult.metadata?.serverSideFilteringAttempted) {
        filteringMessage = ' (filtered client-side - server-side fallback)';
      } else {
        filteringMessage = ' (filtered client-side)';
      }
    }

    const taskCount = filteringResult.tasks?.length || 0;
    const response = createTaskResponse(
      'list-tasks',
      `Found ${taskCount} tasks${filteringMessage}`,
      { tasks: filteringResult.tasks || [] },
      {
        timestamp: new Date().toISOString(),
        count: taskCount,
        ...(filteringResult.metadata || {}),
      },
      undefined, // verbosity (ignored - using standard AORP)
      undefined, // useOptimizedFormat (ignored - using standard AORP)
      undefined, // useAorp (ignored - always using AORP)
      undefined, // aorpConfig (using auto-generated)
      args.sessionId,
    );

    logger.debug('Tasks tool response', { subcommand: 'list', itemCount: taskCount });

    return {
      content: [
        {
          type: 'text' as const,
          text: formatAorpAsMarkdown(response.response),
        },
      ],
    };
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }

    // Log the full error for debugging filter issues
    logger.error('Task list error:', {
      error: error instanceof Error ? error.message : String(error),
      filter: args.filter,
      filterId: args.filterId,
    });

    throw handleFetchError(error, 'list tasks');
  }
}

/**
 * Handle file attachments
 * Accepts base64-encoded file content or URL and uploads to Vikunja
 */
async function handleAttach(
  args: {
    id: number;
    fileContent?: string; // base64 encoded file
    fileName?: string;
    fileUrl?: string; // alternative: URL to download file from
  },
  authManager: AuthManager,
  sessionId?: string,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { id, fileContent, fileName, fileUrl } = args;

  if (!id) {
    throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Task ID is required for attachment');
  }

  if (!fileContent && !fileUrl) {
    throw new MCPError(
      ErrorCode.VALIDATION_ERROR,
      'Either fileContent (base64) or fileUrl is required',
    );
  }

  const session = authManager.getSession(sessionId);

  let fileData: ArrayBuffer | null = null;
  let finalFileName = fileName || 'attachment';

  if (fileContent) {
    // Decode base64 to binary
    try {
      // Remove data URL prefix if present
      const base64Data = fileContent.replace(/^data:[^;]+;base64,/, '');
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      fileData = bytes.buffer;
    } catch {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Invalid base64 file content');
    }
  } else if (fileUrl) {
    // Download file from URL
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error('Failed to download file');
      }
      fileData = await response.arrayBuffer();

      // Extract filename from URL if not provided
      if (!fileName && fileUrl) {
        const urlParts = fileUrl.split('/');
        const lastPart = urlParts[urlParts.length - 1];
        finalFileName = lastPart?.split('?')[0] || 'attachment';
      }
    } catch {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Failed to download file from URL');
    }
  }

  if (!fileData) {
    throw new MCPError(ErrorCode.VALIDATION_ERROR, 'No file data available');
  }

  // Create FormData with the file
  const formData = new FormData();
  const blob = new Blob([fileData]);
  formData.append('file', blob, finalFileName);

  // Upload to Vikunja
  const response = await fetch(`${session.apiUrl}/tasks/${id}/attachments`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${session.apiToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 404) {
      throw new MCPError(ErrorCode.NOT_FOUND, `Task with ID ${id} not found`);
    }
    throw new MCPError(ErrorCode.API_ERROR, `Failed to upload attachment: ${errorText}`);
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: `Attachment "${finalFileName}" uploaded successfully to task ${id}`,
      },
    ],
  };
}

export function registerTasksTool(
  server: McpServer,
  authManager: AuthManager,
  clientFactory?: VikunjaClientFactory,
): void {
  server.tool(
    'vikunja_tasks',
    'THE task management tool: create, get, update, delete, list, assign/unassign users, add/list/remove labels, add/list/remove comments, add/list/remove reminders, relate/unrelate tasks, attach files, and bulk operations. Use for ALL task operations. This is the ONLY task tool you need. Note: id is required for get, update, delete, assign, unassign, comment, relate, unrelate, add-reminder, remove-reminder, list-assignees, list-reminders, list-labels, apply-label, and remove-label subcommands.',
    {
      subcommand: z.enum([
        'create',
        'get',
        'update',
        'delete',
        'list',
        'assign',
        'unassign',
        'list-assignees',
        'attach',
        'comment',
        'bulk-create',
        'bulk-update',
        'bulk-delete',
        'relate',
        'unrelate',
        'relations',
        'add-reminder',
        'remove-reminder',
        'list-reminders',
        'apply-label',
        'remove-label',
        'list-labels',
      ]),
      // Task creation/update fields
      title: z.string().optional(),
      description: z.string().optional(),
      projectId: z.number().optional(), // Also allows moving task to different project
      dueDate: z.string().optional(),
      priority: z.number().min(0).max(5).optional(),
      labels: z.array(z.number()).optional(),
      assignees: z.array(z.number()).optional(),
      // NEW: Additional task fields from Vikunja API
      percentDone: z.number().min(0).max(100).optional(), // % complete (0-100)
      startDate: z.string().optional(), // task start date
      endDate: z.string().optional(), // task end date
      hexColor: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(), // task color
      // Recurring task fields
      repeatAfter: z.number().min(0).optional(),
      repeatMode: z.enum(['day', 'week', 'month', 'year']).optional(),
      // Query fields
      id: z.number().optional(),
      filter: z.string().optional(),
      filterId: z.string().optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
      sort: z.string().optional(),
      search: z.string().optional(),
      // List specific filters
      allProjects: z.boolean().optional(),
      done: z.boolean().optional(),
      // Comment fields
      comment: z.string().optional(),
      commentId: z.number().optional(),
      // Bulk operation fields
      taskIds: z.array(z.number()).optional(),
      field: z.string().optional(),
      value: z.unknown().optional(),
      tasks: z
        .array(
          z.object({
            title: z.string(),
            description: z.string().optional(),
            dueDate: z.string().optional(),
            priority: z.number().min(0).max(5).optional(),
            labels: z.array(z.number()).optional(),
            assignees: z.array(z.number()).optional(),
            percentDone: z.number().min(0).max(100).optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
            hexColor: z
              .string()
              .regex(/^#[0-9A-Fa-f]{6}$/)
              .optional(),
            repeatAfter: z.number().min(0).optional(),
            repeatMode: z.enum(['day', 'week', 'month', 'year']).optional(),
          }),
        )
        .optional(),
      // Reminder fields
      reminderDate: z.string().optional(),
      reminderId: z.number().optional(),
      // Attachment fields (NEW)
      fileContent: z.string().optional(), // base64 encoded file content
      fileName: z.string().optional(), // original filename
      fileUrl: z.string().optional(), // URL to download file from
      // Add relation schema
      ...relationSchema,
      // Session ID for AORP response tracking
      sessionId: z.string().optional(),
    },
    async (args, extra?: { sessionId?: string }) => {
      const sessionId = extra?.sessionId;
      try {
        logger.debug('Executing tasks tool', { subcommand: args.subcommand, args });

        // Check authentication with enhanced error message
        if (!authManager.isAuthenticated(sessionId)) {
          throw createAuthRequiredError('access task management features');
        }

        // Set the client factory for this request if provided
        if (clientFactory) {
          await setGlobalClientFactory(clientFactory);
        }

        // Test client connection
        await getClientFromContext(sessionId);

        switch (args.subcommand) {
          case 'list': {
            // Get session-scoped storage for filter operations (only when needed)
            const storage = await getSessionStorage(authManager, sessionId);
            return listTasks(args as Parameters<typeof listTasks>[0], storage, sessionId);
          }

          case 'create':
            return createTask({ ...args, sessionId } as Parameters<typeof createTask>[0]);

          case 'get':
            return getTask({ ...args, sessionId } as Parameters<typeof getTask>[0]);

          case 'update':
            return updateTask({ ...args, sessionId } as Parameters<typeof updateTask>[0]);

          case 'delete':
            return deleteTask({ ...args, sessionId } as Parameters<typeof deleteTask>[0]);

          case 'assign':
            return assignUsers(args as Parameters<typeof assignUsers>[0], sessionId);

          case 'unassign':
            return unassignUsers(args as Parameters<typeof unassignUsers>[0], sessionId);

          case 'list-assignees':
            return listAssignees(args as Parameters<typeof listAssignees>[0], sessionId);

          case 'comment':
            return handleComment(args as Parameters<typeof handleComment>[0], sessionId);

          case 'attach':
            return handleAttach(
              args as {
                id: number;
                fileContent?: string;
                fileName?: string;
                fileUrl?: string;
              },
              authManager,
              sessionId,
            );

          case 'bulk-update':
            return bulkUpdateTasks(args as Parameters<typeof bulkUpdateTasks>[0], sessionId);

          case 'bulk-delete':
            return bulkDeleteTasks(args as Parameters<typeof bulkDeleteTasks>[0], sessionId);

          case 'bulk-create':
            return bulkCreateTasks(args as Parameters<typeof bulkCreateTasks>[0], sessionId);

          // Handle relation subcommands
          case 'relate':
          case 'unrelate':
          case 'relations':
            return handleRelationSubcommands(
              {
                subcommand: args.subcommand,
                id: args.id,
                otherTaskId: args.otherTaskId,
                relationKind: args.relationKind,
              },
              sessionId,
            );

          // Handle reminder operations
          case 'add-reminder':
            return addReminder(args as Parameters<typeof addReminder>[0], sessionId);

          case 'remove-reminder':
            return removeReminder(args as Parameters<typeof removeReminder>[0], sessionId);

          case 'list-reminders':
            return listReminders(args as Parameters<typeof listReminders>[0], sessionId);
          case 'apply-label':
            return applyLabels(args as Parameters<typeof applyLabels>[0], sessionId);

          case 'remove-label':
            return removeLabels(args as Parameters<typeof removeLabels>[0], sessionId);

          case 'list-labels':
            return listTaskLabels(args as Parameters<typeof listTaskLabels>[0], sessionId);

          default:
            throw new MCPError(
              ErrorCode.VALIDATION_ERROR,
              `Unknown subcommand: ${args.subcommand as string}`,
            );
        }
      } catch (error) {
        if (error instanceof MCPError) {
          throw error;
        }
        throw new MCPError(
          ErrorCode.INTERNAL_ERROR,
          `Task operation error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );
}
