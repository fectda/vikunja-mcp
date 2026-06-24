# Design: Increase Test Coverage on 5 Lowest Modules

## Technical Approach

Strict TDD per phase (Red-Green-Refactor) targeting 5 modules below threshold. Each phase adds a single test file that mirrors `src/` structure under `tests/`. No production code changes — implementations already exist. Ordered by lowest coverage first to de-risk phases.

Confirmed: `strict_tdd: true` from sdd-init (Engram #240).

## Architecture Decisions

| Decision                       | Options                                                         | Rationale                                                                                                                                                                                                            |
| ------------------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **File organization**          | (a) One file per module vs (b) merge into existing files        | **(a)**: Keeps changes isolated, easy to revert, follows existing pattern (`tests/storage/filtering-coverage.test.ts`, `tests/transforms/base.test.ts`)                                                              |
| **Mocking for Phase 5**        | (a) Mock `FilteringContext` only vs (b) mock all strategies     | **(a)**: `src/tools/tasks/filtering/` strategies delegate to `src/utils/filtering/` — existing `filtering-coverage.test.ts` already covers orchestrator-level flows. Phase 5 validates FilterValidator pure methods. |
| **Type-level tests (Phase 4)** | (a) Runtime assertions via type guards vs (b) compile-time only | **(a)**: MCPError has runtime behavior (`toJSON()`), VikunjaTask has optional fields that existing tests skip. Runtime assertions catch real regressions.                                                            |
| **Phase ordering**             | Lowest coverage first                                           | De-risks: bulk (22%) and storage/filtering (16%) are the biggest gaps. Earlier phases are simpler while context is fresh.                                                                                            |

## Data Flow

```
tests/*/coverage.test.ts
    │
    ├── import → src/tools/tasks/bulk/        (bulkOperationValidator methods — pure)
    ├── import → src/storage/filtering/       (FilterSerializer methods — pure)
    ├── import → src/transforms/*             (SizeEstimator, fieldSelector — pure)
    ├── import → src/types/errors             (MCPError class — runtime)
    └── import → src/tools/tasks/filtering/   (FilterValidator — pure functions)
```

All modules under test are **pure logic or synchronous validation** — no API calls, no async mocking needed for Phases 1–4. Phase 5 validates `validateTaskListingArgs` and `validateMemoryConstraints` (synchronous, pure).

## File Changes

| File                                                           | Action | Description                                                                     |
| -------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| `tests/tools/tasks/bulk/bulk-coverage.test.ts`                 | Create | Validation edge cases for bulkOperationValidator methods                        |
| `tests/storage/filtering/filtering-storage-coverage.test.ts`   | Create | Serialize/deserialize/validate for FilterSerializer (extends existing)          |
| `tests/transforms/size-calculator.test.ts`                     | Create | SizeEstimator.calculateReduction + nested object size                           |
| `tests/types/coverage.test.ts`                                 | Create | VikunjaTask optional fields, FilterExpression structure, MCPError serialization |
| `tests/tools/tasks/filtering/filtering-tools-coverage.test.ts` | Create | FilterValidator.validateTaskListingArgs + validateMemoryConstraints             |

**No existing files modified.** No production code touched.

## Interfaces / Contracts

No new interfaces. Only existing exported symbols are tested:

- `bulkOperationValidator.{validateBulkUpdate, validateBulkDelete, validateBulkCreate, preprocessFieldValue, validateFieldConstraints}`
- `FilterSerializer.{serialize, deserialize, validate}`
- `fieldSelector.selectFields`, `SizeEstimator.{estimateSize, calculateReduction}`, `TaskTransformer.{transformTask, createMinimalTask, createStandardTask}`
- `MCPError`, `ErrorCode`, `FilterExpression`, `VikunjaTask`
- `FilterValidator.{validateTaskListingArgs, validateMemoryConstraints}`

## Testing Strategy

| Layer              | What to Test                                            | Approach                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unit (Phase 1)** | bulkOperationValidator validation edge cases            | Pure function assertions: empty arrays, missing fields, invalid types, boundary values (priority 0-5). No mocks needed.                                                     |
| **Unit (Phase 2)** | FilterSerializer round-trip + validation errors         | Instantiate FilterSerializer, call serialize/deserialize/validate with known inputs. String/regex matching on error messages.                                               |
| **Unit (Phase 3)** | SizeEstimator + fieldSelector + TaskTransformer targets | New tests cover: zero-size edge case in `calculateReduction`, nested object size for `estimateSize`, missing fields in `selectFields`, verbosity levels in `transformTask`. |
| **Unit (Phase 4)** | MCPError serialization, type structure validation       | Runtime assertions on VikunjaTask with all optional fields, FilterExpression group validation at type level, MCPError.toJSON() round-trip.                                  |
| **Unit (Phase 5)** | FilterValidator pure validation methods                 | Test `validateTaskListingArgs` with negative page, test `validateMemoryConstraints` with exceed-limit page size. Pure functions — no mocks needed.                          |

**Mock strategy**: Phases 1–4 use no mocks (pure functions). Phase 5 may need a mock for `validateTaskCountLimit` if it depends on it directly — otherwise pure.

## Edge Cases per Module

| Module            | Edge Cases                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| bulk/             | Empty array, missing field, missing value, negative IDs, priority > max, string "true"/"false" coercion           |
| storage/filtering | Invalid JSON, missing groups, invalid operators at group and root level, missing condition field/value            |
| transforms        | Zero original size, null/undefined in size calc, missing fields in selector empty available fields                |
| types             | VikunjaTask with all optional fields null/undefined, FilterExpression with empty groups, MCPError without details |
| filtering         | Negative page, non-integer page/perPage, perPage exceeding memory limits                                          |

## Coverage Verification

After each phase run:

```bash
npm run test:coverage -- --coverageReporters=text | grep -E "src/(tools/tasks/bulk|storage/filtering|transforms|types|tools/tasks/filtering)"
```

Target: each module ≥ 80% statements and lines. If not met, add edge-case tests before proceeding.

## Migration / Rollout

No migration required. Each phase's test file can be reverted independently via `git checkout -- tests/<path>`. No production code changes.

## Risks and Contingencies

| Risk                                                                        | Likelihood | Mitigation                                                                                           |
| --------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| Coverage threshold not met after tests                                      | Medium     | Add edge-case tests per phase until pass; some modules may have complex branching not fully covered  |
| Type-level tests (Phase 4) limited by TS interfaces being compile-time only | Low        | Use runtime object construction with `expect` shape checks; focus on MCPError for real runtime value |
| Phase ordering rationale mismatch (Phase 2 has lowest coverage at 16%)      | None       | Design follows the task order as authored — Phase 2 (16%) after Phase 1 (22%) is fine                |
| Spec verification mismatch on Phase 5                                       | None       | Updated spec R5.1–R5.3 now targets orchestrator-level coverage, matching existing tests              |
