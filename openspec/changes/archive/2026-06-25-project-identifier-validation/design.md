# Design: Project Identifier Validation

## Technical Approach

Two independent one-line fixes to the project tools module. Both are client-side corrections that don't change any interfaces — only tighten existing validation and fix a string formatting bug.

## Architecture Decisions

### Decision: Zod max(10) for identifier field

| Option                    | Tradeoff                                                                                      | Decision                            |
| ------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------- |
| Keep `.max(50)`           | API rejects oversized identifiers anyway, but with a confusing 400 error after a round-trip   | ❌ Rejected — wastes a network call |
| `.max(10)`                | Rejects at Zod level before any API call; matches Vikunja's actual constraint (`varchar(10)`) | ✅ Chosen                           |
| Custom validator function | More flexible but overkill for a static length check                                          | ❌ Rejected — Zod `.max()` suffices |

### Decision: Remove "Failed to " from operation string

| Option                      | Tradeoff                                                                 | Decision                              |
| --------------------------- | ------------------------------------------------------------------------ | ------------------------------------- |
| Fix caller in `crud.ts`     | Single-line fix; `handleStatusCodeError` already prepends `"Failed to "` | ✅ Chosen                             |
| Fix `handleStatusCodeError` | Would change behavior for ALL callers (24 call sites); 23 are correct    | ❌ Rejected — would break other tools |

## Data Flow

```
Zod Schema Fix (identifier > 10 chars):

  User Input (identifier: "VERY-LONG-IDENTIFIER")
    → Zod parse at src/tools/projects/index.ts:127
    → FAILS: `String must contain at most 10 character(s)`
    → Returns VALIDATION_ERROR immediately
    → ❌ NEVER reaches Vikunja API

Error Message Fix:

  Vikunja API error (400 Bad Request)
    → updateProject() in crud.ts catches
    → handleStatusCodeError(error, 'update project', id)
    → Produces "Failed to update project: <reason>"
    → ✅ Single prefix
```

## File Changes

| File                              | Action | Description                                                              |
| --------------------------------- | ------ | ------------------------------------------------------------------------ |
| `src/tools/projects/index.ts:127` | Modify | `.max(50)` → `.max(10)` for identifier Zod schema                        |
| `src/tools/projects/crud.ts:488`  | Modify | `'Failed to update project'` → `'update project'` in operation string    |
| `tests/tools/projects.test.ts`    | Modify | Add identifier length tests; existing error-message assertions unchanged |

## Interfaces / Contracts

No interface changes. The Zod schema line change:

```typescript
// Before
identifier: z.string().min(1).max(50).optional(),
// After
identifier: z.string().min(1).max(10).optional(),
```

The error handler call change:

```typescript
// Before
throw handleStatusCodeError(error, 'Failed to update project', id);
// After
throw handleStatusCodeError(error, 'update project', id);
```

The `handleStatusCodeError` function at `src/utils/error-handler.ts:218` always produces `Failed to {operation}: {message}`, so after the fix the output is `Failed to update project: {message}` — correct and single-prefixed.

## Testing Strategy

| Layer        | What to Test                    | Approach                                                                                                                                                                                                |
| ------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (Zod)   | identifier > 10 chars rejected  | Test that Zod schema rejects 11-char strings with `ZodError` containing `max`                                                                                                                           |
| Unit (Zod)   | identifier = 10 chars accepted  | Test that Zod schema passes 10-char strings                                                                                                                                                             |
| Unit (Zod)   | identifier = 1-9 chars accepted | Test that existing valid identifiers still work                                                                                                                                                         |
| Unit (error) | Update error has single prefix  | Test that `callTool('update', ...)` with a mock API error produces exactly `"Failed to update project: ..."` (existing tests at lines 585/592/600 already verify this — no change needed to assertions) |
| Integration  | Full flow                       | Existing mocks verify identifier passes through to API; no new integration tests needed                                                                                                                 |

The Zod schema tests should exercise the **parse-time** validation (before the handler logic), verifying the error code is `VALIDATION_ERROR` and the message indicates the 10-char limit.

## Migration / Rollout

No migration required. Both changes take effect immediately after the two lines are modified. No feature flags, no data migration, no phased rollout.

## Open Questions

None.
