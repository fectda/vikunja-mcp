# Tasks: fix-teams-members-list

## Review Workload Forecast

| Field                   | Value                                                                         |
| ----------------------- | ----------------------------------------------------------------------------- |
| Estimated changed lines | 30 - 50 lines                                                                 |
| 400-line budget risk    | Low                                                                           |
| Chained PRs recommended | Yes                                                                           |
| Suggested split         | PR 1 (Tests Red) → PR 2 (Fix Green) → PR 3 (Edge Cases) → PR 4 (Verification) |
| Delivery strategy       | force-chained PR                                                              |
| Chain strategy          | stacked-to-main                                                               |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                                         | Likely PR | Notes                                                |
| ---- | -------------------------------------------- | --------- | ---------------------------------------------------- |
| 1    | TDD Red: Write failing test for members.list | PR 1      | base: main; updates existing test to mock `/teams/1` |
| 2    | TDD Green: Implement fix                     | PR 2      | base: PR 1; updates `teams.ts` to call `/teams/{id}` |
| 3    | Test coverage: Edge cases & non-regression   | PR 3      | base: PR 2; adds 404 and empty team tests            |
| 4    | Verification: Pre-commit checks              | PR 4      | base: PR 3; runs lint, coverage, typecheck, contract |

## Phase 1: TDD Red (Failing Tests)

- [x] 1.1 **Update mock in existing test**: In `tests/tools/teams.test.ts` (approx line 518), change the mock for `members list subcommand` to intercept `GET /teams/1` instead of `GET /teams/1/members`. Make it return a full team object containing a `members` array.
- [x] 1.2 **Verify test fails**: Run the test to ensure it fails with a 405 Method Not Allowed (since the implementation still hits the wrong endpoint).
  - _Commit_: `test: update members.list mock to correct endpoint (TDD Red)`
  - _Test_: `jest tests/tools/teams.test.ts -t "members list subcommand"`

## Phase 2: TDD Green (Implementation)

- [x] 2.1 **Fix endpoint and parse members**: In `src/tools/teams.ts` (approx line 307), update the `members.list` case to call `GET /teams/${teamId}`.
- [x] 2.2 **Defensive parsing**: In the same block, parse the response as `const team = await response.json()` and return `team.members ?? []` using `createStandardResponse`.
- [x] 2.3 **Verify test passes**: Run the test from 1.2 to ensure it now passes.
  - _Commit_: `fix: fetch team resource to list members (TDD Green)`
  - _Test_: `jest tests/tools/teams.test.ts -t "members list subcommand"`

## Phase 3: Test Coverage (Edge Cases)

- [x] 3.1 **Test empty team**: Add a test in `tests/tools/teams.test.ts` mocking `GET /teams/2` returning a team with no `members` property, asserting the tool returns `[]`.
- [x] 3.2 **Test 404 propagation**: Add a test mocking `GET /teams/99` returning `404 Not Found`, asserting the MCPError propagates correctly.
- [x] 3.3 **Verify non-regression**: Run the entire `teams.test.ts` suite to ensure `members.add`, `members.update`, etc., are unaffected.
  - _Commit_: `test: add edge cases for teams.members.list`
  - _Test_: `jest tests/tools/teams.test.ts`

## Phase 4: Verification

- [x] 4.1 **Run full test suite & coverage**: Run `npm run test:coverage` and ensure branches >90% and lines >95%.
- [x] 4.2 **Run lint and typecheck**: Run `npm run lint && npm run typecheck`.
- [x] 4.3 **Run contract tests**: Run `npm run test:contract` to ensure mocks are complete.
  - _Commit_: `chore: verify pre-commit checks and contract tests pass`
  - _Test_: `npm run lint && npm run test:coverage && npm run typecheck && npm run test:contract`

## Open Questions

None.
