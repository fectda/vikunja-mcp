# SDD + TDD Verification Specification

## Purpose

This specification defines how SDD (Spec-Driven Development) and TDD (Test-Driven Development) should be used in the Vikunja MCP project.

## Requirements

### Requirement: SDD Workflow

All substantial changes MUST go through the SDD workflow.

#### Scenario: New Feature

- GIVEN a new feature request
- WHEN the team decides to implement it
- THEN the change MUST have: proposal, specs, design, tasks
- AND artifacts MUST be in openspec/changes/{change-name}/

#### Scenario: Bug Fix

- GIVEN a bug that requires code changes
- WHEN the fix is implemented
- THEN it SHOULD have a proposal documenting the issue
- AND tests MUST verify the fix works

---

### Requirement: TDD Workflow

All code MUST be tested using TDD principles.

#### Scenario: Writing New Code

- GIVEN a new function or feature
- WHEN writing the code
- THEN the test MUST be written FIRST (RED)
- AND the code MUST make the test pass (GREEN)
- AND the code SHOULD be refactored (REFACTOR)

#### Scenario: Test Verifies Requirement

- GIVEN a test
- WHEN the test is written
- THEN it MUST verify a REQUIREMENT, not implementation
- AND the test description MUST describe what should happen
- AND NOT how it happens

---

### Requirement: Test Coverage

The project MUST maintain high test coverage.

#### Scenario: Coverage Thresholds

- GIVEN coverage report is generated
- WHEN running `npm run test:coverage`
- THEN branches MUST be >= 90%
- AND lines MUST be >= 95%

---

### Requirement: Contract Test

The project MUST have a contract test that verifies mocks are complete.

#### Scenario: Contract Test Detects Missing Method

- GIVEN source code calls `client.tasks.newMethod()`
- WHEN the mock doesn't have `newMethod`
- THEN the contract test MUST fail
- AND it MUST indicate which method is missing

---

### Requirement: No Implementation Tests

Tests MUST NOT verify implementation details.

#### Scenario: Implementation Detail Test

- GIVEN a test that checks exact error message text
- WHEN the error message changes but behavior stays the same
- THEN the test SHOULD NOT fail

#### Scenario: Correct Test

- GIVEN a test that checks error type
- WHEN the error message changes but type stays the same
- THEN the test MUST pass

---

### Requirement: Test Maintenance

Tests that verify removed functionality MUST be removed.

#### Scenario: Deleted Function

- GIVEN a function was deleted from source code
- WHEN tests reference that function
- THEN those tests or test cases MUST be deleted

---

## Verification Scenarios

### Verification: SDD Artifacts Exist

- GIVEN a change in openspec/changes/
- WHEN examining the change
- THEN it MUST have: proposal.md, specs/, design.md, tasks.md

### Verification: Contract Test Runs

- GIVEN `npm run test:contract`
- WHEN the command runs
- THEN it MUST pass

### Verification: All Tests Pass

- GIVEN `npm test`
- WHEN all tests run
- THEN the output SHOULD show 0 failed tests (if tests are maintained)

### Verification: TDD Applied

- GIVEN a new feature implementation
- WHEN examining git history
- THEN commits SHOULD show test-first pattern
