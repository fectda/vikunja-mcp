# Tasks: Increase Test Coverage on 5 Lowest Modules

## Phase 1: src/tools/tasks/bulk (21.75% statements, 17.74% lines)

- [ ] 1.1 Write test for BulkOperationProcessor.bulkUpdateTasks - validate input throws error when taskIds is empty array
- [ ] 1.2 Write test for BulkOperationProcessor.bulkUpdateTasks - validate input throws error when field is missing
- [ ] 1.3 Write test for BulkOperationProcessor.bulkDeleteTasks - validate delete with empty taskIds array
- [ ] 1.4 Write test for BulkOperationProcessor.bulkCreateTasks - validate create with empty tasks array
- [ ] 1.5 Write test for BulkOperationValidator.validateBulkUpdate - throws error for invalid taskId types
- [ ] 1.6 Write test for BulkOperationValidator.preprocessFieldValue - converts string "true"/"false" to boolean
- [ ] 1.7 Write test for BulkOperationValidator.validateFieldConstraints - rejects priority > 4 or < 1

## Phase 2: src/storage/filtering (16% statements, 20% lines)

- [ ] 2.1 Write test for FilterSerializer.serialize - throws error for invalid expression structure
- [ ] 2.2 Write test for FilterSerializer.deserialize - parses valid JSON to FilterExpression
- [ ] 2.3 Write test for FilterSerializer.deserialize - throws error for invalid JSON
- [ ] 2.4 Write test for FilterSerializer.validate - returns errors for missing groups array
- [ ] 2.5 Write test for FilterSerializer.validate - returns errors for invalid group operators
- [ ] 2.6 Write test for FilterSerializer.validate - returns errors for invalid condition operators

## Phase 3: src/transforms (55.85% statements, 48.05% lines)

- [ ] 3.1 Write test for field-selector.ts selectFields function - filters based on verbosity level
- [ ] 3.2 Write test for field-selector.ts selectFields function - handles missing fields gracefully
- [ ] 3.3 Write test for task.ts transformTask function - transforms task to minimal verbosity
- [ ] 3.4 Write test for task.ts transformTask function - transforms task to detailed verbosity
- [ ] 3.5 Write test for size-calculator.ts - calculates accurate byte size for nested objects
- [ ] 3.6 Write test for base.ts SizeEstimator.calculateReduction - handles zero original size

## Phase 4: src/types (82.6% statements, 47.05% functions)

- [ ] 4.1 Write test for VikunjaTask type - accepts all optional fields
- [ ] 4.2 Write test for FilterExpression type - validates group structure
- [ ] 4.3 Write test for error types - MCPError serialization/deserialization

## Phase 5: src/tools/tasks/filtering (58.35% statements, 50% lines)

- [ ] 5.1 Write test for ServerSideFilteringStrategy - applies filter to API call
- [ ] 5.2 Write test for ClientSideFilteringStrategy - filters tasks in memory
- [ ] 5.3 Write test for HybridFilteringStrategy - attempts server-side first, falls back to client
- [ ] 5.4 Write test for FilterValidator.validateTaskListingArgs - rejects negative page numbers
- [ ] 5.5 Write test for FilterValidator.validateMemoryConstraints - throws for exceeding limits

## Implementation Order

Write tests FIRST (TDD red), verify they fail with "no coverage" error, then:

1. Run coverage: should show new test files with 0% coverage on implementation code
2. Implementation already exists in most cases - tests will turn green after they pass
3. For truly missing implementation, implement minimum to make test pass

## Coverage Verification

After each phase, run:

```bash
npm run test:coverage -- --coverageReporters=text | grep -E "src/(tools/tasks/bulk|storage/filtering|transforms|types|tools/tasks/filtering)"
```
