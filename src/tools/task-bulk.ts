/**
 * Task Bulk Operations Tool
 * Handles bulk task operations: bulk-create, bulk-update, bulk-delete
 * Replaces monolithic tasks tool with focused individual tool
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthManager } from '../auth/AuthManager';
import type { VikunjaClientFactory } from '../client/VikunjaClientFactory';

/**
 * Register task bulk operations tool
 */
export function registerTaskBulkTool(
  _server: McpServer,
  _authManager: AuthManager,
  _clientFactory?: VikunjaClientFactory,
): void {
  // Registration removed to consolidate tools
}
