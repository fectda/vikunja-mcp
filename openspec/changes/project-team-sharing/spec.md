# Delta for Project Team Sharing

## Purpose

This spec defines the requirements and scenarios for adding team-based project sharing functionality to the Vikunja MCP server. This enables giving team-based access to projects (different from link sharing), where all team members inherit the specified permission level.

## ADDED Requirements

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

### Requirement: Authentication

The system MUST require authentication for team sharing operations.

#### Scenario: Unauthenticated request rejected

- GIVEN user is not authenticated
- WHEN calling any team share subcommand (share-team, list-team-shares, etc.)
- THEN system shall throw AUTH_REQUIRED error

## MODIFIED Requirements

### Requirement: Tool Registration

The existing `vikunja_projects` tool registration MUST be modified to include the new team sharing subcommands.

(Previously: vikunja_projects included subcommands: list, create, get, update, delete, share, list-shares, get-share, delete-share, auth-share)

#### Scenario: Register new team sharing subcommands

- GIVEN project tool is registered
- WHEN registration occurs
- THEN vikunja_projects tool shall include subcommands: share-team, list-team-shares, get-team-share, update-team-share, remove-team-share

## REMOVED Requirements

None.

## Summary Table

| Requirement          | Type     | Scenarios |
| -------------------- | -------- | --------- |
| Team Share Creation  | ADDED    | 6         |
| Team Share Listing   | ADDED    | 2         |
| Team Share Retrieval | ADDED    | 1         |
| Team Share Update    | ADDED    | 1         |
| Team Share Removal   | ADDED    | 1         |
| Input Validation     | ADDED    | 4         |
| Error Handling       | ADDED    | 4         |
| Authentication       | ADDED    | 1         |
| Tool Registration    | MODIFIED | 1         |
| **Total**            |          | **21**    |

## Coverage

- Happy paths: 11 scenarios (team share CRUD operations)
- Edge cases: 6 scenarios (numeric permissions, re-sharing, pagination)
- Error states: 4 scenarios (not found, unauthorized, validation)
