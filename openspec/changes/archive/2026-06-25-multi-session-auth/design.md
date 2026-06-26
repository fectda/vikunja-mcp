# Design: Multi-Session Auth for SSE Transport

## Technical Approach

Map `AuthManager` from single-session to `Map<string, AuthSession>`. Thread `extra.sessionId` from MCP SDK v1.22.0 through 25+ tool handler files. `ClientContext` stores a per-session client cache. Stdio mode uses `'default'` key — no behavioral change.

## Architecture Decisions

| Decision                 | Choice                                                   | Alternative         | Rationale                                                                    |
| ------------------------ | -------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------- |
| Session storage          | `Map<string, AuthSession>` with `'default'` fallback     | AsyncLocalStorage   | Explicit threading is safer — ALS loses context across Promise.race/parallel |
| Client factory           | Single factory with per-session client Map               | Factory per session | One factory, one authManager reference, less object churn                    |
| Deep module threading    | Thread `sessionId` parameter (~15 sub-module signatures) | Singleton setter    | Thread-safe w/ existing mutex pattern; no race window between set and get    |
| `extra.sessionId` source | MCP SDK v1.22.0 native `RequestHandlerExtra`             | Custom schema field | SDK provides it in SSE mode; no session spoofing risk (user can't inject)    |

## Data Flow

```
SSE Transport → McpServer.tool handler(args, extra)
                    │
                    ├─ extra.sessionId ──→ authManager.getSession(sessionId)
                    │                         └─ returns AuthSession
                    │
                    ├─ extra.sessionId ──→ getClientFromContext(sessionId)
                    │                         └─ ClientContext.getClient(sessionId)
                    │                            └─ VikunjaClientFactory.getClient(sessionId)
                    │                               └─ new VikunjaClient(url, token)
                    │
                    └─ tools sub-module ──→ getClientFromContext(sessionId)
                                              (threaded through args or context param)
```

## File Changes

| File                                  | Action | Description                                                                                                                         |
| ------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/auth/AuthManager.ts`             | Modify | `private session` → `private sessions: Map<string, AuthSession>`. All methods accept `sessionId?: string` defaulting to `'default'` |
| `src/client.ts`                       | Modify | `getClientFromContext(sessionId?)` — per-session client lookup                                                                      |
| `src/client/VikunjaClientFactory.ts`  | Modify | `getClient(sessionId?)` — Map of clients keyed by sessionId; reuses client when same URL+token                                      |
| `src/index.ts`                        | Modify | `authManager.connect(url, token, 'default')` — explicit default session                                                             |
| `src/tools/auth.ts`                   | Modify | `(args, extra)` → thread `extra?.sessionId` to all authManager calls                                                                |
| `src/tools/labels.ts`                 | Modify | `(args, extra)` → `isAuthenticated(extra?.sessionId)` + `getClientFromContext(extra?.sessionId)`                                    |
| `src/tools/teams.ts`                  | Modify | Add `extra` param; thread sessionId to `getSession()` and `getClientFromContext()`                                                  |
| `src/tools/users.ts`                  | Modify | Add `extra` param; thread sessionId to auth/client calls                                                                            |
| `src/tools/filters.ts`                | Modify | Add `extra` param; `getSessionStorage(authManager, sessionId)`                                                                      |
| `src/tools/templates.ts`              | Modify | Add `extra` param; thread sessionId                                                                                                 |
| `src/tools/webhooks.ts`               | Modify | Add `extra` param; thread sessionId to `getValidEvents()` and direct API calls                                                      |
| `src/tools/export.ts`                 | Modify | Add `extra` param; thread sessionId through 3 tool registrations                                                                    |
| `src/tools/batch-import.ts`           | Modify | Add `extra` param; thread sessionId to auth/client calls                                                                            |
| `src/tools/tasks-relations.ts`        | Modify | `handleRelationSubcommands(args, sessionId?)` — pass to `getClientFromContext()`                                                    |
| `src/tools/tasks/index.ts`            | Modify | `(args, extra)` → thread sessionId to sub-module calls and `handleAttach()`                                                         |
| `src/tools/tasks/crud/*.ts` (3 files) | Modify | Accept `sessionId?: string` param; pass to `getClientFromContext()`                                                                 |
| `src/tools/tasks/bulk/*.ts` (2 files) | Modify | Accept `sessionId?: string` param                                                                                                   |
| `src/tools/tasks/assignees/*.ts`      | Modify | Accept `sessionId?: string` param                                                                                                   |
| `src/tools/tasks/comments/*.ts`       | Modify | Accept `sessionId?: string` param                                                                                                   |
| `src/tools/tasks/reminders.ts`        | Modify | Accept `sessionId?: string` param                                                                                                   |
| `src/tools/tasks/labels.ts`           | Modify | Accept `sessionId?: string` param                                                                                                   |
| `src/tools/projects/index.ts`         | Modify | Already has `context` param — read `extra.sessionId` from it                                                                        |
| `src/tools/projects/crud.ts`          | Modify | Accept `sessionId?: string` param                                                                                                   |
| `src/tools/projects/hierarchy.ts`     | Modify | Accept `sessionId?: string` param                                                                                                   |
| `src/tools/projects/sharing.ts`       | Modify | Accept `sessionId?: string` param                                                                                                   |
| `src/tools/projects/team-sharing.ts`  | Modify | Accept `sessionId?: string` param                                                                                                   |
| `src/tools/projects/user-sharing.ts`  | Modify | Accept `sessionId?: string` param                                                                                                   |
| `src/utils/filtering/*.ts` (2 files)  | Modify | Accept `sessionId?: string` param                                                                                                   |
| `src/middleware/direct-middleware.ts` | Modify | `applyPermissions` uses `extra.sessionId` for session lookup                                                                        |
| `tests/**/*.test.ts` (~15 files)      | Modify | Add multi-session mocks, update existing call signatures                                                                            |

## Interfaces / Contracts

```typescript
// AuthManager — session Map
class AuthManager {
  connect(apiUrl: string, apiToken: string, sessionId?: string): void;
  getSession(sessionId?: string): AuthSession; // default 'default'
  isAuthenticated(sessionId?: string): boolean; // default 'default'
  disconnect(sessionId?: string): void; // default 'default'
  getStatus(sessionId?: string): Status;
  getAuthType(sessionId?: string): 'api-token' | 'jwt';
}

// Client context — per-session factory
async function getClientFromContext(sessionId?: string): Promise<VikunjaClient>;
async function setGlobalClientFactory(factory: VikunjaClientFactory): Promise<void>;

// VikunjaClientFactory — per-session client map
class VikunjaClientFactory {
  getClient(sessionId?: string): VikunjaClient; // keyed by sessionId
}

// Tool handler pattern — all 10 tool registration files
async (args, extra: RequestHandlerExtra) => {
  const sessionId = extra?.sessionId;
  authManager.isAuthenticated(sessionId);
  const client = await getClientFromContext(sessionId);
};
```

## Testing Strategy

| Layer       | What                                 | Approach                                                           |
| ----------- | ------------------------------------ | ------------------------------------------------------------------ |
| Unit        | AuthManager multi-session            | 2 sessions, isolate, disconnect with cross-contamination check     |
| Unit        | ClientFactory per-session            | Twice-get same session → same client; diff session → diff client   |
| Unit        | `isAuthenticated()` with no sessions | Returns false for any sessionId                                    |
| Unit        | Stdio backward compat                | No `extra` param → `'default'` key used                            |
| Integration | SSE multi-agent                      | Mock `extra = { sessionId: 'agent-a' }` set A, verify B can't read |
| Integration | Session disconnect isolation         | Disconnect session A, verify B still works                         |
| Regression  | All existing tests pass              | Same assertions, same coverage thresholds                          |

## Migration / Rollout

No migration required. Stdio behavior is identical — `sessionId` is only provided by SSE transport. Auto-login in `src/index.ts` uses `'default'` key. All existing tests continue to pass with `'default'` fallback.

## Open Questions

- [ ] Should `createVikunjaClientFactory()` be called once per session or lazily? (Proposal: lazy — first `getClientFromContext(sessionId)` creates the factory entry)
- [ ] Rate limiter `getSessionId()` — should it use the real transport sessionId instead of `session_${process.pid}`? (Spec says yes, but this is a separate concern)
