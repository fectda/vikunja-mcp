# Design: Testing Strategy Overhaul

## Technical Approach

This change implements a behavior-driven testing (BDT) strategy that shifts test assertions from implementation details (exact strings, exact object structures) to behaviors (error types, field existence, function presence). The approach involves five coordinated phases: fixing mock gaps, removing deleted function tests, converting assertions to BDT style, adding test layer tags, and implementing a contract test to prevent future regressions.

## Architecture Decisions

### Decision: BDT Assertion Pattern

**Choice**: Use `toContain()`, `toMatchObject()`, `toBeInstanceOf()`, and `toBeGreaterThanOrEqual()` instead of exact equality matchers
**Alternatives considered**: Keep exact matchers with constant updates, use snapshot testing
**Rationale**: Exact matchers break on every refactor (error message text changes, new fields added). BDT patterns check the essential behavior without coupling to implementation details. Snapshot testing was considered but creates maintenance burden and doesn't convey intent as clearly.

### Decision: Contract Test Implementation

**Choice**: Static code analysis approach - scan source files for `client.X.Y()` calls at build/test time
**Alternatives considered**: Runtime reflection, manual mock review
**Rationale**: Static analysis catches gaps before tests run, works with Jest's module system, and doesn't require executing code. Runtime reflection would require actual API calls or complex mock inspection. Manual review is error-prone and doesn't scale.

### Decision: Test Layer Tags

**Choice**: Jest describe block tags using `#unit` and `#integration` suffixes
**Alternatives considered**: Jest testNamePattern filtering, separate directories
**Rationale**: The `#tag` pattern works with Jest's `--testNamePattern` flag for selective execution. It's minimal ceremony and fits existing test structure. Separate directories would require moving many files and updating imports.

### Decision: Deleted Function Handling

**Choice**: Automated detection via "is not a function" test failures, then manual verification of source code existence
**Alternatives considered**: Grep source for function names, remove all tests for deleted functions
**Rationale**: Test failures naturally surface the issue. Some "is not a function" errors are mock gaps (function exists in source), not deleted functions. Grep-based detection would generate false positives.

## Data Flow

```
Phase 1-2: Mock Gap / Deleted Function Detection
┌─────────────┐    npm test     ┌─────────────────┐
│ Source Code │ ──────────────→ │ Jest Test Suite │
└─────────────┘                  └────────┬────────┘
                                           │
                          "is not a function" errors
                                           │
                                           ▼
┌─────────────────┐    classify     ┌─────────────────┐
│  Test Failure   │ ──────────────→ │ Gap (add mock)  │
└─────────────────┘                 │ OR              │
                                     │ Deleted (delete test)
                                     └─────────────────┘

Phase 3: Behavior-Driven Assertion Conversion
┌─────────────┐    lint/grep    ┌─────────────────┐
│ Test Files  │ ──────────────→ │ Anti-patterns   │
└─────────────┘                  └────────┬────────┘
                                           │
                        toBe('exact'), toEqual({exact})
                                           │
                                           ▼
┌─────────────────┐    replace     ┌─────────────────┐
│ Anti-patterns   │ ──────────────→ │ BDT patterns   │
└─────────────────┘                 │ toContain      │
                                    │ toMatchObject   │
                                    │ toBeInstanceOf │
                                    └─────────────────┘

Phase 5: Contract Test
┌─────────────┐    scan src/    ┌─────────────────┐
│ Source Code │ ──────────────→ │ API calls list │
└─────────────┘                 └────────┬────────┘
                                         │
                                         ▼
┌─────────────────┐    verify     ┌─────────────────┐
│ Mock Services   │ ←──────────── │ MockContract   │
└─────────────────┘               │ Test           │
                                  └─────────────────┘
```

## File Changes

| File                                         | Action | Description                                            |
| -------------------------------------------- | ------ | ------------------------------------------------------ |
| `tests/types/mocks.ts`                       | Modify | Add missing mock methods (e.g., `assignUserToTask`)    |
| `tests/utils/filters.test.ts`                | Modify | Delete tests for deleted functions, convert assertions |
| `tests/tools/tasks.test.ts`                  | Modify | Fix mock gaps, convert assertions to BDT               |
| `tests/tools/tasks-simple-filters.test.ts`   | Delete | File references deleted functions                      |
| `tests/tools/tasks/assignees.test.ts`        | Modify | Fix mock, convert assertions                           |
| `tests/services/TaskCreationService.test.ts` | Modify | Fix mock, convert assertions                           |
| `tests/utils/filters-security.test.ts`       | Modify | Convert assertions to BDT                              |
| `tests/utils/logger.test.ts`                 | Modify | Convert assertions to BDT                              |
| `tests/config/ConfigurationManager.test.ts`  | Modify | Convert assertions to BDT                              |
| `tests/storage/storage-integration.test.ts`  | Modify | Fix setup or delete                                    |
| `tests/utils/retry.test.ts`                  | Modify | Convert assertions to BDT                              |
| `package.json`                               | Modify | Add `test:contract` script                             |
| `tests/contract/mock-contract.test.ts`       | Create | Contract test to verify mocks match source             |

## Interfaces / Contracts

### Mock Contract Test Interface

```typescript
interface MockContractConfig {
  sourceGlob: string; // e.g., 'src/**/*.ts'
  mockServices: string[]; // e.g., ['MockTaskService', 'MockProjectService']
}

interface MethodCall {
  service: string; // e.g., 'tasks'
  method: string; // e.g., 'assignUserToTask'
  file: string; // source file where found
  line: number;
}

interface ContractViolation {
  type: 'missing_mock_method' | 'unused_mock_method';
  service: string;
  method: string;
  sourceLocations: Array<{ file: string; line: number }>;
}
```

### BDT Assertion Helpers (Optional)

```typescript
// Helper functions to encourage BDT patterns
declare function expectErrorContaining(error: Error, substring: string): void;
declare function expectObjectContaining<T>(actual: T, expected: Partial<T>): void;
declare function expectArrayContainingAtLeast<T>(actual: T[], minLength: number): void;
```

## Testing Strategy

| Layer       | What to Test              | Approach                                     |
| ----------- | ------------------------- | -------------------------------------------- |
| Unit        | Mock contract validation  | Static analysis of source vs mocks           |
| Unit        | BDT assertion patterns    | Review test files for anti-patterns          |
| Integration | Full test suite execution | `npm test` must pass                         |
| Integration | Coverage thresholds       | `npm run test:coverage` must meet thresholds |

### Test Anti-Patterns to Fix

| Anti-Pattern                                  | BDT Replacement                                |
| --------------------------------------------- | ---------------------------------------------- |
| `expect(error.message).toBe('exact message')` | `expect(error.message).toContain('keyword')`   |
| `expect(error).toBe('specific error')`        | `expect(error).toBeInstanceOf(Error)`          |
| `expect(obj).toEqual({ exact, fields })`      | `expect(obj).toMatchObject({ required })`      |
| `expect(arr).toHaveLength(2)`                 | `expect(arr.length).toBeGreaterThanOrEqual(1)` |
| `expect(fn).toHaveBeenCalledTimes(2)`         | `expect(fn).toHaveBeenCalled()`                |

## Migration / Rollback

No migration required. This is a test infrastructure change with no runtime impact.

**Rollback strategy**: If tests fail after changes, revert the specific test file changes while keeping mock additions (mock additions are safe and backward-compatible).

## Open Questions

- [ ] Should the contract test run as part of CI (pre-check) or as a separate npm script?
- [ ] Should we add a lint rule to catch BDT anti-patterns automatically?
- [ ] How frequently should we run the contract test (per commit, nightly, or on-demand)?
