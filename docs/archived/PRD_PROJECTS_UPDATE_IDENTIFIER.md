# PRD — Bug: projects.update (identifier) returns Invalid Data for identifiers > 10 chars

**⚠️ CRITICAL RULE: THIS PRD MUST BE WRITTEN ENTIRELY IN ENGLISH.**

## Status

**Fork**: fectda/vikunja-mcp
**Date**: 2026-06-25
**Reported by**: vikunja-mcp-docker wrapper
**Severity**: Low (test data issue + missing client-side validation)

---

## Summary

The `projects.update` tool fails with `Failed to Failed to update project: Invalid Data` when updating a project identifier longer than 10 characters. The Vikunja API enforces `runelength(0|10)` on the `identifier` field — max 10 characters. The fork (`fectda/vikunja-mcp`) **already has** `identifier` in the Zod schema (commits 5f69770, 69657db), so the original upstream-focused PRD was incorrect.

Two bugs remain:

1. **Missing client-side validation**: The Zod schema accepts identifiers up to 50 chars (`z.string().min(1).max(50)`) but Vikunja rejects > 10 chars with a generic "Invalid Data" error.
2. **Double-prefix error message**: `handleStatusCodeError(error, 'Failed to update project', id)` combined with `Failed to ${operation}` in `error-handler.ts` produces `Failed to Failed to update project: Invalid Data`.

---

## Expected Behavior

When updating a project identifier, the MCP should:
- Validate identifier length client-side (max 10 chars) before sending to Vikunja
- Return a clear error like `"Identifier must be 10 characters or less"` if exceeded
- Show `Failed to update project: Invalid Data` (not double-prefixed) for other API errors

## Actual Behavior

- Identifier `TEST-ID-123` (12 chars) → `Failed to Failed to update project: Invalid Data`
- Identifier `FEAT` (4 chars) → works correctly in both MCP and API

---

## Steps to Reproduce

1. Call `vikunja_projects` with `{ subcommand: "update", id: <id>, identifier: "12345678901" }` (11 chars)
2. Observe the double-prefixed error

---

## Root Cause Analysis

### Real API error (confirmed via direct node-vikunja call)

```
POST /projects/{id} {title: "...", identifier: "12345678901"}
→ 412 {"code":2002,"message":"Invalid Data","invalid_fields":[
    "title: non zero value required",
    "identifier: 12345678901 does not validate as runelength(0|10)"
]}
```

### Two contributing issues:

1. **Vikunja requires `title` in all updates** — the MCP already handles this correctly (fetches current title if not provided), but the API also rejects identifiers > 10 chars

2. **Error handler double-prefix** — in `crud.ts`:
   ```typescript
   throw handleStatusCodeError(error, 'Failed to update project', id);
   //                              ^^^^^^^^^^^^^^^^^^^^^  already has "Failed to"
   ```
   In `error-handler.ts`:
   ```typescript
   return new MCPError(ErrorCode.API_ERROR, `Failed to ${operation}: ${sanitized}`);
   //                                            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   //                                            Produces "Failed to Failed to update project: Invalid Data"
   ```

---

## Proposed Solution

### Option A: Client-side identifier validation (recommended)

In `src/tools/projects/index.ts`, change the Zod schema to enforce 10-char max:

```typescript
identifier: z.string().min(1).max(10).optional(),
```

This gives the LLM a clear validation error instead of a cryptic API error.

### Option B: Fix error handler double-prefix

In `src/tools/projects/crud.ts`, change:
```typescript
throw handleStatusCodeError(error, 'Failed to update project', id);
```
to:
```typescript
throw handleStatusCodeError(error, 'update project', id);
```

### Option C: Both (recommended)

Apply both fixes for a complete solution.

---

## Impact

- **Affected endpoints**: `vikunja_projects` (subcommand: update)
- **Affected users**: Users attempting to set identifiers longer than 10 characters
- **Available workaround**: Use identifiers ≤ 10 characters (e.g., "PROJ-1", "FEAT", "BUGFIX")

---

## References

- [Fork commit 5f69770](https://github.com/fectda/vikunja-mcp/commit/5f69770) — added `identifier` to Zod schema
- [Fork commit 69657db](https://github.com/fectda/vikunja-mcp/commit/69657db) — added `identifier` to Zod schema (duplicate)
- Vikunja API: `POST /projects/{id}` — `identifier` validates as `runelength(0|10)`
