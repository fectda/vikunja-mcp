/**
 * Authentication Manager
 * Handles session management and token refresh for the MCP server
 * Supports multiple simultaneous sessions keyed by sessionId (default: 'default')
 */

import type { AuthSession } from '../types';
import { MCPError, ErrorCode } from '../types';
import { logger } from '../utils/logger';

export class AuthManager {
  private sessions: Map<string, AuthSession> = new Map();

  /**
   * Resolve sessionId, defaulting to 'default'
   */
  private resolveSessionId(sessionId?: string): string {
    return sessionId || 'default';
  }

  /**
   * Detect authentication type based on token format
   */
  static detectAuthType(token: string): 'api-token' | 'jwt' {
    // API tokens start with tk_
    if (token.startsWith('tk_')) {
      return 'api-token';
    }

    // JWTs have 3 parts separated by dots and start with eyJ (base64 for {"alg":)
    if (token.startsWith('eyJ') && token.split('.').length === 3) {
      return 'jwt';
    }

    // Default to API token for backward compatibility
    return 'api-token';
  }

  /**
   * Initialize a new auth session
   */
  connect(apiUrl: string, apiToken: string, sessionId?: string): void {
    const resolvedId = this.resolveSessionId(sessionId);
    // Auto-detect auth type
    const detectedAuthType = AuthManager.detectAuthType(apiToken);
    logger.debug(
      'AuthManager.connect - Creating session %s with authType: %s',
      resolvedId,
      detectedAuthType,
    );
    this.sessions.set(resolvedId, {
      apiUrl,
      apiToken,
      authType: detectedAuthType,
      // tokenExpiry and userId are optional
    });
    logger.debug('AuthManager.connect - Session %s created successfully', resolvedId);
  }

  /**
   * Get current session
   * @throws MCPError if not authenticated
   */
  getSession(sessionId?: string): AuthSession {
    const resolvedId = this.resolveSessionId(sessionId);
    const session = this.sessions.get(resolvedId);
    if (!session) {
      throw new MCPError(
        ErrorCode.AUTH_REQUIRED,
        'Authentication required. Please use vikunja_auth.connect first.',
      );
    }
    return session;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(sessionId?: string): boolean {
    return this.sessions.has(this.resolveSessionId(sessionId));
  }

  /**
   * Clear session
   */
  disconnect(sessionId?: string): void {
    this.sessions.delete(this.resolveSessionId(sessionId));
  }

  /**
   * Get auth status
   */
  getStatus(sessionId?: string): {
    authenticated: boolean;
    apiUrl?: string;
    userId?: string;
    authType?: 'api-token' | 'jwt';
  } {
    const resolvedId = this.resolveSessionId(sessionId);
    const session = this.sessions.get(resolvedId);
    if (!session) {
      return { authenticated: false };
    }
    const status: {
      authenticated: boolean;
      apiUrl?: string;
      userId?: string;
      authType?: 'api-token' | 'jwt';
    } = {
      authenticated: true,
      apiUrl: session.apiUrl,
      authType: session.authType,
    };
    if (session.userId !== undefined) {
      status.userId = session.userId;
    }
    return status;
  }

  /**
   * Get authentication type
   * @throws MCPError if not authenticated
   */
  getAuthType(sessionId?: string): 'api-token' | 'jwt' {
    const resolvedId = this.resolveSessionId(sessionId);
    const session = this.sessions.get(resolvedId);
    if (!session) {
      throw new MCPError(
        ErrorCode.AUTH_REQUIRED,
        'Authentication required. Please use vikunja_auth.connect first.',
      );
    }
    return session.authType;
  }

  /**
   * Save session with auth type
   */
  saveSession(session: AuthSession, sessionId?: string): void {
    this.sessions.set(this.resolveSessionId(sessionId), session);
  }

  // ==========================================
  // TEST-ONLY METHODS - Protected by environment checks
  // These methods are only available in test environments
  // ==========================================

  /**
   * Test-only method to set user ID
   * @throws Error if used in production
   */
  setTestUserId(userId: string, sessionId?: string): void {
    this.validateTestEnvironment();
    const resolvedId = this.resolveSessionId(sessionId);
    const session = this.sessions.get(resolvedId);
    if (!session) {
      throw new MCPError(
        ErrorCode.AUTH_REQUIRED,
        'Authentication required. Please use vikunja_auth.connect first.',
      );
    }
    session.userId = userId;
  }

  /**
   * Test-only method to set token expiry
   * @throws Error if used in production
   */
  setTestTokenExpiry(expiry: Date, sessionId?: string): void {
    this.validateTestEnvironment();
    const resolvedId = this.resolveSessionId(sessionId);
    const session = this.sessions.get(resolvedId);
    if (!session) {
      throw new MCPError(
        ErrorCode.AUTH_REQUIRED,
        'Authentication required. Please use vikunja_auth.connect first.',
      );
    }
    session.tokenExpiry = expiry;
  }

  /**
   * Validate test environment - prevents test methods from being used in production
   * @throws Error if not in test environment
   */
  private validateTestEnvironment(): void {
    const nodeEnv = process.env.NODE_ENV;
    const jestRunning = process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test';

    if (!jestRunning && nodeEnv !== 'test' && nodeEnv !== 'development') {
      throw new Error(
        'AuthManager test methods can only be used in test environments. ' +
          'This is a security measure to prevent testing methods from being accessible in production.',
      );
    }
  }
}
