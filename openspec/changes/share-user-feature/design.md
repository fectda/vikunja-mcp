# Design: User-Based Project Sharing

## Technical Approach

Mirror the existing team-sharing module (`src/tools/projects/team-sharing.ts`) to create a user-sharing module (`user-sharing.ts`). Integrate as subcommands of `vikunja_projects`, reusing the same patterns: `normalizeRight()` validation, `fetch()`-based API calls, `createStandardResponse`/`formatAorpAsMarkdown` for responses, and `wrapToolError` for error wrapping.

Key API difference from team-sharing: user sharing uses a **single-step PUT** (`/projects/:id/users/:userId` with `{right}` body) for both create and update, unlike teams which requires two steps (PUT to create with default permission, then POST to upgrade).

## Architecture Decisions

| Decision                       | Choice                                   | Alternative              | Rationale                                                                                         |
| ------------------------------ | ---------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------- |
| normalizeRight reuse           | Import from `./team-sharing`             | Extract to shared util   | 22-line pure function; import is simple and keeps change minimal                                  |
| Tool registration              | Subcommands in `vikunja_projects`        | Separate tool            | Identical pattern to team-sharing; discoverability from one project tool                          |
| get-user-share                 | Direct GET `/projects/:id/users/:userId` | List+filter (like teams) | Vikunja API supports direct user GET; simpler and more efficient                                  |
| share-user + update-user-share | Same PUT endpoint, different validation  | Separate endpoints       | Both map to `PUT /projects/:id/users/:userId`; validator enforces `right` required for share-user |
| Response format                | AORP via `createStandardResponse`        | SimpleResponse           | Existing team-sharing uses AORP; consistency trumps migration scope                               |

## Data Flow

```
vikunja_projects(subcommand: "share-user", projectId, userId, right)
  │
  ▼
index.ts switch → validates projectId/userId/right required
  │
  ▼
user-sharing.ts handler
  │
  ▼
fetch(PUT /projects/{projectId}/users/{userId}, { right: numericRight })
  │
  ▼
AORP success/error response ←─── Vikunja API
```

## File Changes

| File                                        | Action | Description                                                                                                       |
| ------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| `src/tools/projects/user-sharing.ts`        | Create | 5 exported handlers: shareUser, listUserShares, getUserShare, updateUserShare, removeUserShare + 5 arg interfaces |
| `src/tools/projects/index.ts`               | Modify | Add `userId` to Zod schema; add 5 subcommands to enum; import and route 5 handlers; export types and functions    |
| `tests/tools/projects/user-sharing.test.ts` | Create | Full test suite: validation, API calls, error handling, defensive validation                                      |

## Interfaces / Contracts

```typescript
// user-sharing.ts
export interface ShareUserArgs {
  projectId: number;
  userId: number;
  right: 'read' | 'write' | 'admin' | 0 | 1 | 2;
}
export interface ListUserSharesArgs {
  projectId: number;
  page?: number;
  perPage?: number;
}
export interface GetUserShareArgs {
  projectId: number;
  userId: number;
}
export type UpdateUserShareArgs = ShareUserArgs; // Same shape
export type RemoveUserShareArgs = { projectId: number; userId: number };
```

## API Mapping Detail

| Subcommand        | Method | Endpoint                      | Request Body        |
| ----------------- | ------ | ----------------------------- | ------------------- |
| share-user        | PUT    | `/projects/:id/users/:userId` | `{ right: number }` |
| list-user-shares  | GET    | `/projects/:id/users`         | —                   |
| get-user-share    | GET    | `/projects/:id/users/:userId` | —                   |
| update-user-share | PUT    | `/projects/:id/users/:userId` | `{ right: number }` |
| remove-user-share | DELETE | `/projects/:id/users/:userId` | —                   |

All subcommands return AORP-formatted responses. `share-user` vs `update-user-share` are semantically distinct (create vs modify) but use the same API verb — the Vikunja API handles upsert semantics.

## Testing Strategy

| Layer       | What to Test                                    | Approach                                                              |
| ----------- | ----------------------------------------------- | --------------------------------------------------------------------- |
| Unit        | Validation (missing/invalid IDs, invalid right) | Call handlers directly with bad args; expect MCPError                 |
| Unit        | API call format (method, URL, body)             | Mock `fetch()`; assert exact URL + body JSON                          |
| Unit        | Error handling (404, 403, 500)                  | Mock `fetch()` returning error status; check error code + message     |
| Unit        | Unexpected errors                               | Mock `getClientFromContext` rejection; check `wrapToolError` wraps it |
| Integration | Tool registration + routing                     | Through `registerProjectsTool` like team-sharing tests                |

## Migration / Rollout

No migration required. New tool — no existing data to migrate. Single feature branch, single PR. Estimated <300 lines new code, well under the 400-line review budget.

## Open Questions

None — all decisions resolved by the existing team-sharing pattern.
