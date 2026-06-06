# Proposal: fix-team-members-add-schema

## Intent

Fix the `vikunja_teams` `members.add` subcommand to use `username` instead of `userId`. Vikunja's REST API expects `username` for team member creation, resolving a bug where users could not be added to teams via the MCP.

## Scope

### In Scope

- Add optional `username` to the `vikunja_teams` tool Zod schema.
- Update `members.add` handler to require `username` and use it in the PUT body.
- Update unit tests in `tests/tools/teams.test.ts` to expect `username`.

### Out of Scope

- Changing `userId` behavior for `members.update` and `members.remove`.
- Addressing bugs in `members.list`.

## Capabilities

### New Capabilities

None

### Modified Capabilities

None

## Approach

Modify the Zod schema in `src/tools/teams.ts` to include `username: z.string().optional()`. Ensure `userId` remains optional for backward compatibility with `update` and `remove`. In the `members.add` block, validate `args.username` is provided and build the request body as `{"username": args.username, "admin": args.admin}`. Update `tests/tools/teams.test.ts` to replace `userId` with `username` in all `members.add` test cases.

## Affected Areas

| Area                        | Impact   | Description                                                             |
| --------------------------- | -------- | ----------------------------------------------------------------------- |
| `src/tools/teams.ts`        | Modified | Update Zod schema and `members.add` payload construction.               |
| `tests/tools/teams.test.ts` | Modified | Update tests to reflect the new `username` parameter for `members.add`. |

## Risks

| Risk                                                                        | Likelihood | Mitigation                                                                             |
| --------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------- |
| Breaking backward compatibility for clients using `userId` in `members.add` | High       | Acceptable breakage since the current behavior is completely broken (fails with 1005). |
| Breaking `members.update` or `members.remove`                               | Low        | Ensure `userId` remains in the schema and add/maintain test coverage.                  |

## Rollback Plan

Revert changes to `src/tools/teams.ts` and `tests/tools/teams.test.ts` to restore the previous `userId` implementation.

## Dependencies

- None

## Success Criteria

- [ ] `vikunja_teams` `members.add` successfully adds a member when provided a valid `username`.
- [ ] The PUT request payload correctly contains `{"username": "...", "admin": ...}` instead of `user_id`.
- [ ] Unit tests pass successfully.
