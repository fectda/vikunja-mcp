# PRD — Multi-Session Auth Support for SSE Transport

**⚠️ CRITICAL RULE: THIS PRD MUST BE WRITTEN ENTIRELY IN ENGLISH.**

## Status
**MCP Version**: `aee8b7a` (2026-06-25)
**Date**: 2026-06-25
**Reported by**: vikunja-mcp-docker wrapper
**Severity**: Medium (Feature Request)

---

## Summary

The MCP's `AuthManager` stores a single global session (`this.session`). In SSE mode, multiple clients (agents) can connect to the same MCP server, but they all share the same Vikunja authentication. This means all connected agents operate as the same Vikunja user, with the same permissions and the same rate-limit budget.

This PRD proposes making `AuthManager` session-aware so each connected MCP client (agent) can authenticate with a different Vikunja user.

---

## Expected Behavior

Each MCP client connected via SSE should be able to call `vikunja_auth.connect()` independently and have its own Vikunja session. Agent A connected as `user-1` can create tasks as `user-1`, while Agent B connected as `user-2` creates tasks as `user-2`, without either one overwriting the other's session.

## Actual Behavior

`AuthManager` is a singleton with a single `this.session` property. When Agent B calls `vikunja_auth.connect()`, it overwrites Agent A's session:

```typescript
class AuthManager {
  private session: AuthSession | null = null;  // ONE session for all

  connect(url: string, token: string): void {
    this.session = { url, token, authType: detectType(token) };
    // ^^^ This overwrites whatever session another agent had
  }
}
```

---

## Steps to Reproduce

1. Start the MCP in SSE mode: `MCP_TRANSPORT=sse node dist/index.js`
2. Agent A connects and calls `vikunja_auth.connect(url, token_user_a)`
3. Agent A calls `vikunja_get_task(1)` → ✅ works as user A
4. Agent B connects and calls `vikunja_auth.connect(url, token_user_b)`
5. Agent A calls `vikunja_get_task(1)` again → ❌ now using user B's token

---

## Error Logs

No errors — the MCP silently switches tokens. This is a correctness and isolation issue, not a crash.

---

## Wrapper Context

Our wrapper (`vikunja-mcp-docker`) runs the MCP inside a Docker container:
- Base: `node:22-alpine`
- Transport: SSE (default in docker-compose)
- Auth: JWT / API Token

The wrapper DOES NOT modify the MCP logic, it only:
1. Auto-login JWT via `/api/v1/login` (if credentials exist)
2. Injects `VIKUNJA_API_TOKEN` as an environment variable

In a multi-agent setup, each agent connects to the same MCP endpoint via SSE. Since the MCP is a single Node process, all agents share the same `AuthManager` singleton.

---

## Proposed Solution

### Option A: Session-keyed AuthManager (recommended)

Replace the single `this.session` with a `Map<string, AuthSession>` keyed by a session identifier:

```typescript
class AuthManager {
  // Instead of:
  //   private session: AuthSession | null = null;
  //
  // Use:
  private sessions: Map<string, AuthSession> = new Map();

  connect(sessionId: string, url: string, token: string): void {
    this.sessions.set(sessionId, { url, token, authType: detectType(token) });
  }

  getSession(sessionId: string): AuthSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  disconnect(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
```

Each MCP tool needs access to the `sessionId` for the requesting client. This requires either:

1. **Per-transport sessions (recommended)**: The `@modelcontextprotocol/sdk` assigns each SSE connection a unique `sessionId` via the transport. Each tool handler receives the transport as part of the request context. Use the transport's `sessionId` to look up the correct auth token.
2. **Explicit session ID in tool calls** (fallback): Each tool call requires an additional `sessionId` parameter. Clients pass their session ID on every call. Less elegant but works with the current MCP SDK version.

### Option B: One MCP process per agent (orchestration-side fix)

Instead of modifying the MCP, run a separate MCP process per agent. Each process is a separate Node instance with its own `AuthManager`, own token, own rate limit budget.

This is the 🅰️ option from earlier analysis — not a code change to the MCP, but an orchestration change. It works today without MCP modifications but uses more resources.

---

## Impact

- **Affected endpoints**: All tools that use `authManager.getSession()` — essentially every MCP tool that makes Vikunja API calls
- **Affected users**: Teams running the MCP in SSE mode with multiple agents (OpenCode, Cline, etc.) connecting to the same server
- **Available workaround**: 
  - Today: Run one MCP instance per agent in stdio mode
  - With Option A: Single SSE server with full multi-user isolation
  - With Option B: Multiple SSE servers (one per agent), each on a different port

---

## References

- Source: `src/auth/AuthManager.ts` in fectda/vikunja-mcp
- MCP SDK: `@modelcontextprotocol/sdk` — Transport interface with `sessionId`
- Vikunja auth: `POST /api/v1/login` (JWT) or `tk_...` API tokens
- Related: PRD_FIX_EXPORT_JWT_AUTH_CHECK.md (auth type detection pattern)
