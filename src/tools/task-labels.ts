import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthManager } from '../auth/AuthManager';
import type { VikunjaClientFactory } from '../client/VikunjaClientFactory';

/**
 * Register task labels tool
 */
export function registerTaskLabelsTool(
  _server: McpServer,
  _authManager: AuthManager,
  _clientFactory?: VikunjaClientFactory,
): void {
  // Registration removed to consolidate tools
}
