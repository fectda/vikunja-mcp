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
