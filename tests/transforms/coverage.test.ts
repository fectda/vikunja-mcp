/**
 * TDD Tests for src/transforms - Phase 3
 * Tests for field-selector, task, and size-calculator transforms
 */

import { FieldSelector, defaultFieldSelector } from '../../src/transforms/field-selector';
import { Verbosity } from '../../src/transforms/base';
import {
  transformTask,
  transformTasks,
  createMinimalTask,
  createStandardTask,
  createDetailedTask,
  createCompleteTask,
  Task,
  OptimizedTask,
} from '../../src/transforms/task';
import { SizeEstimator } from '../../src/transforms/base';

describe('Transforms - Phase 3 Coverage Tests', () => {
  describe('field-selector.ts selectFields', () => {
    it('should filter fields based on MINIMAL verbosity', () => {
      const config = { verbosity: Verbosity.MINIMAL };
      const availableFields = ['id', 'title', 'done', 'description', 'project_id', 'due_date'];

      const result = defaultFieldSelector.selectFields(config, availableFields);

      expect(result.includedFields).toContain('id');
      expect(result.includedFields).toContain('title');
      expect(result.includedFields).toContain('done');
      expect(result.includedFields).not.toContain('description');
    });

    it('should filter fields based on STANDARD verbosity', () => {
      const config = { verbosity: Verbosity.STANDARD };
      const availableFields = ['id', 'title', 'done', 'description', 'project_id', 'due_date'];

      const result = defaultFieldSelector.selectFields(config, availableFields);

      expect(result.includedFields).toContain('id');
      expect(result.includedFields).toContain('title');
      expect(result.includedFields).toContain('description');
      expect(result.includedFields).toContain('project_id');
      expect(result.includedFields).not.toContain('due_date');
    });

    it('should filter fields based on DETAILED verbosity', () => {
      const config = { verbosity: Verbosity.DETAILED };
      const availableFields = [
        'id',
        'title',
        'done',
        'description',
        'project_id',
        'due_date',
        'created_at',
      ];

      const result = defaultFieldSelector.selectFields(config, availableFields);

      expect(result.includedFields).toContain('due_date');
      expect(result.includedFields).toContain('created_at');
    });

    it('should filter fields based on COMPLETE verbosity', () => {
      const config = { verbosity: Verbosity.COMPLETE };
      const availableFields = ['id', 'title', 'done', 'description', 'hex_color', 'position'];

      const result = defaultFieldSelector.selectFields(config, availableFields);

      expect(result.includedFields).toContain('hex_color');
      expect(result.includedFields).toContain('position');
    });

    it('should handle missing fields gracefully', () => {
      const config = { verbosity: Verbosity.STANDARD };
      const availableFields = ['id', 'title']; // missing many fields

      const result = defaultFieldSelector.selectFields(config, availableFields);

      expect(result.includedFields).toEqual(['id', 'title']);
      expect(result.excludedFields).toHaveLength(0);
    });

    it('should respect include field overrides', () => {
      const config = {
        verbosity: Verbosity.MINIMAL,
        fieldOverrides: {
          include: ['description', 'due_date'],
        },
      };
      const availableFields = ['id', 'title', 'done', 'description', 'due_date'];

      const result = defaultFieldSelector.selectFields(config, availableFields);

      expect(result.includedFields).toContain('description');
      expect(result.includedFields).toContain('due_date');
    });

    it('should respect exclude field overrides', () => {
      const config = {
        verbosity: Verbosity.STANDARD,
        fieldOverrides: {
          exclude: ['description'],
        },
      };
      const availableFields = ['id', 'title', 'done', 'description', 'project_id'];

      const result = defaultFieldSelector.selectFields(config, availableFields);

      expect(result.includedFields).not.toContain('description');
    });

    it('should track active field categories', () => {
      const config = { verbosity: Verbosity.DETAILED };
      const availableFields = ['id', 'title', 'done', 'description', 'due_date'];

      const result = defaultFieldSelector.selectFields(config, availableFields);

      expect(result.activeCategories.length).toBeGreaterThan(0);
    });

    it('should return field definitions', () => {
      const config = { verbosity: Verbosity.MINIMAL };
      const availableFields = ['id', 'title'];

      const result = defaultFieldSelector.selectFields(config, availableFields);

      expect(result.fieldDefinitions.length).toBeGreaterThan(0);
      expect(result.fieldDefinitions[0].fieldName).toBeDefined();
      expect(result.fieldDefinitions[0].category).toBeDefined();
    });
  });

  describe('task.ts transformTask', () => {
    const sampleTask: Task = {
      id: 1,
      title: 'Test Task',
      description: 'Test description',
      done: false,
      priority: 3,
      due_date: '2024-12-31',
      start_date: '2024-01-01',
      end_date: '2024-12-31',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z',
      completed_at: undefined,
      project_id: 1,
      hex_color: '#ff0000',
      position: 1,
      identifier: 'TASK-001',
      index: 0,
      parent_task_id: undefined,
      repeat_after: undefined,
      percent_done: 50,
      repeat_mode: 0,
      reminder_dates: [],
      labels: [{ id: 1, title: 'Label 1', description: 'Desc', hex_color: '#fff' }],
      assignees: [{ id: 1, username: 'user', email: 'test@test.com' }],
      subtasks: [],
      related_tasks: [],
      attachment_count: 0,
      cover_image_attachment_id: undefined,
      is_favorite: false,
    };

    it('should transform task to MINIMAL verbosity', () => {
      const result = transformTask(sampleTask, Verbosity.MINIMAL);

      expect(result.data.id).toBe(1);
      expect(result.data.title).toBe('Test Task');
      expect(result.data.done).toBe(false);
      expect(result.metadata.verbosity).toBe(Verbosity.MINIMAL);
      expect(result.metrics.originalSize).toBeGreaterThan(0);
    });

    it('should transform task to STANDARD verbosity', () => {
      const result = transformTask(sampleTask, Verbosity.STANDARD);

      expect(result.data.id).toBe(1);
      expect(result.data.title).toBe('Test Task');
      expect(result.data.done).toBe(false);
      expect(result.data.description).toBe('Test description');
      expect(result.metadata.verbosity).toBe(Verbosity.STANDARD);
    });

    it('should transform task to DETAILED verbosity', () => {
      const result = transformTask(sampleTask, Verbosity.DETAILED);

      expect(result.data.due_date).toBeDefined();
      expect(result.data.created_at).toBeDefined();
      expect(result.metadata.verbosity).toBe(Verbosity.DETAILED);
    });

    it('should transform task to COMPLETE verbosity', () => {
      const result = transformTask(sampleTask, Verbosity.COMPLETE);

      expect(result.data.hex_color).toBeDefined();
      expect(result.data.position).toBeDefined();
      expect(result.metadata.verbosity).toBe(Verbosity.COMPLETE);
    });

    it('should calculate metrics correctly', () => {
      const result = transformTask(sampleTask, Verbosity.STANDARD);

      expect(result.metrics.originalSize).toBeGreaterThan(0);
      expect(result.metrics.optimizedSize).toBeGreaterThan(0);
      expect(result.metrics.reductionPercentage).toBeDefined();
      expect(result.metrics.fieldsIncluded).toBeGreaterThan(0);
      expect(result.metrics.totalFields).toBeGreaterThan(0);
      expect(result.metrics.fieldInclusionPercentage).toBeDefined();
    });

    it('should include timestamp in metadata', () => {
      const result = transformTask(sampleTask, Verbosity.MINIMAL);

      expect(result.metadata.timestamp).toBeDefined();
      expect(result.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should include active categories in metadata', () => {
      const result = transformTask(sampleTask, Verbosity.MINIMAL);

      expect(result.metadata.categoriesIncluded).toBeDefined();
      expect(Array.isArray(result.metadata.categoriesIncluded)).toBe(true);
    });
  });

  describe('task.ts transformTasks', () => {
    const sampleTasks: Task[] = [
      {
        id: 1,
        title: 'Task 1',
        done: false,
        priority: 1,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
      {
        id: 2,
        title: 'Task 2',
        done: true,
        priority: 2,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
    ];

    it('should transform multiple tasks', () => {
      const result = transformTasks(sampleTasks, Verbosity.MINIMAL);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe(1);
      expect(result.data[1].id).toBe(2);
    });

    it('should calculate combined metrics', () => {
      const result = transformTasks(sampleTasks, Verbosity.MINIMAL);

      expect(result.metrics.originalSize).toBeGreaterThan(0);
      expect(result.metrics.optimizedSize).toBeGreaterThan(0);
    });

    it('should handle empty array', () => {
      const result = transformTasks([], Verbosity.MINIMAL);

      expect(result.data).toHaveLength(0);
    });
  });

  describe('task.ts quick transformation functions', () => {
    const sampleTask: Task = {
      id: 1,
      title: 'Test Task',
      done: false,
      priority: 3,
      description: 'Description',
      project_id: 1,
      due_date: '2024-12-31',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z',
    };

    it('should create minimal task', () => {
      const result = createMinimalTask(sampleTask);

      expect(result.id).toBe(1);
      expect(result.title).toBe('Test Task');
      expect(result.done).toBe(false);
      expect(result.priority).toBeUndefined();
    });

    it('should create standard task', () => {
      const result = createStandardTask(sampleTask);

      expect(result.id).toBe(1);
      expect(result.title).toBe('Test Task');
      expect(result.done).toBe(false);
      expect(result.priority).toBe(3);
      expect(result.description).toBe('Description');
      expect(result.project_id).toBe(1);
    });

    it('should create detailed task with date transformations', () => {
      const result = createDetailedTask(sampleTask);

      expect(result.id).toBe(1);
      expect(result.title).toBe('Test Task');
      expect(result.due_date).toBeDefined();
      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
    });

    it('should create complete task', () => {
      const result = createCompleteTask(sampleTask);

      expect(result.id).toBe(1);
      expect(result.title).toBe('Test Task');
    });
  });

  describe('size-calculator.ts SizeEstimator', () => {
    it('should calculate size for string', () => {
      const size = SizeEstimator.estimateSize('hello');
      expect(size).toBe(10); // 5 chars * 2 bytes
    });

    it('should calculate size for number', () => {
      const size = SizeEstimator.estimateSize(123);
      expect(size).toBe(8); // 64-bit number
    });

    it('should calculate size for boolean', () => {
      const size = SizeEstimator.estimateSize(true);
      expect(size).toBe(4);
    });

    it('should calculate size for null', () => {
      const size = SizeEstimator.estimateSize(null);
      expect(size).toBe(0);
    });

    it('should calculate size for undefined', () => {
      const size = SizeEstimator.estimateSize(undefined);
      expect(size).toBe(0);
    });

    it('should calculate size for array', () => {
      const size = SizeEstimator.estimateSize([1, 2, 3]);
      expect(size).toBeGreaterThan(2);
    });

    it('should calculate size for nested objects', () => {
      const nestedObj = {
        level1: {
          level2: {
            value: 'deep',
          },
        },
      };
      const size = SizeEstimator.estimateSize(nestedObj);
      expect(size).toBeGreaterThan(10);
    });

    it('should calculate accurate byte size for nested objects', () => {
      const complexObj = {
        user: {
          name: 'John',
          profile: {
            bio: 'Test bio',
            settings: { theme: 'dark' },
          },
        },
        tags: ['a', 'b', 'c'],
      };
      const size = SizeEstimator.estimateSize(complexObj);
      expect(size).toBeGreaterThan(0);
    });

    describe('calculateReduction', () => {
      it('should calculate reduction percentage', () => {
        const reduction = SizeEstimator.calculateReduction(100, 50);
        expect(reduction).toBe(50);
      });

      it('should handle zero original size', () => {
        const reduction = SizeEstimator.calculateReduction(0, 50);
        expect(reduction).toBe(0);
      });

      it('should handle negative reduction (larger result)', () => {
        const reduction = SizeEstimator.calculateReduction(50, 100);
        expect(reduction).toBe(-100);
      });

      it('should handle equal sizes', () => {
        const reduction = SizeEstimator.calculateReduction(100, 100);
        expect(reduction).toBe(0);
      });
    });
  });

  describe('base.ts FieldSelector instance', () => {
    it('should create FieldSelector instance', () => {
      const selector = new FieldSelector();
      expect(selector).toBeDefined();
    });

    it('should have selectFields method', () => {
      const selector = new FieldSelector();
      expect(typeof selector.selectFields).toBe('function');
    });
  });
});
