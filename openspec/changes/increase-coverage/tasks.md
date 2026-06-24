# Tasks: Increase Test Coverage on 5 Lowest Modules

## Phase 1: src/tools/tasks/bulk (21.75% → 92.33% statements, 17.74% → 91.84% lines)

- [x] 1.1 Write test for BulkOperationProcessor.bulkUpdateTasks - validate input throws error when taskIds is empty array
- [x] 1.2 Write test for BulkOperationProcessor.bulkUpdateTasks - validate input throws error when field is missing
- [x] 1.3 Write test for BulkOperationProcessor.bulkDeleteTasks - validate delete with empty taskIds array
- [x] 1.4 Write test for BulkOperationProcessor.bulkCreateTasks - validate create with empty tasks array
- [x] 1.5 Write test for BulkOperationValidator.validateBulkUpdate - throws error for invalid taskId types
- [x] 1.6 Write test for BulkOperationValidator.preprocessFieldValue - converts string "true"/"false" to boolean
- [x] 1.7 Write test for BulkOperationValidator.validateFieldConstraints - rejects priority > 4 or < 1

## Phase 2: src/storage/filtering (16% → 90.66% statements, 20% → 90.66% lines)

- [x] 2.1 Write test for FilterSerializer.serialize - throws error for invalid expression structure
- [x] 2.2 Write test for FilterSerializer.deserialize - parses valid JSON to FilterExpression
- [x] 2.3 Write test for FilterSerializer.deserialize - throws error for invalid JSON
- [x] 2.4 Write test for FilterSerializer.validate - returns errors for missing groups array
- [x] 2.5 Write test for FilterSerializer.validate - returns errors for invalid group operators
- [x] 2.6 Write test for FilterSerializer.validate - returns errors for invalid condition operators

## Phase 3: src/transforms (55.85% → 87.95% statements, 48.05% → 89.45% lines)

- [x] 3.1 Write test for field-selector.ts selectFields function - filters based on verbosity level
- [x] 3.2 Write test for field-selector.ts selectFields function - handles missing fields gracefully
- [x] 3.3 Write test for task.ts transformTask function - transforms task to minimal verbosity
- [x] 3.4 Write test for task.ts transformTask function - transforms task to detailed verbosity
- [x] 3.5 Write test for size-calculator.ts - calculates accurate byte size for nested objects
- [x] 3.6 Write test for base.ts SizeEstimator.calculateReduction - handles zero original size

## Phase 4: src/types (82.6% → 97.82% statements, 47.05% → 52.94% lines)

- [x] 4.1 Write test for VikunjaTask type - accepts all optional fields
- [x] 4.2 Write test for FilterExpression type - validates group structure
- [x] 4.3 Write test for error types - MCPError serialization/deserialization

## Phase 5: src/tools/tasks/filtering + src/utils/filtering (58.35% → 90.85% statements, 50% → 90.96% lines)

- [x] 5.1 Write test for ClientSideFilteringStrategy - filters tasks in memory (utils/filtering: 100% stmts ✅)
- [x] 5.2 Ensure coverage thresholds met by existing filter tests if needed

## Results

| Module                    | Before | After  | Target  |
| ------------------------- | ------ | ------ | ------- |
| src/tools/tasks/bulk      | 21.75% | 92.33% | ✅ ≥80% |
| src/storage/filtering     | 16%    | 90.66% | ✅ ≥80% |
| src/transforms            | 55.85% | 87.95% | ✅ ≥80% |
| src/types                 | 82.6%  | 97.82% | ✅ ≥80% |
| src/tools/tasks/filtering | 58.35% | 90.85% | ✅ ≥80% |
| src/utils/filtering       | —      | 100%   | ✅ ≥80% |
