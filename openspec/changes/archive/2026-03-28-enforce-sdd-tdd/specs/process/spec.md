# Spec: Enforce SDD + TDD

## Purpose

This spec defines how SDD and TDD are enforced in the Vikunja MCP project.

## Requirements

### Requirement: SDD is Mandatory

All substantial changes MUST go through SDD workflow.

#### Scenario: New Feature

- GIVEN a new feature request
- WHEN implementing the feature
- THEN artifacts MUST exist in `openspec/changes/{change-name}/`:
  - proposal.md
  - specs/
  - design.md
  - tasks.md

#### Scenario: Bug Fix

- GIVEN a bug fix
- WHEN fixing the bug
- THEN a proposal.md MUST exist documenting:
  - What the bug is
  - How it will be fixed
  - What tests verify the fix

---

### Requirement: TDD is Mandatory

All code MUST be tested using TDD workflow.

#### Scenario: Writing New Code

- GIVEN a new function
- WHEN writing the code
- THEN the test MUST be written FIRST (RED)
- AND the code MUST make it pass (GREEN)
- AND the code SHOULD be refactored (REFACTOR)

#### Scenario: Development Mode

- GIVEN development
- WHEN running tests
- THEN use `npm run test:watch` for TDD workflow

---

### Requirement: Contract Test is Mandatory

The contract test MUST pass before any PR.

#### Scenario: PR Check

- GIVEN a pull request
- WHEN running checks
- THEN `npm run test:contract` MUST pass

---

### Requirement: Tests Verify Requirements

Tests MUST verify requirements, NOT implementation.

#### Scenario: Good Test

- GIVEN a test
- WHEN written
- THEN it MUST check behavior (e.g., "should return task")
- AND NOT implementation details (e.g., exact error message)

#### Scenario: Bad Test

- GIVEN a test that checks exact error message
- WHEN error message changes but behavior stays same
- THEN the test SHOULD fail (and should be fixed)

---

### Requirement: Tests for Deleted Code

Tests for deleted functionality MUST be removed.

#### Scenario: Function Deleted

- GIVEN a function was deleted from source
- WHEN tests reference it
- THEN those tests or test cases MUST be deleted

---

## Verification

### Verification: SDD Artifacts

- GIVEN `openspec/changes/{change-name}/`
- THEN it MUST have: proposal.md, specs/, design.md, tasks.md

### Verification: TDD Applied

- GIVEN new code
- THEN test should exist first in git history

### Verification: Contract Test

- GIVEN `npm run test:contract`
- THEN it MUST pass
