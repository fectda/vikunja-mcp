/**
 * Vikunja Client Factory
 * Provides dependency injection for Vikunja client instances
 */

import type { VikunjaClient } from 'node-vikunja';
import type { AuthManager } from '../auth/AuthManager';
import type { VikunjaClientConstructor } from '../types/node-vikunja-extended';

/**
 * Factory for creating and managing Vikunja client instances
 * Uses dependency injection instead of global state
 */
export class VikunjaClientFactory {
  private clientInstance: VikunjaClient | null = null;
  private currentApiUrl: string | null = null;
  private currentApiToken: string | null = null;

  constructor(
    private readonly authManager: AuthManager,
    private readonly VikunjaClientClass: VikunjaClientConstructor,
  ) {}

  /**
   * Get an authenticated Vikunja client instance
   */
  getClient(): VikunjaClient {
    const session = this.authManager.getSession();

    // Check if we need to create a new client
    if (
      !this.clientInstance ||
      this.currentApiUrl !== session.apiUrl ||
      this.currentApiToken !== session.apiToken
    ) {
      // Clean up old client if it exists
      if (this.clientInstance) {
        this.clientInstance = null;
      }

      this.clientInstance = new this.VikunjaClientClass(session.apiUrl, session.apiToken);
      this.currentApiUrl = session.apiUrl;
      this.currentApiToken = session.apiToken;

      // Monkey-patch getAllTasks to use /tasks instead of /tasks/all
      // This is a workaround for the deprecated /tasks/all endpoint in node-vikunja
      if (this.clientInstance.tasks) {
        type OriginalGetAllTasks = typeof this.clientInstance.tasks.getAllTasks;
        this.clientInstance.tasks.getAllTasks = (async (
          params?: Record<string, string | readonly string[]>,
        ): Promise<unknown> => {
          const baseUrl = this.currentApiUrl || '';
          const token = this.currentApiToken || '';
          const url = new URL(`${baseUrl}/api/v1/tasks`);

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
    }

    if (!this.clientInstance) {
      throw new Error('Failed to create Vikunja client instance');
    }

    return this.clientInstance;
  }

  /**
   * Cleanup function to reset client instance
   */
  cleanup(): void {
    this.clientInstance = null;
    this.currentApiUrl = null;
    this.currentApiToken = null;
  }

  /**
   * Check if the factory has a valid session
   */
  hasValidSession(): boolean {
    try {
      this.authManager.getSession();
      return true;
    } catch {
      return false;
    }
  }
}
