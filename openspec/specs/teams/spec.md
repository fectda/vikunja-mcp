# Delta for vikunja_teams

## MODIFIED Requirements

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

## ADDED Requirements

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

## Acceptance Criteria

- The Zod schema for `vikunja_teams` requires `username` (string) for `members.add`, while keeping `userId` for `update`/`remove`.
- The `members.add` PUT request payload correctly contains `{"username": "...", "admin": ...}` instead of `user_id`.
- Unit tests for `members.add` are updated to expect `username` and verify the correct PUT body structure.
