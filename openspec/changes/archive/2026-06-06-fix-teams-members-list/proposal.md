# Proposal: fix-teams-members-list

## Intent

The `teams.members.list` subcommand currently fails with a `405 Method Not Allowed` error because it requests a non-existent `/teams/{id}/members` API endpoint. This completely blocks the enumeration of team membership through the MCP. This change will fix the endpoint and parse the correct response.

## Scope

### In Scope

- Update `src/tools/teams.ts` to call `GET /teams/{id}` instead of `/teams/{id}/members` for the `members.list` subcommand.
- Extract and return the embedded `members` array from the team resource response.
- Implement defensive handling (e.g., `team.members ?? []`) to ensure a team with no members returns an empty array.
- Update the mock requests and assertions in `tests/tools/teams.test.ts` to reflect the new endpoint and response shape.

### Out of Scope

- Modifying the `members.add`, `members.update`, or `members.remove` subcommands (these are separate changes, e.g., handled by `teams-api-fixes`).
- Refactoring `src/tools/teams.ts` to use a newly extracted shared `getTeam` helper for all subcommands (this is deferred to avoid distracting from the immediate fix).

## Capabilities

### New Capabilities

None

### Modified Capabilities

None

## Approach

Reuse the team resource (`GET /teams/{id}`). The handler will fetch the team object and return its embedded `members` array, identical to the pattern used in commit `6b01e22` for `src/tools/projects/team-sharing.ts`. The response will be defensibly parsed as `team.members ?? []`. Mock fixtures in tests will be updated to return a full team object when `/teams/{id}` is queried.

## Affected Areas

| Area                        | Impact   | Description                                                           |
| --------------------------- | -------- | --------------------------------------------------------------------- |
| `src/tools/teams.ts`        | Modified | Update `members.list` to call `GET /teams/{id}` and extract `members` |
| `tests/tools/teams.test.ts` | Modified | Update mocks for `members.list` to match the new route and response   |

## Risks

| Risk                                     | Likelihood | Mitigation                                                                                                                  |
| ---------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| Team resource missing `members` field    | High       | Defensively default to `[]` if `team.members` is undefined or null.                                                         |
| Existing tests break due to mock changes | High       | Update the mock to intercept `/teams/1` instead of `/teams/1/members` and return a full team object.                        |
| Overlap with `teams-api-fixes` change    | Medium     | The `teams-api-fixes` change addresses other verb corrections. Coordinate to avoid merge conflicts in `src/tools/teams.ts`. |

## Rollback Plan

Revert the commit that modifies `src/tools/teams.ts` and `tests/tools/teams.test.ts`. The previous state will be restored, returning the 405 error behavior.

## Dependencies

None

## Success Criteria

- [ ] Calling `vikunja_teams` with `subcommand: "members", memberSubcommand: "list", id: <id>` returns the team's members.
- [ ] The returned shape preserves whatever Vikunja embeds in `members[]` (e.g. `{ user_id, username, admin, joined_at, ... }`).
- [ ] A team with no members returns `[]`, not `undefined` and not an error.
- [ ] The test reproducing the 405 (a failing test pre-fix) passes after the fix.
