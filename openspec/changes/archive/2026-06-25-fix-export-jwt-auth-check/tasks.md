# Tasks: Add JWT Auth Guard to User Export Tools

## Review Workload Forecast

| Field                   | Value         |
| ----------------------- | ------------- |
| Estimated changed lines | 70-100        |
| 400-line budget risk    | Low           |
| Chained PRs recommended | No            |
| Suggested split         | Single PR     |
| Delivery strategy       | force-chained |
| Chain strategy          | pending       |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: RED — Write failing auth-rejection tests

- [x] 1.1 Add test to `tests/tools/export.test.ts` under `vikunja_request_user_export`: re-register tool with `getAuthType: 'api-token'`, expect `PERMISSION_DENIED` with JWT-required message
- [x] 1.2 Add test to `tests/tools/export.test.ts` under `vikunja_download_user_export`: re-register tool with `getAuthType: 'api-token'`, expect `PERMISSION_DENIED` with JWT-required message
- [x] 1.3 Run `npm test` — confirmed both new tests fail (no guard yet)

## Phase 2: GREEN — Add JWT guard to handlers

- [x] 2.1 Add JWT auth guard (before `try` block) in `src/tools/export.ts` — `vikunja_request_user_export`: `authManager.getAuthType() !== 'jwt'` → `MCPError(ErrorCode.PERMISSION_DENIED, ...)` with same message as `vikunja_export_project`
- [x] 2.2 Add JWT auth guard (before `try` block) in `src/tools/export.ts` — `vikunja_download_user_export`: same guard pattern as above
- [x] 2.3 Run `npm test` — all 29 tests pass including new ones

## Phase 3: REFACTOR — Verify suite

- [x] 3.1 Run `npm run typecheck` — no type errors
- [x] 3.2 Run `npm run test:coverage` — meets thresholds (90% branches, 95% lines; 2 pre-existing failures in unrelated index.test.ts)
- [x] 3.3 Run `npm run test:contract` — contract test passes
- [x] 3.4 Run `npm run lint` — no lint errors
