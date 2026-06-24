# Proposal: Increase Test Coverage on 5 Lowest Modules

## Intent

Five source modules are below target thresholds (branches ≥ 90%, lines ≥ 95%). Coverage gaps exist in error-handling paths, validation edge cases, serialization, and type assertions — code paths that could silently cause incorrect behavior in production. Closing these gaps reduces regression risk without changing any production code.

## Scope

### In Scope

- Test suites for `src/tools/tasks/bulk` — validation edge cases (empty arrays, invalid fields)
- Test suites for `src/storage/filtering` — FilterSerializer round-trip and validation errors
- Test suites for `src/transforms` — field selection, task transforms, size estimation
- Test suites for `src/types` — type assertions, error serialization
- Test suites for `src/tools/tasks/filtering` — strategy fallback and validator limits

### Out of Scope

- New features or functionality
- Production code changes (implementations already exist)
- CI/CD or tooling changes
- Modifications to existing test files

## Capabilities

> This section is the CONTRACT between proposal and specs phases.

### New Capabilities

None — no new capabilities are introduced.

### Modified Capabilities

None — existing capability specs in `openspec/specs/` (testing, task-tools) are unchanged. Coverage gaps are filled within the existing testing framework.

## Approach

Strict TDD per phase, ordered by lowest coverage first:

1. **Phase 1**: `src/tools/tasks/bulk` (21.75% stmts) — 7 tests
2. **Phase 2**: `src/storage/filtering` (16% stmts) — 6 tests
3. **Phase 3**: `src/transforms` (55.85% stmts) — 6 tests
4. **Phase 4**: `src/types` (82.6% stmts) — 3 tests
5. **Phase 5**: `src/tools/tasks/filtering` (58.35% stmts) — 5 tests

Each phase: write failing test → confirm red → existing impl covers green → verify coverage.

## Affected Areas

| Area                           | Impact | Description                             |
| ------------------------------ | ------ | --------------------------------------- |
| `tests/tools/tasks/bulk/`      | New    | Validation edge cases for bulk CRUD     |
| `tests/storage/filtering/`     | New    | FilterSerializer round-trip + validate  |
| `tests/transforms/`            | New    | Field select, task transform, size calc |
| `tests/types/`                 | New    | Type assertions, error serialization    |
| `tests/tools/tasks/filtering/` | New    | Strategies, validators, limits          |

## Risks

| Risk                                 | Likelihood | Mitigation                                                         |
| ------------------------------------ | ---------- | ------------------------------------------------------------------ |
| Time spent with no user-facing value | Med        | Coverage is a quality gate — prevents hidden regressions           |
| Existing tests break from mock gaps  | Low        | Follow existing test patterns; contract test catches missing mocks |
| Scope creep into refactors           | Low        | Strict scope: no production code changes                           |
| Coverage targets not met after tests | Low        | Add more edge-case tests until thresholds pass                     |

## Rollback Plan

Each phase's new test files revert independently via `git checkout -- tests/<path>`. No production code is touched — rollback is always safe and file-local.

## Dependencies

- Existing Jest config (ts-jest, coverage thresholds, moduleNameMapper)
- Existing mock infrastructure in `tests/__mocks__/`
- Contract test (`npm run test:contract`) to verify mock completeness

## Success Criteria

- [ ] All 5 modules reach ≥ 80% statements and lines
- [ ] `npm run test:coverage` passes (zero regressions)
- [ ] All 27 test scenarios passing in their respective phases
- [ ] `npm run test:contract` passes
