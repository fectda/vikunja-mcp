/**
 * Tool Registration
 * Registers all Vikunja tools with the MCP server
 *
 * Registration Strategy:
 * - Core tools (auth, tasks): Always registered
 * - Client-dependent tools: Only registered when clientFactory is available
 *
 * Auth decisions happen per-method at runtime, not at registration time.
 * This avoids a race condition where auth is established AFTER tool registration
 * (autoLoginWithCredentials runs async in parallel). Each tool handler validates
 * auth and returns proper errors if the token type doesn't support the operation.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthManager } from '../auth/AuthManager';
import type { VikunjaClientFactory } from '../client/VikunjaClientFactory';

import { registerAuthTool } from './auth';
import { registerTasksTool } from './tasks';
import { registerProjectsTool } from './projects/index';
import { registerLabelsTool } from './labels';
import { registerTeamsTool } from './teams';
import { registerUsersTool } from './users';
import { registerFiltersTool } from './filters';
import { registerTemplatesTool } from './templates';
import { registerWebhooksTool } from './webhooks';
import { registerBatchImportTool } from './batch-import';
import { registerExportTool } from './export';

// Re-export for testing
export {
  registerAuthTool,
  registerTasksTool,
  registerProjectsTool,
  registerLabelsTool,
  registerTeamsTool,
  registerUsersTool,
  registerFiltersTool,
  registerTemplatesTool,
  registerWebhooksTool,
  registerBatchImportTool,
  registerExportTool,
};

export function registerTools(
  server: McpServer,
  authManager: AuthManager,
  clientFactory?: VikunjaClientFactory,
): void {
  // Register tools with conditional availability based on dependencies and authentication

  registerAuthTool(server, authManager);

  // Register the comprehensive tasks tool (expected by tests)
  registerTasksTool(server, authManager, clientFactory);

  // Only register tools that require clientFactory if it's available
  if (clientFactory) {
    registerProjectsTool(server, authManager, clientFactory);
    registerLabelsTool(server, authManager, clientFactory);
    registerTeamsTool(server, authManager, clientFactory);

    // Register filters tool (needs auth manager for session-scoped storage)
    registerFiltersTool(server, authManager, clientFactory);

    // Register templates tool
    registerTemplatesTool(server, authManager, clientFactory);

    // Register webhooks tool
    registerWebhooksTool(server, authManager, clientFactory);

    // Register batch import tool
    registerBatchImportTool(server, authManager, clientFactory);

    // Register all tools unconditionally — auth is decided per-method at runtime.
    // Conditional registration based on auth type at startup is unreliable because
    // auth is established AFTER tool registration (async race). Each tool handler
    // checks auth at runtime and returns proper auth errors.
    registerUsersTool(server, authManager, clientFactory);
    registerExportTool(server, authManager, clientFactory);
  }
}
