/**
 * Constants for task operations
 */

// Error message constants
export const AUTH_ERROR_MESSAGES = {
  ASSIGNEE_CREATE:
    'Assignee operation failed. The user may not have access to the project. ' +
    'Share the project with the user first before assigning them to tasks.',
  ASSIGNEE_UPDATE:
    'Assignee update operation failed. The user may not have access to the project. ' +
    'Share the project with the user first before assigning them to tasks.',
  ASSIGNEE_ASSIGN:
    'Assignee operation failed. The user may not have access to the project. ' +
    'Share the project with the user first before assigning them to tasks.',
  ASSIGNEE_REMOVE: 'Assignee removal operation failed.',
  ASSIGNEE_REMOVE_PARTIAL:
    'Assignee removal operation partially failed. New assignees were added but old assignees could not be removed.',
  ASSIGNEE_BULK_UPDATE: 'Assignee bulk update operation failed.',
  LABEL_CREATE: 'Label operation failed.',
  LABEL_UPDATE: 'Label update operation failed.',
};

// API Token specific error messages (when JWT is required but API token is used)
export const API_TOKEN_ERROR_MESSAGES = {
  ASSIGNEE_OPERATION:
    'Assignment failed: API tokens (tk_*) do not support assignee operations in Vikunja.\n\n' +
    'This is a known limitation - Vikunja requires JWT authentication for:\n' +
    '- Assigning users to tasks\n' +
    '- Removing users from tasks\n' +
    '- Applying labels to tasks\n' +
    '- User management endpoints\n\n' +
    'Solutions (choose one):\n' +
    '1. Enable auto-login JWT: Set VIKUNJA_USER and VIKUNJA_PASSWORD in .env\n' +
    '2. Use JWT token directly: Connect with a JWT token starting with "eyJ"\n' +
    '3. Login via MCP: Use vikunja_auth.login({ apiUrl, username, password })',
  LABEL_OPERATION:
    'Label operation failed: API tokens (tk_*) do not support label operations in Vikunja.\n\n' +
    'This is a known limitation - Vikunja requires JWT authentication for:\n' +
    '- Applying labels to tasks\n' +
    '- Removing labels from tasks\n\n' +
    'Solutions (choose one):\n' +
    '1. Enable auto-login JWT: Set VIKUNJA_USER and VIKUNJA_PASSWORD in .env\n' +
    '2. Use JWT token directly: Connect with a JWT token starting with "eyJ"\n' +
    '3. Login via MCP: Use vikunja_auth.login({ apiUrl, username, password })',
  USER_OPERATION:
    'User operation failed: API tokens (tk_*) do not support user endpoints in Vikunja.\n\n' +
    'This is a known limitation - Vikunja requires JWT authentication for:\n' +
    '- Getting current user\n' +
    '- Searching users\n' +
    '- User settings\n\n' +
    'Solutions (choose one):\n' +
    '1. Enable auto-login JWT: Set VIKUNJA_USER and VIKUNJA_PASSWORD in .env\n' +
    '2. Use JWT token directly: Connect with a JWT token starting with "eyJ"\n' +
    '3. Login via MCP: Use vikunja_auth.login({ apiUrl, username, password })',
};

// Bulk operation constants
export const BULK_OPERATION_BATCH_SIZE = 10;
export const MAX_BULK_OPERATION_TASKS = 100;

// Repeat mode mapping for bulk update API
// Maps user-friendly string values to Vikunja API numeric codes
export const REPEAT_MODE_MAP: Record<string, number> = {
  default: 0,
  month: 1,
  from_current: 2,
} as const;
