# Apply Progress: fix-projects-update-identifier

## Implementation Progress

**Change**: fix-projects-update-identifier
**Mode**: Strict TDD

### TDD Cycle Evidence

| Task                                              | RED (Test Fails)                                | GREEN (Test Passes)                               | REFACTOR (Clean)          |
| ------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------- | ------------------------- |
| 1.1 Update mocks for 400 validation error         | ✅ Added mock returning 400 in projects.test.ts | ✅ Test passes after fix                          | ✅ Clean mock setup       |
| 1.2 Assert real error message appears             | ✅ Test failed because customMessage masked it  | ✅ Test passes (masked message removed)           | ✅ Clear test description |
| 2.1 Remove customMessage in crud.ts (5 calls)     | ✅ Tests failed originally                      | ✅ Code changed, all tests pass                   | ✅ Handled 5 callsites    |
| 2.2 Remove customMessage in hierarchy.ts (1 call) | ✅ Tests failed originally                      | ✅ Code changed, all tests pass                   | ✅ Handled 1 callsite     |
| 3.1 Verify 404 case still works                   | ✅ Verified existing 404 tests                  | ✅ Verified fallback produces correct "not found" | ✅ N/A                    |
| 4.1 Pre-commit checks                             | ✅ N/A                                          | ✅ All checks passed                              | ✅ N/A                    |

### Completed Tasks

- [x] 1.1 `tests/tools/projects.test.ts`: Update mocks to return a `{ statusCode: 400, message: "real validation error" }` for payload rejection scenarios.
- [x] 1.2 `tests/tools/projects.test.ts`: Write tests that assert the real error message appears.
- [x] 1.3 Verify tests fail (Red) because the code still hardcodes `customMessage`.
- [x] 2.1 `src/tools/projects/crud.ts`: Remove `customMessage` arg from `handleStatusCodeError` calls.
- [x] 2.2 `src/tools/projects/hierarchy.ts`: Remove `customMessage` arg from `handleStatusCodeError` calls.
- [x] 2.3 Verify the tests from work unit 1 pass (Green).
- [x] 2.4 Run full test suite.
- [x] 3.1 `tests/tools/projects.test.ts`: Verify the 404 case still works.
- [x] 3.2 Verify the error handler's fallback produces the same "not found" message.
- [x] 4.1 Run `npm run lint && npm run test:coverage && npm run typecheck && npm run test:contract`.

### Files Changed

| File                              | Action   | What Was Done                                                    |
| --------------------------------- | -------- | ---------------------------------------------------------------- |
| `tests/tools/projects.test.ts`    | Modified | Added 400 error test cases for create and update commands        |
| `src/tools/projects/crud.ts`      | Modified | Removed `customMessage` arg from 5 `handleStatusCodeError` calls |
| `src/tools/projects/hierarchy.ts` | Modified | Removed `customMessage` arg from 1 `handleStatusCodeError` call  |

### Deviations from Design

None — implementation matches design.

### Issues Found

None. The PRD mentioned 2 callsites in crud.ts and 4 in hierarchy.ts, but it was actually 5 in crud.ts and 1 in hierarchy.ts. All 6 callsites were fixed.

### Remaining Tasks

All tasks completed.

### Workload / PR Boundary

- Mode: auto-chain
- Current work unit: 1 & 2 (TDD Red & Green), 3 & 4 (Verification)
- Boundary: Full change implemented
- Estimated review budget impact: Very low (tests and minor arg removal)

### Status

4/4 tasks complete. Ready for verify.
