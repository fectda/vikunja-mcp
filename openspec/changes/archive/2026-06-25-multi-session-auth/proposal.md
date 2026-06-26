# Proposal: Multi-Session Auth for SSE Transport

## Intent

The MCP server currently stores a single global auth session. In SSE mode, multiple agents share one process — when Agent B calls `vikunja_auth.connect()`, it silently overwrites Agent A's session, breaking isolation. This makes the server unsafe for multi-tenant SSE deployments.

## Scope

### In Scope

- AuthManager: single `this.session` → `Map<string, AuthSession>` with `'default'` fallback key
- ClientFactory: per-session client caching (reuses client for same session)
- Tool handlers: thread `extra.sessionId` from MCP SDK v1.22.0 through 25+ files
- Rate limiter: use real sessionId instead of `session_${process.pid}`
- Auto-login in `src/index.ts`: uses `'default'` sessionId for stdio

### Out of Scope

- Explicit `sessionId` in tool Zod schemas (Option A2 — session spoofing risk)
- Separate MCP processes per agent (Option B — wrong layer)
- SSE transport customizations (already provides sessionId natively)
- Per-transport session lifecycle management via SDK internals

## Capabilities

### New Capabilities

- `session-management`: isolated auth sessions keyed by transport sessionId, with `'default'` fallback for stdio backward compat

### Modified Capabilities

- None — spec-level auth precondition semantics are unchanged (it's always "user is authenticated")

## Approach

Option A1 from exploration: `AuthManager` becomes `Map<string, AuthSession>`. All public methods get an overload accepting optional `sessionId` (defaults to `'default'`). `VikunjaClientFactory` caches clients per sessionId. Tool handlers declare the `extra: RequestHandlerExtra` parameter and forward `extra.sessionId` to auth/client calls. MCP SDK v1.22.0 already provides `extra.sessionId` in every callback — no SDK changes needed. Stdio mode works identically (no sessionId → `'default'` key).

## Affected Areas

| Area                                 | Impact   | Description                                         |
| ------------------------------------ | -------- | --------------------------------------------------- |
| `src/auth/AuthManager.ts`            | Modified | Single session → `Map<string, AuthSession>`         |
| `src/client/VikunjaClientFactory.ts` | Modified | Per-session client caching                          |
| `src/client.ts`                      | Modified | `getClientFromContext()` accepts optional sessionId |
| `src/tools/auth.ts`                  | Modified | Thread `extra.sessionId` from SDK callback          |
| `src/tools/*/index.ts` (4 files)     | Modified | Forward `extra.sessionId` through handler chain     |
| `src/tools/*.ts` (10+ tool files)    | Modified | Pass sessionId to auth/client calls                 |
| `src/middleware/*.ts` (2 files)      | Modified | Use real sessionId for rate limiting                |
| `src/index.ts`                       | Modified | Auto-login uses `'default'` sessionId               |
| `tests/**/*.test.ts` (~10 files)     | Modified | Update mocks, add multi-session tests               |

## Risks

| Risk                                    | Likelihood | Mitigation                                                          |
| --------------------------------------- | ---------- | ------------------------------------------------------------------- |
| Missed code path (session not threaded) | Medium     | Automated grep for `getSession(`, `isAuthenticated(` after refactor |
| Session cross-contamination             | Low        | Transport sessionId is opaque UUID, never user-provided             |
| Backward compat regression (stdio)      | Low        | Default `'default'` key ensures unchanged behavior                  |
| Memory growth from cached clients       | Low        | Each Vikunja client is lightweight HTTP config, not a pool          |

## Rollback Plan

1. Revert AuthManager to single-session pattern in `src/auth/AuthManager.ts`
2. Remove `sessionId` parameter from all tool handlers
3. Restore `VikunjaClientFactory` to single-instance cache
4. Revert rate limiter key to `session_${process.pid}`
5. Revert test files

## Dependencies

- MCP SDK v1.22.0+ (already installed) — provides `extra.sessionId`
- No external dependency changes

## Success Criteria

- [ ] AuthManager stores and retrieves independent sessions per sessionId
- [ ] Stdio mode works identically (no sessionId → default key)
- [ ] All 90%+ branch / 95%+ line coverage thresholds maintained
- [ ] SSE multi-client test proves isolation: two agents, different Vikunja users, zero cross-contamination
- [ ] Session disconnect doesn't affect other sessions
