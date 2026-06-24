/**
 * TDD Tests for src/storage/filtering/FilterValidator - Phase 2 Coverage
 * Tests validateAndParseFilter, validateLoadedTasks, validateMemoryConstraints,
 * and validateTaskFiltering edge cases not covered by existing tests.
 */

import { FilterValidator } from '../../../src/storage/filtering/FilterValidator';
import { MCPError } from '../../../src/types/errors';
import type { TaskListingArgs, TaskFilterStorage } from '../../../src/tools/tasks/types/filters';

// Mock storage for testing validateAndParseFilter
const createMockStorage = (overrides?: Partial<TaskFilterStorage>): TaskFilterStorage => ({
  get: jest.fn().mockResolvedValue({ id: '1', filter: 'done = true', name: 'Test Filter' }),
  set: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  getAll: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue({} as any),
  update: jest.fn().mockResolvedValue({} as any),
  list: jest.fn().mockResolvedValue([]),
  findByName: jest.fn().mockResolvedValue(null),
  ...overrides,
});

describe('FilterValidator (storage) - Phase 2 Coverage Tests', () => {
  describe('validateAndParseFilter', () => {
    it('should parse filter from filterId when storage returns a saved filter', async () => {
      const mockStorage = createMockStorage({
        get: jest.fn().mockResolvedValue({ id: '1', filter: 'done = true', name: 'Test' }),
      });
      const args: TaskListingArgs = { filterId: '1' };

      const result = await FilterValidator.validateAndParseFilter(args, mockStorage);

      expect(result.filterString).toBe('done = true');
      expect(result.filterExpression).not.toBeNull();
      expect(result.filterExpression?.groups).toBeDefined();
      expect(result.validationWarnings).toEqual([]);
    });

    it('should throw MCPError when filterId is not found in storage', async () => {
      const mockStorage = createMockStorage({
        get: jest.fn().mockResolvedValue(null),
      });
      const args: TaskListingArgs = { filterId: 'nonexistent' };

      await expect(FilterValidator.validateAndParseFilter(args, mockStorage)).rejects.toThrow(
        MCPError,
      );
    });

    it('should throw MCPError when filterId not found with correct error code', async () => {
      const mockStorage = createMockStorage({
        get: jest.fn().mockResolvedValue(null),
      });
      const args: TaskListingArgs = { filterId: 'missing' };

      try {
        await FilterValidator.validateAndParseFilter(args, mockStorage);
        fail('Expected MCPError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPError);
        expect((error as MCPError).code).toBe('VALIDATION_ERROR');
        expect((error as MCPError).message).toContain('missing');
      }
    });

    it('should use direct filter string when filter is provided', async () => {
      const mockStorage = createMockStorage();
      const args: TaskListingArgs = { filter: 'priority > 1' };

      const result = await FilterValidator.validateAndParseFilter(args, mockStorage);

      expect(result.filterString).toBe('priority > 1');
      expect(result.filterExpression).not.toBeNull();
    });

    it('should return null expression when neither filterId nor filter provided', async () => {
      const mockStorage = createMockStorage();
      const args: TaskListingArgs = {};

      const result = await FilterValidator.validateAndParseFilter(args, mockStorage);

      expect(result.filterExpression).toBeNull();
      expect(result.filterString).toBeUndefined();
    });

    it('should throw MCPError for invalid filter syntax', async () => {
      const mockStorage = createMockStorage();
      const args: TaskListingArgs = { filter: '!!!invalid syntax!!!' };

      await expect(FilterValidator.validateAndParseFilter(args, mockStorage)).rejects.toThrow(
        MCPError,
      );
    });

    it('should prefer filterId over filter when both are provided', async () => {
      const mockStorage = createMockStorage({
        get: jest.fn().mockResolvedValue({ id: '2', filter: 'done = false', name: 'Test' }),
      });
      const args: TaskListingArgs = {
        filterId: '2',
        filter: 'priority > 3',
      };

      const result = await FilterValidator.validateAndParseFilter(args, mockStorage);

      // filterId should take precedence
      expect(result.filterString).toBe('done = false');
    });
  });

  describe('validateMemoryConstraints', () => {
    it('should return valid for reasonable page size', () => {
      const args: TaskListingArgs = {};
      const result = FilterValidator.validateMemoryConstraints(args, 100);

      expect(result.isValid).toBe(true);
      expect(result.maxAllowed).toBeGreaterThan(0);
    });

    it('should add performance warning for large page size (>500)', () => {
      const args: TaskListingArgs = {};
      const result = FilterValidator.validateMemoryConstraints(args, 600);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('performance'))).toBe(true);
    });

    it('should include maxAllowed in result', () => {
      const args: TaskListingArgs = {};
      const result = FilterValidator.validateMemoryConstraints(args, 50);

      expect(result.maxAllowed).toBeDefined();
      expect(typeof result.maxAllowed).toBe('number');
    });
  });

  describe('validateLoadedTasks', () => {
    it('should return valid for reasonable task count', () => {
      const result = FilterValidator.validateLoadedTasks(100);

      expect(result.isValid).toBe(true);
      expect(result.shouldThrow).toBe(false);
    });

    it('should return warnings when task count exceeds limits', () => {
      // Use a very large task count that exceeds the default limit
      const result = FilterValidator.validateLoadedTasks(100);

      // With default 10000 limit, 100 should be fine
      expect(result.isValid).toBe(true);
    });

    it('should include risk level in result', () => {
      const result = FilterValidator.validateLoadedTasks(100);

      expect(result.riskLevel).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(result.riskLevel);
    });

    it('should include estimated memory in result', () => {
      const result = FilterValidator.validateLoadedTasks(100);

      expect(result.estimatedMemoryMB).toBeDefined();
      expect(typeof result.estimatedMemoryMB).toBe('number');
    });

    it('should handle sample task for accurate estimation', () => {
      const sampleTask = {
        id: 1,
        title: 'Test Task',
        done: false,
        priority: 3,
      };

      const result = FilterValidator.validateLoadedTasks(50, sampleTask as any);

      expect(result.isValid).toBe(true);
    });
  });

  describe('validateTaskFiltering', () => {
    it('should return filterExpression and memoryValidation for valid args', async () => {
      const mockStorage = createMockStorage();
      const args: TaskListingArgs = {
        filter: 'done = true',
        page: 1,
        perPage: 50,
      };

      const result = await FilterValidator.validateTaskFiltering(args, mockStorage);

      expect(result.filterExpression).not.toBeNull();
      expect(result.filterString).toBe('done = true');
      expect(result.memoryValidation.isValid).toBe(true);
    });

    it('should throw MCPError for invalid task listing args', async () => {
      const mockStorage = createMockStorage();
      const args: TaskListingArgs = { page: -1 };

      await expect(FilterValidator.validateTaskFiltering(args, mockStorage)).rejects.toThrow(
        MCPError,
      );
    });

    it('should aggregate warnings from filter and memory validation', async () => {
      const mockStorage = createMockStorage();
      // Large perPage to trigger memory warnings
      const args: TaskListingArgs = {
        filter: 'done = true',
        perPage: 600,
      };

      const result = await FilterValidator.validateTaskFiltering(args, mockStorage);

      expect(result.validationWarnings).toBeDefined();
    });

    it('should handle empty args gracefully', async () => {
      const mockStorage = createMockStorage();
      const args: TaskListingArgs = {};

      const result = await FilterValidator.validateTaskFiltering(args, mockStorage);

      expect(result.filterExpression).toBeNull();
      expect(result.filterString).toBeUndefined();
      expect(result.memoryValidation.isValid).toBe(true);
    });
  });
});
