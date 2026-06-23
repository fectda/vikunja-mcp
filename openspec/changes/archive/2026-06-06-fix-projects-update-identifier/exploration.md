# Exploration: fix-projects-update-identifier

## Current State

The PRD states that updating a project's `identifier` fails with `Project with ID [id] not found`, and hypothesizes that `identifier` is missing from the Zod schema, causing an empty payload.

However, an inspection of the codebase reveals that `identifier` is **already present** in the Zod schema and correctly processed:

1. `src/tools/projects/index.ts` (Lines 109, 303): `identifier: z.string().min(1).max(50).optional()` is defined in the schema.
2. `src/tools/projects/crud.ts` (Lines 83, 359, 448): `identifier` is correctly extracted from `args` and added to the `updateData` payload payload.
3. `tests/tools/projects.test.ts` (Lines 458-474): Tests explicitly confirm that `identifier` is passed to the API client during an update.

When an update fails in Vikunja (e.g., due to an invalid or duplicate identifier), the API returns a 400 Bad Request or 422 Unprocessable Entity. This error is caught in `crud.ts` (Line 493) and passed to `handleStatusCodeError`.

## Root Cause

The real issue is **not** a missing field in the Zod schema, but a **flaw in the error handling logic** that masks API validation errors.

1. In `src/tools/projects/crud.ts`, the `updateProject` function wraps API errors using `handleStatusCodeError` and passes a hardcoded `customMessage`: `"Project with ID ${id} not found"`.
2. A recent change (`fix-unknown-error-handler`) updated `src/utils/error-handler.ts` so that `handleStatusCodeError` unconditionally uses the `customMessage` for **all** status code errors, not just 404s.
3. Therefore, when the Vikunja API rejects an `identifier` update with a 400 error, `handleStatusCodeError` incorrectly masks it with the hardcoded 404-style message (`Project with ID [id] not found`). The user never sees the actual validation error.

## Related Work

- The recent `fix-unknown-error-handler` change modified how `customMessage` behaves in `handleStatusCodeError`, introducing this masking issue.
- The `projects-update-bug` spec primarily addressed `parentProjectId` validation and hierarchy depth checks; it does not overlap with the `identifier` validation or the error-masking bug.

## Proposed Fix Shape

1. Remove the hardcoded `customMessage` strings (`"Project with ID ${id} not found"`) from all calls to `handleStatusCodeError` in `src/tools/projects/crud.ts` and `src/tools/projects/hierarchy.ts`.
2. Rely on `handleStatusCodeError`'s built-in 404 logic, which automatically generates `"Project with ID [id] not found"` dynamically using the provided `resourceId` when a genuine 404 occurs.
3. Allow non-404 errors (like 400 validation errors) to surface their actual API error messages to the user.

## Affected Files

- `src/tools/projects/crud.ts` (Lines 226, 497, 544, 617, 690) - Remove `customMessage` arguments.
- `src/tools/projects/hierarchy.ts` (Line 357) - Remove `customMessage` argument.
- `tests/tools/projects.test.ts` - Update tests to assert that non-404 API errors are no longer masked as 404s.

## Test Strategy

- Update existing API error tests in `projects.test.ts` to simulate a `400 Bad Request` and assert that the error message contains the API's validation message, rather than a "not found" message.
- Verify that genuine `404 Not Found` errors still return the correct `"Project with ID [id] not found"` message via `handleStatusCodeError`'s fallback logic.

## Risks

- Tests might currently rely on the masking behavior (i.e., expecting "Project not found" for any mocked error). Test expectations will need to be updated.

## Open Questions

- Does the Vikunja API enforce specific format constraints on `identifier` that we should pre-validate in `crud.ts` to fail faster? (Usually, it's safer to let the upstream API handle this validation, which will now surface correctly once the error masking is fixed).

## Ready for Proposal

Yes. The orchestrator should be informed that the PRD's hypothesis about the Zod schema is incorrect, and the true fix involves correcting the error-masking logic in `crud.ts`.
