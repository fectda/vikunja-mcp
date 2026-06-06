## Exploration: fix-unknown-error-handler

### Current State

`SecureErrorHandler.handleStatusCode()` was partially patched recently (June 1) to correctly extract the `.message` property from plain error objects (i.e. `{ statusCode: number, message: string }`). However, the `customMessage` parameter is still only utilized when `statusCode === 404`. For any other status code (e.g., 403, 500), `customMessage` is completely ignored, and the error handler falls back to generating a generic `Failed to {operation}: {sanitized error message}` message.

For instance, in `src/tools/teams.ts`, when a direct API call fails with a non-404 status, it calls `handleStatusCodeError` and passes a descriptive `customMessage` (e.g. `` `Failed to list members for team ${teamId}: ${errorText}` ``). Since the status code is not 404, this `customMessage` is discarded. The handler falls back to `Failed to list team members: {sanitized message}`, which can result in an ugly JSON string or lose context compared to the `customMessage`.

### Affected Areas

- `src/utils/error-handler.ts` — `handleStatusCode` ignores `customMessage` for non-404 errors.
- `src/tools/teams.ts` — Uses `handleStatusCodeError` with descriptive `customMessage`s that get ignored for non-404s.
- `src/tools/export.ts` — Uses `handleStatusCodeError` directly.
- `src/tools/projects/*.ts` — Multiple sharing operations use `handleStatusCodeError`.

### Approaches

1. **Option A: Use `customMessage` for all status codes in `handleStatusCode`**
   Modify `handleStatusCode` to respect `customMessage` for non-404 errors as well. If `customMessage` is provided, we return `new MCPError(ErrorCode.API_ERROR, customMessage)`.
   - Pros: Simple, centralizes the fix in one file. Preserves context provided by the caller.
   - Cons: Callers construct their own `customMessage` using unsanitized API strings (`errorText`). If we forget to sanitize `customMessage` inside `handleStatusCode`, it poses a major security risk.
   - Effort: Low

2. **Option B: Have callers throw `MCPError` directly**
   Instead of using `handleStatusCodeError`, update all callers (e.g., `teams.ts`) to parse the JSON error and throw `MCPError` directly, optionally using `transformApiError`.
   - Pros: Clearer control at the call site.
   - Cons: Requires modifying multiple files and duplicates error handling logic. Bypasses the unified status code logic.
   - Effort: High

3. **Option C: Fix the handler AND sanitize `customMessage`**
   Update `handleStatusCode` to use `customMessage` for all status codes, but ensure `this.sanitize(customMessage)` is applied so we don't accidentally expose sensitive data. We also parse the JSON out of `errorText` if possible to avoid displaying raw JSON to the user.
   - Pros: Most robust. Fixes the issue centrally while maintaining security.
   - Cons: Slightly more complex logic in `error-handler.ts`.
   - Effort: Medium

### Recommendation

**Option C** is recommended. The handler should be updated to respect `customMessage` for all status codes, but it MUST apply `this.sanitize()` to it, because callers currently embed raw API strings (like `errorText`) into the `customMessage`.

### Risks

- **Security Bypass**: If `customMessage` is used without `this.sanitize()`, we risk leaking sensitive details like stack traces or tokens embedded in the API response text.
- **Test Failures**: Modifying the output of `handleStatusCodeError` might break existing tests that assert specific error string formats. We must ensure tests are updated accordingly.

### Ready for Proposal

Yes. The orchestrator can proceed to the `sdd-propose` phase based on Option C.
