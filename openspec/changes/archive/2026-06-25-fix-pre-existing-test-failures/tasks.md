# Tasks: Fix Pre-Existing Test Failures

## Review Workload Forecast

| Field                   | Value          |
| ----------------------- | -------------- |
| Estimated changed lines | ~30 (±10)      |
| 400-line budget risk    | Low            |
| Chained PRs recommended | No             |
| Suggested split         | Single PR only |
| Delivery strategy       | force-chained  |
| Chain strategy          | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: RED — Confirm Existing Failures

- [x] 1.1 Run `npm test` and confirm 2 test failures in `tests/tools/index.test.ts` at lines 183–185 and 341–342 (`registerUsersTool`/`registerExportTool` stale `not.toHaveBeenCalled()`)
- [x] 1.2 Run `npm run test:coverage` to capture baseline before fix

## Phase 2: GREEN — Fix Stale Assertions

- [x] 2.1 `tests/tools/index.test.ts:184` — flip `expect(registerUsersTool).not.toHaveBeenCalled()` → `toHaveBeenCalledTimes(1)` + `toHaveBeenCalledWith(mockServer, mockAuthManager, mockClientFactory)`
- [x] 2.2 `tests/tools/index.test.ts:185` — same flip for `registerExportTool`
- [x] 2.3 `tests/tools/index.test.ts:341` — flip `expect(registerUsersTool).not.toHaveBeenCalled()` → `toHaveBeenCalledTimes(1)` + `toHaveBeenCalledWith(mockServer, mockAuthManager, mockClientFactory)`
- [x] 2.4 `tests/tools/index.test.ts:342` — same flip for `registerExportTool`
- [x] 2.5 Run `npm test` — confirm 0 failures (tests now match production)

## Phase 3: REFACTOR — Rename & Document

- [x] 3.1 Rename test 1 (line 114) from "except users and export" to "all tools unconditionally with clientFactory"
- [x] 3.2 Update inline comment at line 123 to note auth is enforced at runtime, not registration
- [x] 3.3 Rename test 2 (line 272) from "not register users and export" to "all tools unconditionally even when unauthenticated"
- [x] 3.4 Update inline comment at line 280 to match unconditional registration behavior
- [x] 3.5 Run full suite: `npm test`, `npm run test:coverage`, `npm run typecheck`
