/**
 * Task Assignees Tool
 * Handles task assignment operations: assign, unassign, list-assignees
 * Replaces monolithic tasks tool with focused individual tool
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthManager } from '../auth/AuthManager';
import type { VikunjaClientFactory } from '../client/VikunjaClientFactory';

/**
 * Register task assignees tool
 */
export function registerTaskAssigneesTool(
  _server: McpServer,
  _authManager: AuthManager,
  _clientFactory?: VikunjaClientFactory,
): void {
  // Registration removed to consolidate tools
}
