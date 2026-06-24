# Projects Update Specification

## Purpose

Define behavior for updating Vikunja projects via the MCP server, specifically handling the optional `parentProjectId` parameter correctly.

## Requirements

### Requirement: Optional parentProjectId in Updates

When updating a project, if `parentProjectId` is not provided by the user, the system MUST automatically fetch the current project's `parent_project_id` value and include it in the API update payload.

The system SHALL preserve the existing parent project relationship when the user doesn't explicitly specify a new parent.

#### Scenario: Update project title without parentProjectId

- GIVEN a project exists with id 5, title "Old Title", and parent_project_id 2
- WHEN user calls `vikunja_projects { subcommand: "update", id: 5, title: "New Title" }` (no parentProjectId)
- THEN the MCP fetches the current project to get parent_project_id=2
- AND sends update payload with `{ title: "New Title", parent_project_id: 2 }`
- AND the API returns success with updated project

#### Scenario: Update project with explicit parentProjectId

- GIVEN a project exists with id 5 and parent_project_id 2
- WHEN user calls `vikunja_projects { subcommand: "update", id: 5, title: "New", parentProjectId: 3 }`
- THEN the MCP uses parentProjectId=3 in the update payload
- AND sends update payload with `{ title: "New", parent_project_id: 3 }`

#### Scenario: Update project with parentProjectId set to null/undefined (no parent)

- GIVEN a project exists with id 5 and parent_project_id 2
- WHEN user explicitly provides `parentProjectId: 0` to remove parent
- THEN the MCP includes `parent_project_id: 0` in the update payload
- AND the API removes the parent relationship

#### Scenario: Update project that has no parent

- GIVEN a project exists with id 5 and parent_project_id is null
- WHEN user calls `vikunja_projects { subcommand: "update", id: 5, title: "New" }`
- THEN the MCP uses null/undefined for parent_project_id in the update payload
- AND the API returns success

### Requirement: Validation Before Update

The system MUST validate project data (title, hexColor, parentProjectId hierarchy) before making the API call, using the resolved parentProjectId value.

#### Scenario: Validate depth constraint on parent change

- GIVEN user attempts to set parentProjectId that would exceed depth 10
- THEN the MCP throws validation error before API call
- AND no update is attempted

### Requirement: Error Handling

The system MUST handle errors from fetching the current project and return meaningful error messages.

#### Scenario: Project not found during fetch

- GIVEN project with id 5 does not exist
- WHEN user calls `vikunja_projects { subcommand: "update", id: 5, title: "New" }`
- THEN the MCP throws error with message indicating project not found
- AND no update is attempted

## Modified Requirements

None - this is a new specification.

## Removed Requirements

None.

## Acceptance Criteria

| ID  | Criterion                                                                                      | Testable    |
| --- | ---------------------------------------------------------------------------------------------- | ----------- |
| AC1 | `vikunja_projects { subcommand: "update", id: X, title: "New" }` works without parentProjectId | Manual/Unit |
| AC2 | Update preserves existing parentProjectId                                                      | Unit test   |
| AC3 | Explicit parentProjectId overrides current value                                               | Unit test   |
| AC4 | Validation uses resolved parentProjectId                                                       | Unit test   |
| AC5 | Error handling for project fetch failures                                                      | Unit test   |
