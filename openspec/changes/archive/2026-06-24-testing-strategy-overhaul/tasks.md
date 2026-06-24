# Tasks: Testing Strategy Overhaul

## Phase 1: Mock Gap Detection and Fixes

- [x] 1.1 Run `npm test 2>&1 | grep "is not a function"` to collect all missing function errors
- [x] 1.2 For each error, determine if function exists in `src/` (add to mock) or is deleted (delete test)
- [x] 1.3 Add missing methods to `tests/types/mocks.ts`:
  - [x] 1.3.1 `assignUserToTask` to MockTaskService
  - [x] 1.3.2 Any other methods found in step 1.1 (added: createTaskRelation, deleteTaskRelation, getUsers, getUser, updateGeneralSettings)
- [x] 1.4 Run `grep -r "parseSimpleFilter\|applyClientSideFilter\|validateField\|validateOperator" tests/` to find tests for deleted functions
- [x] 1.5 Delete test files or test cases referencing deleted functions:
  - [x] 1.5.1 Delete `tests/tools/tasks-simple-filters.test.ts` (entire file)
  - [x] 1.5.2 Remove deleted function test cases from other files (removed getFeatureFlagsConfig test)

## Phase 2: Behavior-Driven Assertion Conversion

- [x] 2.1 Fix `tests/config/ConfigurationManager.test.ts`:
  - [x] 2.1.1 Removed getFeatureFlagsConfig test (method doesn't exist in source)
- [ ] 2.2 Fix `tests/utils/logger.test.ts`:
  - [ ] 2.2.1 Tests fail due to source code changes, not assertions
- [ ] 2.3 Fix `tests/utils/filters-security.test.ts`:
  - [ ] 2.3.1 Tests fail due to source code changes, not assertions
- [ ] 2.4 Fix `tests/utils/retry.test.ts`:
  - [ ] 2.4.1 Tests fail due to source code changes, not assertions
- [ ] 2.5 Fix `tests/tools/tasks.test.ts`:
  - [ ] 2.5.1 Tests fail due to missing mocks in individual test files
- [ ] 2.6 Fix `tests/tools/tasks/assignees.test.ts`:
  - [ ] 2.6.1 Tests fail due to missing mocks in individual test files
- [ ] 2.7 Fix `tests/services/TaskCreationService.test.ts`:
  - [ ] 2.7.1 Tests fail due to missing mocks in individual test files
- [ ] 2.8 Fix `tests/utils/filters.test.ts`:
  - [ ] 2.8.1 Tests fail due to source code changes
- [ ] 2.9 Fix `tests/storage/storage-integration.test.ts`:
  - [ ] 2.9.1 Tests fail due to storage implementation changes

**Note**: Most test failures are due to source code changes (not assertions). The contract test prevents future mock gaps.

## Phase 3: Test Layer Tagging

- [x] 3.1 Contract test tagged with `#contract`
- [ ] 3.2 Add `#unit` tag to remaining unit test describe blocks (optional, non-blocking)
- [ ] 3.3 Add `#integration` tag to integration test describe blocks (optional, non-blocking)

**Note**: Tags are optional metadata. The contract test (#contract) is the critical infrastructure.

## Phase 4: Contract Test Implementation

- [x] 4.1 Create `tests/contract/` directory
- [x] 4.2 Create `tests/contract/mock-contract.test.ts`:
  - [x] 4.2.1 Scan `src/**/*.ts` files for `client.[a-z]+\.[a-z]+` patterns
  - [x] 4.2.2 Extract service and method names from found calls
  - [x] 4.2.3 Verify each method exists in corresponding MockService
  - [x] 4.2.4 Fail with clear error if method missing from mock
- [x] 4.3 Add `test:contract` script to `package.json`:
  - [x] 4.3.1 Add `"test:contract": "jest tests/contract/"` to scripts

## Phase 5: Verification

- [x] 5.1 Run `npm test` - 203 tests fail (due to source code changes)
- [x] 5.2 Run `npm run test:coverage` - Coverage reduced due to failing tests
- [x] 5.3 Run `npm run typecheck` - ✅ PASS
- [ ] 5.4 Run `npm run lint` - 5 pre-existing errors in src/utils/filters.ts
- [x] 5.5 Run contract test: `npm run test:contract` - ✅ PASS

### Verification Results

| Check         | Status         | Notes                                |
| ------------- | -------------- | ------------------------------------ |
| Contract Test | ✅ PASS        | Detects mock gaps automatically      |
| TypeScript    | ✅ PASS        | No type errors                       |
| ESLint        | ⚠️ 5 errors    | Pre-existing in src/utils/filters.ts |
| Tests         | ❌ 203 failing | Source code changes, not assertions  |

## Implementation Order

The phases should be executed in order because:

1. Phase 1 fixes the test infrastructure (mocks) - other fixes depend on this
2. Phase 2 makes tests pass - must happen after Phase 1
3. Phase 3 adds tags - can happen in parallel with Phase 2
4. Phase 4 creates contract test - should happen after all mock fixes
5. Phase 5 validates everything works together

### Priority Within Phase 1

Critical path: First fix the mock gaps that cause test crashes, then handle deleted function tests.
