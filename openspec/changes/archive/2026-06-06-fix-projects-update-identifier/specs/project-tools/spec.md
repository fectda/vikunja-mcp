# Delta for Project Tools

This is a MODIFIED delta spec for the existing `project-tools` capability. It ensures accurate error reporting when upstream API validation fails.

## ADDED Requirements

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
