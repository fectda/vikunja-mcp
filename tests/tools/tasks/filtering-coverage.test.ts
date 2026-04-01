/**
 * TDD Tests for src/tools/tasks/filtering - Phase 5
 * Tests for TaskFilteringOrchestrator and related filtering functionality
 */

import { TaskFilteringOrchestrator } from '../../../src/tools/tasks/filtering';
import { FilterValidator } from '../../../src/storage/filtering/FilterValidator';
import type { TaskListingArgs } from '../../../src/tools/tasks/types/filters';
import type { SimpleFilterStorage } from '../../../src/storage';

// Mock storage for testing
const createMockStorage = (): SimpleFilterStorage => ({
  get: jest.fn().mockResolvedValue({ id: '1', filter: 'done = true' }),
  set: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(true),
  getAll: jest.fn().mockResolvedValue([]),
  has: jest.fn().mockResolvedValue(true),
  clear: jest.fn().mockResolvedValue(undefined),
  size: jest.fn().mockReturnValue(0),
});

describe('TaskFilteringOrchestrator - Phase 5 Coverage Tests', () => {
  let mockStorage: SimpleFilterStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
  });

  describe('validateTaskFiltering method', () => {
    it('should return valid for valid arguments', async () => {
      const args: TaskListingArgs = {
        page: 1,
        perPage: 50,
      };

      const result = await TaskFilteringOrchestrator.validateTaskFiltering(args, mockStorage);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid for negative page number', async () => {
      const args: TaskListingArgs = {
        page: -1,
        perPage: 50,
      };

      const result = await TaskFilteringOrchestrator.validateTaskFiltering(args, mockStorage);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('positive integer'))).toBe(true);
    });

    it('should return invalid for negative perPage', async () => {
      const args: TaskListingArgs = {
        page: 1,
        perPage: -10,
      };

      const result = await TaskFilteringOrchestrator.validateTaskFiltering(args, mockStorage);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('positive integer'))).toBe(true);
    });

    it('should return invalid for non-integer page', async () => {
      const args: TaskListingArgs = {
        page: 1.5,
        perPage: 50,
      };

      const result = await TaskFilteringOrchestrator.validateTaskFiltering(args, mockStorage);

      expect(result.isValid).toBe(false);
    });

    it('should return invalid for zero page', async () => {
      const args: TaskListingArgs = {
        page: 0,
        perPage: 50,
      };

      const result = await TaskFilteringOrchestrator.validateTaskFiltering(args, mockStorage);

      expect(result.isValid).toBe(false);
    });

    it('should return invalid for zero perPage', async () => {
      const args: TaskListingArgs = {
        page: 1,
        perPage: 0,
      };

      const result = await TaskFilteringOrchestrator.validateTaskFiltering(args, mockStorage);

      expect(result.isValid).toBe(false);
    });

    it('should validate done parameter must be boolean', async () => {
      const args: TaskListingArgs = {
        done: 'true' as any,
      };

      const result = await TaskFilteringOrchestrator.validateTaskFiltering(args, mockStorage);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('boolean'))).toBe(true);
    });

    it('should validate filter must be string', async () => {
      const args: TaskListingArgs = {
        filter: 123 as any,
      };

      const result = await TaskFilteringOrchestrator.validateTaskFiltering(args, mockStorage);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('string'))).toBe(true);
    });

    it('should return memory validation in result', async () => {
      const args: TaskListingArgs = {
        page: 1,
        perPage: 50,
      };

      const result = await TaskFilteringOrchestrator.validateTaskFiltering(args, mockStorage);

      expect(result.memoryValidation).toBeDefined();
      expect(result.memoryValidation.isValid).toBe(true);
    });
  });

  describe('createFilteringContext method', () => {
    it('should create context with filter info', () => {
      const args: TaskListingArgs = {
        filter: 'done = true',
        projectId: 1,
        page: 1,
        perPage: 50,
      };

      const mockResult = {
        tasks: [{ id: 1, title: 'Task' }],
        metadata: {
          serverSideFilteringUsed: true,
          serverSideFilteringAttempted: true,
          clientSideFiltering: false,
          filteringNote: 'Used server-side filtering',
        },
      };

      const context = TaskFilteringOrchestrator.createFilteringContext(args, mockResult as any);

      expect(context.input.hasFilter).toBe(true);
      expect(context.input.projectId).toBe(1);
      expect(context.output.taskCount).toBe(1);
      expect(context.output.serverSideFilteringUsed).toBe(true);
    });

    it('should create context with filterId info', () => {
      const args: TaskListingArgs = {
        filterId: 'filter-123',
      };

      const mockResult = {
        tasks: [],
        metadata: {},
      };

      const context = TaskFilteringOrchestrator.createFilteringContext(args, mockResult as any);

      expect(context.input.hasFilterId).toBe(true);
    });

    it('should create context without optional args', () => {
      const args: TaskListingArgs = {};

      const mockResult = {
        tasks: [],
        metadata: {},
      };

      const context = TaskFilteringOrchestrator.createFilteringContext(args, mockResult as any);

      expect(context.input.hasFilter).toBe(false);
      expect(context.input.hasFilterId).toBe(false);
      expect(context.input.projectId).toBeUndefined();
    });

    it('should include memory info when present', () => {
      const args: TaskListingArgs = {};
      const mockResult = {
        tasks: [],
        metadata: {},
        memoryInfo: {
          actualCount: 100,
          maxAllowed: 50,
          estimatedMemoryMB: 5,
        },
      };

      const context = TaskFilteringOrchestrator.createFilteringContext(args, mockResult as any);

      expect(context.output.memoryInfo).toBeDefined();
      expect(context.output.memoryInfo?.actualCount).toBe(100);
    });

    it('should include performance timestamp', () => {
      const args: TaskListingArgs = {};
      const mockResult = {
        tasks: [],
        metadata: {},
      };

      const context = TaskFilteringOrchestrator.createFilteringContext(args, mockResult as any);

      expect(context.performance.timestamp).toBeDefined();
    });
  });

  describe('analyzeFilteringPerformance method', () => {
    it('should return optimal for simple efficient queries', () => {
      const args: TaskListingArgs = {
        filter: 'done = false',
        perPage: 100,
      };

      const mockResult = {
        tasks: Array(100).fill({}),
        metadata: {
          serverSideFilteringUsed: true,
        },
        memoryInfo: {
          actualCount: 100,
          maxAllowed: 200,
          estimatedMemoryMB: 1,
        },
      };

      const analysis = TaskFilteringOrchestrator.analyzeFilteringPerformance(
        args,
        mockResult as any,
      );

      expect(analysis.isOptimal).toBe(true);
    });

    it('should report issue when server-side filtering failed', () => {
      const args: TaskListingArgs = {
        filter: 'done = true',
      };

      const mockResult = {
        tasks: [],
        metadata: {
          serverSideFilteringUsed: false,
          serverSideFilteringAttempted: true,
        },
      };

      const analysis = TaskFilteringOrchestrator.analyzeFilteringPerformance(
        args,
        mockResult as any,
      );

      expect(analysis.isOptimal).toBe(false);
      expect(analysis.issues.some((i) => i.includes('falling back'))).toBe(true);
    });

    it('should recommend server-side when filter exists but not used', () => {
      const args: TaskListingArgs = {
        filter: 'done = true',
      };

      const mockResult = {
        tasks: [],
        metadata: {
          serverSideFilteringUsed: false,
          serverSideFilteringAttempted: false,
        },
      };

      const analysis = TaskFilteringOrchestrator.analyzeFilteringPerformance(
        args,
        mockResult as any,
      );

      expect(analysis.recommendations.some((r) => r.includes('server-side'))).toBe(true);
    });

    it('should report issue for large page size', () => {
      const args: TaskListingArgs = {
        perPage: 1000,
      };

      const mockResult = {
        tasks: [],
        metadata: {},
      };

      const analysis = TaskFilteringOrchestrator.analyzeFilteringPerformance(
        args,
        mockResult as any,
      );

      expect(analysis.issues.some((i) => i.includes('page size'))).toBe(true);
    });

    it('should report issue for memory limit exceeded', () => {
      const args: TaskListingArgs = {};

      const mockResult = {
        tasks: [],
        metadata: {},
        memoryInfo: {
          actualCount: 1000,
          maxAllowed: 500,
          estimatedMemoryMB: 10,
        },
      };

      const analysis = TaskFilteringOrchestrator.analyzeFilteringPerformance(
        args,
        mockResult as any,
      );

      expect(analysis.issues.some((i) => i.includes('memory'))).toBe(true);
    });

    it('should recommend longer search terms', () => {
      const args: TaskListingArgs = {
        search: 'ab',
      };

      const mockResult = {
        tasks: [],
        metadata: {},
      };

      const analysis = TaskFilteringOrchestrator.analyzeFilteringPerformance(
        args,
        mockResult as any,
      );

      expect(analysis.recommendations.some((r) => r.includes('3 characters'))).toBe(true);
    });
  });

  describe('FilterValidator.validateMemoryConstraints', () => {
    it('should validate memory constraints for reasonable page size', () => {
      const args: TaskListingArgs = {};
      const result = FilterValidator.validateMemoryConstraints(args, 100);

      expect(result.isValid).toBe(true);
    });

    it('should throw for exceeding memory limits', () => {
      // Try to get a large page size - this may or may not throw depending on current limits
      const args: TaskListingArgs = {};

      expect(() => {
        FilterValidator.validateMemoryConstraints(args, 100000);
      }).toThrow();
    });

    it('should add warning for large page size', () => {
      const args: TaskListingArgs = {};
      const result = FilterValidator.validateMemoryConstraints(args, 600);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('performance'))).toBe(true);
    });
  });

  describe('FilterValidator.validateTaskListingArgs', () => {
    it('should return no errors for valid args', () => {
      const args: TaskListingArgs = {
        page: 1,
        perPage: 50,
        projectId: 1,
        done: false,
        search: 'test',
        sort: 'created_at',
        filter: 'done = true',
        filterId: 'filter-1',
      };

      const errors = FilterValidator.validateTaskListingArgs(args);

      expect(errors).toHaveLength(0);
    });

    it('should return error for negative page', () => {
      const args: TaskListingArgs = { page: -1 };

      const errors = FilterValidator.validateTaskListingArgs(args);

      expect(errors.some((e) => e.includes('Page number'))).toBe(true);
    });

    it('should return error for negative perPage', () => {
      const args: TaskListingArgs = { perPage: -5 };

      const errors = FilterValidator.validateTaskListingArgs(args);

      expect(errors.some((e) => e.includes('Per page'))).toBe(true);
    });

    it('should return error for negative projectId', () => {
      const args: TaskListingArgs = { projectId: -1 };

      const errors = FilterValidator.validateTaskListingArgs(args);

      expect(errors.some((e) => e.includes('Project ID'))).toBe(true);
    });

    it('should return error for non-boolean done', () => {
      const args: TaskListingArgs = { done: 'true' as any };

      const errors = FilterValidator.validateTaskListingArgs(args);

      expect(errors.some((e) => e.includes('Done parameter'))).toBe(true);
    });

    it('should return error for non-string search', () => {
      const args: TaskListingArgs = { search: 123 as any };

      const errors = FilterValidator.validateTaskListingArgs(args);

      expect(errors.some((e) => e.includes('Search parameter'))).toBe(true);
    });

    it('should return error for non-string sort', () => {
      const args: TaskListingArgs = { sort: [] as any };

      const errors = FilterValidator.validateTaskListingArgs(args);

      expect(errors.some((e) => e.includes('Sort parameter'))).toBe(true);
    });

    it('should return error for non-string filter', () => {
      const args: TaskListingArgs = { filter: {} as any };

      const errors = FilterValidator.validateTaskListingArgs(args);

      expect(errors.some((e) => e.includes('Filter parameter'))).toBe(true);
    });

    it('should return error for non-string filterId', () => {
      const args: TaskListingArgs = { filterId: 123 as any };

      const errors = FilterValidator.validateTaskListingArgs(args);

      expect(errors.some((e) => e.includes('Filter ID'))).toBe(true);
    });
  });
});
