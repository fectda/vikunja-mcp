# PRD — `vikunja-mcp`: Teams members return "Unknown error" due to error handler swallowing status messages

**⚠️ CRITICAL RULE: THIS PRD MUST BE WRITTEN ENTIRELY IN ENGLISH.**

## Status

**MCP Version**: 0.2.2 (8c4096d)
**Date**: 2026-06-01 (original) / 2026-06-24 (updated)
**Reported by**: vikunja-mcp-docker wrapper
**Severity**: High (resolved — see update below)

---

## Update 2026-06-24: "Unknown error" resolved, 403 behavior exposed

### What Changed

Upstream commit `b9cf833` fixed the `SecureErrorHandler.handleStatusCode()` to properly extract `.message` from plain objects. The "Unknown error" is now **resolved** — the MCP correctly propagates the actual Vikunja API error message.

### Current Behavior

The original "Unknown error" no longer occurs. Instead, the MCP now returns the real API error:

```
Failed to list members for team 999999: {"message":"You don't have the permission to see this"}
```

This is the Vikunja API responding with **HTTP 403 Forbidden** (not 404) when queried for a non-existent team's members. The API treats an invalid team ID as a permission denial rather than a "not found" scenario.

### Analysis

- **This is Vikunja API behavior**, not an MCP bug. The [Vikunja API design](https://vikunja.io/docs/api-v1/) returns 403 for resources the user cannot access, regardless of whether the resource exists (to avoid leaking existence information).
- The MCP error handler is now working correctly — it passes through the API's response verbatim.
- The fix `b9cf833` (commit referenced in this PRD's Proposed Solution / Option A) resolved the underlying handler issue.

### Remaining Considerations

1. **Error message clarity**: The raw API JSON `{"message":"You don't have the permission to see this"}` is technically correct but less helpful than a 404 "Team not found" would be.
2. **Potential enhancement**: The MCP could normalize 403 responses for team operations to include the team ID in the error message (e.g., `"Team 999999 not found or inaccessible"`) but this is a UX improvement, not a bug fix.
3. **Status**: The core bug (Unknown error) is FIXED. The remaining behavior is upstream API design.

---

## Summary

When calling `vikunja_teams` with `subcommand: "members"` and an invalid or inaccessible team ID, the MCP returns `"Failed to list team members: Unknown error"` instead of the actual API error (e.g., 404 Not Found, 403 Forbidden). Root cause: `SecureErrorHandler.handleStatusCode()` in `src/utils/error-handler.ts` only uses the `customMessage` parameter and extracts the `.message` property from plain objects for 404 errors. For all other status codes (403, 500, etc.), it falls through to generic handling that treats plain objects (`{ statusCode, message }`) as "Unknown error" because it only extracts messages from `Error` instances or strings.

---

## Expected Behavior

Calling `vikunja_teams(members, id: <invalid>)` should return a descriptive error message, such as:
- `"Team with ID 999999 not found"` (for 404)
- `"Failed to list members for team 999999: Forbidden"` (for 403)

The error message should reflect the actual API response, not a generic "Unknown error".

## Actual Behavior

The MCP returns `"Failed to list team members: Unknown error"` regardless of the actual API error. The real error from the Vikunja API (e.g., 404, 403) is swallowed by the error handler.

---

## Steps to Reproduce

1. Call `vikunja_teams` with `{ subcommand: "members", id: 999999 }` (a non-existent team)
2. Observe the error response

**Test Data**:
```
VIKUNJA_URL=http://your-vikunja/api/v1
VIKUNJA_USER=test
VIKUNJA_PASSWORD=test
```

---

## Error Logs

```
📋 teams.members with team ID=999999...
Result: Failed to list team members: Unknown error
```

**Direct API call for comparison**:
```bash
curl -s http://vikunja:3456/api/v1/teams/999999/members \
  -H "Authorization: Bearer $JWT" | jq .
# → {"message":"Team not found","code":2002}  ← descriptive!
```

---

## Root Cause Analysis

The bug is in `src/utils/error-handler.ts`, specifically in `SecureErrorHandler.handleStatusCode()`:

```typescript
handleStatusCode(error, operation, resourceId, customMessage) {
  // Only handles 404 with customMessage
  if (this.isStatusCodeError(error) && error.statusCode === 404) {
    if (customMessage) {
      return new MCPError(ErrorCode.NOT_FOUND, customMessage);
    }
    // ...
  }

  // For any other status code (403, 500, etc.):
  let message: string;
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else {
    message = 'Unknown error';  // ← THIS IS THE BUG
  }
}
```

The teams tool throws plain objects `{ statusCode, message }` (not `Error` instances), so:
1. `error instanceof Error` → **false** (it's a plain object)
2. `typeof error === 'string'` → **false**
3. Falls to `message = 'Unknown error'`

The `customMessage` parameter (4th arg) is **only used for 404 errors**. For any other status code, it's completely ignored.

### Call chain

1. `src/tools/teams.ts` line ~355: `throw handleStatusCodeError({ statusCode: response.status, message: errorText }, ...)`
2. `handleStatusCodeError` calls `SecureErrorHandler.handleStatusCode(error, ...)`
3. In `handleStatusCode`: the error is a plain object with `{ statusCode, message }` but `statusCode !== 404`
4. Falls to generic branch: plain object is not `Error` or `string` → `"Unknown error"`
5. Returns `"Failed to list team members: Unknown error"`

Note: the function signature accepts `customMessage` as the 4th parameter, but it's only referenced inside the `statusCode === 404` guard. For status codes other than 404, the `customMessage` is dead code.

---

## Proposed Solution

### Option A: Extract message from plain objects in the generic branch

In `src/utils/error-handler.ts`, change the generic handling to also extract `.message` from plain objects:

```typescript
// After the 404 check:
let message: string;
if (error instanceof Error) {
  message = error.message;
} else if (typeof error === 'string') {
  message = error;
} else if (error && typeof error === 'object' && 'message' in error) {
  message = (error as { message: string }).message;
} else {
  message = 'Unknown error';
}
```

Also, use `customMessage` when available for non-404 errors, since callers pass it with meaningful context:

```typescript
if (this.isStatusCodeError(error)) {
  // Use customMessage if provided (for any status code, not just 404)
  if (customMessage) {
    const code = error.statusCode === 404 ? ErrorCode.NOT_FOUND : ErrorCode.API_ERROR;
    return new MCPError(code, customMessage);
  }
  // ... rest of handling
}
```

### Option B: Have callers always pass `Error` instances

Modify `src/tools/teams.ts` (and any other tool that throws status code errors) to wrap API errors in MCPError instances instead of plain objects:

```typescript
if (!response.ok) {
  const errorText = await response.text();
  throw new MCPError(
    errorCodeForStatus(response.status),
    `Failed to list members for team ${teamId}: ${errorText}`,
  );
}
```

This is cleaner but requires changes in every calling tool.

### Option C: Both — fix the handler AND add proper error creation helpers

Apply Option A for defense-in-depth, plus create a helper like `createApiError(status, message)` that creates proper MCPError instances with correct error codes. Then migrate tools to use it.

---

## Impact

- **Affected endpoints**: `vikunja_teams` (members subcommand), potentially any tool that uses `handleStatusCodeError` with non-404 status codes
- **Affected users**: All users trying to access team memberships, especially with invalid team IDs, insufficient permissions, or server errors
- **Available workaround**: Users can call the Vikunja API directly to get the real error message. The MCP operation fails but the error is unhelpful for troubleshooting.

### Tools affected by the same pattern

The following tools also throw plain objects with `{ statusCode, message }` via `handleStatusCodeError` for non-404 errors:

- `src/tools/teams.ts`: members.list, members.add, members.remove, members.update, delete (direct fallback), update (direct API), get (direct API)
- `src/tools/export.ts`: request user export, download user export
- `src/tools/projects/` (multiple sharing operations)

All of these will exhibit "Unknown error" for non-404 failures.

---

## References

- Source: `src/utils/error-handler.ts` — `SecureErrorHandler.handleStatusCode()` method
- Source: `src/tools/teams.ts` — `members` subcommand at line ~355
- Direct API test: `curl $VIKUNJA_URL/teams/999999/members` returns descriptive message
