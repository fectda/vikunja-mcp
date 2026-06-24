# Testing Strategy Specification

## Purpose

This specification defines the behavior-driven testing strategy for the Vikunja MCP project. It ensures tests are resilient to refactoring, maintainable, and provide clear pass/fail signals without breaking on implementation details.

## Requirements

### Requirement: Mock Contract Validation

The test infrastructure SHALL include a contract test that verifies all mock services contain the methods used in source code.

#### Scenario: Mock Contract Catches Missing Methods

- GIVEN the source code calls `client.tasks.assignUserToTask(...)`
- WHEN the mock service `MockTaskService` does not have `assignUserToTask`
- THEN the contract test MUST fail with a clear error indicating the missing method

#### Scenario: Mock Contract Passes When Complete

- GIVEN all API methods used in source code exist in mocks
- WHEN the contract test runs
- THEN all assertions MUST pass

---

### Requirement: Behavior-Driven Error Assertions

Tests SHALL check that errors occurred, not the exact error messages.

#### Scenario: Error Type Check

- GIVEN a function that throws an error
- WHEN the test asserts `expect(error).toBeInstanceOf(Error)`
- THEN the test MUST pass regardless of the error message text

#### Scenario: Error Message Partial Match

- GIVEN a function that throws "Invalid filter syntax at position 5"
- WHEN the test asserts `expect(error.message).toContain('Invalid')`
- THEN the test MUST pass even if the full message changes

#### Scenario: Error Message NOT Matched

- GIVEN a function that throws an error
- WHEN the test asserts `expect(error.message).toBe('specific exact message')`
- THEN the test SHOULD fail (this is an anti-pattern that must be fixed)

---

### Requirement: Behavior-Driven Object Assertions

Tests SHALL check required fields exist, not exact object structures.

#### Scenario: Partial Object Match

- GIVEN a task object `{ id: 1, title: 'Test', done: false, created_at: '...' }`
- WHEN the test asserts `expect(task).toMatchObject({ id: 1, title: 'Test' })`
- THEN the test MUST pass even if additional fields are present

#### Scenario: Individual Field Assertion

- GIVEN a task object with multiple fields
- WHEN the test asserts each field individually (`task.id`, `task.title`)
- THEN the test MUST pass regardless of extra fields

#### Scenario: Exact Object Match Anti-Pattern

- GIVEN a task with additional fields beyond the test expectation
- WHEN the test asserts `expect(task).toEqual({ id: 1, title: 'Test' })`
- THEN the test SHOULD fail (must use toMatchObject instead)

---

### Requirement: Behavior-Driven Array Assertions

Tests SHALL use flexible length checks, not exact counts.

#### Scenario: Minimum Length Check

- GIVEN an array of validation errors
- WHEN the test asserts `expect(errors.length).toBeGreaterThanOrEqual(1)`
- THEN the test MUST pass regardless of actual length

#### Scenario: Array Contains Item

- GIVEN an array that includes 'something wrong'
- WHEN the test asserts `expect(errors).toContain('something wrong')`
- THEN the test MUST pass regardless of array size

#### Scenario: Exact Length Anti-Pattern

- GIVEN an array that may grow with new items
- WHEN the test asserts `expect(errors).toHaveLength(2)`
- THEN the test SHOULD fail (use toContain or >= instead)

---

### Requirement: Deleted Function Test Removal

Tests for functions that no longer exist in source code SHALL be removed.

#### Scenario: Detect Deleted Function Reference

- GIVEN a test file references `parseSimpleFilter` or `applyClientSideFilter`
- WHEN those functions do NOT exist in `src/utils/filters*.ts`
- THEN the test file or test case MUST be deleted

#### Scenario: Mock Gap vs Deleted Function

- GIVEN a test fails with "is not a function"
- WHEN checking if the function exists in source code
- IF exists → add to mock
- IF does NOT exist → delete the test

---

### Requirement: Test Layer Tagging

Tests SHALL be tagged to identify their execution layer.

#### Scenario: Unit Test Tag

- GIVEN a test file using mocked dependencies
- WHEN the test is written
- THEN the describe block MUST include `#unit` (e.g., `describe('TaskService #unit')`)

#### Scenario: Integration Test Tag

- GIVEN a test file using real API calls
- WHEN the test is written
- THEN the describe block MUST include `#integration` (e.g., `describe('TaskService #integration')`)

---

### Requirement: Test Execution Success Criteria

All test commands MUST pass for the change to be considered complete.

#### Scenario: All Tests Pass

- GIVEN `npm test` is executed
- WHEN there are 0 failed test suites
- THEN the test execution MUST report success

#### Scenario: Coverage Threshold Met

- GIVEN `npm run test:coverage` is executed
- WHEN branches >= 90% AND lines >= 95%
- THEN the coverage check MUST pass

#### Scenario: TypeCheck Passes

- GIVEN `npm run typecheck` is executed
- WHEN TypeScript compilation succeeds
- THEN the type check MUST pass

#### Scenario: Lint Passes

- GIVEN `npm run lint` is executed
- WHEN ESLint reports no errors
- THEN the lint check MUST pass

---

## Verification Scenarios

### Verification: Run Full Test Suite

- GIVEN the complete test suite
- WHEN executing `npm test`
- THEN the output MUST show "Test Suites: X passed"
- AND "Tests: Y passed" with 0 failures

### Verification: Run Coverage

- GIVEN the coverage configuration
- WHEN executing `npm run test:coverage`
- THEN the output MUST show branches >= 90% AND lines >= 95%

### Verification: Contract Test Exists

- GIVEN the contract test file
- WHEN examining `tests/contract/mock-contract.test.ts`
- THEN the file MUST exist
- AND it MUST scan source for API calls
- AND it MUST verify mocks contain all used methods
