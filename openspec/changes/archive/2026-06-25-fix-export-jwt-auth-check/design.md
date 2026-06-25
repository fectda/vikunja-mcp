# Design: Add JWT Auth Guard to User Export Tools

## Technical Approach

Add the same JWT auth guard already present in `vikunja_export_project` to `vikunja_request_user_export` and `vikunja_download_user_export`. The guard checks `authManager.getAuthType() !== 'jwt'` before any API call and throws `MCPError(ErrorCode.PERMISSION_DENIED, ...)` with the same error message used in the sister tool. The spec requires this for both user export endpoints.

## Architecture Decisions

| Decision                  | Choice                                         | Alternatives                                 | Rationale                                                                                               |
| ------------------------- | ---------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Guard placement           | Before `try` block in handler                  | Inside `try` / before `getClientFromContext` | Matches existing `vikunja_export_project` pattern exactly — fail-fast before any I/O                    |
| Error message             | Reuse same message as `vikunja_export_project` | Custom message per tool                      | Consistent UX for all export tools; user gets one clear instruction regardless of which export they try |
| Guard location in handler | Top of handler, before password validation     | After password validation                    | Fail-fast: if auth is wrong, don't make user provide a password that will never be used                 |
| Test pattern              | Re-register tool with API token mock           | Conditional mock injection                   | Follows existing test pattern from `vikunja_export_project` auth tests (lines 86-102)                   |

## Data Flow

```
MCP Tool Call (vikunja_request_user_export / vikunja_download_user_export)
  │
  ├─ authManager.getAuthType() !== 'jwt'?
  │     YES → throw PERMISSION_DENIED ← NEW GUARD
  │     NO  → continue
  │
  ├─ Password validation (existing)
  ├─ getClientFromContext() (existing)
  ├─ Direct API call (existing)
  └─ Response formatting (existing)
```

## File Changes

| File                         | Action | Description                                                                                                                                   |
| ---------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/tools/export.ts`        | Modify | Add JWT auth guard before `try` block in `vikunja_request_user_export` (before line 214) and `vikunja_download_user_export` (before line 296) |
| `tests/tools/export.test.ts` | Modify | Add 2 test cases under each tool's describe block: one for API token rejection, one for JWT success (verify existing behavior preserved)      |

## Interfaces / Contracts

No new interfaces. The guard reuses the existing `AuthManager.getAuthType()` → `'jwt' | 'api-token'` contract:

```typescript
// Existing pattern — already in src/tools/export.ts line 146-152
if (authManager.getAuthType() !== 'jwt') {
  throw new MCPError(
    ErrorCode.PERMISSION_DENIED,
    'Export operations require JWT authentication. Please reconnect using vikunja_auth.connect with JWT authentication.',
  );
}
```

## Testing Strategy

| Layer | What to Test                                          | Approach                                                                                |
| ----- | ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Unit  | `vikunja_request_user_export` rejects API token auth  | Register tool with `getAuthType: 'api-token'`, call handler, expect `PERMISSION_DENIED` |
| Unit  | `vikunja_download_user_export` rejects API token auth | Same pattern as above for download endpoint                                             |
| Unit  | Both tools still work with JWT auth                   | Existing tests already verify this — just confirm they don't regress                    |

**TDD sequence**: Write failing auth-rejection tests first, then add guard to handler, verify all existing tests still pass.

## Migration / Rollout

No migration required. Single commit, single file change (plus tests).

## Open Questions

- None. The change is well-defined, the pattern is already established in the same file.
