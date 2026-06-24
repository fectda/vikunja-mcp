/**
 * TDD Tests for src/tools/tasks/bulk - Phase 1
 * Tests for BulkOperationProcessor and BulkOperationValidator
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock barrel module to prevent full MCP server initialization
// Keep pure functions real; mock only side-effect modules
const _respFactory = jest.requireActual('../../../../src/utils/response-factory');
const _mockGetClientFromContext = jest.fn();

jest.mock('../../../../src/client', () => ({
  getClientFromContext: _mockGetClientFromContext,
}));

jest.mock('../../../../src/index', () => ({
  MCPError: class MCPError extends Error {
    code: string;
    details: unknown;
    constructor(code: string, message: string, details?: unknown) {
      super(message);
      this.code = code;
      this.details = details;
      this.name = 'MCPError';
    }
  },
  ErrorCode: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    API_ERROR: 'API_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    AUTH_FAILED: 'AUTH_FAILED',
    NETWORK_ERROR: 'NETWORK_ERROR',
    NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    REQUEST_TOO_LARGE: 'REQUEST_TOO_LARGE',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  },
  createStandardResponse: _respFactory.createStandardResponse,
  getClientFromContext: _mockGetClientFromContext,
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  isAuthenticationError: jest.fn(() => false),
  RETRY_CONFIG: { AUTH_ERRORS: { maxRetries: 3, initialDelay: 100, maxDelay: 1000 } },
  transformApiError: jest.fn((err: Error) => err),
  handleFetchError: jest.fn((err: Error) => err),
}));

jest.mock('../../../../src/utils/retry', () => ({
  withRetry: jest.fn((fn: () => unknown) => fn()),
  RETRY_CONFIG: { AUTH_ERRORS: { maxRetries: 3, initialDelay: 100, maxDelay: 1000 } },
}));

import { BulkOperationProcessor } from '../../../../src/tools/tasks/bulk/BulkOperationProcessor';
import {
  BulkOperationValidator,
  BulkOperationErrorHandler,
  BatchProcessorFactory,
} from '../../../../src/tools/tasks/bulk';
import { MCPError, ErrorCode } from '../../../../src/types';

describe('BulkOperationProcessor - Phase 1 Coverage Tests', () => {
  describe('bulkUpdateTasks - input validation throws', () => {
    // 1.1: BulkOperationProcessor.bulkUpdateTasks validates empty taskIds input (R1.1)
    it('should throw when taskIds is empty', async () => {
      await expect(
        BulkOperationProcessor.bulkUpdateTasks({ taskIds: [], field: 'done', value: true }),
      ).rejects.toThrow('taskIds array is required');
    });

    // 1.2: BulkOperationProcessor.bulkUpdateTasks validates missing field (R1.2)
    it('should throw when field is missing', async () => {
      await expect(
        BulkOperationProcessor.bulkUpdateTasks({ taskIds: [1], value: true }),
      ).rejects.toThrow('field is required for bulk update operation');
    });
  });

  describe('bulkDeleteTasks - input validation', () => {
    // 1.3: BulkOperationProcessor.bulkDeleteTasks handles empty taskIds (R1.3)
    it('should throw when taskIds is empty', async () => {
      await expect(BulkOperationProcessor.bulkDeleteTasks({ taskIds: [] })).rejects.toThrow(
        'taskIds array is required',
      );
    });
  });

  describe('bulkCreateTasks - input validation', () => {
    // 1.4: BulkOperationProcessor.bulkCreateTasks handles empty tasks (R1.4)
    it('should throw when tasks array is empty', async () => {
      await expect(
        BulkOperationProcessor.bulkCreateTasks({ projectId: 1, tasks: [] }),
      ).rejects.toThrow('tasks array is required');
    });
  });

  describe('isValidTask - type guard', () => {
    it('should return false for null', () => {
      expect(BulkOperationProcessor.isValidTask(null)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(BulkOperationProcessor.isValidTask('string')).toBe(false);
    });

    it('should return false for object missing required fields', () => {
      expect(BulkOperationProcessor.isValidTask({ id: 1 })).toBe(false);
    });

    it('should return true for valid task object', () => {
      expect(BulkOperationProcessor.isValidTask({ project_id: 1, title: 'Test' })).toBe(true);
    });

    it('should return false when project_id is not a number', () => {
      expect(BulkOperationProcessor.isValidTask({ project_id: 'abc', title: 'Test' })).toBe(false);
    });

    it('should return false when title is not a string', () => {
      expect(BulkOperationProcessor.isValidTask({ project_id: 1, title: 123 })).toBe(false);
    });
  });

  describe('verifyTaskFieldValue', () => {
    it('should verify priority field matches', () => {
      expect(
        BulkOperationProcessor.verifyTaskFieldValue({ id: 1, priority: 3 } as any, 'priority', 3),
      ).toBe(true);
    });

    it('should verify done field matches', () => {
      expect(
        BulkOperationProcessor.verifyTaskFieldValue({ id: 1, done: true } as any, 'done', true),
      ).toBe(true);
    });

    it('should verify due_date field matches', () => {
      expect(
        BulkOperationProcessor.verifyTaskFieldValue(
          { id: 1, due_date: '2024-01-01' } as any,
          'due_date',
          '2024-01-01',
        ),
      ).toBe(true);
    });

    it('should verify project_id field matches', () => {
      expect(
        BulkOperationProcessor.verifyTaskFieldValue(
          { id: 1, project_id: 5 } as any,
          'project_id',
          5,
        ),
      ).toBe(true);
    });

    it('should return true for complex fields (default)', () => {
      expect(
        BulkOperationProcessor.verifyTaskFieldValue(
          { id: 1, description: 'x' } as any,
          'description',
          undefined,
        ),
      ).toBe(true);
    });

    it('should detect mismatched priority', () => {
      expect(
        BulkOperationProcessor.verifyTaskFieldValue({ id: 1, priority: 1 } as any, 'priority', 3),
      ).toBe(false);
    });
  });

  describe('processBulkUpdateResult', () => {
    it('should handle empty array result', () => {
      const result = BulkOperationProcessor.processBulkUpdateResult(
        { taskIds: [1], field: 'done', value: true },
        [],
      );
      expect(result.updatedTasks).toHaveLength(0);
      expect(result.bulkUpdateSuccessful).toBe(false);
    });

    it('should handle message response', () => {
      const result = BulkOperationProcessor.processBulkUpdateResult(
        { taskIds: [1], field: 'done', value: true },
        { message: 'Tasks updated' },
      );
      expect(result.bulkUpdateSuccessful).toBe(true);
    });

    it('should mark invalid task objects as failure', () => {
      const result = BulkOperationProcessor.processBulkUpdateResult(
        { taskIds: [1], field: 'done', value: true },
        [{ notValid: true }],
      );
      expect(result.bulkUpdateSuccessful).toBe(false);
    });

    it('should mark unchanged field values as failure', () => {
      // Returned task still has done:false but we asked for done:true
      const result = BulkOperationProcessor.processBulkUpdateResult(
        { taskIds: [1], field: 'done', value: true },
        [{ id: 1, project_id: 1, title: 'Test', done: false }],
      );
      expect(result.bulkUpdateSuccessful).toBe(false);
    });
  });

  describe('processDeleteResults', () => {
    it('should throw error when all deletes fail', () => {
      expect(() =>
        BulkOperationProcessor.processDeleteResults(
          [1, 2],
          {
            successful: [],
            failed: [
              { originalItem: 1, error: new Error('Failed'), index: 0 },
              { originalItem: 2, error: new Error('Failed'), index: 1 },
            ],
            metrics: {
              totalDuration: 0,
              successfulOperations: 0,
              failedOperations: 2,
              operationsPerSecond: 0,
            },
          },
          [],
        ),
      ).toThrow('Bulk delete failed. Could not delete any tasks');
    });
  });

  describe('processCreateResults', () => {
    it('should throw error when all creates fail', () => {
      expect(() =>
        BulkOperationProcessor.processCreateResults({
          successful: [],
          failed: [{ originalItem: 0, error: new Error('Create failed'), index: 0 }],
          metrics: {
            totalDuration: 0,
            successfulOperations: 0,
            failedOperations: 1,
            operationsPerSecond: 0,
          },
        }),
      ).toThrow('Bulk create failed. Could not create any tasks');
    });

    it('should return partial success response', () => {
      const result = BulkOperationProcessor.processCreateResults({
        successful: [{ id: 1, title: 'Task 1', project_id: 1 } as any],
        failed: [{ originalItem: 1, error: new Error('Failed'), index: 1 }],
        metrics: {
          totalDuration: 100,
          successfulOperations: 1,
          failedOperations: 1,
          operationsPerSecond: 10,
        },
      });
      expect(result.content[0].text).toContain('partial');
    });
  });

  describe('createUpdateResponse', () => {
    it('should format response with updated tasks', () => {
      const result = BulkOperationProcessor.createUpdateResponse(
        [1, 2],
        [{ id: 1, title: 'Task 1', project_id: 1 } as any],
        'done',
        0,
      );
      expect(result.content[0].text).toContain('Successfully updated');
      expect(result.content[0].text).toContain('done');
    });

    it('should include fetch errors when present', () => {
      const result = BulkOperationProcessor.createUpdateResponse(
        [1, 2],
        [{ id: 1, title: 'Task 1', project_id: 1 } as any],
        'done',
        1,
      );
      expect(result.content[0].text).toContain('fetch');
    });
  });

  describe('async methods with client mocking', () => {
    const mockClient = {
      tasks: {
        bulkUpdateTasks: jest.fn<any>(),
        getTask: jest.fn<any>(),
        updateTask: jest.fn<any>(),
        deleteTask: jest.fn<any>(),
        createTask: jest.fn<any>(),
        updateTaskLabels: jest.fn<any>(),
        assignUserToTask: jest.fn<any>(),
        bulkAssignUsersToTask: jest.fn<any>(),
        removeUserFromTask: jest.fn<any>(),
        getProjectTasks: jest.fn<any>(),
        getAllTasks: jest.fn<any>(),
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
      // Both modules share the same mock function reference
      _mockGetClientFromContext.mockResolvedValue(mockClient);
      // Reset error mocks to passthrough behavior
      const mockedModule = jest.requireMock('../../../../src/index');
      mockedModule.isAuthenticationError.mockReturnValue(false);
      mockedModule.transformApiError.mockImplementation((err: Error) => err);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    describe('bulkUpdateTasks - async path', () => {
      it('should succeed with valid args and bulk API response', async () => {
        mockClient.tasks.bulkUpdateTasks.mockResolvedValue([
          { id: 1, project_id: 1, title: 'Task 1', done: true },
        ]);

        const result = await BulkOperationProcessor.bulkUpdateTasks({
          taskIds: [1],
          field: 'done',
          value: true,
        });

        expect(result.content[0].text).toBeDefined();
        expect(mockClient.tasks.bulkUpdateTasks).toHaveBeenCalledWith({
          task_ids: [1],
          field: 'done',
          value: true,
        });
      });

      it('should fall back to individual updates when bulk API returns message', async () => {
        mockClient.tasks.bulkUpdateTasks.mockResolvedValue({
          message: 'Tasks updated successfully',
        });
        mockClient.tasks.getTask.mockResolvedValue({
          id: 1,
          project_id: 1,
          title: 'Task 1',
          done: true,
        });
        // Need to mock BatchProcessorFactory - it's in the bulk module, not the barrel
        // The processBatches call will try real BatchProcessor...

        // For message response, attemptBulkUpdateAPI goes to fetchResult path
        // which calls BatchProcessorFactory.processBatches -> real batch processor
        // This should work since the real batch processor doesn't need mocking
        const result = await BulkOperationProcessor.bulkUpdateTasks({
          taskIds: [1],
          field: 'done',
          value: true,
        });

        expect(result.content[0].text).toBeDefined();
      });

      it('should fall back to individual updates when bulk API throws', async () => {
        mockClient.tasks.bulkUpdateTasks.mockRejectedValue(new Error('Bulk API error'));
        mockClient.tasks.getTask.mockResolvedValue({
          id: 1,
          project_id: 1,
          title: 'Task 1',
          assignees: [],
        });
        mockClient.tasks.updateTask.mockResolvedValue({
          id: 1,
          title: 'Task 1',
          project_id: 1,
          done: true,
        });

        const result = await BulkOperationProcessor.bulkUpdateTasks({
          taskIds: [1],
          field: 'done',
          value: true,
        });

        expect(result.content[0].text).toContain('Successfully updated');
        expect(mockClient.tasks.updateTask).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ done: true }),
        );
      });

      it('should handle labels field via fallback individual updates', async () => {
        mockClient.tasks.bulkUpdateTasks.mockRejectedValue(new Error('Bulk API error'));
        mockClient.tasks.getTask.mockResolvedValue({
          id: 1,
          project_id: 1,
          title: 'Task 1',
        });
        mockClient.tasks.updateTask.mockResolvedValue({
          id: 1,
          title: 'Task 1',
          project_id: 1,
        });
        mockClient.tasks.updateTaskLabels.mockResolvedValue({});

        const result = await BulkOperationProcessor.bulkUpdateTasks({
          taskIds: [1],
          field: 'labels',
          value: [10, 20],
        });

        expect(result.content[0].text).toContain('Successfully updated');
        expect(mockClient.tasks.updateTaskLabels).toHaveBeenCalledWith(1, {
          label_ids: [10, 20],
        });
      });

      it('should handle assignees field via fallback individual updates', async () => {
        mockClient.tasks.bulkUpdateTasks.mockRejectedValue(new Error('Bulk API error'));
        // getTask called by updateIndividualTask first, then handleAssigneeUpdate
        mockClient.tasks.getTask
          .mockResolvedValueOnce({
            id: 1,
            project_id: 1,
            title: 'Task 1',
            assignees: [{ id: 5, username: 'oldUser' }],
          })
          .mockResolvedValueOnce({
            id: 1,
            project_id: 1,
            title: 'Task 1',
            assignees: [{ id: 5, username: 'oldUser' }],
          });
        mockClient.tasks.updateTask.mockResolvedValue({
          id: 1,
          title: 'Task 1',
          project_id: 1,
        });
        mockClient.tasks.assignUserToTask.mockResolvedValue({});
        mockClient.tasks.removeUserFromTask.mockResolvedValue({});

        const result = await BulkOperationProcessor.bulkUpdateTasks({
          taskIds: [1],
          field: 'assignees',
          value: [1, 2],
        });

        expect(result.content[0].text).toContain('Successfully updated');
        expect(mockClient.tasks.assignUserToTask).toHaveBeenCalledTimes(2);
        expect(mockClient.tasks.removeUserFromTask).toHaveBeenCalledWith(1, 5);
      });

      it('should convert repeat_mode string to numeric via bulk API', async () => {
        mockClient.tasks.bulkUpdateTasks.mockResolvedValue([
          {
            id: 1,
            project_id: 1,
            title: 'Task 1',
            repeat_mode: 1,
          },
        ]);

        const result = await BulkOperationProcessor.bulkUpdateTasks({
          taskIds: [1],
          field: 'repeat_mode',
          value: 'month',
        });

        expect(result.content[0].text).toBeDefined();
        // 'month' maps to 1 via REPEAT_MODE_MAP
        expect(mockClient.tasks.bulkUpdateTasks).toHaveBeenCalledWith({
          task_ids: [1],
          field: 'repeat_mode',
          value: 1,
        });
      });

      it('should throw MCPError for fetch errors in bulk update', async () => {
        mockClient.tasks.bulkUpdateTasks.mockRejectedValue(new Error('fetch failed'));
        mockClient.tasks.getTask.mockRejectedValue(new Error('fetch failed'));
        mockClient.tasks.updateTask = jest.fn<any>().mockRejectedValue(new Error('fetch failed'));

        await expect(
          BulkOperationProcessor.bulkUpdateTasks({
            taskIds: [1],
            field: 'done',
            value: true,
          }),
        ).rejects.toThrow();
      });
    });

    describe('bulkDeleteTasks - async path', () => {
      it('should succeed with valid taskIds', async () => {
        mockClient.tasks.getTask.mockResolvedValue({
          id: 1,
          title: 'Task to delete',
          project_id: 1,
        });
        mockClient.tasks.deleteTask.mockResolvedValue({});

        const result = await BulkOperationProcessor.bulkDeleteTasks({ taskIds: [1] });

        expect(result.content[0].text).toBeDefined();
        expect(mockClient.tasks.deleteTask).toHaveBeenCalledWith(1);
      });

      it('should handle partial delete success', async () => {
        mockClient.tasks.getTask
          .mockResolvedValueOnce({
            id: 1,
            title: 'Task 1',
            project_id: 1,
          })
          .mockResolvedValueOnce({
            id: 2,
            title: 'Task 2',
            project_id: 1,
          });
        mockClient.tasks.deleteTask
          .mockResolvedValueOnce({})
          .mockRejectedValueOnce(new Error('Delete failed'));

        const result = await BulkOperationProcessor.bulkDeleteTasks({
          taskIds: [1, 2],
        });

        expect(result.content[0].text).toContain('partial');
        expect(mockClient.tasks.deleteTask).toHaveBeenCalledTimes(2);
      });
    });

    describe('bulkCreateTasks - async path', () => {
      it('should succeed with valid tasks', async () => {
        mockClient.tasks.createTask.mockResolvedValue({
          id: 1,
          title: 'New Task',
          project_id: 1,
        });
        mockClient.tasks.getTask.mockResolvedValue({
          id: 1,
          title: 'New Task',
          project_id: 1,
        });

        const result = await BulkOperationProcessor.bulkCreateTasks({
          projectId: 1,
          tasks: [{ title: 'New Task' }],
        });

        expect(result.content[0].text).toBeDefined();
        expect(mockClient.tasks.createTask).toHaveBeenCalled();
      });

      it('should handle tasks with labels and assignees', async () => {
        mockClient.tasks.createTask.mockResolvedValue({
          id: 1,
          title: 'Task with labels',
          project_id: 1,
        });
        mockClient.tasks.getTask.mockResolvedValue({
          id: 1,
          title: 'Task with labels',
          project_id: 1,
          labels: [{ id: 1, title: 'Label 1' }],
          assignees: [{ id: 1, username: 'user1' }],
        });
        mockClient.tasks.updateTaskLabels.mockResolvedValue({});
        mockClient.tasks.assignUserToTask.mockResolvedValue({});

        const result = await BulkOperationProcessor.bulkCreateTasks({
          projectId: 1,
          tasks: [
            {
              title: 'Task with labels',
              labels: [1],
              assignees: [1],
            },
          ],
        });

        expect(result.content[0].text).toBeDefined();
        expect(mockClient.tasks.updateTaskLabels).toHaveBeenCalled();
        expect(mockClient.tasks.assignUserToTask).toHaveBeenCalled();
      });

      it('should create task with repeat configuration', async () => {
        mockClient.tasks.createTask.mockResolvedValue({
          id: 1,
          title: 'Repeating Task',
          project_id: 1,
        });
        mockClient.tasks.getTask.mockResolvedValue({
          id: 1,
          title: 'Repeating Task',
          project_id: 1,
        });

        const result = await BulkOperationProcessor.bulkCreateTasks({
          projectId: 1,
          tasks: [
            {
              title: 'Repeating Task',
              repeatAfter: 7,
              repeatMode: 'day',
            },
          ],
        });

        expect(result.content[0].text).toBeDefined();
        expect(mockClient.tasks.createTask).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            repeat_after: 7 * 24 * 60 * 60,
            repeat_mode: 0,
          }),
        );
      });

      it('should create task with description and priority', async () => {
        mockClient.tasks.createTask.mockResolvedValue({
          id: 1,
          title: 'Detailed Task',
          project_id: 1,
        });
        mockClient.tasks.getTask.mockResolvedValue({
          id: 1,
          title: 'Detailed Task',
          project_id: 1,
        });

        const result = await BulkOperationProcessor.bulkCreateTasks({
          projectId: 1,
          tasks: [
            {
              title: 'Detailed Task',
              description: 'A description',
              priority: 3,
              dueDate: '2024-12-31T00:00:00Z',
            },
          ],
        });

        expect(result.content[0].text).toBeDefined();
        expect(mockClient.tasks.createTask).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            description: 'A description',
            priority: 3,
            due_date: '2024-12-31T00:00:00Z',
          }),
        );
      });

      it('should handle assignee permission denied error (code 7003) during creation', async () => {
        mockClient.tasks.createTask.mockResolvedValue({
          id: 1,
          title: 'Perm Error Task',
          project_id: 1,
        });
        mockClient.tasks.assignUserToTask.mockRejectedValue({
          code: 7003,
          message: 'User does not have access',
        });

        await expect(
          BulkOperationProcessor.bulkCreateTasks({
            projectId: 1,
            tasks: [{ title: 'Perm Error Task', assignees: [999] }],
          }),
        ).rejects.toThrow('Bulk create failed');
        expect(mockClient.tasks.assignUserToTask).toHaveBeenCalledWith(1, 999);
        // Cleanup: deleteTask should be called for partially created task
        expect(mockClient.tasks.deleteTask).toHaveBeenCalledWith(1);
      });

      it('should handle non-existent user error (code 1005) during creation', async () => {
        mockClient.tasks.createTask.mockResolvedValue({
          id: 1,
          title: 'Bad User Task',
          project_id: 1,
        });
        mockClient.tasks.assignUserToTask.mockRejectedValue({
          code: 1005,
          message: 'User does not exist',
        });

        await expect(
          BulkOperationProcessor.bulkCreateTasks({
            projectId: 1,
            tasks: [{ title: 'Bad User Task', assignees: [999] }],
          }),
        ).rejects.toThrow('Bulk create failed');
        expect(mockClient.tasks.assignUserToTask).toHaveBeenCalledWith(1, 999);
      });
    });
  });

  describe('getValueType for breakdown analysis', () => {
    // Test the private getValueType method via a task with arrays/nulls/objects
    it('should handle nested object data in breakdown', () => {
      // createUpdateResponse with nested data to exercise breakdown logic
      const result = BulkOperationProcessor.createUpdateResponse(
        [1],
        [{ id: 1, title: 'Test', project_id: 1, labels: [{ id: 1 }], assignees: [] }] as any,
        'done',
        0,
      );
      expect(result.content[0].text).toBeDefined();
    });
  });
});

describe('BulkOperationValidator - Phase 1 Coverage Tests', () => {
  // 1.5: BulkOperationValidator.validateBulkUpdate rejects invalid taskId types (R1.5)
  describe('validateBulkUpdate', () => {
    it('should reject negative taskId', () => {
      expect(() =>
        BulkOperationValidator.validateBulkUpdate({
          taskIds: [1, -2],
          field: 'done',
          value: true,
        }),
      ).toThrow('task ID must be a positive integer');
    });

    it('should reject zero taskId', () => {
      expect(() =>
        BulkOperationValidator.validateBulkUpdate({
          taskIds: [0],
          field: 'done',
          value: true,
        }),
      ).toThrow('task ID must be a positive integer');
    });

    it('should accept valid taskIds', () => {
      expect(() =>
        BulkOperationValidator.validateBulkUpdate({
          taskIds: [1, 2, 3],
          field: 'done',
          value: true,
        }),
      ).not.toThrow();
    });
  });

  // 1.6: BulkOperationValidator.preprocessFieldValue converts string "true"/"false" to boolean (R1.6)
  describe('preprocessFieldValue', () => {
    it('should convert string "true" to boolean', () => {
      const args = { taskIds: [1], field: 'done', value: 'true' as any };
      BulkOperationValidator.preprocessFieldValue(args);
      expect(args.value).toBe(true);
    });

    it('should convert string "false" to boolean', () => {
      const args = { taskIds: [1], field: 'done', value: 'false' as any };
      BulkOperationValidator.preprocessFieldValue(args);
      expect(args.value).toBe(false);
    });

    it('should convert string "3" to number for priority', () => {
      const args = { taskIds: [1], field: 'priority', value: '3' as any };
      BulkOperationValidator.preprocessFieldValue(args);
      expect(args.value).toBe(3);
    });

    it('should convert string "5" to number for project_id', () => {
      const args = { taskIds: [1], field: 'project_id', value: '5' as any };
      BulkOperationValidator.preprocessFieldValue(args);
      expect(args.value).toBe(5);
    });

    it('should convert string "7" to number for repeat_after', () => {
      const args = { taskIds: [1], field: 'repeat_after', value: '7' as any };
      BulkOperationValidator.preprocessFieldValue(args);
      expect(args.value).toBe(7);
    });

    it('should not modify non-numeric string for priority', () => {
      const args = { taskIds: [1], field: 'priority', value: 'abc' as any };
      BulkOperationValidator.preprocessFieldValue(args);
      expect(args.value).toBe('abc'); // NaN check means unchanged
    });

    it('should not modify boolean value for done', () => {
      const args = { taskIds: [1], field: 'done', value: true as any };
      BulkOperationValidator.preprocessFieldValue(args);
      expect(args.value).toBe(true);
    });
  });

  // 1.7: BulkOperationValidator.validateFieldConstraints rejects invalid priority (R1.7)
  describe('validateFieldConstraints', () => {
    it('should reject priority > 5', () => {
      expect(() =>
        BulkOperationValidator.validateFieldConstraints({
          taskIds: [1],
          field: 'priority',
          value: 6,
        }),
      ).toThrow('Priority must be between 0 and 5');
    });

    it('should reject priority < 0', () => {
      expect(() =>
        BulkOperationValidator.validateFieldConstraints({
          taskIds: [1],
          field: 'priority',
          value: -1,
        }),
      ).toThrow('Priority must be between 0 and 5');
    });

    it('should accept valid priority', () => {
      expect(() =>
        BulkOperationValidator.validateFieldConstraints({
          taskIds: [1],
          field: 'priority',
          value: 3,
        }),
      ).not.toThrow();
    });

    it('should reject invalid field name', () => {
      expect(() =>
        BulkOperationValidator.validateFieldConstraints({
          taskIds: [1],
          field: 'invalid_field',
          value: true,
        }),
      ).toThrow('Invalid field');
    });

    it('should reject invalid hex_color', () => {
      expect(() =>
        BulkOperationValidator.validateFieldConstraints({
          taskIds: [1],
          field: 'hex_color',
          value: 'not-a-hex',
        }),
      ).toThrow('hex_color must be a valid hex color');
    });

    it('should accept valid hex_color without hash', () => {
      expect(() =>
        BulkOperationValidator.validateFieldConstraints({
          taskIds: [1],
          field: 'hex_color',
          value: 'ff0000',
        }),
      ).not.toThrow();
    });

    it('should accept valid hex_color with hash', () => {
      expect(() =>
        BulkOperationValidator.validateFieldConstraints({
          taskIds: [1],
          field: 'hex_color',
          value: '#00ff00',
        }),
      ).not.toThrow();
    });

    it('should reject percent_done > 100', () => {
      expect(() =>
        BulkOperationValidator.validateFieldConstraints({
          taskIds: [1],
          field: 'percent_done',
          value: 101,
        }),
      ).toThrow('percent_done must be between 0 and 100');
    });

    it('should reject percent_done < 0', () => {
      expect(() =>
        BulkOperationValidator.validateFieldConstraints({
          taskIds: [1],
          field: 'percent_done',
          value: -1,
        }),
      ).toThrow('percent_done must be between 0 and 100');
    });

    it('should reject non-boolean value for done field', () => {
      expect(() =>
        BulkOperationValidator.validateFieldConstraints({
          taskIds: [1],
          field: 'done',
          value: 'maybe',
        }),
      ).toThrow('done field must be a boolean');
    });

    it('should reject repeat_after < 0', () => {
      expect(() =>
        BulkOperationValidator.validateFieldConstraints({
          taskIds: [1],
          field: 'repeat_after',
          value: -1,
        }),
      ).toThrow('repeat_after must be a non-negative number');
    });

    it('should reject invalid repeat_mode', () => {
      expect(() =>
        BulkOperationValidator.validateFieldConstraints({
          taskIds: [1],
          field: 'repeat_mode',
          value: 'invalid',
        }),
      ).toThrow('Invalid repeat_mode');
    });

    it('should accept valid repeat_mode', () => {
      expect(() =>
        BulkOperationValidator.validateFieldConstraints({
          taskIds: [1],
          field: 'repeat_mode',
          value: 'month' as any,
        }),
      ).not.toThrow();
    });

    it('should reject non-array assignees', () => {
      expect(() =>
        BulkOperationValidator.validateFieldConstraints({
          taskIds: [1],
          field: 'assignees',
          value: 'not-array',
        }),
      ).toThrow('assignees must be an array');
    });

    it('should reject non-array labels', () => {
      expect(() =>
        BulkOperationValidator.validateFieldConstraints({
          taskIds: [1],
          field: 'labels',
          value: 123,
        }),
      ).toThrow('labels must be an array');
    });
  });

  describe('validateBulkDelete', () => {
    it('should reject empty taskIds', () => {
      expect(() => BulkOperationValidator.validateBulkDelete({ taskIds: [] })).toThrow(
        'taskIds array is required',
      );
    });

    it('should reject negative taskId', () => {
      expect(() => BulkOperationValidator.validateBulkDelete({ taskIds: [1, -1] })).toThrow(
        'task ID must be a positive integer',
      );
    });
  });

  describe('validateBulkCreate', () => {
    it('should reject missing projectId', () => {
      expect(() => BulkOperationValidator.validateBulkCreate({})).toThrow('projectId is required');
    });

    it('should reject missing tasks array', () => {
      expect(() => BulkOperationValidator.validateBulkCreate({ projectId: 1 })).toThrow(
        'tasks array is required',
      );
    });

    it('should reject task with empty title', () => {
      expect(() =>
        BulkOperationValidator.validateBulkCreate({
          projectId: 1,
          tasks: [{ title: '' }],
        }),
      ).toThrow('non-empty title');
    });
  });
});

describe('BatchProcessorFactory - Phase 1 Coverage Tests', () => {
  it('should return update processor for update operation', () => {
    const processor = BatchProcessorFactory.getProcessor('bulk_update_test');
    expect(processor).toBeDefined();
    expect(processor.processBatches).toBeDefined();
  });

  it('should return delete processor for delete operation', () => {
    const processor = BatchProcessorFactory.getProcessor('delete_task');
    expect(processor).toBeDefined();
  });

  it('should return create processor for create operation', () => {
    const processor = BatchProcessorFactory.getProcessor('create_task');
    expect(processor).toBeDefined();
  });

  it('should return update processor for unknown operation', () => {
    const processor = BatchProcessorFactory.getProcessor('unknown_operation');
    expect(processor).toBeDefined();
  });

  it('getCreateProcessor should return create processor', () => {
    const processor = BatchProcessorFactory.getCreateProcessor();
    expect(processor).toBeDefined();
  });

  it('getUpdateProcessor should return update processor', () => {
    const processor = BatchProcessorFactory.getUpdateProcessor();
    expect(processor).toBeDefined();
  });

  it('getDeleteProcessor should return delete processor', () => {
    const processor = BatchProcessorFactory.getDeleteProcessor();
    expect(processor).toBeDefined();
  });

  it('should process batches successfully', async () => {
    const result = await BatchProcessorFactory.processBatches(
      [1, 2, 3],
      async (item) => ({ id: item, processed: true }),
      'test_operation',
    );
    expect(result.successful).toHaveLength(3);
    expect(result.failed).toHaveLength(0);
  });
});

describe('BulkOperationErrorHandler - Phase 1 Coverage Tests', () => {
  describe('handleUpdateFailures', () => {
    it('should throw when all failures are assignee auth errors', () => {
      const failures = [
        {
          index: 0,
          originalItem: 1,
          error: new MCPError(
            ErrorCode.API_ERROR,
            'Assignee operations may have authentication issues with certain Vikunja API versions',
          ),
        },
      ];

      expect(() =>
        BulkOperationErrorHandler.handleUpdateFailures(
          { taskIds: [1], field: 'assignees', value: [1] },
          failures,
          0,
        ),
      ).toThrow('Assignee operations may have authentication issues');
    });

    it('should throw when all updates fail', () => {
      const failures = [
        { index: 0, originalItem: 1, error: new Error('API error'), successCount: 0 },
      ];

      expect(() =>
        BulkOperationErrorHandler.handleUpdateFailures(
          { taskIds: [1, 2], field: 'done', value: true },
          failures,
          0,
        ),
      ).toThrow('Bulk update failed. Could not update any tasks');
    });

    it('should not throw when some updates succeed', () => {
      const failures = [
        { index: 0, originalItem: 1, error: new Error('API error'), successCount: 1 },
      ];

      expect(() =>
        BulkOperationErrorHandler.handleUpdateFailures(
          { taskIds: [1, 2], field: 'done', value: true },
          failures,
          1,
        ),
      ).not.toThrow();
    });

    it('should not throw when some assignee failures are auth-related but not all', () => {
      // Mixed: one auth failure, one non-auth failure, with partial success
      expect(() =>
        BulkOperationErrorHandler.handleUpdateFailures(
          { taskIds: [1, 2], field: 'assignees', value: [1] },
          [
            {
              index: 0,
              originalItem: 1,
              error: new MCPError(
                ErrorCode.API_ERROR,
                'Assignee operations may have authentication issues with certain Vikunja API versions',
              ),
            },
            { index: 1, originalItem: 2, error: new Error('Other error') },
          ],
          2,
        ),
      ).not.toThrow();
    });

    it('should throw when all assignee failures are auth-related even with partial success', () => {
      // All failures are auth, but successCount > 0 — auth check comes first
      expect(() =>
        BulkOperationErrorHandler.handleUpdateFailures(
          { taskIds: [1], field: 'assignees', value: [1] },
          [
            {
              index: 0,
              originalItem: 1,
              error: new MCPError(
                ErrorCode.API_ERROR,
                'Assignee operations may have authentication issues with certain Vikunja API versions',
              ),
            },
          ],
          1,
        ),
      ).toThrow('Assignee operations may have authentication issues');
    });
  });

  describe('processUpdateResults', () => {
    it('should return response when all updates succeed', async () => {
      const result = await BulkOperationErrorHandler.processUpdateResults(
        { taskIds: [1], field: 'done', value: true },
        [1],
        {
          successful: [{ id: 1, title: 'Task 1', project_id: 1 }] as any[],
          failed: [],
          metrics: {
            totalDuration: 0,
            successfulOperations: 1,
            failedOperations: 0,
            operationsPerSecond: 0,
          },
        },
      );

      expect(result.content[0].text).toBeDefined();
      expect(result.content[0].text).toContain('Successfully updated');
    });

    it('should fetch tasks when successful tasks are missing from result', async () => {
      // mock processBatches to return fetched tasks for the fetch path
      jest.spyOn(BatchProcessorFactory, 'processBatches').mockResolvedValueOnce({
        successful: [{ id: 1, title: 'Fetched Task', project_id: 1 }] as any[],
        failed: [],
        metrics: {
          totalDuration: 0,
          successfulOperations: 1,
          failedOperations: 0,
          operationsPerSecond: 0,
        },
      });

      const result = await BulkOperationErrorHandler.processUpdateResults(
        { taskIds: [1], field: 'done', value: true },
        [1],
        {
          successful: [],
          failed: [],
          metrics: {
            totalDuration: 0,
            successfulOperations: 1,
            failedOperations: 0,
            operationsPerSecond: 0,
          },
        },
      );

      expect(result.content[0].text).toBeDefined();
      expect(result.content[0].text).toContain('Successfully updated');
    });

    it('should throw when all updates fail', async () => {
      await expect(
        BulkOperationErrorHandler.processUpdateResults(
          { taskIds: [1, 2], field: 'done', value: true },
          [1, 2],
          {
            successful: [],
            failed: [{ index: 0, originalItem: 1, error: new Error('API error') }],
            metrics: {
              totalDuration: 0,
              successfulOperations: 0,
              failedOperations: 1,
              operationsPerSecond: 0,
            },
          },
        ),
      ).rejects.toThrow('Bulk update failed');
    });

    it('should handle partial failures gracefully with successful tasks', async () => {
      const result = await BulkOperationErrorHandler.processUpdateResults(
        { taskIds: [1, 2], field: 'done', value: true },
        [1, 2],
        {
          successful: [{ id: 1, title: 'Task 1', project_id: 1 }] as any[],
          failed: [{ index: 1, originalItem: 2, error: new Error('Failed for task 2') }],
          metrics: {
            totalDuration: 150,
            successfulOperations: 1,
            failedOperations: 1,
            operationsPerSecond: 6.66,
          },
        },
      );

      expect(result.content[0].text).toContain('Successfully updated 2 tasks');
    });
  });

  describe('handleAssigneeUpdate', () => {
    const mockClient = {
      tasks: {
        getTask: jest.fn<any>(),
        assignUserToTask: jest.fn<any>(),
        removeUserFromTask: jest.fn<any>(),
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should throw auth error when getTask fails with auth error', async () => {
      mockClient.tasks.getTask.mockRejectedValue(new Error('Unauthorized'));

      await expect(
        BulkOperationErrorHandler.handleAssigneeUpdate(mockClient, 1, [42]),
      ).rejects.toThrow('Assignee bulk update operation failed');
    });

    it('should re-throw non-auth error when getTask fails', async () => {
      mockClient.tasks.getTask.mockRejectedValue(new Error('Database error'));

      await expect(
        BulkOperationErrorHandler.handleAssigneeUpdate(mockClient, 1, [42]),
      ).rejects.toThrow('Database error');
    });

    it('should throw MCPError when removeUserFromTask fails with auth error', async () => {
      mockClient.tasks.getTask.mockResolvedValue({
        id: 1,
        title: 'Task',
        project_id: 1,
        assignees: [{ id: 5, username: 'oldUser' }],
      });
      mockClient.tasks.assignUserToTask.mockResolvedValue({});
      mockClient.tasks.removeUserFromTask.mockRejectedValue(new Error('Unauthorized'));

      await expect(
        BulkOperationErrorHandler.handleAssigneeUpdate(mockClient, 1, [42]),
      ).rejects.toThrow('Assignee removal operation partially failed');
    });

    it('should re-throw non-auth error from removeUserFromTask', async () => {
      mockClient.tasks.getTask.mockResolvedValue({
        id: 1,
        title: 'Task',
        project_id: 1,
        assignees: [{ id: 5, username: 'oldUser' }],
      });
      mockClient.tasks.assignUserToTask.mockResolvedValue({});
      mockClient.tasks.removeUserFromTask.mockRejectedValue(new Error('Remove failed'));

      await expect(
        BulkOperationErrorHandler.handleAssigneeUpdate(mockClient, 1, [42]),
      ).rejects.toThrow('Remove failed');
    });
  });
});
