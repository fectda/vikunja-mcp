# Deep Dive: fix-projects-update-identifier

## 1. Error Flow Trace

The path of an `update` command with an `identifier` is:

1. **Tool routing:** `src/tools/projects/index.ts` validates the input via Zod. `identifier: z.string().min(1).max(50).optional()` allows the `identifier` field.
2. **CRUD Handler:** `updateProject` in `src/tools/projects/crud.ts` receives the `args`.
3. **Extraction:** It checks for `identifier !== undefined` and adds it to `updateData.identifier = identifier`.
4. **API Call:** It calls `client.projects.updateProject(id, updateData)`.
5. **Error Handler:** If the Vikunja API rejects the identifier (e.g., duplicate, invalid format), it throws an error with a `statusCode` (like 400 or 422). The `catch` block in `updateProject` catches this and calls `handleStatusCodeError(error, 'Failed to update project', id, "Project with ID ${id} not found")`.

## 2. `identifier` Field Verification

- **Schema:** Defined in `src/tools/projects/index.ts` line 109.
- **Handling:** Mapped in `src/tools/projects/crud.ts` lines 83, 359, and 448.
- **Result:** The `identifier` IS definitively forwarded to the API. The PRD hypothesis is completely incorrect.

## 3. "Project with ID not found" Map

The string `Project with ID ${id} not found` is passed as a `customMessage` argument to `handleStatusCodeError` in:

- `src/tools/projects/crud.ts`:
  - Line 226: `getProject`
  - Line 497: `updateProject`
  - Line 544: `deleteProject`
  - Line 617: `archiveProject`
  - Line 690: `unarchiveProject`
- `src/tools/projects/hierarchy.ts`:
  - Line 357: `moveProject`

## 4. `customMessage` Map

- `src/utils/error-handler.ts` defines `handleStatusCodeError`. If `customMessage` is provided, it returns this string for BOTH 404 errors AND any other `statusCode` errors!

## 5. `fix-unknown-error-handler` Impact

The `fix-unknown-error-handler` change modified `error-handler.ts`. The new `SecureErrorHandler.handleStatusCode` contains:

```typescript
if (error.statusCode === 404) {
  if (customMessage) return new MCPError(ErrorCode.NOT_FOUND, this.sanitize(customMessage));
  // ...
}
if (customMessage) {
  return new MCPError(ErrorCode.API_ERROR, this.sanitize(customMessage));
}
```

This causes ANY API error with a status code (e.g., 400 Bad Request, 403 Forbidden) to return the `customMessage` ("Project with ID ... not found") if provided, entirely masking the actual validation error text from Vikunja!

## 6. `projects-update-bug` Overlap

I checked the `projects-update-bug` archive/active specs. It dealt with `parentProjectId` and hierarchy depth checks. It did not address `identifier` or the `customMessage` error masking bug.

## 7. Test Evidence

`tests/tools/projects.test.ts` line 457 tests updating `identifier` and it passes. Why? Because the test suite mocks `mockClient.projects.updateProject.mockResolvedValue(updatedProject)`.
For API error tests (line 568), it mocks `new Error('API Error')` without a `.statusCode` property. Because the mocked error lacks `.statusCode`, `error-handler.ts` falls back to `Failed to update project: API Error` rather than triggering the masked `customMessage` branch. Thus, the tests passed but failed to simulate real Vikunja API 400/422 responses.

## 8. Root Cause Conclusion

The real root cause is **Error Masking**. The `identifier` field is correctly validated and sent to the API. However, if the API rejects it (e.g. 400 Bad Request), `node-vikunja` throws an error containing `.statusCode = 400`. The catch block calls `handleStatusCodeError` with a hardcoded `customMessage` of `"Project with ID ${id} not found"`. The `error-handler.ts` unconditionally uses this `customMessage` for all status code errors. As a result, users receive "Project not found" instead of the actual API validation error (like "Identifier already exists").

## 9. Proposed Fix

**Option A: Remove `customMessage` arguments** (Recommended)
Remove the 4th argument (`customMessage`) from all calls to `handleStatusCodeError` in `crud.ts` and `hierarchy.ts`. The error handler already automatically generates `"Project with ID ${id} not found"` for 404s natively (see `error-handler.ts` lines 149-155), and will correctly extract the real API error string for 400/500 errors if `customMessage` is absent.
**Option B: Fix `error-handler.ts`**
Change `handleStatusCodeError` to ONLY use `customMessage` when `statusCode === 404`. However, Option A is better because the fallback logic in `error-handler.ts` already generates exact 404 messages perfectly.

## 10. Open Questions

- Do we need to update the mock tests in `projects.test.ts` to include `.statusCode = 400` in their simulated API errors to prevent regressions? (Yes, highly recommended).
