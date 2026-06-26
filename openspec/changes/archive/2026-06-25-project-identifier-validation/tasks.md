# Tasks: Project Identifier Validation

## Review Workload Forecast

| Field                   | Value                                               |
| ----------------------- | --------------------------------------------------- |
| Estimated changed lines | ~20-30                                              |
| 400-line budget risk    | Low                                                 |
| Chained PRs recommended | Yes                                                 |
| Suggested split         | PR 1 (error prefix) → PR 2 (identifier max + tests) |
| Delivery strategy       | force-chained                                       |
| Chain strategy          | stacked-to-main                                     |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                                | Likely PR | Notes                                                |
| ---- | ----------------------------------- | --------- | ---------------------------------------------------- |
| 1    | Fix error double-prefix             | PR 1      | Base: main. Code change only; existing tests verify. |
| 2    | Reduce identifier max to 10 + tests | PR 2      | Base: main. Zod schema change + new tests.           |

## Phase 1: Error Prefix Fix (TDD — GREEN)

- [x] 1.1 Change `'Failed to update project'` to `'update project'` in `src/tools/projects/crud.ts:488`
- [x] 1.2 Verify existing tests pass: `jest tests/tools/projects.test.ts -t "update"` — lines 585/592/600 expect `'Failed to update project: ...'` output, unchanged

## Phase 2: Identifier Max Validation (TDD — RED)

- [x] 2.1 **RED**: Add test `'should reject identifier longer than 10 characters'` under `update` describe block — call `callTool('update', { id: 1, identifier: '12345678901' })`, expect Zod rejection with max 10 error
- [x] 2.2 **RED**: Add test `'should accept identifier of exactly 10 characters'` — call `callTool('update', { id: 1, identifier: '1234567890' })`, expect success (mocked)
- [x] 2.3 **RED**: Add test `'should accept identifier of 1-9 characters'` — call `callTool('update', { id: 1, identifier: 'abc' })`, expect success (mocked)

## Phase 3: Identifier Max Validation (TDD — GREEN)

- [x] 3.1 Change `.max(50)` to `.max(10)` in `src/tools/projects/index.ts:127`

## Phase 4: Verification

- [x] 4.1 Run full project test suite: `jest tests/tools/projects.test.ts`
- [x] 4.2 Run contract test: `npm run test:contract`
- [x] 4.3 Run lint: `npm run lint`
- [x] 4.4 Run typecheck: `npm run typecheck`
