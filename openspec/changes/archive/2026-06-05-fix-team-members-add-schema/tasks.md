# Tasks: fix-team-members-add-schema

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low

| Field                   | Value           |
| ----------------------- | --------------- |
| Estimated changed lines | ~30-50 lines    |
| 400-line budget risk    | Low             |
| Chained PRs recommended | No              |
| Suggested split         | Not needed      |
| Delivery strategy       | auto-chain      |
| Chain strategy          | stacked-to-main |

### Suggested Work Units

| Unit | Goal                          | Likely PR | Notes             |
| ---- | ----------------------------- | --------- | ----------------- |
| 1    | Full implementation and tests | PR 1      | Single focused PR |

## Phase 1: Core Implementation

- [ ] 1.1 In `src/tools/teams.ts`, update the Zod schema to include `username: z.string().optional()`.
- [ ] 1.2 In `src/tools/teams.ts`, under `case 'add':`, validate that `args.username` is provided (throw `ErrorCode.INVALID_PARAMS` if missing). Remove validation for `userId` in this case.
- [ ] 1.3 In `src/tools/teams.ts`, construct the PUT payload using `username: args.username` (and optionally `admin`), and send it to `/teams/${args.id}/members`.
- [ ] 1.4 In `src/tools/teams.ts`, update the error messages in the `add` case to reference the `username` instead of `userId`.
- [ ] 1.5 Verify that `members.update` and `members.remove` in `src/tools/teams.ts` remain unchanged and correctly require `args.userId`.

## Phase 2: Testing

- [ ] 2.1 In `tests/tools/teams.test.ts`, update the `members.add` tests to use `username: 'user3'` instead of `userId`.
- [ ] 2.2 In `tests/tools/teams.test.ts`, ensure the mock for the `members.add` API call asserts that the PUT request body contains `username` instead of `user_id`.
- [ ] 2.3 Run tests with `npm run test:coverage` to ensure tests pass and coverage is maintained.
