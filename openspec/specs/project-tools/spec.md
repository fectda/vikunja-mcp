# Project Tools Specification

## Purpose

This spec defines the behavior of the project tools, including the ability to persist the `identifier` field during project updates, ensuring correct usage of sharing endpoints, and team-based and user-based project sharing functionality.

## Requirements

### Requirement: Persist Identifier Field

The system MUST accept an `identifier` field in the `vikunja_projects` update schema and pass it to the upstream Vikunja API.

#### Scenario: User updates project identifier

- GIVEN the user invokes `vikunja_projects` with the `update` subcommand
- WHEN the user provides an `identifier` field in the request
- THEN the system MUST include the `identifier` in the API update payload

### Requirement: Identifier Length Validation

The system MUST reject project identifiers longer than 10 characters during Zod schema validation, before any API call is made.

#### Scenario: Identifier over 10 chars rejected before API call

- GIVEN the user invokes `vikunja_projects` with subcommand `update`
- WHEN the user provides an `identifier` field with more than 10 characters
- THEN the system SHALL return a VALIDATION_ERROR
- AND the system SHALL NOT call the upstream Vikunja API
- AND the error message SHALL indicate the maximum allowed length is 10

#### Scenario: Identifier exactly 10 chars accepted

- GIVEN the user invokes `vikunja_projects` with subcommand `update`
- WHEN the user provides an `identifier` field with exactly 10 characters
- THEN the system SHALL accept the value and pass it to the upstream API

#### Scenario: Identifier of 1-9 chars continues to work

- GIVEN the user invokes `vikunja_projects` with subcommand `update`
- WHEN the user provides an `identifier` field with between 1 and 9 characters
- THEN the system SHALL accept the value as before

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

### Requirement: Error Message Formatting for Update Failures

The system MUST NOT produce double-prefixed error messages in project update operations. The error message SHALL contain exactly one `Failed to` prefix.

#### Scenario: Update error has single prefix

- GIVEN the user invokes `vikunja_projects` with subcommand `update`
- WHEN the upstream API returns an error (e.g., 400 Bad Request)
- THEN the returned error message SHALL read `"Failed to update project: <reason>"`
- AND the message SHALL NOT read `"Failed to Failed to update project: <reason>"`

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

### Requirement: Team Share Creation

The system MUST allow sharing a project with a team by specifying the team ID and permission level.

#### Scenario: Create team share with read permission

- GIVEN user is authenticated with valid JWT or API token
- AND project ID 123 exists and user has admin permission
- AND team ID 5 exists
- WHEN calling `share-team` with projectId=123, teamId=5, right='read'
- THEN the API shall be called with PUT /projects/123/teams/5 with right=0
- AND response shall indicate successful share creation

#### Scenario: Create team share with write permission

- GIVEN user is authenticated with valid JWT or API token
- AND project ID 123 exists and user has admin permission
- AND team ID 5 exists
- WHEN calling `share-team` with projectId=123, teamId=5, right='write'
- THEN the API shall be called with PUT /projects/123/teams/5 with right=1
- AND response shall indicate successful share creation

#### Scenario: Create team share with admin permission

- GIVEN user is authenticated with valid JWT or API token
- AND project ID 123 exists and user has admin permission
- AND team ID 5 exists
- WHEN calling `share-team` with projectId=123, teamId=5, right='admin'
- THEN the API shall be called with PUT /projects/123/teams/5 with right=2
- AND response shall indicate successful share creation

#### Scenario: Create team share with numeric permission

- GIVEN user is authenticated with valid JWT or API token
- AND project ID 123 exists and user has admin permission
- AND team ID 5 exists
- WHEN calling `share-team` with projectId=123, teamId=5, right=2
- THEN the API shall be called with PUT /projects/123/teams/5 with right=2
- AND response shall indicate successful share creation

#### Scenario: Re-share project with team updates existing share

- GIVEN project 123 is already shared with team 5 with read permission
- WHEN calling `share-team` with projectId=123, teamId=5, right='admin'
- THEN the API shall update the existing share to admin permission
- AND response shall indicate successful update

### Requirement: Team Share Listing

The system MUST allow listing all team shares for a project.

#### Scenario: List team shares on project

- GIVEN user is authenticated with valid JWT or API token
- AND project ID 123 has 2 team shares
- WHEN calling `list-team-shares` with projectId=123
- THEN the API shall be called to retrieve team shares
- AND response shall contain list of team shares with team names and permission levels
- AND response shall indicate count of team shares

#### Scenario: List team shares on project with pagination

- GIVEN user is authenticated with valid JWT or API token
- AND project ID 123 has multiple team shares
- WHEN calling `list-team-shares` with projectId=123, page=1, perPage=10
- THEN the API shall be called with pagination parameters
- AND response shall return up to 10 team shares

### Requirement: Team Share Retrieval

The system MUST allow getting details of a specific team share.

#### Scenario: Get single team share

- GIVEN user is authenticated with valid JWT or API token
- AND project ID 123 has a share with team ID 5
- WHEN calling `get-team-share` with projectId=123, teamId=5
- THEN response shall contain team share details including team name and permission level

### Requirement: Team Share Update

The system MUST allow updating the permission level of an existing team share.

#### Scenario: Update team share permission

- GIVEN project 123 is shared with team 5 with read permission
- WHEN calling `update-team-share` with projectId=123, teamId=5, right='admin'
- THEN the API shall update the permission to admin level
- AND response shall indicate successful update

### Requirement: Team Share Removal

The system MUST allow removing a team share from a project.

#### Scenario: Remove team share from project

- GIVEN project 123 is shared with team 5
- WHEN calling `remove-team-share` with projectId=123, teamId=5
- THEN the API shall be called with DELETE /projects/123/teams/5
- AND response shall indicate successful removal

### Requirement: User Share Creation

The system MUST allow sharing a project with a user by specifying the user ID and permission level.

#### Scenario: Share project with read permission

- GIVEN user is authenticated with valid JWT or API token
- AND project ID 123 exists and user has admin permission
- AND user ID 5 exists
- WHEN calling `share-user` with projectId=123, userId=5, right='read'
- THEN the API shall be called with PUT /projects/123/users/5 with right=0
- AND response shall indicate successful share creation

#### Scenario: Share project with admin permission

- GIVEN user is authenticated with valid JWT or API token
- AND project ID 123 exists and user has admin permission
- AND user ID 5 exists
- WHEN calling `share-user` with projectId=123, userId=5, right='admin'
- THEN the API shall be called with PUT /projects/123/users/5 with right=2
- AND response shall indicate successful share creation

#### Scenario: Re-share project with user updates existing share

- GIVEN project 123 is already shared with user 5 with read permission
- WHEN calling `share-user` with projectId=123, userId=5, right='admin'
- THEN the API shall update the existing share to admin permission
- AND response shall indicate successful update

### Requirement: User Share Listing

The system MUST allow listing all user shares for a project.

#### Scenario: List user shares on project

- GIVEN user is authenticated with valid JWT or API token
- AND project ID 123 has 2 user shares
- WHEN calling `list-user-shares` with projectId=123
- THEN the API shall be called to retrieve user shares
- AND response shall contain list of user shares with usernames and permission levels
- AND response shall indicate count of user shares

#### Scenario: List user shares on project with pagination

- GIVEN user is authenticated with valid JWT or API token
- AND project ID 123 has multiple user shares
- WHEN calling `list-user-shares` with projectId=123, page=1, perPage=10
- THEN the API shall be called with pagination parameters
- AND response shall return up to 10 user shares

### Requirement: User Share Retrieval

The system MUST allow getting details of a specific user share.

#### Scenario: Get single user share

- GIVEN user is authenticated with valid JWT or API token
- AND project ID 123 has a share with user ID 5
- WHEN calling `get-user-share` with projectId=123, userId=5
- THEN response shall contain user share details including username and permission level

### Requirement: User Share Update

The system MUST allow updating the permission level of an existing user share.

#### Scenario: Update user share permission

- GIVEN project 123 is shared with user 5 with read permission
- WHEN calling `update-user-share` with projectId=123, userId=5, right='admin'
- THEN the API shall update the permission to admin level
- AND response shall indicate successful update

### Requirement: User Share Removal

The system MUST allow removing a user share from a project.

#### Scenario: Remove user share from project

- GIVEN project 123 is shared with user 5
- WHEN calling `remove-user-share` with projectId=123, userId=5
- THEN the API shall be called with DELETE /projects/123/users/5
- AND response shall indicate successful removal

### Requirement: Input Validation

The system MUST validate all inputs according to RFC 2119 requirements.

#### Scenario: Validate team ID is required

- GIVEN user is authenticated
- WHEN calling `share-team` without teamId
- THEN system shall throw VALIDATION_ERROR with message indicating teamId is required

#### Scenario: Validate project ID is required

- GIVEN user is authenticated
- WHEN calling `share-team` with projectId=0
- THEN system shall throw VALIDATION_ERROR with message indicating projectId must be positive

#### Scenario: Validate permission level is valid

- GIVEN user is authenticated
- WHEN calling `share-team` with right='invalid'
- THEN system shall throw VALIDATION_ERROR with message indicating valid options are read, write, admin

#### Scenario: Validate permission level accepts numeric values

- GIVEN user is authenticated
- WHEN calling `share-team` with right=3
- THEN system shall throw VALIDATION_ERROR with message indicating valid numeric values are 0, 1, 2

#### Scenario: Validate user ID is required

- GIVEN user is authenticated
- WHEN calling `share-user` without userId
- THEN system shall throw VALIDATION_ERROR with message indicating userId is required

#### Scenario: Validate user sharing right is valid

- GIVEN user is authenticated
- WHEN calling `share-user` with right='invalid'
- THEN system shall throw VALIDATION_ERROR with message indicating valid options are read, write, admin

### Requirement: Error Handling

The system MUST handle API errors gracefully.

#### Scenario: Handle project not found

- GIVEN user is authenticated
- WHEN calling `share-team` with projectId=999 (non-existent)
- THEN system shall throw NOT_FOUND error indicating project not found

#### Scenario: Handle team not found

- GIVEN user is authenticated
- AND project 123 exists
- WHEN calling `share-team` with teamId=999 (non-existent)
- THEN system shall throw error indicating team not found

#### Scenario: Handle unauthorized access

- GIVEN user has read-only permission on project 123
- WHEN calling `share-team` to add team to project 123
- THEN system shall throw FORBIDDEN or API error indicating lack of permission

#### Scenario: Handle team share not found for retrieval

- GIVEN user is authenticated
- AND project 123 exists but is not shared with team 5
- WHEN calling `get-team-share` with projectId=123, teamId=5
- THEN system shall throw NOT_FOUND error indicating team share not found

#### Scenario: Handle user share not found for retrieval

- GIVEN user is authenticated
- AND project 123 exists but is not shared with user 5
- WHEN calling `get-user-share` with projectId=123, userId=5
- THEN system shall throw NOT_FOUND error indicating user share not found

### Requirement: Authentication

The system MUST require authentication for team and user sharing operations.

#### Scenario: Unauthenticated request rejected for team sharing

- GIVEN user is not authenticated
- WHEN calling any team share subcommand (share-team, list-team-shares, etc.)
- THEN system shall throw AUTH_REQUIRED error

#### Scenario: Unauthenticated request rejected for user sharing

- GIVEN user is not authenticated
- WHEN calling any user share subcommand (share-user, list-user-shares, etc.)
- THEN system shall throw AUTH_REQUIRED error

### Requirement: Tool Registration

The existing `vikunja_projects` tool registration MUST be modified to include the new team and user sharing subcommands.

(Previously: vikunja_projects included subcommands: list, create, get, update, delete, share, list-shares, get-share, delete-share, auth-share)

#### Scenario: Register new team sharing subcommands

- GIVEN project tool is registered
- WHEN registration occurs
- THEN vikunja_projects tool shall include subcommands: share-team, list-team-shares, get-team-share, update-team-share, remove-team-share

#### Scenario: Register new user sharing subcommands

- GIVEN project tool is registered
- WHEN registration occurs
- THEN vikunja_projects tool shall include subcommands: share-user, list-user-shares, get-user-share, update-user-share, remove-user-share
