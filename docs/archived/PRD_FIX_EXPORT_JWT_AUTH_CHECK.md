# PRD — Add JWT auth check to `vikunja_request_user_export`

**⚠️ CRITICAL RULE: THIS PRD MUST BE WRITTEN ENTIRELY IN ENGLISH.**

## Status
**MCP Version**: `aee8b7a` (2026-06-25)
**Date**: 2026-06-25
**Reported by**: vikunja-mcp-docker wrapper
**Severity**: Low

---

## Summary

`vikunja_request_user_export` makes a POST request to Vikunja's `/user/export/request` endpoint, which **requires JWT authentication**. However, the tool does not check the authentication type before making the API call. When the MCP is running with an API token (`tk_...`), the Vikunja API rejects the request with a generic "invalid token" error instead of a clear message telling the user to use JWT auth.

The sibling tool `vikunja_export_project` already has this guard — it returns a clear `PERMISSION_DENIED` error when auth type is not `jwt`.

---

## Expected Behavior

When `vikunja_request_user_export` is called with API token auth (not JWT), it should return a clear error message telling the user that JWT authentication is required, similar to `vikunja_export_project`.

## Actual Behavior

The tool silently propagates the Vikunja API error:
```
missing, malformed, expired or otherwise invalid token provided
```

This is confusing because the token is valid — it's just not the right *type* of token for this endpoint.

---

## Steps to Reproduce

1. Start the MCP with an API token (not JWT): `VIKUNJA_API_TOKEN=tk_xxx`
2. Call `vikunja_request_user_export` with a valid password
3. Observe the error: `missing, malformed, expired or otherwise invalid token provided`

**Test Data**:
```
VIKUNJA_URL=http://vikunja:8080/api/v1
VIKUNJA_API_TOKEN=tk_f54611a...
```

---

## Error Logs

```
❌ export.request: missing, malformed, expired or otherwise invalid token provided
```

---

## Wrapper Context

Our wrapper (`vikunja-mcp-docker`) runs the MCP inside a Docker container:
- Base: `node:22-alpine`
- Transport: stdio / sse
- Auth: JWT / API Token

The wrapper DOES NOT modify the MCP logic, it only:
1. Auto-login JWT via `/api/v1/login` (if credentials exist)
2. Injects `VIKUNJA_API_TOKEN` as an environment variable

**Verification**: The issue can be reproduced by running the MCP directly (without wrapper):
```bash
VIKUNJA_API_TOKEN=tk_f54611a... node dist/index.js
```

---

## Proposed Solution

### Option A: Add JWT auth check (recommended)

Add the same auth type check that `vikunja_export_project` already has. In `src/tools/export.ts`, before making the API call to `/user/export/request`, check:

```typescript
// Export operations require JWT authentication
if (authManager.getAuthType() !== 'jwt') {
    throw new MCPError(
        ErrorCode.PERMISSION_DENIED,
        'Export operations require JWT authentication. Please reconnect using vikunja_auth.connect with JWT authentication.',
    );
}
```

This is the same pattern already used in `vikunja_export_project` in the same file.

### Option B: Fallback to password-based auth

Some Vikunja instances accept password-based auth for the export endpoint (password in body + API token in header). If the Vikunja API supports it, the MCP could attempt password-only auth as a fallback. However, this is less secure and not recommended.

---

## Impact

- **Affected endpoints**: `vikunja_request_user_export`, `vikunja_download_user_export`
- **Affected users**: Users running the MCP with API token (`tk_...`) who try to use the export feature
- **Available workaround**: Use JWT authentication (set `VIKUNJA_USER` + `VIKUNJA_PASSWORD`) — the export works correctly with JWT

---

## References

- Source: `src/tools/export.ts` in fectda/vikunja-mcp
- Sister tool with correct guard: `vikunja_export_project` (same file, lines ~68-74)
- Vikunja export API: `POST /api/v1/user/export/request` (requires JWT)
