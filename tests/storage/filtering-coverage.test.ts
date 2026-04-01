/**
 * TDD Tests for src/storage/filtering - Phase 2
 * Tests for FilterSerializer serialize, deserialize, and validate methods
 */

import { FilterSerializer } from '../../src/storage/filtering/FilterSerializer';
import type { FilterExpression } from '../../src/types/filters';

describe('FilterSerializer - Phase 2 Coverage Tests', () => {
  let serializer: FilterSerializer;

  beforeEach(() => {
    serializer = new FilterSerializer();
  });

  describe('serialize method', () => {
    it('should serialize a valid filter expression to JSON string', () => {
      const validExpression: FilterExpression = {
        groups: [
          {
            conditions: [
              {
                field: 'title',
                operator: '=',
                value: 'Test Task',
              },
            ],
            operator: '&&',
          },
        ],
      };

      const result = serializer.serialize(validExpression);

      expect(result).toBe(JSON.stringify(validExpression));
    });

    it('should throw error for invalid expression structure - missing groups', () => {
      const invalidExpression = {
        operator: '&&',
      } as unknown as FilterExpression;

      expect(() => {
        serializer.serialize(invalidExpression);
      }).toThrow('Invalid filter expression');
    });

    it('should throw error for invalid expression structure - groups not array', () => {
      const invalidExpression = {
        groups: 'not an array',
      } as unknown as FilterExpression;

      expect(() => {
        serializer.serialize(invalidExpression);
      }).toThrow('Invalid filter expression');
    });

    it('should throw error for invalid group - missing conditions', () => {
      const invalidExpression = {
        groups: [
          {
            operator: '&&',
          },
        ],
      } as unknown as FilterExpression;

      expect(() => {
        serializer.serialize(invalidExpression);
      }).toThrow('Invalid filter expression');
    });

    it('should throw error for invalid group - invalid operator', () => {
      const invalidExpression = {
        groups: [
          {
            conditions: [{ field: 'title', operator: '=', value: 'test' }],
            operator: 'INVALID' as any,
          },
        ],
      } as unknown as FilterExpression;

      expect(() => {
        serializer.serialize(invalidExpression);
      }).toThrow('Invalid filter expression');
    });

    it('should throw error for invalid condition - missing field', () => {
      const invalidExpression = {
        groups: [
          {
            conditions: [
              {
                operator: '=',
                value: 'test',
              },
            ],
            operator: '&&',
          },
        ],
      } as unknown as FilterExpression;

      expect(() => {
        serializer.serialize(invalidExpression);
      }).toThrow('Invalid filter expression');
    });

    it('should throw error for invalid condition - invalid operator', () => {
      const invalidExpression = {
        groups: [
          {
            conditions: [
              {
                field: 'title',
                operator: 'INVALID_OP' as any,
                value: 'test',
              },
            ],
            operator: '&&',
          },
        ],
      } as unknown as FilterExpression;

      expect(() => {
        serializer.serialize(invalidExpression);
      }).toThrow('Invalid filter expression');
    });

    it('should serialize expression with multiple groups', () => {
      const expression: FilterExpression = {
        groups: [
          { conditions: [{ field: 'title', operator: '=', value: 'a' }], operator: '&&' },
          { conditions: [{ field: 'done', operator: '=', value: false }], operator: '||' },
        ],
      };

      const result = serializer.serialize(expression);
      expect(result).toContain('"groups"');
    });
  });

  describe('deserialize method', () => {
    it('should parse valid JSON to FilterExpression', () => {
      const validJson = JSON.stringify({
        groups: [
          {
            conditions: [
              {
                field: 'title',
                operator: '=',
                value: 'Test Task',
              },
            ],
            operator: '&&',
          },
        ],
      });

      const result = serializer.deserialize(validJson);

      expect(result).toEqual({
        groups: [
          {
            conditions: [
              {
                field: 'title',
                operator: '=',
                value: 'Test Task',
              },
            ],
            operator: '&&',
          },
        ],
      });
    });

    it('should throw error for invalid JSON string', () => {
      const invalidJson = '{ not valid json }';

      expect(() => {
        serializer.deserialize(invalidJson);
      }).toThrow('Failed to deserialize filter expression');
    });

    it('should throw error for JSON that is not an object', () => {
      const json = '"just a string"';

      expect(() => {
        serializer.deserialize(json);
      }).toThrow('Invalid filter expression structure');
    });

    it('should throw error for empty JSON object', () => {
      const json = '{}';

      expect(() => {
        serializer.deserialize(json);
      }).toThrow('Invalid filter expression structure');
    });

    it('should throw error for missing groups in parsed JSON', () => {
      const json = JSON.stringify({ operator: '&&' });

      expect(() => {
        serializer.deserialize(json);
      }).toThrow('Invalid filter expression structure');
    });

    it('should throw error for invalid group in parsed JSON', () => {
      const json = JSON.stringify({
        groups: [
          {
            // missing conditions and operator
          },
        ],
      });

      expect(() => {
        serializer.deserialize(json);
      }).toThrow('Invalid filter expression structure');
    });
  });

  describe('validate method', () => {
    it('should return valid=true for valid filter expression', () => {
      const validExpression: FilterExpression = {
        groups: [
          {
            conditions: [
              {
                field: 'title',
                operator: '=',
                value: 'Test Task',
              },
            ],
            operator: '&&',
          },
        ],
      };

      const result = serializer.validate(validExpression);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for missing groups array', () => {
      const invalidExpression = {
        operator: '&&',
      } as unknown as FilterExpression;

      const result = serializer.validate(invalidExpression);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Expression must have a groups array');
    });

    it('should return errors for invalid group operators', () => {
      const invalidExpression = {
        groups: [
          {
            conditions: [{ field: 'title', operator: '=', value: 'test' }],
            operator: 'INVALID' as any,
          },
        ],
      } as unknown as FilterExpression;

      const result = serializer.validate(invalidExpression);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("operator must be '&&' or '||'"))).toBe(true);
    });

    it('should return errors for invalid condition operators', () => {
      const invalidExpression = {
        groups: [
          {
            conditions: [
              {
                field: 'title',
                operator: 'INVALID_OP' as any,
                value: 'test',
              },
            ],
            operator: '&&',
          },
        ],
      } as unknown as FilterExpression;

      const result = serializer.validate(invalidExpression);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('operator must be one of'))).toBe(true);
    });

    it('should return errors for missing condition field', () => {
      const invalidExpression = {
        groups: [
          {
            conditions: [
              {
                operator: '=',
                value: 'test',
              },
            ],
            operator: '&&',
          },
        ],
      } as unknown as FilterExpression;

      const result = serializer.validate(invalidExpression);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('.field must be a string'))).toBe(true);
    });

    it('should return errors for missing condition value', () => {
      const invalidExpression = {
        groups: [
          {
            conditions: [
              {
                field: 'title',
                operator: '=',
              },
            ],
            operator: '&&',
          },
        ],
      } as unknown as FilterExpression;

      const result = serializer.validate(invalidExpression);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('.value is required'))).toBe(true);
    });

    it('should handle null/undefined input gracefully', () => {
      const resultNull = serializer.validate(null);
      expect(resultNull.valid).toBe(false);
      expect(resultNull.errors).toContain('Expression must be an object');

      const resultUndefined = serializer.validate(undefined);
      expect(resultUndefined.valid).toBe(false);
      expect(resultUndefined.errors).toContain('Expression must be an object');
    });

    it('should handle non-object inputs gracefully', () => {
      const resultString = serializer.validate('string');
      expect(resultString.valid).toBe(false);

      const resultNumber = serializer.validate(123);
      expect(resultNumber.valid).toBe(false);

      const resultArray = serializer.validate([]);
      expect(resultArray.valid).toBe(false);
    });

    it('should validate multiple conditions within a group', () => {
      const expression: FilterExpression = {
        groups: [
          {
            conditions: [
              { field: 'title', operator: '=', value: 'test1' },
              { field: 'done', operator: '=', value: false },
            ],
            operator: '&&',
          },
        ],
      };

      const result = serializer.validate(expression);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate multiple groups', () => {
      const expression: FilterExpression = {
        groups: [
          { conditions: [{ field: 'title', operator: '=', value: 'test1' }], operator: '&&' },
          { conditions: [{ field: 'done', operator: '=', value: false }], operator: '||' },
        ],
      };

      const result = serializer.validate(expression);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate various valid condition operators', () => {
      const operators = ['=', '!=', '>', '>=', '<', '<=', 'like', 'LIKE', 'in', 'not in'];

      operators.forEach((operator) => {
        const expression = {
          groups: [
            {
              conditions: [{ field: 'title', operator, value: 'test' }],
              operator: '&&',
            },
          ],
        } as unknown as FilterExpression;

        const result = serializer.validate(expression);
        expect(result.valid).toBe(true);
      });
    });

    it('should return errors for root level invalid operator', () => {
      const expression = {
        groups: [],
        operator: 'INVALID' as any,
      } as unknown as FilterExpression;

      const result = serializer.validate(expression);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid operator at root level');
    });
  });
});
