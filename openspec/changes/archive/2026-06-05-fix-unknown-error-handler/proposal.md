# Proposal: fix-unknown-error-handler

## Intent

`SecureErrorHandler.handleStatusCode()` ignores the `customMessage` parameter for non-404 status codes. Callers (e.g., `src/tools/teams.ts`) construct descriptive `customMessage` strings that get discarded, falling back to a generic `Failed to {operation}: {message}` format that can be ugly and lose context.

The original "Unknown error" bug is already fixed (plain object `.message` extraction at `error-handler.ts:163`). This change addresses the remaining gap: making `customMessage` work for non-404 errors too.

## Scope

**In scope:**

- `src/utils/error-handler.ts` — modify `handleStatusCode` to use `customMessage` for non-404 errors
- Tests in `tests/utils/error-handler.test.ts` (or similar) — add coverage for the new behavior
- Apply `this.sanitize()` to `customMessage` to avoid security bypass

**Out of scope:**

- Modifying individual callers in `teams.ts`, `export.ts`, `projects/*.ts` (they already pass good `customMessage`; the fix centralizes in the handler)
- The plain object `.message` extraction (already implemented)
- Refactoring callers to use `MCPError` directly (Option B - too invasive)

## Approach

**Option C: Use `customMessage` for all status codes + sanitize.**

In `handleStatusCode`:

1. If `customMessage` is provided AND `statusCode !== 404`, return `new MCPError(ErrorCode.API_ERROR, sanitize(customMessage))`
2. Sanitize first via `this.sanitize()` to avoid leaking raw API response strings
3. Keep existing 404 branch as-is (uses `customMessage` for 404 already, with `ErrorCode.NOT_FOUND`)

```typescript
// After the 404 block
if (customMessage) {
  return new MCPError(ErrorCode.API_ERROR, this.sanitize(customMessage));
}
// ... existing generic branch
```

## Files touched

| File                                | Action | Change                                            |
| ----------------------------------- | ------ | ------------------------------------------------- |
| `src/utils/error-handler.ts`        | Modify | Use `customMessage` for non-404 path              |
| `tests/utils/error-handler.test.ts` | Modify | Add tests for `customMessage` with 403, 500, etc. |

**Estimated diff: ~10 lines, well under the 400-line budget.**

## Risks

- **Security bypass**: `customMessage` may contain unsanitized API response text. Mitigation: apply `this.sanitize()` before returning.
- **Test updates**: Existing tests that assert specific error formats may need updates.
- **Backward compat**: None — the change is additive (new behavior for cases that previously ignored `customMessage`).

## Effort

Low. Single-file change + tests. 1 hour work.
