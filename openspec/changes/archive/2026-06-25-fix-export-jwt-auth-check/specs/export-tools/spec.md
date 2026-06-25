# Delta for export-tools

## ADDED Requirements

### Requirement: User Export JWT Auth Guard

The system MUST verify the authentication type is `jwt` before making API calls to user export endpoints (`/user/export/request`, `/user/export/download`). If the auth type is not `jwt`, the system MUST return a `PERMISSION_DENIED` error with a clear message directing the user to use JWT authentication.

#### Scenario: User export succeeds with JWT auth

- GIVEN the client is authenticated with JWT (`authManager.getAuthType() === 'jwt'`)
- WHEN the user calls `vikunja_request_user_export` or `vikunja_download_user_export`
- THEN the system MUST proceed with the API call
- AND the export request MUST be forwarded to the Vikunja API

#### Scenario: User export is rejected with API token auth

- GIVEN the client is authenticated with an API token (`authManager.getAuthType() !== 'jwt'`)
- WHEN the user calls `vikunja_request_user_export` or `vikunja_download_user_export`
- THEN the system MUST NOT make the API call
- AND the system MUST throw an MCPError with `ErrorCode.PERMISSION_DENIED`
- AND the error message MUST clearly state that JWT authentication is required
