/**
 * Vikunja Client Factory Exports
 */

import type { VikunjaClient } from 'node-vikunja';
import type { AuthManager } from './auth/AuthManager';
import type { VikunjaModule } from './types/node-vikunja-extended';
import { isVikunjaClientConstructor } from './types/node-vikunja-extended';
import { VikunjaClientFactory } from './client/VikunjaClientFactory';
import { Mutex } from 'async-mutex';
import { createAuthRequiredError, createInternalError } from './utils/error-handler';

export { VikunjaClientFactory } from './client/VikunjaClientFactory';

/**
 * Client context for dependency injection with thread safety
 *
 * NOTE: Only async getInstanceAsync() method is available to prevent race conditions.
 */
class ClientContext {
  private static instance: ClientContext | null = null;
  private static instanceMutex = new Mutex();
  private clientFactory: VikunjaClientFactory | null = null;
  private factoryMutex = new Mutex();

  private constructor() {}

  /**
   * Thread-safe async getInstance for new code
   */
  static async getInstanceAsync(): Promise<ClientContext> {
    const release = await ClientContext.instanceMutex.acquire();
    try {
      if (!ClientContext.instance) {
        ClientContext.instance = new ClientContext();
      }
      return ClientContext.instance;
    } finally {
      release();
    }
  }

  /**
   * Set the client factory for dependency injection (thread-safe)
   */
  async setClientFactory(factory: VikunjaClientFactory): Promise<void> {
    const release = await this.factoryMutex.acquire();
    try {
      this.clientFactory = factory;
    } finally {
      release();
    }
  }

  /**
   * Clear the client factory (for testing, thread-safe)
   */
  async clearClientFactory(): Promise<void> {
    const release = await this.factoryMutex.acquire();
    try {
      this.clientFactory = null;
    } finally {
      release();
    }
  }

  /**
   * Get a client instance using the factory (thread-safe)
   */
  async getClient(sessionId?: string): Promise<VikunjaClient> {
    const release = await this.factoryMutex.acquire();
    try {
      if (this.clientFactory) {
        return this.clientFactory.getClient(sessionId);
      }
      throw createAuthRequiredError('get Vikunja client');
    } finally {
      release();
    }
  }

  /**
   * Check if factory is available (thread-safe)
   */
  async hasFactory(): Promise<boolean> {
    const release = await this.factoryMutex.acquire();
    try {
      return this.clientFactory !== null;
    } finally {
      release();
    }
  }

  /**
   * Cleanup cached client for a specific session (thread-safe)
   * Delegates to factory.cleanup(sessionId) which removes only the
   * specified session's cached client from the factory map.
   * Other sessions' cached clients are preserved.
   */
  async cleanupClient(sessionId?: string): Promise<void> {
    const release = await this.factoryMutex.acquire();
    try {
      if (this.clientFactory) {
        this.clientFactory.cleanup(sessionId);
      }
    } finally {
      release();
    }
  }
}

/**
 * Convenience function to get client from context (thread-safe)
 */
export async function getClientFromContext(sessionId?: string): Promise<VikunjaClient> {
  const context = await ClientContext.getInstanceAsync();
  return context.getClient(sessionId);
}

/**
 * Set the global client factory for all tools (thread-safe)
 */
export async function setGlobalClientFactory(factory: VikunjaClientFactory): Promise<void> {
  const context = await ClientContext.getInstanceAsync();
  await context.setClientFactory(factory);
}

/**
 * Clear the global client factory (for testing, thread-safe)
 */
export async function clearGlobalClientFactory(): Promise<void> {
  const context = await ClientContext.getInstanceAsync();
  await context.clearClientFactory();
}

/**
 * Cleanup cached client for a specific session from context (thread-safe)
 * Removes only the specified session's cached client from the factory.
 * Other sessions' cached clients are preserved.
 * If no sessionId provided, cleans up the default session.
 * Safe to call even if factory is not set (no-op).
 */
export async function cleanupClientFromContext(sessionId?: string): Promise<void> {
  const context = await ClientContext.getInstanceAsync();
  await context.cleanupClient(sessionId);
}

export { ClientContext };

/**
 * Creates a new VikunjaClientFactory with dependency injection
 */
export async function createVikunjaClientFactory(
  authManager: AuthManager,
): Promise<VikunjaClientFactory> {
  // Dynamically import VikunjaClient
  const module: VikunjaModule = await import('node-vikunja');
  if (!isVikunjaClientConstructor(module.VikunjaClient)) {
    throw createInternalError(
      'Invalid VikunjaClient constructor imported from node-vikunja module',
    );
  }

  return new VikunjaClientFactory(authManager, module.VikunjaClient);
}
