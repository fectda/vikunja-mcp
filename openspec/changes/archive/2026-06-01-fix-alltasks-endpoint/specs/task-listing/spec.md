# Delta for task-listing

## MODIFIED Requirements

### Requirement: Task Listing Retrieval

The system MUST retrieve a list of tasks using the correct `/tasks` endpoint by appending `/tasks` to the configured `baseUrl` (which already contains the `/api/v1` path), bypassing the deprecated `/tasks/all` endpoint hardcoded in `node-vikunja`.
(Previously: The system MUST retrieve a list of tasks using the `/tasks` endpoint, bypassing the deprecated `/tasks/all` endpoint hardcoded in `node-vikunja`.)

#### Scenario: Successful Task Retrieval

- GIVEN the MCP wrapper receives a `vikunja_tasks list` command with `allProjects: true`
- WHEN the client invokes the task listing operation
- THEN the system MUST intercept the call and construct the URL without duplicating the `/api/v1` path segment
- AND route the HTTP request to the correct `/tasks` endpoint relative to the API base URL
- AND the system MUST return the retrieved tasks successfully

#### Scenario: Query Parameters Preservation

- GIVEN the MCP wrapper receives a task listing request with query parameters (e.g., `filter`, `sort_by`, `page`)
- WHEN the request is routed to the `/tasks` endpoint
- THEN the system MUST append all provided query parameters correctly to the URL

#### Scenario: Authentication Context Forwarding

- GIVEN the MCP wrapper has an active session with valid authentication tokens
- WHEN the task listing operation is intercepted
- THEN the system MUST forward the correct Authorization headers from the current session to the `/tasks` endpoint
