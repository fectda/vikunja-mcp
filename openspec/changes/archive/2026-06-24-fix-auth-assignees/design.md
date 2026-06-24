# Design: Fix Authentication for Assignee & Label Operations

## Architecture Decisions

### AD-01: JWT takes priority over API token

**Decision**: When both JWT credentials and API token exist, JWT always takes priority.
**Rationale**: API tokens have limited permissions in Vikunja. JWT provides full API access. Users expect all MCP operations to work when they provide both credentials.
**Consequence**: If JWT login fails, we fall back to API token with a clear warning about limitations.

### AD-02: Login happens only at server startup (not per-request)

**Decision**: Auto-login JWT is obtained once when the server starts. No per-request login.
**Rationale**: Vikunja login endpoint may have rate limiting. JWT tokens last ~24h which is sufficient for most use cases. Per-request login would add latency to every operation.
**Consequence**: If JWT expires, the server needs a restart or manual refresh.

### AD-03: Circuit breaker removed from retry wrapper

**Decision**: The `withRetry` function shall NOT use a shared circuit breaker for individual retry operations.
**Rationale**: The circuit breaker pattern is designed to protect upstream services from cascading failures. Using it for individual operation retries with a shared name (`'anonymous'`) causes unrelated operations to share failure state. Each retry should be independent.
**Consequence**: Circuit breaker functionality is available via `withNamedRetry` for specific use cases that need it.

### AD-04: MCPError preservation in assignee operations

**Decision**: `assignUsers()` and `unassignUsers()` shall re-throw `MCPError` instances without wrapping them.
**Rationale**: Wrapping all errors in a generic "Failed to assign users" message loses critical diagnostic information. Auth errors with specific guidance are more useful to users than generic failures.
**Consequence**: Error messages will be more specific and actionable.

### AD-05: Auth type detection is authoritative

**Decision**: `AuthManager.detectAuthType()` is the single source of truth for auth type. Tools that require JWT SHALL check `authManager.getAuthType() === 'jwt'`.
**Rationale**: Avoids duplicating auth type logic across tools. Centralizes the token format detection.
**Consequence**: If a JWT is obtained via auto-login, it will be correctly detected as JWT because JWT tokens always start with `eyJ`.

---

## Sequence Diagrams

### Auto-login Flow (Server Startup)

```
┌─────────┐     ┌──────────┐     ┌─────────┐     ┌──────────┐
│  Index   │     │  Auth    │     │ Vikunja │     │  Auth    │
│   .ts    │     │ Manager  │     │  API    │     │  Type    │
└────┬─────┘     └────┬─────┘     └────┬────┘     └────┬─────┘
     │                │                │                │
     │ load .env      │                │                │
     ├───────────────>│                │                │
     │                │                │                │
     │ has USER+PASS? │                │                │
     ├───────────────>│                │                │
     │                │                │                │
     │ [YES] ──────────────────────────────────────────>│
     │                │                │   POST /login  │
     │                │                │<───────────────┤
     │                │                │                │
     │                │                │  JWT token     │
     │                │                │───────────────>│
     │                │                │                │
     │                │  connect(url,  │                │
     │                │  jwt_token)    │                │
     │                │<───────────────────────────────┤
     │                │                │                │
     │                │  detectAuthType() → 'jwt'      │
     │                │────────────────────────────────>│
     │                │                │                │
     │  ✅ JWT auth   │                │                │
     │<───────────────┤                │                │
     │                │                │                │
     │  [if login fails + has API_TOKEN]               │
     │                │  connect(url,  │                │
     │                │  api_token)    │                │
     │                │                │                │
     │  ⚠️ API fallback                │                │
     │<───────────────┤                │                │
```

### Assign User Flow (With JWT)

```
┌──────────┐    ┌───────────┐    ┌──────────┐    ┌─────────┐
│  MCP     │    │  Assignee │    │  with    │    │ Vikunja │
│  Tool    │    │  Service  │    │  Retry   │    │  API    │
└────┬─────┘    └─────┬─────┘    └────┬─────┘    └────┬────┘
     │                │               │                │
     │ assign(task,   │               │                │
     │ user)          │               │                │
     ├───────────────>│               │                │
     │                │               │                │
     │                │ assignUser()  │                │
     │                ├──────────────>│                │
     │                │               │                │
     │                │               │ PUT /tasks/    │
     │                │               │ {id}/assignees │
     │                │               │ Authorization: │
     │                │               │ Bearer {jwt}   │
     │                │               ├───────────────>│
     │                │               │                │
     │                │               │  200 OK        │
     │                │               │<───────────────┤
     │                │               │                │
     │                │<──────────────┤                │
     │                │               │                │
     │                │ getTask(id)   │                │
     │                ├───────────────────────────────>│
     │                │               │                │
     │                │  task with    │                │
     │                │  assignees    │                │
     │                │<───────────────────────────────┤
     │                │               │                │
     │  ✅ Success    │               │                │
     │<───────────────┤               │                │
```

### Assign User Flow (With API Token - Failure)

```
┌──────────┐    ┌───────────┐    ┌──────────┐    ┌─────────┐
│  MCP     │    │  Assignee │    │  with    │    │ Vikunja │
│  Tool    │    │  Service  │    │  Retry   │    │  API    │
└────┬─────┘    └─────┬─────┘    └────┬─────┘    └────┬────┘
     │                │               │                │
     │ assign(task,   │               │                │
     │ user)          │               │                │
     ├───────────────>│               │                │
     │                │               │                │
     │                │ assignUser()  │                │
     │                ├──────────────>│                │
     │                │               │                │
     │                │               │ PUT /tasks/    │
     │                │               │ {id}/assignees │
     │                │               │ Authorization: │
     │                │               │ Bearer {tk_*}  │
     │                │               ├───────────────>│
     │                │               │                │
     │                │               │  401/403       │
     │                │               │<───────────────┤
     │                │               │                │
     │                │               │ [retry x3]     │
     │                │               ├───────────────>│
     │                │               │  401/403       │
     │                │               │<───────────────┤
     │                │               │                │
     │                │<─── AssigneeAuthenticationError │
     │                │               │                │
     │                │ detect API token auth          │
     │                │               │                │
     │  ❌ Error:     │               │                │
     │  "API tokens  │               │                │
     │  don't support│               │                │
     │  assignees.   │               │                │
     │  Use JWT..."  │               │                │
     │<───────────────┤               │                │
```

---

## Component Interaction

```
┌─────────────────────────────────────────────────────┐
│                    MCP Server                        │
│                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Auth   │  │   Client     │  │    Tools      │  │
│  │  Manager │──│   Factory    │──│              │  │
│  │          │  │              │  │  ┌──────────┐ │  │
│  │ connect()│  │ getClient()  │  │  │Assignees │ │  │
│  │ type=jwt │  │              │  │  │  Service │ │  │
│  │ type=api │  │              │  │  └────┬─────┘ │  │
│  └──────────┘  └──────────────┘  │       │       │  │
│       │              │           │  ┌────▼─────┐ │  │
│       │              │           │  │  with    │ │  │
│       │              │           │  │  Retry   │ │  │
│       │              │           │  └────┬─────┘ │  │
│       │              │           └───────┼───────┘  │
│       │              │                   │          │
│  ┌────▼──────────────▼───────────────────▼───────┐  │
│  │              node-vikunja Client              │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  TaskService                            │  │  │
│  │  │  - assignUserToTask(taskId, userId)     │  │  │
│  │  │  - removeUserFromTask(taskId, userId)   │  │  │
│  │  │  - getTask(taskId)                      │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  │                      │                        │  │
│  │  ┌───────────────────▼───────────────────┐    │  │
│  │  │  VikunjaService.request()             │    │  │
│  │  │  - Adds Authorization: Bearer {token} │    │  │
│  │  │  - Retry with X-API-Token header      │    │  │
│  │  │  - Retry with lowercase auth header   │    │  │
│  │  └───────────────────────────────────────┘    │  │
│  └───────────────────────────────────────────────┘  │
│                        │                             │
└────────────────────────┼─────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   Vikunja API       │
              │   (go-vikunja)      │
              │                     │
              │  JWT: ✅ all ops    │
              │  API: ⚠️ limited    │
              └─────────────────────┘
```

---

## Impact Analysis

### Files Modified

| File                                                     | Change Type | Lines Changed (est.) | Breaking? |
| -------------------------------------------------------- | ----------- | -------------------- | --------- |
| `src/index.ts`                                           | Bug fix     | ~15                  | No        |
| `src/utils/retry.ts`                                     | Bug fix     | ~10                  | No        |
| `src/tools/auth.ts`                                      | Feature add | ~50                  | No        |
| `src/auth/AuthManager.ts`                                | Feature add | ~10                  | No        |
| `src/tools/tasks/assignees/index.ts`                     | Enhancement | ~20                  | No        |
| `src/tools/tasks/assignees/AssigneeOperationsService.ts` | Enhancement | ~15                  | No        |

### Test Impact

- Existing tests use mocks (`jest.mock('../../../src/client')`) so they should pass without changes
- New tests needed for:
  - `src/tools/auth.ts` — login subcommand, refresh behavior
  - `src/index.ts` — auto-login with both credentials present
  - `src/utils/retry.ts` — circuit breaker naming
