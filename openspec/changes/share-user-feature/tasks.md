# Tasks: User-Based Project Sharing

## Review Workload Forecast

| Field                   | Value                     |
| ----------------------- | ------------------------- |
| Estimated changed lines | ~210 (src) + ~420 (tests) |
| 400-line budget risk    | Low                       |
| Chained PRs recommended | No                        |
| Suggested split         | Single PR                 |
| Delivery strategy       | single-pr                 |
| Chain strategy          | size-exception            |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                                                | Likely PR | Notes                            |
| ---- | --------------------------------------------------- | --------- | -------------------------------- |
| 1    | Full user-sharing feature (source + tests + wiring) | Single PR | Self-contained, ~630 lines total |

## Phase 1: Foundation — Create user-sharing.ts module

- [x] 1.1 Create `src/tools/projects/user-sharing.ts` — import `normalizeRight` from `./team-sharing`, `getClientFromContext`, `AuthManager`, `MCPError`/`ErrorCode`/`createStandardResponse`, `formatAorpAsMarkdown`, `wrapToolError`
- [x] 1.2 Define 5 export interfaces: `ShareUserArgs`, `ListUserSharesArgs`, `GetUserShareArgs`, `UpdateUserShareArgs` (= `ShareUserArgs`), `RemoveUserShareArgs`
- [x] 1.3 Write `shareUser` handler — single-step `PUT /projects/:id/users/:userId` with `{ right: numericRight }`, AORP success, error handling (404→NOT_FOUND, 403→PERMISSION_DENIED, other→API_ERROR)
- [x] 1.4 Write `listUserShares` handler — `GET /projects/:id/users` with pagination, AORP response
- [x] 1.5 Write `getUserShare` handler — direct `GET /projects/:id/users/:userId` (no list+filter), AORP response, 404→NOT_FOUND
- [x] 1.6 Write `updateUserShare` handler — same PUT endpoint as shareUser but validates user must exist, AORP response, 404→NOT_FOUND
- [x] 1.7 Write `removeUserShare` handler — `DELETE /projects/:id/users/:userId`, AORP response, 404→NOT_FOUND

## Phase 2: Tests (RED) — Write failing tests

- [x] 2.1 Create `tests/tools/projects/user-sharing.test.ts` — mock setup: `registerProjectsTool`, `getClientFromContext`, `AuthManager`
- [x] 2.2 Write auth test: unauthenticated user rejected for all 5 subcommands
- [x] 2.3 Write validation tests: missing/invalid `projectId`, `userId`, `right` for each subcommand (via Zod routing + direct handlers)
- [x] 2.4 Write `shareUser` tests: single-step PUT with `{right: number}`, success, 404, 403, 500 responses
- [x] 2.5 Write `listUserShares` tests: GET with pagination, empty list, 404, 500
- [x] 2.6 Write `getUserShare` tests: direct GET success, 404 (no access), 500
- [x] 2.7 Write `updateUserShare` tests: PUT with right, 404 (non-existent), 500
- [x] 2.8 Write `removeUserShare` tests: DELETE success, 404, 500
- [x] 2.9 Write defensive validation tests: bypass Zod, call each handler directly with non-positive IDs, missing required fields, `wrapToolError` wrapping

## Phase 3: Integration — Wire into index.ts

- [x] 3.1 In `src/tools/projects/index.ts`: add `userId` to Zod schema (`z.number().positive().optional()`)
- [x] 3.2 Add 5 subcommand strings to `subcommand` enum: `share-user`, `list-user-shares`, `get-user-share`, `update-user-share`, `remove-user-share`
- [x] 3.3 Import 5 handlers + 5 types from `./user-sharing`
- [x] 3.4 Add 5 switch cases routing each subcommand to its handler (passing projectId, userId, right, authManager)
- [x] 3.5 Add 5 type exports + 5 function exports at bottom of index.ts

## Phase 4: Verify

- [x] 4.1 Run `npm run test:coverage` — confirm tests pass and coverage thresholds hold
- [x] 4.2 Run `npm run lint` — confirm no new lint issues
- [x] 4.3 Run `npm run typecheck` — confirm TypeScript compilation clean
