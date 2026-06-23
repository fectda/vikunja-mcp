# Export Tools Specification

## Purpose

This spec defines the behavior of the export tools, specifically focusing on password handling and environment variable fallbacks during data export.

## Requirements

### Requirement: Export Password Fallback

The system SHOULD allow the export password to be optional in the tool schema, and MUST fallback to the `VIKUNJA_EXPORT_PASSWORD` environment variable if the password is not provided in the request.

#### Scenario: User requests export without explicit password

- GIVEN the `VIKUNJA_EXPORT_PASSWORD` environment variable is set
- WHEN a user requests an export without providing a `password`
- THEN the system MUST use the environment variable for the export
- AND the export request MUST succeed

#### Scenario: User requests export with explicit password

- GIVEN the `VIKUNJA_EXPORT_PASSWORD` environment variable is set
- WHEN a user requests an export and explicitly provides a `password`
- THEN the system MUST use the explicitly provided `password` instead of the environment variable

#### Scenario: User requests export without password or env var

- GIVEN the `VIKUNJA_EXPORT_PASSWORD` environment variable is NOT set
- WHEN a user requests an export without providing a `password`
- THEN the request MAY fail or be rejected by the upstream API depending on its internal requirements
