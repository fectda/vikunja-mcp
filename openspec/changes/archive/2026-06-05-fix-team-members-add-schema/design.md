# Design: fix-team-members-add-schema

## Technical Approach

The core issue is that the `vikunja_teams` tool's `members.add` subcommand sends `user_id` in its payload, whereas Vikunja's REST API (`models.TeamMember` schema) requires `username`. We will update the tool's schema to accept `username` and use it in the `PUT /teams/{id}/members` payload. We will maintain backward compatibility for `members.update` and `members.remove`, which correctly rely on `userId`.

## Architecture Decisions

| Decision Title                | Choice                                                            | Alternatives considered                                                                                    | Rationale                                                                                                                                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fix for `members.add` Payload | **Option A**: Send `username` in the PUT body                     | **Option B**: Keep `userId` in MCP arg, lookup `username` via `GET /users/{userId}`, then send `username`. | Option A directly matches Vikunja's API schema and avoids an extra round trip. While it is a breaking change for callers currently passing `userId`, the current behavior is completely broken (fails with 1005), so the breakage is acceptable. |
| Schema Backward Compatibility | Make `username` optional in the global Zod schema, keep `userId`. | Make `username` required.                                                                                  | The single Zod schema covers multiple `memberSubcommand`s. `update` and `remove` still require `userId`, so both `username` and `userId` must remain optional globally, with explicit checks in each switch case.                                |

## Data Flow

```text
MCP Client                  vikunja_teams (members.add)            Vikunja API
    │                                    │                              │
    │  1. call(username: "alice")        │                              │
    ├───────────────────────────────────►│                              │
    │                                    │  2. PUT /teams/3/members     │
    │                                    │     {"username": "alice"}    │
    │                                    ├─────────────────────────────►│
    │                                    │                              │
    │                                    │  3. 200 OK                   │
    │                                    │◄─────────────────────────────┤
    │  4. return formatted result        │                              │
    ◄────────────────────────────────────┤                              │
```

## File Changes

| File                        | Action | Description                                                                                                                                                                                                                                 |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/tools/teams.ts`        | Modify | Update Zod schema to include `username: z.string().optional()`. In the `members.add` block, validate `args.username` instead of `args.userId` and use it in the PUT body instead of `user_id`. Update error messages to reflect `username`. |
| `tests/tools/teams.test.ts` | Modify | Update tests to pass `username: 'user3'` instead of `userId: 3` when testing `members.add`.                                                                                                                                                 |

## Interfaces / Contracts

**Zod Schema Additions (`src/tools/teams.ts`)**:

```typescript
{
  // ... existing fields
  memberSubcommand: z.enum(['list', 'add', 'remove', 'update']).optional(),
  userId: z.union([z.string(), z.number()]).optional(),
  username: z.string().optional(), // NEW
  admin: z.boolean().optional(),
}
```

**Payload Construction (`members.add`)**:

```typescript
const memberData: { username: string; admin?: boolean } = {
  username: args.username,
};
if (args.admin !== undefined) memberData.admin = args.admin;
```

## Testing Strategy

| Layer | What to Test                     | Approach                                                                                               |
| ----- | -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Unit  | `members.add` valid input        | Ensure passing `username` correctly forms the `PUT` body with `{"username": ...}` and returns success. |
| Unit  | `members.add` missing `username` | Ensure calling `members.add` without `username` throws a `VALIDATION_ERROR`.                           |
| Unit  | `members.update` / `remove`      | Ensure they continue to require and use `userId`.                                                      |

## Migration / Rollout

No migration required. Callers (like integration tests) that previously passed `userId` to `members.add` will need to switch to passing `username`, but as the operation was failing universally anyway, there is no state migration needed.

## Open Questions

- [ ] None. The solution is straightforward and aligns with the proposal.
