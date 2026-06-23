# Design: fix-teams-members-list

## Context

The `vikunja_teams` tool's `members.list` subcommand currently fails with a `405 Method Not Allowed` error because it makes a `GET` request to a non-existent `/teams/{id}/members` endpoint on the Vikunja API. The correct way to retrieve a team's members is by fetching the full team resource via `GET /teams/{id}` and extracting the embedded `members` array from the response. This change implements that fix.

## Goals and Non-Goals

- **Goals**: `members.list` returns the team's members as an array; defensively handles cases where the team has no members (empty teams); preserves the member object shape.
- **Non-Goals**: Fixing `members.add`, `members.update`, or `members.remove` (these are handled by the `teams-api-fixes` change); adding new subcommands; changing other team operations or introducing a shared `getTeam` helper.

## Technical Approach

Instead of requesting `/teams/{id}/members`, the `members.list` handler in `src/tools/teams.ts` will fetch the team resource via `GET /teams/{id}`.
The handler will parse the JSON response as a `Team` object and extract `team.members`. To prevent errors on empty teams where `team.members` might be undefined or null, it will default to an empty array using the nullish coalescing operator (`team.members ?? []`).
The extracted array will be passed to `createStandardResponse` without altering its shape, thereby matching the existing behavior of the MCP tool but successfully retrieving the data. We will also update test mocks in `tests/tools/teams.test.ts` to intercept `/teams/{id}` instead of the hallucinated endpoint and assert the correct behavior under both normal and edge cases (empty team, non-existent team).

## Architecture Decisions

### Decision: Reuse Team Resource for Members

**Choice**: Use `GET /teams/{id}` and return `team.members ?? []`.
**Alternatives considered**:

1. Hitting `GET /teams` (list endpoint) and filtering client-side.
2. Adding a new method to the `node-vikunja` client.
   **Rationale**: Fetching the full team resource by ID is the most direct approach and exactly mirrors the precedent set by commit `6b01e22` in `src/tools/projects/team-sharing.ts`. It requires a single GET request, no pagination, and limits the blast radius of the bug fix strictly to this subcommand without modifying the SDK.

## File Changes

| File                        | Action | Description                                                                                                                                                                                                                                                        |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/tools/teams.ts`        | Modify | Update the `members.list` case (approx. line 307-313) to change the endpoint to `/teams/${teamId}`. Update the response parsing to use `const team = await response.json()` and extract `const members = team.members ?? []`.                                      |
| `tests/tools/teams.test.ts` | Modify | Update `members list subcommand` mocks (approx. line 518-583) to intercept `/teams/1` instead of `/teams/1/members`, and make the mock return a full team object with an embedded `members` array. Add test cases for an empty team and a non-existent team (404). |

## Interfaces / Contracts

No new interfaces or data structures are introduced. The shape of the response remains exactly what Vikunja provides for a team member (e.g. `{ id, username, admin, email, created, ... }`).

## Testing Strategy

| Layer | What to Test   | Approach                                                                                           |
| ----- | -------------- | -------------------------------------------------------------------------------------------------- |
| Unit  | Happy Path     | Mock `GET /teams/{id}` to return a team with members, assert `members.list` returns the array.     |
| Unit  | Empty Team     | Mock `GET /teams/{id}` to return a team with no `members` property, assert the tool returns `[]`.  |
| Unit  | Not Found      | Mock `GET /teams/{id}` returning `404 Not Found`, assert appropriate MCPError is thrown (not 405). |
| Unit  | Non-Regression | Ensure other subcommands (`members.add`, `members.remove`, etc.) still function exactly as before. |

## Migration / Rollout

No migration required.

## Risks & Mitigations

- **Merge conflict with `teams-api-fixes`**: `teams-api-fixes` also touches `src/tools/teams.ts` and `tests/tools/teams.test.ts`. _Mitigation_: Keep changes minimal and isolated to the `members.list` `case` block in the switch statement. This change should preferably be stacked _after_ `teams-api-fixes` or cleanly rebased if merging in parallel.
- **Empty team structure**: Vikunja might omit `members`. _Mitigation_: Defensively use `team.members ?? []`.
- **Contract Drift**: _Mitigation_: The `npm run test:contract` suite should be executed after updating the mocks to ensure they are valid.

## Open Questions

- [ ] None.

## Out of Scope

Refactoring to use a shared `getTeam` helper for all `teams.ts` subcommands is out of scope for this focused fix.
