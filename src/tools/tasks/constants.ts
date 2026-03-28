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
