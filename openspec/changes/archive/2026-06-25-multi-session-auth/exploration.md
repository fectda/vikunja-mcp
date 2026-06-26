## Exploration: Multi-Session Auth Support for SSE Transport

### Current State

The MCP server has two singleton bottlenecks that prevent multi-session auth:

**1. AuthManager** (`src/auth/AuthManager.ts`):

- Stores a single `this.session: AuthSession | null`
- `connect()`, `getSession()`, `disconnect()` operate on one global session
- When Agent B calls `vikunja_auth.connect()`, it overwrites Agent A's session silently
- Used by 50+ reference points across 25+ source files

**2. ClientContext + VikunjaClientFactory** (`src/client.ts`, `src/client/VikunjaClientFactory.ts`):

- `ClientContext` is a singleton holding one `VikunjaClientFactory`
- `VikunjaClientFactory` creates one `VikunjaClient` instance
- `getClient()` calls `authManager.getSession()` — the singleton session
- All tools use `getClientFromContext()` which returns the same client

**3. Tool handler pattern**:

- All tool callbacks currently only take `(args)` and ignore the `extra` parameter
- The MCP SDK v1.22.0 provides `extra.sessionId` from `RequestHandlerExtra` — **already available today, just not consumed**
- Rate-limiting middleware (`applyRateLimiting`) uses generic spreads and forwards all arguments — compatible without changes

**4. MCP SDK sessionId support** (v1.22.0, already installed):

- `Transport` interface: `sessionId?: string` (line 69, transport.d.ts)
- `SSEServerTransport`: generates unique UUID per SSE connection, exposes via `get sessionId()`
- `StreamableHTTPServerTransport`: configurable `sessionIdGenerator` option
- `RequestHandlerExtra`: includes `sessionId?: string` — passed to every tool callback
- `ToolCallback` type: `(args, extra: RequestHandlerExtra) => CallToolResult` — `extra.sessionId` is already there

**5. Storage system already session-aware** (`src/storage/SimpleFilterStorage.ts`):

- Uses `Map<string, SimpleFilterStorage>`, keyed by session ID
- Currently derives sessionId from `apiToken.substring(0,8)` — not ideal, but the pattern exists

### Affected Areas

| File                                      | Why Changes                                                     |
| ----------------------------------------- | --------------------------------------------------------------- |
| `src/auth/AuthManager.ts`                 | Core change: single `this.session` → `Map<string, AuthSession>` |
| `src/client/VikunjaClientFactory.ts`      | Cache clients per-sessionId instead of single instance          |
| `src/client.ts`                           | `getClientFromContext()` must accept optional `sessionId`       |
| `src/tools/auth.ts`                       | Auth tool needs `extra.sessionId` for connect/disconnect        |
| `src/tools/tasks/index.ts`                | Pass `extra.sessionId` through handler chain                    |
| `src/tools/tasks/crud/*.ts` (5 files)     | Accept `sessionId` parameter                                    |
| `src/tools/projects/index.ts`             | Pass `extra.sessionId` through handler chain                    |
| `src/tools/projects/user-sharing.ts`      | Pass `sessionId` to auth calls                                  |
| `src/tools/projects/team-sharing.ts`      | Pass `sessionId` to auth calls                                  |
| `src/tools/filters.ts`                    | Pass `sessionId` to `authManager.getSession()`                  |
| `src/tools/templates.ts`                  | Pass `sessionId` to auth calls                                  |
| `src/tools/webhooks.ts`                   | Pass `sessionId` to auth calls                                  |
| `src/tools/teams.ts`                      | Pass `sessionId` to auth calls                                  |
| `src/tools/export.ts`                     | Pass `sessionId` to auth calls                                  |
| `src/tools/users.ts`                      | Pass `sessionId` to auth calls                                  |
| `src/tools/labels.ts`                     | Pass `sessionId` to auth calls                                  |
| `src/tools/batch-import.ts`               | Pass `sessionId` to auth calls                                  |
| `src/middleware/direct-middleware.ts`     | Pass `sessionId` in `applyPermissions()`                        |
| `src/middleware/simplified-rate-limit.ts` | Use real sessionId instead of `session_${process.pid}`          |
| `src/index.ts`                            | Auto-login uses default sessionId                               |
| **Test files** (~10 files)                | Update mocks and test expectations                              |

### Approaches

1. **Option A1: Transport-native sessionId (Recommended)** — Change AuthManager to `Map<string, AuthSession>`. All methods accept optional `sessionId` (default: `'default'` for stdio backward compat). Tool handlers declare the `extra` parameter and pass `extra.sessionId` through. `VikunjaClientFactory` caches clients per sessionId. SDK already provides `extra.sessionId` — no schema changes needed.
   - Pros: Backward compatible (stdio mode works unchanged); full isolation in SSE mode; no new tool parameters added; uses SDK-native mechanism; storage already has session-keyed pattern as precedent
   - Cons: Touches 50+ reference points in ~25 files; need to thread `sessionId` through all tool handler chains; risk of missing a code path
   - Effort: High (touches many files, but each change is small)

2. **Option A2: Explicit sessionId in tool args** — Add `sessionId: z.string().optional()` to every tool's Zod schema. Clients pass their session ID explicitly. AuthManager uses `Map<string, AuthSession>` as in A1.
   - Pros: Works in any transport mode (not just SSE); explicit contract visible to users
   - Cons: **Session spoofing risk** — any client can impersonate another by sending their sessionId; adds noise to every tool call; partially already implemented in some tools (`vikunja_tasks`, `vikunja_projects` already have `sessionId: z.string().optional()`)
   - Effort: Medium (adds parameter to schemas, but spoofing mitigation requires transport-vs-args validation)
   - **Risk: High** — session cross-contamination without transport validation

3. **Option B: One MCP process per agent** — Run one Node.js process per connected agent, each with its own AuthManager, on different ports. Orchestration-side fix, no MCP code changes.
   - Pros: Works today; zero code changes; full isolation; no session cross-contamination risk
   - Cons: Resource-heavy (multiple Node processes per agent); port management complexity; defeats purpose of SSE (shared server); doesn't scale
   - Effort: Low (orchestration only), but doesn't solve the problem at the right layer

### Recommendation

**Option A1: Transport-native sessionId.**

Rationale:

- The MCP SDK v1.22.0 **already provides** `extra.sessionId` — we're leaving it on the table. Using it costs nothing and requires no SDK upgrades.
- `AuthManager` changes are backward compatible: methods that omit `sessionId` use `'default'` key, so stdio mode works identically to today.
- Storage layer already proves the `Map<string, X>` pattern works for session isolation.
- Rate limiter should be updated to use the real sessionId (currently uses `session_${process.pid}`), giving each MCP client its own rate limit budget.
- Avoid Option A2 because it introduces session spoofing without transport-level validation.

### Risks

- **Session cross-contamination**: LOW with A1 — the transport sessionId is opaque and unique. Each SSE connection gets a UUID. In stdio mode, there's only one client so no risk. Mitigation: never accept user-provided sessionId from args; always use `extra.sessionId` from the SDK.
- **Backward compatibility regression**: LOW — default sessionId key (`'default'`) ensures unchanged stdio behavior. All existing tests should pass without modification.
- **Missing a code path**: MEDIUM — 50+ AuthManager references to update. Mitigation: grep for all patterns (`getSession(`, `isAuthenticated(`, etc.) after changes to catch stragglers.
- **ClientFactory caching**: LOW — per-session client caching means more memory when multiple sessions are active. Mitigation: each Vikunja client is lightweight (HTTP client config), not a connection pool.
- **Rate limiter session spaghetti**: LOW — currently hardcoded to `session_${process.pid}`. Updating to use real sessionId is a separate concern.

### Test Strategy Outline

1. **Unit: AuthManager** — New `connectWithSession()`, `getSession(sessionId)`, multi-session isolation tests. Verify sessions don't leak. Verify backward compat (no sessionId → default).
2. **Unit: VikunjaClientFactory** — Verify per-session client caching. Verify client recreation on token change per-session.
3. **Unit: Tool handlers** — Mock `extra.sessionId`. Verify correct session flows through each tool.
4. **Integration: SSE multi-client** — Start SSE server, connect Client A as user1, Client B as user2. Verify Client A's operations remain as user1. This is the core validation.
5. **Integration: Stdio backward compat** — Verify stdio mode works identically (sessionId undefined → default key).
6. **Security: Session isolation** — Verify one session's disconnect doesn't affect another. Verify session token is never leaked in logs.
7. **Rate limit isolation** — Verify each session has independent rate limit counters.

### Estimated Scope

- **Source files touched**: ~25 files
- **AuthManager core**: 1 file (moderate rewrite)
- **Client/Factory**: 2 files (add session awareness)
- **Tool handlers**: ~18 files (add `extra.sessionId` threading — each ~3-10 line change)
- **Middleware**: 2 files (thread sessionId through)
- **Entry point**: 1 file (default sessionId for auto-login)
- **Test files**: ~10 files (update mocks, add new multi-session tests)
- **Total complexity**: **Medium-High** — broad surface area, but each change is shallow and mechanical

### Ready for Proposal

**Yes.** The PRD accurately identifies the problem, and Option A1 is well-defined with clear implementation patterns. The orchestrator should tell the user:

- The PRD is validated against the actual codebase
- MCP SDK v1.22.0 already supports the needed `sessionId` mechanism — no SDK changes required
- Option A1 is recommended with ~25 files affected, each with small changes
- Backward compat is maintained via default sessionId key
- Session cross-contamination risk is low with transport-native session IDs
