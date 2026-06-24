# Spec: Increase Test Coverage on 5 Lowest Modules

## Requirements

### R1: Bulk operations coverage (src/tools/tasks/bulk)

- R1.1 Test BulkOperationProcessor.bulkUpdateTasks validates empty taskIds input
- R1.2 Test BulkOperationProcessor.bulkUpdateTasks validates missing field
- R1.3 Test BulkOperationProcessor.bulkDeleteTasks handles empty taskIds
- R1.4 Test BulkOperationProcessor.bulkCreateTasks handles empty tasks
- R1.5 Test BulkOperationValidator.validateBulkUpdate rejects invalid taskId types
- R1.6 Test BulkOperationValidator.preprocessFieldValue converts "true"/"false" strings to boolean
- R1.7 Test BulkOperationValidator.validateFieldConstraints rejects invalid priority

### R2: Filtering storage coverage (src/storage/filtering)

- R2.1 Test FilterSerializer.serialize throws on invalid expression structure
- R2.2 Test FilterSerializer.deserialize parses valid JSON to FilterExpression
- R2.3 Test FilterSerializer.deserialize throws on invalid JSON
- R2.4 Test FilterSerializer.validate returns errors for missing groups
- R2.5 Test FilterSerializer.validate returns errors for invalid group operators
- R2.6 Test FilterSerializer.validate returns errors for invalid condition operators

### R3: Transforms coverage (src/transforms)

- R3.1 Test field-selector.ts selectFields filters by verbosity level
- R3.2 Test field-selector.ts selectFields handles missing fields
- R3.3 Test task.ts transformTask for minimal verbosity
- R3.4 Test task.ts transformTask for detailed verbosity
- R3.5 Test size-calculator.ts calculates byte size for nested objects
- R3.6 Test base.ts SizeEstimator.calculateReduction handles zero original size

### R4: Types coverage (src/types)

- R4.1 Test VikunjaTask type accepts all optional fields
- R4.2 Test FilterExpression type validates group structure
- R4.3 Test MCPError serialization/deserialization

### R5: Filtering tools coverage (src/tools/tasks/filtering)

- R5.1 Test TaskFilteringOrchestrator.validateTaskFiltering validates args
- R5.2 Test TaskFilteringOrchestrator.createFilteringContext builds context
- R5.3 Test TaskFilteringOrchestrator.analyzeFilteringPerformance analysis
- R5.4 Test FilterValidator.validateTaskListingArgs rejects negative page
- R5.5 Test FilterValidator.validateMemoryConstraints exceeds limits

## Non-Goals

- No production code changes (implementations already exist)
- No new features or functionality
- No changes to existing test files (only add new tests)
- No CI/CD or tooling changes
- Filtering strategy internals (ServerSideFilteringStrategy, ClientSideFilteringStrategy, HybridFilteringStrategy) are already covered by orchestrator-level tests

## Acceptance Criteria

- All 5 modules reach >= 80% statements and lines
- Zero regressions: `npm run test:coverage` passes
- Every new test follows existing patterns (Jest + ts-jest)
