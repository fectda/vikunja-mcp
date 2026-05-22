# Design: tasks-all-endpoint-deprecated

## Technical Approach

The change will bypass the broken `/tasks/all` endpoint in `node-vikunja` by monkey-patching the `getAllTasks` method on the `VikunjaClient` instance immediately after it is created. The patched method will construct a URL pointing to the valid `/tasks` endpoint, serialize any query parameters, and perform a raw HTTP request using the global `fetch` API while forwarding the session's authentication token.

## Architecture Decisions

### Decision: Monkey-Patch Location

**Choice**: Patch `getAllTasks` inside `VikunjaClientFactory.getClient()` immediately after instantiating `VikunjaClient`.
**Alternatives considered**:

1. Wrap the client in a Proxy.
2. Patch it at the MCP tool handler level (`src/tools/tasks/index.ts`).
   **Rationale**: Patching it inside the factory ensures that every part of the system requesting a `VikunjaClient` automatically gets the corrected method. It keeps the workaround centralized and cleanly isolated from tool business logic.

### Decision: HTTP Client for Patched Method

**Choice**: Use standard global `fetch`.
**Alternatives considered**: Extract and reuse the internal HTTP client (e.g., Axios instance) from `node-vikunja`.
**Rationale**: `node-vikunja`'s internal HTTP client is an implementation detail that isn't exported as part of the public API contract. Relying on global `fetch` is safer, standard, and avoids tying the patch to internal library details.

## Data Flow

    [MCP Tool Handler]
           │
           ▼
    [Client Context] ──→ [VikunjaClientFactory]
           │                    │ (Instantiates VikunjaClient)
           │                    └─→ (Monkey-patches client.tasks.getAllTasks)
           ▼
    [VikunjaClient] (Patched)
           │
           ▼
    [fetch()] ──→ HTTP GET `/tasks?params` ──→ [Vikunja API v1.0.0+]

## File Changes

| File                                 | Action | Description                                                                                                                                                         |
| ------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/client/VikunjaClientFactory.ts` | Modify | Update `getClient()` to intercept the newly created `VikunjaClient` and override `client.tasks.getAllTasks` with a custom fetch implementation before returning it. |

## Interfaces / Contracts

The patched method must adhere to the original signature:

```typescript
// Original signature matching node-vikunja expectations
getAllTasks(params?: any): Promise<Task[]>;
```

The query parameters must be properly translated into a `URLSearchParams` string (e.g., `filter`, `sort_by`, `page`).

## Testing Strategy

| Layer       | What to Test                        | Approach                                                                                                                                                              |
| ----------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | `VikunjaClientFactory` monkey-patch | Verify that `getAllTasks` on the returned client calls `fetch` with the correct URL (`/tasks` endpoint), correct query parameters, and correct Authorization headers. |
| Integration | `vikunja_tasks list` command        | Run the MCP integration test for the list-tasks command against a real or mocked Vikunja API (v1.0.0+) to ensure it completes successfully without a 400 error.       |

## Migration / Rollout

No migration required. The patch will be applied in-memory upon client instantiation. This patch is a temporary workaround until `node-vikunja` releases an update resolving the endpoint deprecation.

## Open Questions

- None
