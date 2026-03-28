#!/usr/bin/env node

/**
 * Vikunja MCP Server
 * Main entry point for the Model Context Protocol server
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import dotenv from 'dotenv';

import { AuthManager } from './auth/AuthManager';
import { registerTools } from './tools';
import { logger } from './utils/logger';
import { createSecureConnectionMessage, createSecureLogConfig } from './utils/security';
import {
  createVikunjaClientFactory,
  setGlobalClientFactory,
  type VikunjaClientFactory,
} from './client';

dotenv.config({ quiet: true });

// Auto-login: if VIKUNJA_USER and VIKUNJA_PASSWORD are provided, obtain JWT automatically
// JWT always takes priority over API tokens because API tokens have limited permissions
// in Vikunja (assignees, labels, and user endpoints require JWT).
async function autoLoginWithCredentials(): Promise<string | null> {
  const vikunjaUrl = process.env.VIKUNJA_URL;
  if (process.env.VIKUNJA_USER && process.env.VIKUNJA_PASSWORD && vikunjaUrl) {
    const loginUrl = vikunjaUrl.replace('/api/v1', '') + '/api/v1/login';
    logger.info('Attempting auto-login with credentials for user: %s', process.env.VIKUNJA_USER);

    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: process.env.VIKUNJA_USER,
          password: process.env.VIKUNJA_PASSWORD,
        }),
      });

      const data = (await response.json()) as { token?: string; message?: string };

      if (data.token) {
        process.env.VIKUNJA_API_TOKEN = data.token;
        logger.info('✅ Auto-login JWT successful — full API access available');
        return data.token;
      } else {
        logger.warn('⚠️ Auto-login failed: %s', data.message || 'No token received');
        if (process.env.VIKUNJA_API_TOKEN) {
          logger.warn('📋 Falling back to API token — assignees/labels may not work');
        }
      }
    } catch (error) {
      logger.error('Auto-login error: %s', error instanceof Error ? error.message : String(error));
      if (process.env.VIKUNJA_API_TOKEN) {
        logger.warn('📋 Falling back to API token — assignees/labels may not work');
      }
    }
  }
  return null;
}

const server = new McpServer({
  name: 'vikunja-mcp',
  version: '0.2.0',
});

const authManager = new AuthManager();

let clientFactory: VikunjaClientFactory | null = null;

async function initializeFactory(): Promise<void> {
  try {
    clientFactory = await createVikunjaClientFactory(authManager);
    if (clientFactory) {
      await setGlobalClientFactory(clientFactory);
    }
  } catch (error) {
    logger.warn('Failed to initialize client factory during startup:', error);
    // Factory will be initialized on first authentication
  }
}

// Initialize factory during module load for both production and test environments
// This ensures the factory is available for tests
export const factoryInitializationPromise = initializeFactory()
  .then(() => {
    try {
      if (clientFactory) {
        registerTools(server, authManager, clientFactory);
      } else {
        registerTools(server, authManager, undefined);
      }
    } catch (error) {
      logger.error('Failed to initialize:', error);
      // Fall back to legacy registration for backwards compatibility
      registerTools(server, authManager, undefined);
    }
  })
  .catch((error) => {
    logger.warn('Failed to initialize client factory during module load:', error);
    registerTools(server, authManager, undefined);
  });

// Run auto-login first if credentials are provided, then auto-authenticate
// JWT always takes priority when both credentials and API token exist
void autoLoginWithCredentials().then((jwtToken) => {
  if (!process.env.VIKUNJA_URL) {
    logger.warn('VIKUNJA_URL not set — skipping auto-authentication');
    return;
  }

  // Prefer JWT from auto-login, fall back to API token
  const token = jwtToken || process.env.VIKUNJA_API_TOKEN;
  if (!token) {
    logger.warn('No authentication token available — connect manually with vikunja_auth');
    return;
  }

  const authType = jwtToken ? '(from auto-login)' : '(direct token)';
  const tokenPrefix = token.substring(0, 10) + '...';
  const connectionMessage = createSecureConnectionMessage(process.env.VIKUNJA_URL, token);
  logger.info('Auto-authenticating %s: %s', authType, connectionMessage);
  authManager.connect(process.env.VIKUNJA_URL, token);

  const detectedAuthType = authManager.getAuthType();
  logger.info(
    'Auth type: %s | Source: %s | Token prefix: %s',
    detectedAuthType,
    authType,
    tokenPrefix,
  );

  if (detectedAuthType === 'api-token') {
    logger.warn(
      '⚠️ Using API token — assignee/label operations and user endpoints may not work. ' +
        'Provide VIKUNJA_USER + VIKUNJA_PASSWORD for full JWT access.',
    );
  }
});

async function main(): Promise<void> {
  await factoryInitializationPromise;

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Vikunja MCP server started');

  const config = createSecureLogConfig({
    mode: process.env.MCP_MODE,
    debug: process.env.DEBUG,
    hasAuth: !!process.env.VIKUNJA_URL && !!process.env.VIKUNJA_API_TOKEN,
    url: process.env.VIKUNJA_URL,
    token: process.env.VIKUNJA_API_TOKEN,
  });

  logger.debug('Configuration loaded', config);
}

// Only start the server if not in test environment
if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
  main().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

// Essential exports only - eliminated 80+ lines of unnecessary barrel exports
// Use direct imports instead of centralized re-exports for better tree-shaking

// Core types that are commonly imported by external code
export { MCPError, ErrorCode } from './types/errors';
export type { TaskResponseData, FilterExpression, Task } from './types';
export type { ParseResult } from './types/filters';
export type { AorpBuilderConfig, AorpFactoryResult } from './types';

// Core utilities that are widely used across the codebase
export { logger } from './utils/logger';
export { isAuthenticationError } from './utils/auth-error-handler';
export { withRetry, RETRY_CONFIG } from './utils/retry';
export { transformApiError, handleFetchError, handleStatusCodeError } from './utils/error-handler';
export { parseFilterString } from './utils/filters';
export { validateTaskCountLimit } from './utils/memory';
export {
  createStandardResponse,
  createAorpErrorResponse as createErrorResponse,
} from './utils/response-factory';

// Additional exports for task modules
export type { SimpleResponse } from './utils/simple-response';

// Client utilities for external usage
export { getClientFromContext, clearGlobalClientFactory } from './client';
