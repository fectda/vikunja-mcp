# Project User Sharing Specification

## Purpose

This specification defines the requirements for user-based project sharing operations in the Vikunja MCP server. It enables sharing projects with individual users and managing their access permissions.

## Requirements

### Requirement: share-user

The system MUST provide a subcommand to share a project with a specific user, granting them defined access rights.

The tool MUST accept `projectId` (positive integer), `userId` (positive integer), and `right` (read|write|admin or 0|1|2) as required parameters.

The tool MUST return a success message including the granted permission level.

#### Scenario: Share project with read access

- GIVEN an authenticated user with admin rights on project 1
- WHEN calling vikunja_projects_user_sharing with subcommand: "share-user", projectId: 1, userId: 5, right: "read"
- THEN the project SHOULD be shared with user 5 with read-only access
- AND the response SHOULD confirm the share was created

#### Scenario: Share project with admin access

- GIVEN an authenticated user with admin rights on project 1
- WHEN calling with right: "admin" (or 2)
- THEN user SHOULD receive full admin permissions on the project

#### Scenario: Re-share with higher permissions (upgrade)

- GIVEN user 5 already has read access to project 1
- WHEN calling with userId: 5, right: "admin"
- THEN existing share SHOULD be updated to admin level
- AND response SHOULD confirm permissions were updated

---

### Requirement: list-user-shares

The system MUST provide a subcommand to list all users who have access to a specific project.

The tool MUST accept `projectId` (positive integer) as required parameter.

The tool MUST accept optional pagination parameters: `page` (default 1) and `perPage` (default 50, max 100).

The response MUST include an array of user shares, each containing user ID, username, and permission level.

#### Scenario: List all users with project access

- GIVEN project 1 is shared with 3 users
- WHEN calling vikunja_projects_user_sharing with subcommand: "list-user-shares", projectId: 1
- THEN response SHOULD contain array of 3 user shares
- AND each entry SHOULD include user id, name, and right (0/1/2)

#### Scenario: List users with pagination

- GIVEN project 1 has 25 shared users
- WHEN calling with perPage: 10, page: 1
- THEN response SHOULD return first 10 users
- AND metadata SHOULD indicate more pages available

#### Scenario: List shares for project with no users

- GIVEN project 1 has no user shares
- WHEN calling list-user-shares
- THEN response SHOULD return empty array

---

### Requirement: get-user-share

The system MUST provide a subcommand to retrieve details of a specific user's access to a project.

The tool MUST accept both `projectId` and `userId` as required parameters.

The response MUST include user details and current permission level.

#### Scenario: Get specific user share details

- GIVEN user 5 has write access to project 1
- WHEN calling vikunja_projects_user_sharing with subcommand: "get-user-share", projectId: 1, userId: 5
- THEN response SHOULD include user ID, username, and right: 1 (write)

#### Scenario: Get share for user without access

- GIVEN user 8 has no access to project 1
- WHEN calling get-user-share with userId: 8
- THEN error SHOULD be returned with NOT_FOUND code

---

### Requirement: update-user-share

The system MUST provide a subcommand to modify an existing user's access permissions on a project.

The tool MUST accept `projectId`, `userId`, and `right` as required parameters.

The operation MUST fail if the user does not already have access to the project.

#### Scenario: Downgrade user permissions

- GIVEN user 5 has admin access to project 1
- WHEN calling with right: "read"
- THEN user 5 permissions SHOULD be downgraded to read-only
- AND response SHOULD confirm the update

#### Scenario: Update non-existent share

- GIVEN user 10 has no access to project 1
- WHEN calling update-user-share with userId: 10
- THEN error SHOULD be returned indicating share not found

---

### Requirement: remove-user-share

The system MUST provide a subcommand to revoke a user's access to a project.

The tool MUST accept `projectId` and `userId` as required parameters.

The operation MUST return success confirmation even if the user had read-only access.

#### Scenario: Remove user share completely

- GIVEN user 5 has write access to project 1
- WHEN calling vikunja_projects_user_sharing with subcommand: "remove-user-share", projectId: 1, userId: 5
- THEN user 5 SHOULD no longer have any access to the project
- AND response SHOULD confirm removal

#### Scenario: Remove share that does not exist

- GIVEN user 10 has no access to project 1
- WHEN calling remove-user-share with userId: 10
- THEN error SHOULD be returned with NOT_FOUND code

---

### Requirement: Input Validation

The system MUST validate all required parameters before making API calls.

- GIVEN missing required projectId
- WHEN calling any subcommand
- THEN validation error SHOULD be returned

- GIVEN userId is not a positive integer
- WHEN calling with invalid userId
- THEN validation error SHOULD be returned

- GIVEN right value is not valid (not read/write/admin or 0/1/2)
- WHEN calling share-user or update-user-share
- THEN validation error SHOULD be returned

---

### Requirement: Error Handling

The system MUST handle API errors gracefully with appropriate error codes.

- GIVEN project does not exist (404 from API)
- THEN MCPError with NOT_FOUND code SHOULD be returned

- GIVEN user does not exist (404 from API)
- THEN MCPError with NOT_FOUND code SHOULD be returned

- GIVEN user lacks permission to share project (403 from API)
- THEN MCPError with PERMISSION_DENIED code SHOULD be returned

- GIVEN API returns unexpected error
- THEN MCPError with API_ERROR code SHOULD be returned

---

### Requirement: Authentication

The system MUST require authentication to perform user sharing operations.

- GIVEN user is not authenticated
- WHEN calling any subcommand
- THEN error SHOULD be returned indicating authentication is required

---

## API Mapping

| Subcommand        | HTTP Method | Vikunja API Endpoint               |
| ----------------- | ----------- | ---------------------------------- |
| share-user        | PUT         | /projects/:projectId/users/:userId |
| list-user-shares  | GET         | /projects/:projectId/users         |
| get-user-share    | GET         | /projects/:projectId/users/:userId |
| update-user-share | PUT         | /projects/:projectId/users/:userId |
| remove-user-share | DELETE      | /projects/:projectId/users/:userId |

---

## Permission Levels

| String Value | Numeric Value | Description                                |
| ------------ | ------------- | ------------------------------------------ |
| read         | 0             | User can view project and tasks            |
| write        | 1             | User can view and create/modify tasks      |
| admin        | 2             | Full access including sharing and deleting |

---

## Response Format

All responses SHOULD use the standard AORP (Action, Object, Result, Parameters) format with appropriate messaging.

Example success response:

```
## Action: share-user

## Result: Success

Project shared with user successfully.

## Parameters
- projectId: 1
- userId: 5
- right: admin (2)
```

---

## Notes

- This specification mirrors the existing team-sharing implementation pattern (src/tools/projects/team-sharing.ts)
- User shares are distinct from link shares (public/shared links)
- The tool name will be `vikunja_projects_user_sharing` with subcommands
- Implementation should reuse existing validation, error handling, and response formatting utilities
