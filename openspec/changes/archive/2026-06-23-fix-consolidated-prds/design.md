# Design: fix-consolidated-prds

## Technical Approach

Consolidate fixes for three high-severity issues identified in recent PRDs:

1. Ensure export tools properly fall back to the `VIKUNJA_EXPORT_PASSWORD` environment variable when `args.password` is omitted.
2. Add the missing `identifier` field to the `vikunja_projects` schema and ensure it is passed through in the update payload.
3. Ensure `field` and `value` properties are properly accepted in the `vikunja_tasks` bulk-update schema and payload.
4. Refactor project sharing endpoints (team and link) to use list endpoints (`GET /projects/{id}/shares`, `GET /projects/{id}/teams`) with client-side filtering because Vikunja does not support singular GET endpoints for them. Also, remove the unnecessary pre-flight GET check before deleting a link share.

## Architecture Decisions

### Decision: Export Password Fallback

**Choice**: Use `process.env.VIKUNJA_EXPORT_PASSWORD` when `args.password` is omitted in export requests.
**Alternatives considered**: Requiring password in all requests or adding a dedicated configuration file for auth.
**Rationale**: Simplifies automated exports while remaining secure. It leverages existing Docker/environment setups seamlessly.

### Decision: Sharing Endpoints List-Filtering

**Choice**: Query the list endpoints (`GET /projects/{id}/shares` and `GET /projects/{id}/teams`) and filter by ID on the client side.
**Alternatives considered**: Creating new custom singular endpoints in Vikunja or wrapping the node-vikunja client with new routes.
**Rationale**: Modifying the upstream Vikunja API is out of scope. Client-side filtering is the most robust way to fetch a specific share given the current API design.

### Decision: Pre-flight GET Removal

**Choice**: Directly call `DELETE` for link shares without verifying their existence first.
**Alternatives considered**: Retaining the GET check but switching it to list filtering.
**Rationale**: Eliminates an unnecessary API call. If a share does not exist, the API will naturally return a 404 on the DELETE request, which we can handle directly.

## Data Flow

    MCP Client ──→ MCP Server (Tool) ──→ node-vikunja / fetch ──→ Vikunja API
                      │
                      ├── export: env var fallback for password
                      ├── projects: passthrough `identifier` field
                      ├── tasks: passthrough `field`, `value` properties
                      └── shares: query list API & filter by share ID

## File Changes

| File                                 | Action | Description                                                                                       |
| ------------------------------------ | ------ | ------------------------------------------------------------------------------------------------- |
| `src/tools/export.ts`                | Modify | Update logic to correctly read and apply `process.env.VIKUNJA_EXPORT_PASSWORD`.                   |
| `src/tools/projects/index.ts`        | Modify | Add `identifier: z.string().min(1).max(50).optional()` to the schema.                             |
| `src/tools/projects/crud.ts`         | Modify | Ensure `identifier` is passed in the update payload to Vikunja.                                   |
| `src/tools/tasks/index.ts`           | Modify | Ensure `field` and `value` are fully integrated in the `vikunja_tasks` bulk-update schema.        |
| `src/tools/tasks/bulk-operations.ts` | Modify | Ensure `field` and `value` are correctly extracted and sent to the API.                           |
| `src/tools/projects/sharing.ts`      | Modify | Use `getLinkShares` and filter by ID for fetching. Remove pre-flight GET in `deleteProjectShare`. |
| `src/tools/projects/team-sharing.ts` | Modify | Use `getTeamShares` and filter by ID for fetching team shares.                                    |

## Interfaces / Contracts

No new interfaces are introduced.
`identifier` added to project update arguments:

```typescript
identifier?: string;
```

## Testing Strategy

| Layer | What to Test      | Approach                                                                                               |
| ----- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| Unit  | Export Password   | Mock `process.env` and verify `fetch` is called with the env password.                                 |
| Unit  | Project Update    | Verify `identifier` is included in the payload passed to the API client.                               |
| Unit  | Task Bulk Update  | Verify `field` and `value` properties are passed correctly to the API.                                 |
| Unit  | Sharing Endpoints | Mock list API response and verify filtering returns the correct matched item. Verify DELETE skips GET. |

## Migration / Rollout

No migration required.

## Open Questions

- [ ] None.
