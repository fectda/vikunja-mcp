/**
 * Tests for cleanupClientFromContext — per-session client cleanup
 *
 * Verifies that cleanupClientFromContext properly delegates to
 * VikunjaClientFactory.cleanup(sessionId) and that only the target
 * session's cached client is removed (cross-contamination protection).
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { VikunjaClientFactory } from '../../src/client/VikunjaClientFactory';
import {
  cleanupClientFromContext,
  setGlobalClientFactory,
  ClientContext,
  clearGlobalClientFactory,
  getClientFromContext,
} from '../../src/client';
import type { AuthManager } from '../../src/auth/AuthManager';
import type { VikunjaClientConstructor } from '../../src/types/node-vikunja-extended';

describe('cleanupClientFromContext', () => {
  let mockAuthManager: jest.Mocked<AuthManager>;
  let mockVikunjaClientConstructor: jest.MockedFunction<VikunjaClientConstructor>;
  let factory: VikunjaClientFactory;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset ClientContext singleton for clean state
    (ClientContext as any).instance = null;

    mockAuthManager = {
      getSession: jest.fn().mockReturnValue({
        apiUrl: 'https://test.vikunja.com',
        apiToken: 'test-token',
      }),
      connect: jest.fn(),
      isAuthenticated: jest.fn().mockReturnValue(true),
      disconnect: jest.fn(),
      getAuthType: jest.fn().mockReturnValue('api-token'),
      getStatus: jest.fn().mockReturnValue({ authenticated: true }),
      saveSession: jest.fn(),
    } as any;

    mockVikunjaClientConstructor = jest.fn().mockImplementation(() => ({
      tasks: {},
      projects: {},
      users: {},
      labels: {},
      teams: {},
    }));

    factory = new VikunjaClientFactory(mockAuthManager, mockVikunjaClientConstructor);
  });

  afterEach(() => {
    (ClientContext as any).instance = null;
  });

  // ==========================================================================
  // Phase 1: Delegation tests — cleanupClientFromContext calls factory.cleanup
  // ==========================================================================

  describe('delegation to factory.cleanup', () => {
    it('should call factory.cleanup with the specified sessionId', async () => {
      await setGlobalClientFactory(factory);
      const cleanupSpy = jest.spyOn(factory, 'cleanup');

      await cleanupClientFromContext('session-a');

      expect(cleanupSpy).toHaveBeenCalledWith('session-a');
      cleanupSpy.mockRestore();
    });

    it('should call factory.cleanup with undefined when no sessionId provided', async () => {
      await setGlobalClientFactory(factory);
      const cleanupSpy = jest.spyOn(factory, 'cleanup');

      await cleanupClientFromContext();

      expect(cleanupSpy).toHaveBeenCalledWith(undefined);
      cleanupSpy.mockRestore();
    });

    it('should not throw when factory is not set (graceful no-op)', async () => {
      // No factory set — context.clientFactory is null
      await expect(cleanupClientFromContext('session-a')).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // Phase 2: Cross-contamination tests — only target session removed
  // ==========================================================================

  describe('cross-contamination protection', () => {
    it('should remove only the specified session from cache, preserving others', async () => {
      const session = {
        apiUrl: 'https://test.vikunja.com',
        apiToken: 'test-token',
      };
      mockAuthManager.getSession.mockReturnValue(session);

      await setGlobalClientFactory(factory);

      // Create cached clients for two sessions
      const clientA = factory.getClient('alice');
      const clientB = factory.getClient('bob');

      // Verify both are cached (same reference on second call)
      expect(factory.getClient('alice')).toBe(clientA);
      expect(factory.getClient('bob')).toBe(clientB);

      // Cleanup only Alice
      await cleanupClientFromContext('alice');

      // Bob's client should STILL be cached (same reference)
      const clientBAfter = factory.getClient('bob');
      expect(clientBAfter).toBe(clientB);

      // Alice's client should be a NEW instance (cache entry was removed)
      const clientAAfter = factory.getClient('alice');
      expect(clientAAfter).not.toBe(clientA);
    });

    it('should preserve global state: other sessions unaffected after cleanup', async () => {
      const session = {
        apiUrl: 'https://test.vikunja.com',
        apiToken: 'test-token',
      };
      mockAuthManager.getSession.mockReturnValue(session);

      await setGlobalClientFactory(factory);

      // Seed clients for multiple sessions
      const clientDefault = factory.getClient();
      const clientX = factory.getClient('session-x');
      const clientY = factory.getClient('session-y');

      // Cleanup one specific session
      await cleanupClientFromContext('session-x');

      // Default session still works
      expect(factory.getClient()).toBe(clientDefault);

      // Session Y still works
      expect(factory.getClient('session-y')).toBe(clientY);

      // Session X was recreated
      expect(factory.getClient('session-x')).not.toBe(clientX);
    });

    it('should not throw when cleaning up a non-existent session', async () => {
      const session = {
        apiUrl: 'https://test.vikunja.com',
        apiToken: 'test-token',
      };
      mockAuthManager.getSession.mockReturnValue(session);

      await setGlobalClientFactory(factory);

      // Create client for one session
      factory.getClient('alice');

      // Cleanup a session that was never created
      await expect(cleanupClientFromContext('nonexistent')).resolves.not.toThrow();

      // Alice's client should still work
      expect(factory.getClient('alice')).toBeDefined();
    });
  });

  // ==========================================================================
  // Phase 2: Auth-handler-style cross-contamination scenarios
  //   Simulates what auth handlers do: cleanupClientFromContext(sessionId)
  // ==========================================================================

  describe('auth-handler cross-contamination scenarios', () => {
    it('should simulate "refresh" isolation: refresh for session A does not affect B', async () => {
      const session = {
        apiUrl: 'https://test.vikunja.com',
        apiToken: 'test-token',
      };
      mockAuthManager.getSession.mockReturnValue(session);

      await setGlobalClientFactory(factory);

      // Seed clients for two sessions
      const clientB = factory.getClient('session-b');
      factory.getClient('session-a'); // Establish session A

      // Simulate what refresh handler does: cleanup the calling session
      await cleanupClientFromContext('session-a');

      // Session B's cached client must survive
      expect(factory.getClient('session-b')).toBe(clientB);
    });

    it('should simulate "disconnect" isolation: disconnect for session A does not affect B', async () => {
      const session = {
        apiUrl: 'https://test.vikunja.com',
        apiToken: 'test-token',
      };
      mockAuthManager.getSession.mockReturnValue(session);

      await setGlobalClientFactory(factory);

      // Seed clients
      const clientB = factory.getClient('session-b');
      factory.getClient('session-a');

      // Simulate what disconnect handler does: cleanup the calling session
      await cleanupClientFromContext('session-a');

      // Session B's cached client must survive
      expect(factory.getClient('session-b')).toBe(clientB);
    });

    it('should simulate "login" isolation: login for session A does not affect B', async () => {
      const session = {
        apiUrl: 'https://test.vikunja.com',
        apiToken: 'test-token',
      };
      mockAuthManager.getSession.mockReturnValue(session);

      await setGlobalClientFactory(factory);

      // Seed clients
      const clientB = factory.getClient('session-b');
      factory.getClient('session-a');

      // Simulate what login handler does:
      // authManager.disconnect(sessionId) followed by cleanupClientFromContext(sessionId)
      await cleanupClientFromContext('session-a');

      // Session B's cached client must survive
      expect(factory.getClient('session-b')).toBe(clientB);
    });
  });
});
