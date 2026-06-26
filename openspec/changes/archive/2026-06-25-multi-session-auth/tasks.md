# Tasks: Multi-Session Auth for SSE Transport

## Review Workload Forecast

| Field                   | Value                                        |
| ----------------------- | -------------------------------------------- |
| Estimated changed lines | ~1300–1800                                   |
| 400-line budget risk    | High                                         |
| Chained PRs recommended | Yes                                          |
| Suggested split         | PR 1: Core → PR 2: Tools → PR 3: Sub-modules |
| Delivery strategy       | ask-on-risk                                  |
| Chain strategy          | pending                                      |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal                                                                           | Likely PR | Notes                                  |
| ---- | ------------------------------------------------------------------------------ | --------- | -------------------------------------- |
| 1    | Core auth infrastructure — AuthManager Map, ClientFactory, client.ts, index.ts | PR 1      | Base: main. Includes AuthManager tests |
| 2    | Top-level tool threading + middleware — 12 tool files + 2 middleware           | PR 2      | Base: main. ~400-600 lines             |
| 3    | Deep sub-module threading — tasks/** (9), projects/** (5), filtering (2)       | PR 3      | Base: main. ~300-400 lines             |

## Phase 1: Core Infrastructure (PR 1)

- [x] 1.1 `src/auth/AuthManager.ts` — `private session` → `private sessions: Map<string, AuthSession>`; add `sessionId?: string` param to all 7 methods defaulting to `'default'`
- [x] 1.2 `src/client/VikunjaClientFactory.ts` — `getClient(sessionId?)`: `private clients: Map<string, {client, url, token}>`; reuse logic keyed by sessionId
- [x] 1.3 `src/client.ts` — `getClientFromContext(sessionId?)`, `createVikunjaClientFactory()` pass sessionId through
- [x] 1.4 `src/index.ts` — `authManager.connect(url, token, 'default')` for explicit default session
- [x] 1.5 Write AuthManager multi-session unit tests (isolation, disconnect, default fallback)
- [x] 1.6 Write ClientFactory per-session cache unit tests (same session → same client, diff session → diff)

## Phase 2: Tool Handler Threading (PR 2)

- [x] 2.1 `src/tools/auth.ts` — thread `extra?.sessionId` to all authManager calls (connect, disconnect, status)
- [x] 2.2 `src/tools/labels.ts`, `teams.ts`, `users.ts`, `filters.ts`, `templates.ts` — add `(args, extra)` with sessionId threading
- [x] 2.3 `src/tools/webhooks.ts` — thread sessionId to `getValidEvents()` and direct fetch calls
- [x] 2.4 `src/tools/export.ts` — thread sessionId through all 3 tool registrations
- [x] 2.5 `src/tools/batch-import.ts` — thread sessionId to auth/client calls
- [x] 2.6 `src/tools/tasks-relations.ts` — `handleRelationSubcommands(args, sessionId?)`
- [x] 2.7 `src/tools/tasks/index.ts` — thread sessionId to sub-module calls and `handleAttach()`
- [x] 2.8 `src/middleware/direct-middleware.ts` — `applyPermissions()` uses `extra.sessionId`
- [x] 2.9 `src/middleware/simplified-rate-limit.ts` — `getSessionId()` and `checkRateLimit()` accept optional `sessionId` param
- [x] 2.10 Write tool handler tests — mock `extra.sessionId`, verify correct session used

## Phase 3: Deep Sub-Module Threading (PR 3)

- [x] 3.1 `src/tools/tasks/crud/` services — accept `sessionId?: string` (already done in Phase 2)
- [x] 3.2 `src/tools/tasks/bulk-operations-simplified.ts` — all 3 functions accept `sessionId?: string`
- [x] 3.3 `src/tools/tasks/assignees/`, `comments/`, `reminders.ts`, `labels.ts`, `types/filters.ts` — all accept `sessionId?: string`
- [x] 3.4 `src/utils/filtering/` strategies, `FilterExecutor.ts`, `TaskFilteringOrchestrator.ts` — accept `sessionId?: string` and pass through
- [x] 3.5 `src/tools/projects/crud.ts`, `hierarchy.ts` — all functions accept `sessionId?: string`
- [x] 3.6 `src/tools/projects/sharing.ts`, `team-sharing.ts`, `user-sharing.ts` — all functions accept `sessionId?: string`
- [x] 3.7 Write sub-module tests — verify sessionId propagated correctly from tool handler entry points

## Phase 4: Integration Verification

- [x] 4.1 Run full test suite (`npm run test:coverage`) — verify thresholds: 90% branches, 95% lines
- [x] 4.2 Run typecheck (`npm run typecheck`) — ensure all new signatures compile
- [x] 4.3 Verify stdio backward compat: no `extra` → `'default'` session used everywhere
- [x] 4.4 Cross-session contamination proof: grep `getSession(` and `isAuthenticated(` without sessionId — ensure all call sites thread it
