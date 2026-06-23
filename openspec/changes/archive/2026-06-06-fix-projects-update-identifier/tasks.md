# Tasks: fix-projects-update-identifier

## Review Workload Forecast

| Field                   | Value           |
| ----------------------- | --------------- |
| Estimated changed lines | < 50            |
| 400-line budget risk    | Low             |
| Chained PRs recommended | Yes             |
| Suggested split         | PR 1            |
| Delivery strategy       | auto-chain      |
| Chain strategy          | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                       | Likely PR | Notes                              |
| ---- | -------------------------- | --------- | ---------------------------------- |
| 1    | Tests (TDD Red)            | PR 1      | Write failing tests                |
| 2    | Implementation (TDD Green) | PR 1      | Remove customMessage from handlers |
| 3    | Coverage                   | PR 1      | Edge cases and regression          |
| 4    | Verification               | PR 1      | Run pre-commit checks              |

## Phase 1: Work unit 1 (TDD Red)

- [x] 1.1 `tests/tools/projects.test.ts`: Update mocks to return a `{ statusCode: 400, message: "real validation error" }` for payload rejection scenarios.
- [x] 1.2 `tests/tools/projects.test.ts`: Write tests that assert the real error message appears (not the fake "Project with ID not found").
- [x] 1.3 Verify tests fail (Red) because the code still hardcodes `customMessage`.

## Phase 2: Work unit 2 (TDD Green)

- [x] 2.1 `src/tools/projects/crud.ts`: Remove `customMessage` arg from both `handleStatusCodeError` calls.
- [x] 2.2 `src/tools/projects/hierarchy.ts`: Remove `customMessage` arg from all 4 `handleStatusCodeError` calls.
- [x] 2.3 Verify the tests from work unit 1 pass (Green).
- [x] 2.4 Run full test suite.

## Phase 3: Work unit 3 (Coverage)

- [x] 3.1 `tests/tools/projects.test.ts`: Verify the 404 case still works (test asserting 404 with non-existent ID).
- [x] 3.2 Verify the error handler's fallback produces the same "not found" message.

## Phase 4: Work unit 4 (Verification)

- [x] 4.1 Run `npm run lint && npm run test:coverage && npm run typecheck && npm run test:contract` to ensure all pre-commit checks pass and coverage is maintained.
