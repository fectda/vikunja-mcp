# Delta for vikunja-projects

## ADDED Requirements

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

### Requirement: Error Handler Transparency for 404

The system MUST propagate sanitized upstream validation errors for 404 status codes rather than masking them completely.

#### Scenario: Genuine 404 preserves the upstream message

- GIVEN an API call that returns a 404 error
- WHEN `handleStatusCodeError` receives a 404 from an upstream API call
- THEN the returned message includes the original upstream message
- AND security sanitization is NOT bypassed
