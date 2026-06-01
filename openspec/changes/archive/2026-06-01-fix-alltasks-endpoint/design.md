# Design: Fix alltasks endpoint

## Technical Approach

Modify the monkey-patched `getAllTasks` method in `VikunjaClientFactory` to correctly construct the API URL. The current implementation erroneously appends `/api/v1/tasks` to the `baseUrl` (which often already contains `/api/v1`), resulting in double API versioning and a 404 error. The new approach will append only `/tasks`, defensively handling any potential trailing slashes in the base URL.

## Architecture Decisions

### Decision: Fix URL Concatenation in Monkey Patch

**Choice**: Modify the URL string concatenation to strictly append `/tasks` to `baseUrl`, stripping any trailing slashes from `baseUrl` to avoid double slashes.
**Alternatives considered**:

1. Use the `URL` constructor's base parameter: `new URL('tasks', baseUrl + '/')`.
2. Update the upstream `node-vikunja` library and remove the monkey patch entirely.
   **Rationale**: Updating the upstream library requires external coordination and delays the fix. Using defensive string replacement (`baseUrl.replace(/\/+$/, '') + '/tasks'`) is straightforward, avoids URL constructor quirks with relative paths in Node, and specifically addresses the double `/api/v1` error observed.

## Data Flow

    Client.tasks.getAllTasks()
         │
         ├──→ Retrieves currentApiUrl (e.g., http://localhost:3456/api/v1)
         │
         ├──→ Appends `/tasks` (safely stripping trailing slashes)
         │
         └────────→ Fetch (GET /api/v1/tasks) ──→ Returns Task[]

## File Changes

| File                                 | Action | Description                                                                                               |
| ------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------- |
| `src/client/VikunjaClientFactory.ts` | Modify | Update the `new URL(...)` line inside the `getAllTasks` monkey patch to prevent duplication of `/api/v1`. |

## Interfaces / Contracts

No new interfaces or data structures are required. The monkey-patch signature and the `VikunjaClientFactory` contract remain identical.

## Testing Strategy

| Layer | What to Test                        | Approach                                                                                                                                                             |
| ----- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit  | `VikunjaClientFactory` Monkey Patch | Mock global `fetch`, call `getAllTasks`, and assert the exact URL used in the fetch call is correct (e.g., `http://url/api/v1/tasks` not `.../api/v1/api/v1/tasks`). |

## Migration / Rollout

No migration required.

## Open Questions

- None
