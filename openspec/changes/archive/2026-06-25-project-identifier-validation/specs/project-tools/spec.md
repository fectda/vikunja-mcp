# Delta for project-tools

## ADDED Requirements

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

### Requirement: Error Message Formatting for Update Failures

The system MUST NOT produce double-prefixed error messages in project update operations. The error message SHALL contain exactly one `Failed to` prefix.

#### Scenario: Update error has single prefix

- GIVEN the user invokes `vikunja_projects` with subcommand `update`
- WHEN the upstream API returns an error (e.g., 400 Bad Request)
- THEN the returned error message SHALL read `"Failed to update project: <reason>"`
- AND the message SHALL NOT read `"Failed to Failed to update project: <reason>"`
