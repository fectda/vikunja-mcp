# Delta for vikunja-teams

## ADDED Requirements

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
