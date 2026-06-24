/**
 * TDD Tests for src/types - Phase 4 Coverage
 * Tests createErrorResponse from responses.ts and related type structures.
 */

import { createErrorResponse } from '../../src/types/responses';

describe('Types - Phase 4 Coverage Tests', () => {
  describe('createErrorResponse from responses.ts', () => {
    it('should create error response with operation and message', () => {
      const result = createErrorResponse('list', 'Failed to list tasks');

      expect(result.success).toBe(false);
      expect(result.operation).toBe('list');
      expect(result.message).toBe('Failed to list tasks');
    });

    it('should include code when provided', () => {
      const result = createErrorResponse('create', 'Validation failed', 'VALIDATION_ERROR');

      expect(result.code).toBe('VALIDATION_ERROR');
    });

    it('should not include code when omitted', () => {
      const result = createErrorResponse('delete', 'Not found');

      expect(result.code).toBeUndefined();
    });

    it('should include details when provided', () => {
      const details = { field: 'title', reason: 'required' };
      const result = createErrorResponse('update', 'Invalid field', 'VALIDATION_ERROR', details);

      expect(result.details).toEqual(details);
    });

    it('should not include details when omitted', () => {
      const result = createErrorResponse('list', 'Timeout');

      expect(result.details).toBeUndefined();
    });

    it('should handle empty string for operation and message', () => {
      const result = createErrorResponse('', '');

      expect(result.operation).toBe('');
      expect(result.message).toBe('');
    });

    it('should have success always set to false', () => {
      const result = createErrorResponse('any', 'error');

      expect(result.success).toBe(false);
    });
  });
});
