/**
 * TDD Tests for src/tools/tasks/filtering - Phase 5 Coverage
 * Tests evaluators.ts (evaluateCondition, evaluateComparison, etc.)
 * and other uncovered filtering tool methods.
 */

import {
  evaluateCondition,
  evaluateComparison,
  evaluateDateComparison,
  parseRelativeDate,
  evaluateStringComparison,
  evaluateArrayComparison,
  evaluateGroup,
  applyFilter,
} from '../../../../src/tools/tasks/filtering/evaluators';
import type { Task } from 'node-vikunja';
import type { FilterCondition, FilterGroup, FilterExpression } from '../../../../src/types/filters';

describe('evaluators.ts - Phase 5 Coverage Tests', () => {
  // Helper to create a minimal task
  const createTask = (overrides?: Partial<Task>): Task => ({
    id: 1,
    title: 'Test Task',
    done: false,
    priority: 3,
    percent_done: 50,
    due_date: '2024-12-31',
    created: '2024-01-01T00:00:00Z',
    updated: '2024-06-01T00:00:00Z',
    description: 'Test description',
    project_id: 1,
    position: 1,
    identifier: 'TASK-001',
    labels: [{ id: 1, title: 'Bug', hex_color: '#ff0000', description: 'Bug label' }],
    assignees: [{ id: 1, username: 'user1', email: 'user1@test.com' }],
    ...overrides,
  });

  describe('evaluateCondition', () => {
    it('should evaluate "done" field equality', () => {
      const task = createTask({ done: true });
      const condition: FilterCondition = { field: 'done', operator: '=', value: true };

      expect(evaluateCondition(task, condition)).toBe(true);
    });

    it('should evaluate "done" field with string "true"', () => {
      const task = createTask({ done: true });
      const condition: FilterCondition = { field: 'done', operator: '=', value: 'true' };

      expect(evaluateCondition(task, condition)).toBe(true);
    });

    it('should evaluate "priority" field with > operator', () => {
      const task = createTask({ priority: 5 });
      const condition: FilterCondition = { field: 'priority', operator: '>', value: 3 };

      expect(evaluateCondition(task, condition)).toBe(true);
    });

    it('should evaluate "percentDone" field', () => {
      const task = createTask({ percent_done: 75 });
      const condition: FilterCondition = { field: 'percentDone', operator: '>=', value: 50 };

      expect(evaluateCondition(task, condition)).toBe(true);
    });

    it('should evaluate "dueDate" default case (not null)', () => {
      const task = createTask({ due_date: '2024-12-31' });
      const condition: FilterCondition = { field: 'dueDate', operator: '=', value: '2024-12-31' };

      expect(evaluateCondition(task, condition)).toBe(true);
    });

    it('should evaluate "dueDate" null case with != operator', () => {
      const task = createTask({ due_date: null });
      const condition: FilterCondition = { field: 'dueDate', operator: '!=', value: '2024-12-31' };

      expect(evaluateCondition(task, condition)).toBe(true);
    });

    it('should evaluate "created" field', () => {
      const task = createTask({ created: '2024-01-01T00:00:00Z' });
      const condition: FilterCondition = { field: 'created', operator: '>', value: '2023-01-01' };

      expect(evaluateCondition(task, condition)).toBe(true);
    });

    it('should return false when created field is missing', () => {
      const task = createTask({ created: undefined });
      const condition: FilterCondition = { field: 'created', operator: '=', value: '2024-01-01' };

      expect(evaluateCondition(task, condition)).toBe(false);
    });

    it('should evaluate "updated" field', () => {
      const task = createTask({ updated: '2024-06-01T00:00:00Z' });
      const condition: FilterCondition = { field: 'updated', operator: '>=', value: '2024-01-01' };

      expect(evaluateCondition(task, condition)).toBe(true);
    });

    it('should evaluate "title" field', () => {
      const task = createTask({ title: 'Urgent Bug Fix' });
      const condition: FilterCondition = { field: 'title', operator: 'like', value: 'urgent' };

      expect(evaluateCondition(task, condition)).toBe(true);
    });

    it('should evaluate "description" field', () => {
      const task = createTask({ description: 'This is a critical issue' });
      const condition: FilterCondition = {
        field: 'description',
        operator: 'like',
        value: 'critical',
      };

      expect(evaluateCondition(task, condition)).toBe(true);
    });

    it('should evaluate "assignees" field with array value', () => {
      const task = createTask({
        assignees: [
          { id: 1, username: 'user1' },
          { id: 2, username: 'user2' },
        ],
      });
      const condition: FilterCondition = { field: 'assignees', operator: 'in', value: [1, 3] };

      expect(evaluateCondition(task, condition)).toBe(true);
    });

    it('should evaluate "labels" field with single value', () => {
      const task = createTask({
        labels: [{ id: 1, title: 'Bug', hex_color: '#ff0000', description: 'Bug label' }],
      });
      const condition: FilterCondition = { field: 'labels', operator: 'in', value: 1 };

      expect(evaluateCondition(task, condition)).toBe(true);
    });

    it('should return false for unknown field', () => {
      const task = createTask();
      const condition = { field: 'unknown', operator: '=', value: 'test' } as FilterCondition;

      expect(evaluateCondition(task, condition)).toBe(false);
    });
  });

  describe('evaluateComparison', () => {
    it('should evaluate = operator', () => {
      expect(evaluateComparison(5, '=', 5)).toBe(true);
      expect(evaluateComparison(5, '=', 10)).toBe(false);
    });

    it('should evaluate != operator', () => {
      expect(evaluateComparison(5, '!=', 10)).toBe(true);
      expect(evaluateComparison(5, '!=', 5)).toBe(false);
    });

    it('should evaluate > operator', () => {
      expect(evaluateComparison(10, '>', 5)).toBe(true);
    });

    it('should evaluate >= operator', () => {
      expect(evaluateComparison(5, '>=', 5)).toBe(true);
      expect(evaluateComparison(4, '>=', 5)).toBe(false);
    });

    it('should evaluate < operator', () => {
      expect(evaluateComparison(3, '<', 5)).toBe(true);
    });

    it('should evaluate <= operator', () => {
      expect(evaluateComparison(5, '<=', 5)).toBe(true);
      expect(evaluateComparison(6, '<=', 5)).toBe(false);
    });

    it('should return false for unknown operator', () => {
      expect(evaluateComparison(5, 'unknown', 5)).toBe(false);
    });

    it('should handle numeric coercion', () => {
      expect(evaluateComparison('5', '>', 3)).toBe(true);
      expect(evaluateComparison(3, '>', '5')).toBe(false);
    });
  });

  describe('evaluateDateComparison', () => {
    it('should evaluate date equality', () => {
      expect(evaluateDateComparison('2024-01-01', '=', '2024-01-01')).toBe(true);
      expect(evaluateDateComparison('2024-01-01', '=', '2024-01-02')).toBe(false);
    });

    it('should evaluate date inequality', () => {
      expect(evaluateDateComparison('2024-01-01', '!=', '2024-01-02')).toBe(true);
    });

    it('should evaluate date > operator', () => {
      expect(evaluateDateComparison('2024-06-01', '>', '2024-01-01')).toBe(true);
      expect(evaluateDateComparison('2024-01-01', '>', '2024-06-01')).toBe(false);
    });

    it('should evaluate date >= operator', () => {
      expect(evaluateDateComparison('2024-01-01', '>=', '2024-01-01')).toBe(true);
    });

    it('should evaluate date < operator', () => {
      expect(evaluateDateComparison('2024-01-01', '<', '2024-06-01')).toBe(true);
    });

    it('should evaluate date <= operator', () => {
      expect(evaluateDateComparison('2024-01-01', '<=', '2024-01-01')).toBe(true);
    });

    it('should return false for unknown operator', () => {
      expect(evaluateDateComparison('2024-01-01', 'unknown', '2024-01-01')).toBe(false);
    });

    it('should return false when expected date is not parseable', () => {
      expect(evaluateDateComparison('2024-01-01', '=', 'not-a-date')).toBe(false);
    });

    it('should handle relative date "now"', () => {
      const result = evaluateDateComparison(new Date().toISOString(), '=', 'now');
      expect(result).toBe(true);
    });

    it('should handle relative date with offset', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      // Use the same logic to test: date comparison with now+7d
      const conditionResult = evaluateDateComparison(
        futureDate.toISOString(),
        '<',
        `now+${8 * 24 * 60}d`,
      );
      expect(conditionResult).toBe(true);
    });
  });

  describe('parseRelativeDate', () => {
    it('should parse ISO date format', () => {
      const result = parseRelativeDate('2024-06-15');
      expect(result).not.toBeNull();
      // Use UTC methods since ISO date strings are parsed as UTC
      expect(result?.getUTCFullYear()).toBe(2024);
      expect(result?.getUTCMonth()).toBe(5); // June (0-indexed)
      expect(result?.getUTCDate()).toBe(15);
    });

    it('should parse "now" keyword', () => {
      const before = Date.now();
      const result = parseRelativeDate('now');
      const after = Date.now();

      expect(result).not.toBeNull();
      expect(result!.getTime()).toBeGreaterThanOrEqual(before);
      expect(result!.getTime()).toBeLessThanOrEqual(after);
    });

    it('should parse relative date with days offset', () => {
      const result = parseRelativeDate('now+7d');
      expect(result).not.toBeNull();
    });

    it('should parse relative date with seconds offset', () => {
      const result = parseRelativeDate('now+30s');
      expect(result).not.toBeNull();
    });

    it('should parse relative date with minutes offset', () => {
      const result = parseRelativeDate('now+15m');
      expect(result).not.toBeNull();
    });

    it('should parse relative date with hours offset', () => {
      const result = parseRelativeDate('now+2h');
      expect(result).not.toBeNull();
    });

    it('should parse relative date with weeks offset', () => {
      const result = parseRelativeDate('now-1w');
      expect(result).not.toBeNull();
    });

    it('should parse relative date with months offset', () => {
      const result = parseRelativeDate('now+3M');
      expect(result).not.toBeNull();
    });

    it('should parse relative date with years offset', () => {
      const result = parseRelativeDate('now-1y');
      expect(result).not.toBeNull();
    });

    it('should parse relative date with default day unit', () => {
      // No unit specified - defaults to days
      const result = parseRelativeDate('now+5');
      expect(result).not.toBeNull();
    });

    it('should return null for unparseable date string', () => {
      const result = parseRelativeDate('completely-invalid');
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = parseRelativeDate('');
      expect(result).toBeNull();
    });
  });

  describe('evaluateStringComparison', () => {
    it('should evaluate = operator', () => {
      expect(evaluateStringComparison('hello', '=', 'hello')).toBe(true);
      expect(evaluateStringComparison('hello', '=', 'world')).toBe(false);
    });

    it('should evaluate != operator', () => {
      expect(evaluateStringComparison('hello', '!=', 'world')).toBe(true);
      expect(evaluateStringComparison('hello', '!=', 'hello')).toBe(false);
    });

    it('should evaluate "like" operator case-insensitively', () => {
      expect(evaluateStringComparison('Hello World', 'like', 'hello')).toBe(true);
      expect(evaluateStringComparison('Hello World', 'like', 'WORLD')).toBe(true);
    });

    it('should return false for unknown operator', () => {
      expect(evaluateStringComparison('hello', 'unknown', 'hello')).toBe(false);
    });
  });

  describe('evaluateArrayComparison', () => {
    it('should evaluate "in" operator - value present', () => {
      expect(evaluateArrayComparison([1, 2, 3], 'in', [2, 4])).toBe(true);
    });

    it('should evaluate "in" operator - value absent', () => {
      expect(evaluateArrayComparison([1, 2, 3], 'in', [4, 5])).toBe(false);
    });

    it('should evaluate "not in" operator - value absent', () => {
      expect(evaluateArrayComparison([1, 2, 3], 'not in', [4, 5])).toBe(true);
    });

    it('should evaluate "not in" operator - value present', () => {
      expect(evaluateArrayComparison([1, 2, 3], 'not in', [2, 4])).toBe(false);
    });

    it('should return false for unknown operator', () => {
      expect(evaluateArrayComparison([1, 2, 3], 'unknown', [1])).toBe(false);
    });

    it('should handle empty arrays', () => {
      expect(evaluateArrayComparison([], 'in', [1])).toBe(false);
      expect(evaluateArrayComparison([], 'not in', [1])).toBe(true);
    });
  });

  describe('evaluateGroup', () => {
    it('should return true when all conditions match with && operator', () => {
      const task = createTask({ done: true, priority: 5 });
      const group: FilterGroup = {
        conditions: [
          { field: 'done', operator: '=', value: true },
          { field: 'priority', operator: '>', value: 3 },
        ],
        operator: '&&',
      };

      expect(evaluateGroup(task, group)).toBe(true);
    });

    it('should return false when any condition fails with && operator', () => {
      const task = createTask({ done: true, priority: 1 });
      const group: FilterGroup = {
        conditions: [
          { field: 'done', operator: '=', value: true },
          { field: 'priority', operator: '>', value: 3 },
        ],
        operator: '&&',
      };

      expect(evaluateGroup(task, group)).toBe(false);
    });

    it('should return true when any condition matches with || operator', () => {
      const task = createTask({ done: true, priority: 1 });
      const group: FilterGroup = {
        conditions: [
          { field: 'done', operator: '=', value: false },
          { field: 'priority', operator: '>', value: 3 },
          { field: 'title', operator: '=', value: 'Test Task' },
        ],
        operator: '||',
      };

      expect(evaluateGroup(task, group)).toBe(true);
    });

    it('should return false when no conditions match with || operator', () => {
      const task = createTask({ done: false, priority: 1 });
      const group: FilterGroup = {
        conditions: [
          { field: 'done', operator: '=', value: true },
          { field: 'priority', operator: '>', value: 3 },
        ],
        operator: '||',
      };

      expect(evaluateGroup(task, group)).toBe(false);
    });
  });

  describe('applyFilter', () => {
    it('should filter tasks matching all groups with && operator', () => {
      const tasks: Task[] = [
        createTask({ id: 1, title: 'Task 1', done: true }),
        createTask({ id: 2, title: 'Task 2', done: false }),
        createTask({ id: 3, title: 'Task 3', done: true }),
      ];

      const expression: FilterExpression = {
        groups: [
          {
            conditions: [{ field: 'done', operator: '=', value: true }],
            operator: '&&',
          },
        ],
        operator: '&&',
      };

      const result = applyFilter(tasks, expression);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(3);
    });

    it('should filter tasks matching any group with || operator', () => {
      const tasks: Task[] = [
        createTask({ id: 1, title: 'Task 1', done: true, priority: 1 }),
        createTask({ id: 2, title: 'Task 2', done: false, priority: 5 }),
        createTask({ id: 3, title: 'Task 3', done: false, priority: 1 }),
      ];

      const expression: FilterExpression = {
        groups: [
          {
            conditions: [{ field: 'done', operator: '=', value: true }],
            operator: '&&',
          },
          {
            conditions: [{ field: 'priority', operator: '>', value: 3 }],
            operator: '&&',
          },
        ],
        operator: '||',
      };

      const result = applyFilter(tasks, expression);
      expect(result).toHaveLength(2);
      expect(result.map((t) => t.id)).toEqual(expect.arrayContaining([1, 2]));
    });

    it('should default to && operator when expression has no operator', () => {
      const tasks: Task[] = [
        createTask({ id: 1, title: 'Task 1', done: true, priority: 5 }),
        createTask({ id: 2, title: 'Task 2', done: false, priority: 1 }),
      ];

      const expression: FilterExpression = {
        groups: [
          {
            conditions: [{ field: 'done', operator: '=', value: true }],
            operator: '&&',
          },
        ],
      };

      const result = applyFilter(tasks, expression);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('should return empty array when no tasks match', () => {
      const tasks: Task[] = [createTask({ id: 1, title: 'Task 1', done: false })];

      const expression: FilterExpression = {
        groups: [
          {
            conditions: [{ field: 'done', operator: '=', value: true }],
            operator: '&&',
          },
        ],
      };

      const result = applyFilter(tasks, expression);
      expect(result).toHaveLength(0);
    });
  });
});
