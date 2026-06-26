# Session Management Specification

## Purpose

Define requirements for multi-session auth isolation, enabling safe multi-tenant SSE deployments while preserving stdio backward compatibility.

## Requirements

### RB-1: Session Isolation

AuthManager MUST support multiple simultaneous sessions keyed by string identifier. MUST use `'default'` as key when no sessionId provided. `connect()`, `getSession()`, `disconnect()` MUST operate on specified session only. `isConnected()` (no args) MUST check `'default'`.

#### Scenario: Two sessions isolated

- GIVEN an AuthManager with no active sessions
- WHEN `connect("alice", url, tA)` AND `connect("bob", url, tB)` are called
- THEN `getSession("alice")` returns Alice's session AND `getSession("bob")` returns Bob's session

#### Scenario: Disconnect isolation

- GIVEN two active sessions "alice" and "bob"
- WHEN `disconnect("alice")` is called
- THEN `getSession("alice")` returns null AND `getSession("bob")` returns Bob's session unmodified

#### Scenario: Stdio default session

- GIVEN an AuthManager
- WHEN `connect(url, token)` is called without sessionId
- THEN `getSession("default")` returns the session AND `isConnected()` returns true

### RB-2: Session Threading

Every MCP tool handler MUST accept optional `extra: RequestHandlerExtra` parameter. MUST extract `extra.sessionId` when available and pass to auth/client calls. When absent (stdio), MUST fall back to `'default'`.

#### Scenario: Extra sessionId threaded

- GIVEN a tool handler invoked with `extra = { sessionId: "alice" }`
- WHEN the handler calls `authManager.getSession("alice")`
- THEN the correct session for "alice" is returned

#### Scenario: No sessionId fallback

- GIVEN a tool handler invoked with `extra = {}` or no extra
- WHEN the handler calls `authManager.getSession()`
- THEN the `'default'` session is returned

### RB-3: Client Factory

ClientFactory MUST accept optional `sessionId` and return/create a client for that session. Different sessions MUST use separate client instances.

#### Scenario: Per-session client caching

- GIVEN a ClientFactory
- WHEN `getClient("alice")` is called twice
- THEN the same VikunjaClient instance is returned both times

#### Scenario: Distinct sessions, distinct clients

- GIVEN a ClientFactory
- WHEN `getClient("alice")` AND `getClient("bob")` are called
- THEN distinct VikunjaClient instances are returned

### RB-4: Error Handling

Invalid or unknown sessionIds MUST NOT crash the process. MUST return null or appropriate MCPError with AUTH_REQUIRED code.

#### Scenario: Unknown sessionId

- GIVEN an AuthManager with no active sessions
- WHEN `getSession("nonexistent")` is called
- THEN the method returns null or throws MCPError with ErrorCode.AUTH_REQUIRED

#### Scenario: No cross-contamination

- GIVEN two sessions "alice" (tokenA) and "bob" (tokenB)
- WHEN a tool call is executed through session "alice"
- THEN the Vikunja API call uses only tokenA, never tokenB
