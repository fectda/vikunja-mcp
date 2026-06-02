/**
 * Individual Task CRUD Tool
 * Handles basic task operations: create, get, update, delete, list
 * Replaces monolithic tasks tool with focused individual tool
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthManager } from '../auth/AuthManager';
import type { VikunjaClientFactory } from '../client/VikunjaClientFactory';

/**
 * Register individual task CRUD tool
 */
export function registerTaskCrudTool(
  _server: McpServer,
  _authManager: AuthManager,
  _clientFactory?: VikunjaClientFactory,
): void {
  // Registration removed to consolidate tools. Handler functions are available in vikunja_tasks.
}
