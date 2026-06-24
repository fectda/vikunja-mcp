/**
 * TDD Tests for src/transforms/size-calculator - Phase 3 Coverage
 * Tests SizeCalculator class, utility functions, and edge cases
 * not covered by existing transforms tests.
 */

import {
  SizeCalculator,
  defaultSizeCalculator,
  calculateSizeMetrics,
  calculateResponseMetrics,
  estimateSize,
  calculateReduction,
} from '../../src/transforms/size-calculator';
import { Verbosity, FieldCategory, SizeEstimator } from '../../src/transforms/base';
import type { TransformationResult, OptimizedResponse } from '../../src/transforms/base';

describe('size-calculator.ts SizeCalculator - Phase 3 Coverage Tests', () => {
  let calculator: SizeCalculator;

  beforeEach(() => {
    calculator = new SizeCalculator();
  });

  describe('calculateMetrics', () => {
    const createResult = (overrides?: Partial<TransformationResult>): TransformationResult => ({
      data: { id: 1, title: 'Test', done: false },
      metrics: {
        originalSize: 100,
        optimizedSize: 60,
        reductionPercentage: 40,
        fieldsIncluded: 3,
        totalFields: 6,
        fieldInclusionPercentage: 50,
      },
      metadata: {
        verbosity: Verbosity.STANDARD,
        categoriesIncluded: [FieldCategory.CORE, FieldCategory.CONTEXT],
        timestamp: '2024-01-01T00:00:00.000Z',
        processingTimeMs: 10,
      },
      ...overrides,
    });

    it('should calculate size metrics from a TransformationResult', () => {
      const result = calculator.calculateMetrics(createResult());

      expect(result.metrics.originalSize).toBe(100);
      expect(result.metrics.optimizedSize).toBe(60);
      expect(result.metrics.reductionPercentage).toBe(40);
    });

    it('should calculate reductionAbsolute correctly', () => {
      const result = calculator.calculateMetrics(
        createResult({
          metrics: { ...createResult().metrics, originalSize: 200, optimizedSize: 50 },
        }),
      );

      expect(result.metrics.reductionAbsolute).toBe(150);
    });

    it('should calculate compressionRatio correctly', () => {
      const result = calculator.calculateMetrics(createResult());

      expect(result.metrics.compressionRatio).toBeCloseTo(1.67, 1);
    });

    it('should handle zero optimized size (compression ratio of 1)', () => {
      const result = calculator.calculateMetrics(
        createResult({ metrics: { ...createResult().metrics, originalSize: 0, optimizedSize: 0 } }),
      );

      expect(result.metrics.compressionRatio).toBe(1);
    });

    it('should calculate bytesSavedPerField', () => {
      const result = calculator.calculateMetrics(createResult());

      expect(result.metrics.bytesSavedPerField).toBeGreaterThan(0);
    });

    it('should handle zero fieldsIncluded for bytesSavedPerField', () => {
      const result = calculator.calculateMetrics(
        createResult({
          metrics: {
            ...createResult().metrics,
            fieldsIncluded: 0,
            originalSize: 100,
            optimizedSize: 100,
          },
        }),
      );

      expect(result.metrics.bytesSavedPerField).toBe(0);
    });

    it('should include performance metrics', () => {
      const result = calculator.calculateMetrics(createResult());

      expect(result.performance.calculationTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.performance.fieldsProcessed).toBe(6);
      expect(result.performance.objectsProcessed).toBe(1);
    });

    it('should include breakdown structure', () => {
      const result = calculator.calculateMetrics(createResult());

      expect(result.breakdown).toBeDefined();
      expect(result.breakdown.byField).toBeDefined();
      expect(result.breakdown.byCategory).toBeDefined();
      expect(result.breakdown.byType).toBeDefined();
    });

    it('should calculate performance objectsProcessed for array data', () => {
      const result = calculator.calculateMetrics(
        createResult({ data: [{ id: 1 }, { id: 2 }, { id: 3 }] }),
      );

      expect(result.performance.objectsProcessed).toBe(3);
    });

    it('should include timestamp in result', () => {
      const result = calculator.calculateMetrics(createResult());

      expect(result.timestamp).toBeDefined();
      expect(() => new Date(result.timestamp)).not.toThrow();
    });

    it('should add result to calculation history', () => {
      calculator.calculateMetrics(createResult());
      calculator.calculateMetrics(createResult({ data: { id: 2, title: 'Another' } }));

      const history = calculator.getHistory();
      expect(history).toHaveLength(2);
    });
  });

  describe('calculateResponseMetrics', () => {
    const createResponse = (overrides?: Partial<OptimizedResponse>): OptimizedResponse => ({
      success: true,
      operation: 'list',
      message: 'Success',
      data: { id: 1, title: 'Test' },
      metadata: {
        timestamp: '2024-01-01T00:00:00.000Z',
        optimization: {
          verbosity: Verbosity.STANDARD,
          sizeMetrics: {
            originalSize: 200,
            optimizedSize: 100,
            reductionPercentage: 50,
          },
          fieldMetrics: {
            fieldsIncluded: 5,
            totalFields: 10,
            inclusionPercentage: 50,
          },
          categoriesIncluded: [FieldCategory.CORE],
          performance: {
            transformationTimeMs: 5,
            totalTimeMs: 10,
          },
        },
      },
      ...overrides,
    });

    it('should calculate metrics from an OptimizedResponse', () => {
      const result = calculator.calculateResponseMetrics(createResponse());

      expect(result.metrics.originalSize).toBe(200);
      expect(result.metrics.optimizedSize).toBe(100);
      expect(result.metrics.reductionPercentage).toBe(50);
    });

    it('should throw when response has no optimization metadata', () => {
      const response = createResponse();
      response.metadata.optimization = undefined;

      expect(() => calculator.calculateResponseMetrics(response)).toThrow(
        'Response does not contain optimization metadata',
      );
    });

    it('should calculate fieldsReduced from fieldMetrics', () => {
      const result = calculator.calculateResponseMetrics(createResponse());

      expect(result.metrics.fieldsReduced).toBe(5); // totalFields(10) - fieldsIncluded(5)
    });

    it('should handle array data for objectsProcessed', () => {
      const result = calculator.calculateResponseMetrics(
        createResponse({ data: [{ id: 1 }, { id: 2 }] }),
      );

      expect(result.performance.objectsProcessed).toBe(2);
    });
  });

  describe('getHistory', () => {
    it('should return empty array when no calculations have been done', () => {
      const history = calculator.getHistory();

      expect(history).toEqual([]);
    });

    it('should return a copy of the history array (not the reference)', () => {
      calculator.calculateMetrics({
        data: { id: 1, title: 'Test', done: false },
        metrics: {
          originalSize: 100,
          optimizedSize: 60,
          reductionPercentage: 40,
          fieldsIncluded: 3,
          totalFields: 6,
          fieldInclusionPercentage: 50,
        },
        metadata: {
          verbosity: Verbosity.STANDARD,
          categoriesIncluded: [FieldCategory.CORE],
          timestamp: '2024-01-01T00:00:00.000Z',
          processingTimeMs: 10,
        },
      });

      const history = calculator.getHistory();
      history.pop(); // Mutate the returned array

      // Internal history should not be affected
      expect(calculator.getHistory()).toHaveLength(1);
    });
  });

  describe('getAverageMetrics', () => {
    it('should return zeros when history is empty', () => {
      const averages = calculator.getAverageMetrics();

      expect(averages.averageReduction).toBe(0);
      expect(averages.averageCompressionRatio).toBe(1);
      expect(averages.totalFieldsProcessed).toBe(0);
      expect(averages.totalObjectsProcessed).toBe(0);
      expect(averages.totalBytesSaved).toBe(0);
    });

    it('should calculate averages from history', () => {
      const baseResult = {
        data: { id: 1, title: 'Test', done: false },
        metrics: {
          originalSize: 100,
          optimizedSize: 60,
          reductionPercentage: 40,
          fieldsIncluded: 3,
          totalFields: 6,
          fieldInclusionPercentage: 50,
        },
        metadata: {
          verbosity: Verbosity.STANDARD,
          categoriesIncluded: [FieldCategory.CORE],
          timestamp: '2024-01-01T00:00:00.000Z',
          processingTimeMs: 10,
        },
      };

      calculator.calculateMetrics(baseResult);
      calculator.calculateMetrics({
        ...baseResult,
        metrics: {
          ...baseResult.metrics,
          originalSize: 200,
          optimizedSize: 100,
          reductionPercentage: 50,
        },
      });

      const averages = calculator.getAverageMetrics();

      expect(averages.averageReduction).toBe(45); // (40 + 50) / 2
      expect(averages.totalFieldsProcessed).toBe(12); // 6 + 6
      expect(averages.totalBytesSaved).toBe(140); // (100-60) + (200-100)
    });
  });

  describe('clearHistory', () => {
    it('should clear all calculation history', () => {
      calculator.calculateMetrics({
        data: { id: 1 },
        metrics: {
          originalSize: 100,
          optimizedSize: 60,
          reductionPercentage: 40,
          fieldsIncluded: 3,
          totalFields: 6,
          fieldInclusionPercentage: 50,
        },
        metadata: {
          verbosity: Verbosity.MINIMAL,
          categoriesIncluded: [FieldCategory.CORE],
          timestamp: '2024-01-01T00:00:00.000Z',
          processingTimeMs: 10,
        },
      });

      expect(calculator.getHistory()).toHaveLength(1);

      calculator.clearHistory();

      expect(calculator.getHistory()).toHaveLength(0);
    });
  });

  describe('generatePerformanceReport', () => {
    it('should generate a report string when there is history', () => {
      calculator.calculateMetrics({
        data: { id: 1, title: 'Test', done: false },
        metrics: {
          originalSize: 100,
          optimizedSize: 60,
          reductionPercentage: 40,
          fieldsIncluded: 3,
          totalFields: 6,
          fieldInclusionPercentage: 50,
        },
        metadata: {
          verbosity: Verbosity.STANDARD,
          categoriesIncluded: [FieldCategory.CORE],
          timestamp: '2024-01-01T00:00:00.000Z',
          processingTimeMs: 10,
        },
      });

      const report = calculator.generatePerformanceReport();

      expect(report).toContain('Size Calculator Performance Report');
      expect(report).toContain('40.00%'); // reduction percentage
      expect(report).toContain('Time:'); // processing time section
    });

    it('should generate a report string when history is empty (no crash with slice)', () => {
      const report = calculator.generatePerformanceReport();

      expect(report).toContain('Size Calculator Performance Report');
    });
  });
});

describe('size-calculator.ts Utility Functions - Phase 3 Coverage', () => {
  it('calculateSizeMetrics should use default calculator', () => {
    const result = {
      data: { id: 1, title: 'Test', done: false },
      metrics: {
        originalSize: 100,
        optimizedSize: 60,
        reductionPercentage: 40,
        fieldsIncluded: 3,
        totalFields: 6,
        fieldInclusionPercentage: 50,
      },
      metadata: {
        verbosity: Verbosity.STANDARD,
        categoriesIncluded: [FieldCategory.CORE],
        timestamp: '2024-01-01T00:00:00.000Z',
        processingTimeMs: 10,
      },
    };

    const metrics = calculateSizeMetrics(result);
    expect(metrics.metrics.originalSize).toBe(100);
  });

  it('calculateResponseMetrics should use default calculator', () => {
    const response: OptimizedResponse = {
      success: true,
      operation: 'list',
      message: 'Success',
      data: { id: 1 },
      metadata: {
        timestamp: '2024-01-01T00:00:00.000Z',
        optimization: {
          verbosity: Verbosity.STANDARD,
          sizeMetrics: { originalSize: 100, optimizedSize: 50, reductionPercentage: 50 },
          fieldMetrics: { fieldsIncluded: 3, totalFields: 6, inclusionPercentage: 50 },
          categoriesIncluded: [FieldCategory.CORE],
          performance: { transformationTimeMs: 5, totalTimeMs: 10 },
        },
      },
    };

    const metrics = calculateResponseMetrics(response);
    expect(metrics.metrics.reductionPercentage).toBe(50);
  });

  it('estimateSize should delegate to SizeEstimator', () => {
    expect(estimateSize('hello')).toBe(SizeEstimator.estimateSize('hello'));
    expect(estimateSize(42)).toBe(SizeEstimator.estimateSize(42));
  });

  it('calculateReduction should delegate to SizeEstimator', () => {
    expect(calculateReduction(100, 50)).toBe(SizeEstimator.calculateReduction(100, 50));
    expect(calculateReduction(0, 50)).toBe(SizeEstimator.calculateReduction(0, 50));
  });

  it('defaultSizeCalculator should be a SizeCalculator instance', () => {
    expect(defaultSizeCalculator).toBeInstanceOf(SizeCalculator);
  });
});
