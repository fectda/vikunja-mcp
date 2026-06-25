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
