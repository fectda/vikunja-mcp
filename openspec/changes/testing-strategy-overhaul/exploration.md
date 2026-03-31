# Exploration: Testing Strategy Analysis

## Current State

### How Testing Works Today

1. **Test Structure**: Tests mirror `src/` directory structure under `tests/`
   - `tests/tools/` → `src/tools/`
   - `tests/utils/` → `src/utils/`
   - `tests/services/` → `src/services/`

2. **Mock Strategy** (CLAUDE.md lines 149-153):
   - External node-vikunja API calls are mocked
   - Tests cover edge cases, auth failures, network errors
   - Race conditions get dedicated test files

3. **Coverage Requirements** (CLAUDE.md lines 7-13):
   - 90%+ branches
   - 95%+ lines
   - All must pass before commit

4. **Current Test Count**:
   - 1984 passing tests
   - 214 failing tests

### Root Cause Analysis

#### Problem 1: Mock/API Mismatch (CRITICAL)

The source code calls `client.tasks.assignUserToTask(taskId, userId)` in 7+ files:

- `src/tools/tasks/assignees/AssigneeOperationsService.ts`
- `src/tools/tasks/crud/TaskCreationService.ts`
- `src/tools/tasks/bulk-operations-simplified.ts`

But the mock in `tests/types/mocks.ts` only defines:

- `bulkAssignUsersToTask` (plural)
- `removeUserFromTask`

**This is why 150+ tests fail** - they call code that uses functions the mock doesn't have.

#### Problem 2: Tight Coupling to Implementation

Tests check:

- Exact error message strings ("Invalid filter syntax")
- Specific function names
- Precise object structures

When code changes error messages or refactors, tests break even though behavior is correct.

#### Problem 3: No Test Layers

All tests use mocks but there's no distinction between:

- Unit tests (mock everything)
- Integration tests (mock only external APIs)
- Contract tests (verify mock matches real API)

#### Problem 4: Deleted Functions Still Tested

Tests in `tests/utils/filters.test.ts` reference:

- `parseSimpleFilter`
- `applyClientSideFilter`

These were deleted during refactoring but tests weren't updated.

### Affected Areas

| Area                          | Issue                                |
| ----------------------------- | ------------------------------------ |
| `tests/types/mocks.ts`        | Missing `assignUserToTask` function  |
| `tests/utils/filters.test.ts` | Tests deleted functions              |
| `tests/tools/tasks.test.ts`   | 150+ tests fail due to mock mismatch |
| `CLAUDE.md`                   | Testing conventions are incomplete   |

### Approaches

#### Option 1: Fix Mocks (Low Effort, High Impact)

Add missing functions to mocks:

- Add `assignUserToTask` to `MockTaskService`
- Update all test files to use complete mocks

**Pros**: Quick fix, 150+ tests pass
**Cons**: Doesn't fix underlying architecture issue

#### Option 2: Adopt Contract Testing (Medium Effort)

Use a tool like Pact or write contract tests that verify:

- Mocks have same interface as real API
- When API changes, tests fail immediately

**Pros**: Prevents future drift
**Cons**: More setup, requires discipline

#### Option 3: Behavior-Driven Testing (High Effort)

Rewrite tests to check behavior, not implementation:

- Use descriptive test names (e.g., "should reject invalid input")
- Test outcomes, not exact error messages
- Use snapshot testing for complex objects

**Pros**: Tests survive refactoring
**Cons**: Large effort, requires rewriting all tests

### Recommendation

**Immediate (Option 1)**: Fix the mocks to match the API calls being made. This will fix 150+ failing tests.

**Short-term**: Add contract testing to verify mocks stay in sync.

**Long-term (Option 3)**: Migrate to behavior-driven tests that are resilient to refactoring.

### Risks

- Fixing mocks without architecture change will lead to same problem in future
- Behavior-driven approach is time-consuming but more sustainable

### Ready for Proposal

Yes. The immediate fix is clear (add missing mock functions). The long-term strategy requires a proposal.
