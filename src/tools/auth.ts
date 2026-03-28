/**
 * Authentication Tool
 * Handles authentication operations for Vikunja
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AuthManager } from '../auth/AuthManager';
import type { VikunjaClientFactory } from '../client/VikunjaClientFactory';
import { MCPError, ErrorCode } from '../types/errors';
import {
  clearGlobalClientFactory,
  getClientFromContext,
  createVikunjaClientFactory,
  setGlobalClientFactory,
} from '../client';
import { logger } from '../utils/logger';
import { applyRateLimiting } from '../middleware/direct-middleware';
import { createSecureConnectionMessage } from '../utils/security';
import { wrapAuthError } from '../utils/error-handler';
import { createStandardResponse } from '../utils/response-factory';
import { formatMcpResponse } from '../utils/simple-response';

interface AuthArgs {
  subcommand: 'connect' | 'status' | 'refresh' | 'disconnect' | 'login';
  apiUrl?: string | undefined;
  apiToken?: string | undefined;
  username?: string | undefined;
  password?: string | undefined;
}

export function registerAuthTool(
  server: McpServer,
  authManager: AuthManager,
  _clientFactory?: VikunjaClientFactory,
): void {
  server.tool(
    'vikunja_auth',
    'Manage authentication with Vikunja API (connect, status, refresh, disconnect, login)',
    {
      subcommand: z.enum(['connect', 'status', 'refresh', 'disconnect', 'login']),
      apiUrl: z.string().url().optional(),
      apiToken: z.string().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
    },
    applyRateLimiting('vikunja_auth', async (args: AuthArgs) => {
      try {
        switch (args.subcommand) {
          case 'connect': {
            if (!args.apiUrl || !args.apiToken) {
              throw new MCPError(
                ErrorCode.VALIDATION_ERROR,
                'apiUrl and apiToken are required for connect',
              );
            }

            const secureMessage = createSecureConnectionMessage(args.apiUrl, args.apiToken);
            logger.debug('Auth connect attempt: %s', secureMessage);

            // Check if already authenticated
            const currentStatus = authManager.getStatus();
            if (currentStatus.authenticated && currentStatus.apiUrl === args.apiUrl) {
              const response = createStandardResponse(
                'auth-connect',
                'Already connected to Vikunja',
                { authenticated: true },
                { apiUrl: args.apiUrl },
              );
              return {
                content: formatMcpResponse(response),
              };
            }

            // Auto-detect auth type will be handled by AuthManager
            logger.info('Attempting to connect to Vikunja');
            authManager.connect(args.apiUrl, args.apiToken);
            const detectedAuthType = authManager.getAuthType();
            logger.info('Successfully connected to Vikunja - authType: %s', detectedAuthType);

            const response = createStandardResponse(
              'auth-connect',
              'Successfully connected to Vikunja',
              { authenticated: true },
              { apiUrl: args.apiUrl, authType: authManager.getAuthType() },
            );
            return {
              content: formatMcpResponse(response),
            };
          }

          case 'status': {
            const status = authManager.getStatus();
            const response = createStandardResponse(
              'auth-status',
              status.authenticated ? 'Authentication status retrieved' : 'Not authenticated',
              status,
              status.authenticated ? { apiUrl: status.apiUrl } : undefined,
            );
            return {
              content: formatMcpResponse(response),
            };
          }

          case 'refresh': {
            // JWT tokens expire (~24h), so we need to refresh them
            const status = authManager.getStatus();
            if (!status.authenticated) {
              throw new MCPError(ErrorCode.AUTH_REQUIRED, 'Not authenticated. Connect first.');
            }

            if (status.authType !== 'jwt') {
              throw new MCPError(
                ErrorCode.PERMISSION_DENIED,
                'Token refresh is only supported for JWT tokens. API tokens cannot be refreshed. ' +
                  'Reconnect with a new token or use login with username/password to obtain a JWT.',
              );
            }

            try {
              const client = await getClientFromContext();
              const newTokenInfo = await client.auth.renewToken();

              if (!newTokenInfo.token || !status.apiUrl) {
                throw new MCPError(ErrorCode.API_ERROR, 'Token refresh returned no token');
              }

              // Update auth manager with new token
              authManager.connect(status.apiUrl, newTokenInfo.token);

              // Reinitialize client factory with new token
              await clearGlobalClientFactory();
              const newFactory = await createVikunjaClientFactory(authManager);
              await setGlobalClientFactory(newFactory);

              logger.info('Token refreshed successfully');

              const response = createStandardResponse(
                'auth-refresh',
                'Token refreshed successfully',
                { refreshed: true, authType: 'jwt' },
                { newTokenPrefix: newTokenInfo.token.substring(0, 10) + '...' },
              );
              return {
                content: formatMcpResponse(response),
              };
            } catch (error) {
              logger.error(
                'Token refresh failed: %s',
                error instanceof Error ? error.message : String(error),
              );
              throw new MCPError(
                ErrorCode.API_ERROR,
                'Token refresh failed. Please reconnect manually with your credentials or JWT token.',
              );
            }
          }

          case 'disconnect': {
            authManager.disconnect();
            await clearGlobalClientFactory();
            const response = createStandardResponse(
              'auth-disconnect',
              'Successfully disconnected from Vikunja',
              { authenticated: false },
              { previouslyConnected: true },
            );
            return {
              content: formatMcpResponse(response),
            };
          }

          case 'login': {
            // Login with username/password to obtain JWT
            if (!args.apiUrl || !args.username || !args.password) {
              throw new MCPError(
                ErrorCode.VALIDATION_ERROR,
                'apiUrl, username, and password are required for login',
              );
            }

            const loginUrl = args.apiUrl.replace('/api/v1', '') + '/api/v1/login';
            logger.info('Attempting login for user: %s', args.username);

            try {
              const loginResponse = await fetch(loginUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: args.username, password: args.password }),
              });

              const data = (await loginResponse.json()) as { token?: string; message?: string };

              if (!data.token) {
                throw new MCPError(
                  ErrorCode.AUTH_REQUIRED,
                  `Login failed: ${data.message || 'No token received'}`,
                );
              }

              // Disconnect existing session if any
              authManager.disconnect();
              await clearGlobalClientFactory();

              // Connect with new JWT
              authManager.connect(args.apiUrl, data.token);

              // Reinitialize client factory with new token
              const newFactory = await createVikunjaClientFactory(authManager);
              await setGlobalClientFactory(newFactory);

              logger.info('✅ Login successful - JWT obtained');

              const loginResult = createStandardResponse(
                'auth-login',
                'Successfully logged in with JWT',
                { authenticated: true, authType: 'jwt' },
                { username: args.username },
              );
              return {
                content: formatMcpResponse(loginResult),
              };
            } catch (error) {
              if (error instanceof MCPError) {
                throw error;
              }
              logger.error(
                'Login failed: %s',
                error instanceof Error ? error.message : String(error),
              );
              throw new MCPError(
                ErrorCode.AUTH_REQUIRED,
                `Login failed: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }

          default:
            throw new MCPError(
              ErrorCode.VALIDATION_ERROR,
              `Unknown subcommand: ${args.subcommand as string}`,
            );
        }
      } catch (error) {
        throw wrapAuthError(error, args.subcommand);
      }
    }),
  );
}
