# Task Listing Specification

## Purpose

This spec defines the behavior for retrieving a list of tasks across all projects using the Vikunja API, specifically addressing the deprecation of the `/tasks/all` endpoint in favor of the `/tasks` endpoint.

## Requirements

### Requirement: Task Listing Retrieval

The system MUST retrieve a list of tasks using the `/tasks` endpoint, bypassing the deprecated `/tasks/all` endpoint hardcoded in `node-vikunja`.

#### Scenario: Successful Task Retrieval

- GIVEN the MCP wrapper receives a `vikunja_tasks list` command
- WHEN the client invokes the task listing operation
- THEN the system MUST intercept the call and route the HTTP request to the `/tasks` endpoint
- AND the system MUST return the retrieved tasks successfully

#### Scenario: Query Parameters Preservation

- GIVEN the MCP wrapper receives a task listing request with query parameters (e.g., `filter`, `sort_by`, `page`)
- WHEN the request is routed to the `/tasks` endpoint
- THEN the system MUST append all provided query parameters correctly to the URL

#### Scenario: Authentication Context Forwarding

- GIVEN the MCP wrapper has an active session with valid authentication tokens
- WHEN the task listing operation is intercepted
- THEN the system MUST forward the correct Authorization headers from the current session to the `/tasks` endpoint
