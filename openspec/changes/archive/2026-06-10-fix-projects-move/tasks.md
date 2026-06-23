# Tasks: fix-projects-move

## Review Workload Forecast

| Field                   | Value                                                            |
| ----------------------- | ---------------------------------------------------------------- |
| Estimated changed lines | ~40-60                                                           |
| 400-line budget risk    | Low                                                              |
| Chained PRs recommended | Yes                                                              |
| Suggested split         | PR 1 (TDD Red) → PR 2 (Fix hierarchy) → PR 3 (Fix error handler) |
| Delivery strategy       | auto-chain                                                       |
| Chain strategy          | stacked-to-main                                                  |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                                             | Likely PR | Notes                                  |
| ---- | ------------------------------------------------ | --------- | -------------------------------------- |
| 1    | TDD Red: Failing tests                           | PR 1      | Base: main; contains only tests        |
| 2    | TDD Green: Fix hierarchy.ts move payload         | PR 2      | Base: PR 1; fixes the payload logic    |
| 3    | TDD Green: Fix error-handler.ts 404 transparency | PR 3      | Base: PR 2; fixes the 404 message      |
| 4    | Verification: Pre-commit checks                  | PR 3      | Base: PR 2; run all validation scripts |

## Phase 1: Test-Driven Development (Red)

- [x] 1.1 In `tests/tools/projects.test.ts`, update existing move mock assertions to verify `mockClient.projects.updateProject` is called with `{ title: 'Test Project', parent_project_id: <id> }`.
- [x] 1.2 In `tests/tools/projects.test.ts`, add a test verifying a move to root (undefined `parentProjectId`) calls `updateProject` with `{ title: 'Test Project', parent_project_id: 0 }`.
- [x] 1.3 In `tests/utils/error-handler.test.ts`, add a test in `handleStatusCodeError` asserting that a 404 error with an upstream message returns the default "not found" text AND the sanitized upstream message.
- [x] 1.4 Run tests to confirm the new assertions fail (Red phase).

## Phase 2: Core Implementation (Green)

- [x] 2.1 In `src/tools/projects/hierarchy.ts`, modify `moveProject` so the `updateData` payload includes `title: currentProject.title`.
- [x] 2.2 In `src/tools/projects/hierarchy.ts`, modify `moveProject` so that if `parentProjectId` is undefined, it explicitly sets `updateData.parent_project_id = 0`.
- [x] 2.3 Run `jest tests/tools/projects.test.ts` to confirm the move project tests now pass.
- [x] 2.4 In `src/utils/error-handler.ts` within `handleStatusCodeError` (404 block), extract `error.message` if it exists, sanitize it, and append it to the returned `MCPError` message.
- [x] 2.5 Run `jest tests/utils/error-handler.test.ts` to confirm the error handler tests now pass.

## Phase 3: Verification

- [x] 3.1 Run `npm run lint`
- [x] 3.2 Run `npm run test:coverage` and ensure coverage has not dropped from current levels.
- [x] 3.3 Run `npm run typecheck`
- [x] 3.4 Run `npm run test:contract`
