# Specs: Fix Authentication for Assignee & Label Operations

## Background

Vikunja provides two authentication mechanisms:

1. **API Token** (`tk_*`): Generated in Settings → API Tokens. Works for basic project/task CRUD.
2. **JWT Token** (`eyJ...`): Obtained via `/api/v1/login`. Required for user endpoints and assignee/label write operations.

The MCP server currently has a bug where auto-login JWT is blocked when `VIKUNJA_API_TOKEN` exists in `.env`, causing assignee and label operations to fail silently.

---

## RF-01: Auto-login JWT when credentials exist

### Scenario 1.1: JWT auto-login with all credentials present

**Given** `.env` contains `VIKUNJA_USER`, `VIKUNJA_PASSWORD`, `VIKUNJA_API_TOKEN`, and `VIKUNJA_URL`
**When** the MCP server starts
**Then** the server SHALL attempt auto-login via `/api/v1/login` to obtain a JWT
**And** the JWT SHALL override `VIKUNJA_API_TOKEN` in the session
**And** the log SHALL show "Auto-login JWT successful"

### Scenario 1.2: JWT auto-login fails, fallback to API token

**Given** `.env` contains invalid `VIKUNJA_USER`/`VIKUNJA_PASSWORD` but valid `VIKUNJA_API_TOKEN`
**When** auto-login fails with 401/403 or network error
**Then** the server SHALL log a warning about the failed login
**And** the server SHALL fall back to using `VIKUNJA_API_TOKEN`
**And** the log SHALL indicate "Falling back to API token — assignees/labels may not work"

### Scenario 1.3: Only API token, no credentials

**Given** `.env` contains only `VIKUNJA_API_TOKEN` (no `VIKUNJA_USER`/`VIKUNJA_PASSWORD`)
**When** the MCP server starts
**Then** the server SHALL use the API token directly
**And** the log SHALL indicate auth type as "API Token"
**And** the server SHALL NOT attempt auto-login

### Scenario 1.4: Only credentials, no API token

**Given** `.env` contains `VIKUNJA_USER` + `VIKUNJA_PASSWORD` but no `VIKUNJA_API_TOKEN`
**When** the MCP server starts
**Then** the server SHALL attempt auto-login via `/api/v1/login`
**And** on success, SHALL use the obtained JWT
**And** on failure, SHALL log an error and start without authentication

---

## RF-02: Assignee operations work with JWT

### Scenario 2.1: Assign user to task with JWT

**Given** the server is authenticated with a JWT token
**When** the user calls `vikunja_task_assignees` with `operation: "assign"` and valid `id` and `assignees`
**Then** the API SHALL be called with `PUT /tasks/{id}/assignees` with the JWT in the Authorization header
**And** the assignment SHALL persist in Vikunja
**And** the response SHALL show the assigned user in the task's assignees

### Scenario 2.2: Unassign user from task with JWT

**Given** the server is authenticated with a JWT token and a user is assigned to a task
**When** the user calls `vikunja_task_assignees` with `operation: "unassign"`
**Then** the API SHALL be called with `DELETE /tasks/{id}/assignees/{userId}`
**And** the user SHALL be removed from the task's assignees

### Scenario 2.3: List assignees with API token (read-only works)

**Given** the server is authenticated with an API token
**When** the user calls `vikunja_task_assignees` with `operation: "list-assignees"`
**Then** the API SHALL be called with `GET /tasks/{id}/assignees`
**And** the response SHALL show current assignees (read-only operations work with API tokens)

---

## RF-03: Label operations work with JWT

### Scenario 3.1: Apply label to task with JWT

**Given** the server is authenticated with a JWT token
**When** the user calls `vikunja_task_labels` with `operation: "apply-label"`
**Then** the API SHALL be called with `PUT /tasks/{id}/labels`
**And** the label SHALL persist on the task

### Scenario 3.2: Remove label from task with JWT

**Given** the server is authenticated with a JWT token and a label is on a task
**When** the user calls `vikunja_task_labels` with `operation: "remove-label"`
**Then** the API SHALL be called with `DELETE /tasks/{id}/labels/{labelId}`
**And** the label SHALL be removed from the task

---

## RF-04: Clear error messages for auth failures

### Scenario 4.1: Assign fails with API token

**Given** the server is authenticated with an API token (`tk_*`)
**When** the user attempts to assign a user to a task
**Then** the response SHALL contain a clear error message explaining that API tokens do not support this operation
**And** the error message SHALL suggest using JWT authentication
**And** the error message SHALL include instructions on how to enable auto-login or login manually

### Scenario 4.2: Generic API error

**Given** the server is authenticated and the Vikunja API returns a non-auth error
**When** the assign operation fails
**Then** the error message SHALL preserve the original error details from the API
**And** the error code SHALL reflect the actual error type (not a generic `API_ERROR`)

---

## RF-05: JWT refresh

### Scenario 5.1: Refresh JWT token

**Given** the server is authenticated with a JWT token
**When** the user calls `vikunja_auth` with `subcommand: "refresh"`
**Then** the server SHALL call the Vikunja renew token endpoint (`/user/token`)
**And** the new token SHALL replace the old token in the session
**And** the response SHALL confirm the refresh was successful

### Scenario 5.2: Refresh fails

**Given** the server is authenticated but the JWT has expired
**When** the user calls `vikunja_auth refresh`
**Then** the server SHALL return an error indicating the token could not be refreshed
**And** the error message SHALL suggest reconnecting with credentials

---

## RF-06: Login via MCP tool

### Scenario 6.1: Login with username and password

**Given** the server is running but not authenticated (or authenticated with API token)
**When** the user calls `vikunja_auth` with `subcommand: "login"`, `apiUrl`, `username`, and `password`
**Then** the server SHALL call `/api/v1/login` with the credentials
**And** on success, the JWT SHALL be used for all subsequent operations
**And** the client factory SHALL be reinitialized with the new token
**And** the response SHALL confirm successful login

### Scenario 6.2: Login fails with wrong credentials

**Given** the user provides incorrect credentials
**When** the user calls `vikunja_auth login`
**Then** the server SHALL return a clear authentication error
**And** the existing session SHALL NOT be affected

---

## RF-07: Auth type logging

### Scenario 7.1: Server startup logs auth type

**Given** the server is starting with any valid configuration
**When** authentication is established
**Then** the log SHALL include the auth type (JWT or API Token)
**And** the log SHALL indicate the source (auto-login, direct token, or fallback)
**And** the log SHALL include a token prefix for debugging (first 10 chars)

---

## RF-08: Circuit breaker fix

### Scenario 8.1: Retry operations use unique circuit breakers

**Given** multiple retry operations are in flight simultaneously
**When** each retry creates a circuit breaker
**Then** each operation SHALL use a unique circuit breaker name
**And** failures in one operation SHALL NOT affect the circuit breaker state of another operation

### Scenario 8.2: Retry backoff works correctly

**Given** an operation fails with a retryable error
**When** retry is triggered
**Then** the retry SHALL wait the configured delay before attempting again
**And** the delay SHALL increase exponentially up to the configured maximum
