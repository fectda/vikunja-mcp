# Tasks: Fix Global Factory Clear on Auth Actions

## Review Workload Forecast

| Field                   | Value       |
| ----------------------- | ----------- |
| Estimated changed lines | ~100–150    |
| 400-line budget risk    | Low         |
| Chained PRs recommended | No          |
| Suggested split         | Single PR   |
| Delivery strategy       | ask-on-risk |
| Chain strategy          | pending     |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                                                  | Likely PR | Notes                            |
| ---- | ----------------------------------------------------- | --------- | -------------------------------- |
| 1    | Per-session cleanup + fix all 3 auth handlers + tests | Single PR | Under 400 lines; no split needed |

## Phase 1: Foundation — Add per-session cleanup to client.ts

- [x] 1.1 Add `cleanupClient(sessionId?)` method to `ClientContext` class in `src/client.ts` — delegates to `this.clientFactory.cleanup(sessionId)` with thread-safe mutex
- [x] 1.2 Add `cleanupClientFromContext(sessionId?)` convenience export function in `src/client.ts` — parallel to existing `getClientFromContext` pattern
- [x] 1.3 Write unit test for `cleanupClientFromContext` — verify only target session removed; other sessions/global state preserved

## Phase 2: Fix auth handlers (TDD)

- [x] 2.1 Write cross-contamination test: simulate multi-session scenario; verify A's refresh/disconnect/login does NOT destroy B's cached client
- [x] 2.2 Fix `refresh` handler in `src/tools/auth.ts` (lines 132–135) — replace `clearGlobalClientFactory()` + `createVikunjaClientFactory()` + `setGlobalClientFactory()` with single `cleanupClientFromContext(sessionId)` call
- [x] 2.3 Fix `disconnect` handler in `src/tools/auth.ts` (line 162) — replace `clearGlobalClientFactory()` with `cleanupClientFromContext(sessionId)`
- [x] 2.4 Fix `login` handler in `src/tools/auth.ts` (lines 204, 210–211) — remove `clearGlobalClientFactory()` + `createVikunjaClientFactory()` + `setGlobalClientFactory()`; add `cleanupClientFromContext(sessionId)` after `authManager.disconnect(sessionId)`

## Phase 3: Verification

- [x] 3.1 Run full pre-commit suite: `npm run lint && npm run typecheck && npm run test:coverage && npm run test:contract`
- [x] 3.2 Verify stdio backward compat — no regression in single-session reconnect flow
