/**
 * Vikunja Client Factory
 * Provides dependency injection for Vikunja client instances
 * Supports per-session client caching keyed by sessionId (default: 'default')
 */

import type { VikunjaClient } from 'node-vikunja';
import type { AuthManager } from '../auth/AuthManager';
import type { VikunjaClientConstructor } from '../types/node-vikunja-extended';

interface CachedClient {
  client: VikunjaClient;
  url: string | null;
  token: string | null;
}

/**
 * Factory for creating and managing Vikunja client instances
 * Uses dependency injection instead of global state
 */
export class VikunjaClientFactory {
  private clients: Map<string, CachedClient> = new Map();

  constructor(
    private readonly authManager: AuthManager,
    private readonly VikunjaClientClass: VikunjaClientConstructor,
  ) {}

  /**
   * Resolve sessionId, defaulting to 'default'
   */
  private resolveCacheKey(sessionId?: string): string {
    return sessionId || 'default';
  }

  /**
   * Get an authenticated Vikunja client instance
   */
  getClient(sessionId?: string): VikunjaClient {
    const cacheKey = this.resolveCacheKey(sessionId);
    const session = this.authManager.getSession(sessionId);

    // Check if we need to create a new client
    const cached = this.clients.get(cacheKey);
    if (!cached || cached.url !== session.apiUrl || cached.token !== session.apiToken) {
      // Clean up old client if it exists
      this.clients.delete(cacheKey);

      const client = new this.VikunjaClientClass(session.apiUrl, session.apiToken);
      this.clients.set(cacheKey, {
        client,
        url: session.apiUrl,
        token: session.apiToken,
      });

      // Monkey-patch getAllTasks to use /tasks instead of /tasks/all
      // This is a workaround for the deprecated /tasks/all endpoint in node-vikunja
      if (client.tasks) {
        type OriginalGetAllTasks = typeof client.tasks.getAllTasks;
        client.tasks.getAllTasks = (async (
          params?: Record<string, string | readonly string[]>,
        ): Promise<unknown> => {
          const baseUrl = session.apiUrl || '';
          const token = session.apiToken || '';
          const url = new URL(`${baseUrl.replace(/\/+$/, '')}/tasks`);

          if (params) {
            const searchParams = new URLSearchParams(params);
            url.search = searchParams.toString();
          }

          const response = await fetch(url.toString(), {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => response.statusText);
            throw new Error(`Failed to get tasks: ${response.status} ${errorText}`);
          }

          return response.json();
        }) as OriginalGetAllTasks;
      }

      const entry = this.clients.get(cacheKey);
      if (!entry) {
        throw new Error('Failed to create Vikunja client instance');
      }

      return entry.client;
    }

    return cached.client;
  }

  /**
   * Cleanup function to reset client instance
   */
  cleanup(sessionId?: string): void {
    if (sessionId !== undefined) {
      this.clients.delete(this.resolveCacheKey(sessionId));
    } else {
      this.clients.clear();
    }
  }

  /**
   * Check if the factory has a valid session
   */
  hasValidSession(sessionId?: string): boolean {
    try {
      this.authManager.getSession(sessionId);
      return true;
    } catch {
      return false;
    }
  }
}
