# Spec for vikunja_teams

## Requirements

### Requirement: Team Member Creation Schema

The `vikunja_teams` tool MUST accept `username` instead of `userId` when adding a member to a team, and MUST send this `username` in the PUT request body.
(Previously: Accepted `userId` and sent `user_id` in the PUT body, which caused the API to reject the request with code 1005).

#### Scenario: Successfully add a team member

- GIVEN a valid team ID and an existing Vikunja username
- WHEN the `vikunja_teams` tool is invoked with `subcommand: "members"`, `memberSubcommand: "add"`, `id`, and `username`
- THEN the MCP MUST send a PUT request to `/teams/{id}/members`
- AND the request body MUST contain `{"username": "<username>", "admin": <boolean>}`
- AND the MCP MUST return the success response from the Vikunja API.

#### Scenario: Attempt to add member without username

- GIVEN a request to add a team member
- WHEN the `username` parameter is omitted
- THEN the MCP MUST reject the request during Zod schema validation.

### Requirement: Schema Backward Compatibility for Other Operations

The `vikunja_teams` tool schema MUST preserve `userId` for the `members.update` and `members.remove` subcommands.

#### Scenario: Update an existing team member

- GIVEN a valid team ID and user ID
- WHEN the `vikunja_teams` tool is invoked with `subcommand: "members"`, `memberSubcommand: "update"`, `id`, and `userId`
- THEN the request MUST pass schema validation.

#### Scenario: Remove a team member

- GIVEN a valid team ID and user ID
- WHEN the `vikunja_teams` tool is invoked with `subcommand: "members"`, `memberSubcommand: "remove"`, `id`, and `userId`
- THEN the request MUST pass schema validation.

### Requirement: List Team Members

The `vikunja_teams` tool MUST retrieve team members by fetching the team resource and returning its embedded members array. It MUST NOT request the non-existent `/teams/{id}/members` endpoint.

#### Scenario: List members of a team with existing members

- GIVEN a valid team ID with at least one member
- WHEN the user calls `vikunja_teams` with `subcommand: "members"`, `memberSubcommand: "list"`, and a valid `id`
- THEN the MCP calls `GET /teams/{id}` (NOT `GET /teams/{id}/members`)
- AND the response body is the `members` array from the team resource
- AND each element preserves Vikunja's shape (e.g. `{ user_id, username, admin, joined_at, ... }`)

#### Scenario: List members of an empty team

- GIVEN a valid team ID that has no members
- WHEN the user calls the same subcommand for a team that has no members
- THEN the MCP returns `[]` (empty array)
- AND the MCP does NOT throw if `team.members` is missing or null

#### Scenario: List members of a non-existent team

- GIVEN a team ID that does not exist
- WHEN the user calls the subcommand with an `id` that does not exist
- THEN the MCP propagates a `404 Not Found` (or appropriate "not found" error) from the upstream Vikunja response
- AND the MCP does NOT return a `405 Method Not Allowed` error

#### Scenario: No regression on other team subcommands

- GIVEN any other team operation
- WHEN the user calls any other subcommand of `vikunja_teams` (e.g. create, get, update, delete, members.add, members.remove)
- THEN the behavior is unchanged from the current implementation

## Acceptance Criteria

- The Zod schema for `vikunja_teams` requires `username` (string) for `members.add`, while keeping `userId` for `update`/`remove`.
- The `members.add` PUT request payload correctly contains `{"username": "...", "admin": ...}` instead of `user_id`.
- Unit tests for `members.add` are updated to expect `username` and verify the correct PUT body structure.
- The `members.list` functionality retrieves members correctly by getting the full team.
