# Project Tools Specification

## Purpose

This spec defines the behavior of the project tools, including the ability to persist the `identifier` field during project updates and ensuring correct usage of sharing endpoints.

## Requirements

### Requirement: Persist Identifier Field

The system MUST accept an `identifier` field in the `vikunja_projects` update schema and pass it to the upstream Vikunja API.

#### Scenario: User updates project identifier

- GIVEN the user invokes `vikunja_projects` with the `update` subcommand
- WHEN the user provides an `identifier` field in the request
- THEN the system MUST include the `identifier` in the API update payload

### Requirement: Route Project Team Sharing

The system MUST fetch a single team share by querying the list endpoint (`GET /projects/{id}/teams`) and filtering the results instead of assuming a single-resource GET endpoint.

#### Scenario: User requests a specific team share

- GIVEN a team share exists for a project
- WHEN the user invokes the `vikunja_projects` tool to get that team share
- THEN the system MUST query the project's list of team shares
- AND the system MUST return the specific team share by matching the ID

### Requirement: Route Project Link Sharing

The system MUST fetch a single link share by querying the list endpoint (`GET /projects/{id}/shares`) and filtering the results. It MUST NOT perform a pre-flight GET check before deleting a link share.

#### Scenario: User requests a specific link share

- GIVEN a link share exists for a project
- WHEN the user invokes the `vikunja_projects` tool to get that link share
- THEN the system MUST query the project's list of link shares
- AND the system MUST return the specific link share by matching the ID

#### Scenario: User deletes a link share

- GIVEN the user wishes to delete a link share
- WHEN the user invokes the `vikunja_projects` tool to delete it
- THEN the system MUST send a DELETE request without a prior pre-flight GET check

### Requirement: Error Reporting for Project Update

The system MUST NOT mask real upstream validation errors with hardcoded "not found" messages when updating projects.

#### Scenario: Update with rejected payload shows real error

- GIVEN the user invokes `vikunja_projects` with the `update` subcommand
- WHEN the user provides a valid id and an identifier that Vikunja rejects (e.g., duplicate, invalid format)
- THEN the MCP returns the **actual Vikunja error message** (400 Bad Request, 422 Unprocessable Entity, etc.)
- AND does NOT return "Project with ID X not found"

#### Scenario: Update with non-existent ID still returns not-found

- GIVEN the user invokes `vikunja_projects` with the `update` subcommand
- WHEN the user provides an id that does not exist (404 from Vikunja)
- THEN the MCP still returns a meaningful "not found" message (the error handler generates this naturally without customMessage)
- AND the message is NOT the real upstream 404 body (the standard behavior is preserved)

### Requirement: Error Reporting for Project Move

The system MUST NOT mask real upstream validation errors with hardcoded "not found" messages when moving projects.

#### Scenario: Move with rejected payload shows real error

- GIVEN the user invokes `vikunja_projects` with the `move` subcommand
- WHEN the user provides invalid parameters
- THEN the MCP returns the actual Vikunja error message
- AND does NOT return "Project with ID X not found"

### Requirement: No regression on error handler behavior

The system MUST preserve the current behavior of the shared error handler for all other tools and operations.

#### Scenario: Other callers of handleStatusCodeError remain unchanged

- GIVEN any OTHER code path calls handleStatusCodeError (not in crud.ts or hierarchy.ts)
- WHEN an error occurs in that code path
- THEN the behavior is unchanged from the current implementation

### Requirement: Project Move Payload

The system MUST correctly formulate the payload for moving projects by including the `title` field and setting `parent_project_id: 0` for root moves.

#### Scenario: Move project to a new parent succeeds

- GIVEN the user invoking vikunja_projects with the move subcommand
- WHEN user calls vikunja_projects with subcommand: "move", a valid id, and a valid parentProjectId
- THEN the payload to Vikunja includes `title` from the current project
- AND the payload includes `parent_project_id` set to the new parent ID
- AND the move succeeds

#### Scenario: Move project to root succeeds

- GIVEN the user invoking vikunja_projects with the move subcommand
- WHEN user calls vikunja_projects with subcommand: "move", a valid id, and parentProjectId is undefined/null
- THEN the payload includes `parent_project_id: 0`
- AND the move succeeds

#### Scenario: Move with invalid data shows real error

- GIVEN the user invoking vikunja_projects with the move subcommand
- WHEN Vikunja rejects the move payload (e.g., missing required field, cycle detection)
- THEN the error message from the upstream API is visible (NOT masked by "Project with ID not found")
