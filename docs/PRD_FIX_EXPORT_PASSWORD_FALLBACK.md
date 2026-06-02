# PRD — `vikunja-mcp`: Export tools should read `VIKUNJA_EXPORT_PASSWORD` as password fallback

**⚠️ CRITICAL RULE: THIS PRD MUST BE WRITTEN ENTIRELY IN ENGLISH.**

## Status

**MCP Version**: main (e0cc18d)
**Date**: 2026-06-01
**Reported by**: vikunja-mcp-docker wrapper
**Severity**: Medium

---

## Summary

`vikunja_request_user_export` and `vikunja_download_user_export` require the user's Vikunja password as a parameter. When called by an LLM agent, the agent does not know the password — it was only used during initial authentication and is not available in the environment. The tool should fall back to `VIKUNJA_EXPORT_PASSWORD` environment variable when the `password` argument is not explicitly provided.

Additionally, there is **no admin requirement** for export — the API endpoint works for any authenticated user. Error messages suggesting otherwise are misleading.

---

## Expected Behavior

An LLM agent should be able to call `vikunja_request_user_export` and `vikunja_download_user_export` **without** passing a `password` argument:

```
vikunja_request_user_export()
# → Successfully requested data export...
```

The tool should read `process.env.VIKUNJA_EXPORT_PASSWORD` when `password` is not provided in the arguments.

## Actual Behavior

Currently both tools require `password: z.string().min(1)` as a mandatory parameter. When the LLM agent calls the tool without a password, Zod validation fails with a required field error. The LLM then infers incorrect reasons (e.g., "user needs admin privileges", "server limitation") because it has no way to know the password.

---

## Steps to Reproduce

1. Start the MCP with auto-login credentials
2. Call `vikunja_request_user_export` without a password argument
3. Observe the validation error

**Test Data**:
```
VIKUNJA_URL=http://vikunja:3456/api/v1
VIKUNJA_USER=test
VIKUNJA_PASSWORD=secret
```

---

## Error Logs

Direct API test with correct password:
```json
POST /user/export/request {"password":"correct"}
→ 200 {"message":"Successfully requested data export..."}
```

Direct API test with wrong password:
```json
POST /user/export/request {"password":"wrong"}
→ 400 {"code":1011,"message":"Wrong username or password."}
```

This confirms non-admin users CAN export — there is no admin restriction.

---

## Root Cause Analysis

### Wrapper side (already fixed in entrypoint.sh)

The `entrypoint.sh` previously did:
```bash
unset VIKUNJA_PASSWORD  # password lost after auto-login
```

Now it does:
```bash
export VIKUNJA_EXPORT_PASSWORD="${VIKUNJA_PASSWORD}"
unset VIKUNJA_PASSWORD
```

This preserves the password in the MCP process environment under a different variable name.

### MCP side (needs fix)

In `src/tools/export.ts`, both `vikunja_request_user_export` and `vikunja_download_user_export` have:

```typescript
server.tool('vikunja_request_user_export', '...', {
  password: z.string().min(1),  // ← mandatory, no fallback
}, async (args) => {
  const { password } = args;
  // ...
  const httpResponse = await fetch(`${baseUrl}/user/export/request`, {
    body: JSON.stringify({ password }),
  });
```

The fix: make `password` optional and fall back to `process.env.VIKUNJA_EXPORT_PASSWORD`:

```typescript
server.tool('vikunja_request_user_export', '...', {
  password: z.string().min(1).optional(),  // ← optional now
}, async (args) => {
  const password = args.password || process.env.VIKUNJA_EXPORT_PASSWORD;
  if (!password) {
    throw new MCPError(
      ErrorCode.VALIDATION_ERROR,
      'Password is required for export. Pass it as an argument or set VIKUNJA_EXPORT_PASSWORD.',
    );
  }
```

---

## Proposed Solution

### Option A: Environment variable fallback (recommended)

Make `password` optional in the Zod schema. When not provided, read `process.env.VIKUNJA_EXPORT_PASSWORD`:

```typescript
password: z.string().min(1).optional(),

// In the handler:
const password = args.password || process.env.VIKUNJA_EXPORT_PASSWORD;
if (!password) {
  throw new MCPError(ErrorCode.VALIDATION_ERROR,
    'Password is required. Provide it as an argument or set VIKUNJA_EXPORT_PASSWORD.');
}
```

Apply to both:
- `vikunja_request_user_export`
- `vikunja_download_user_export`

### Option B: Skip password check entirely (if Vikunja allows)

Test if the endpoint works without a password when using JWT auth. If yes, remove the password requirement entirely.

**Result from testing**: The Vikunja API returns `"Wrong username or password."` (code 1011) when password is wrong, and doesn't accept empty/null passwords. So the password is mandatory per Vikunja's API.

### Option C: Capture password on `connect`/`login`

When the user calls `vikunja_auth.connect` or `vikunja_auth.login`, the MCP could ask for and cache the password in memory for the session duration. This avoids the environment variable pattern entirely.

More complex but more secure (password stays in MCP process memory, not in env).

---

## Impact

- **Affected endpoints**: `vikunja_request_user_export`, `vikunja_download_user_export`
- **Affected users**: All users trying to export data via the MCP
- **Available workaround**: Pass `password` explicitly in the tool arguments. But the LLM agent has no way to discover this password.
- **Wrapper change**: `entrypoint.sh` already exports `VIKUNJA_EXPORT_PASSWORD` (committed in this PRD's companion PR)

---

## References

- Source: `src/tools/export.ts` — `vikunja_request_user_export` and `vikunja_download_user_export`
- Source: `entrypoint.sh` — now exports `VIKUNJA_EXPORT_PASSWORD`
- Vikunja API: `POST /user/export/request` and `POST /user/export/download` accept `{ password }` body
