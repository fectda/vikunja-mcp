# Proposal: fix-projects-update-identifier

## Intent

The `projects.update` (and other subcommands) currently mask actual API validation errors (e.g. 400 Bad Request for an invalid/duplicate `identifier`). This happens because hardcoded "Project with ID not found" messages are passed as `customMessage` to `handleStatusCodeError`, which intercepts any non-404 API error and hides it behind this misleading 404-like text. Removing this hardcoded message allows the real API error to surface.

## Scope

### In Scope

- Remove the hardcoded `customMessage` argument from 5 calls to `handleStatusCodeError` in `src/tools/projects/crud.ts`.
- Remove the hardcoded `customMessage` argument from 1 call to `handleStatusCodeError` in `src/tools/projects/hierarchy.ts`.
- Update tests in `tests/tools/projects.test.ts` to accommodate the error message changes for real API errors.

### Out of Scope

- Modifying `src/utils/error-handler.ts` itself (it's correct after `fix-unknown-error-handler`).
- Adding fields to Zod schemas (the `identifier` field is already there and mapped).

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- None

## Approach

Remove the 4th argument (`customMessage`) from `handleStatusCodeError` calls in `src/tools/projects/crud.ts` (for `getProject`, `updateProject`, `deleteProject`, `archiveProject`, and `unarchiveProject`) and `src/tools/projects/hierarchy.ts` (for `moveProject`). The `error-handler.ts` fallback already automatically generates `"Project with ID {id} not found"` for actual 404s when no `customMessage` is provided.

## Affected Areas

| Area                              | Impact   | Description                                           |
| --------------------------------- | -------- | ----------------------------------------------------- |
| `src/tools/projects/crud.ts`      | Modified | Removed `customMessage` from error handler            |
| `src/tools/projects/hierarchy.ts` | Modified | Removed `customMessage` from error handler            |
| `tests/tools/projects.test.ts`    | Modified | Update mocks/expectations to match new error messages |

## Risks

| Risk                      | Likelihood | Mitigation                                                                                                                                             |
| ------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Test suite failures       | High       | Update tests that mock old API errors to ensure they simulate proper `.statusCode = 400` errors or expect the new dynamic error messages.              |
| External scripts breaking | Low        | Any script incorrectly parsing "Project with ID not found" when submitting invalid identifiers will break, but fixing this is the point of the change. |

## Rollback Plan

Revert the commits removing the `customMessage` arguments and restore the test expectations to their previous states.

## Dependencies

- None

## Success Criteria

- [ ] Updating a project with an invalid/duplicate `identifier` returns the REAL API error instead of a fake 404.
- [ ] Updating or retrieving a project with a non-existent ID still returns a correct 404 error ("Project with ID {id} not found").
- [ ] All tests pass successfully.

> Note: The original PRD hypothesis (that `identifier` was missing from the Zod schema) was incorrect; this proposal fixes the actual bug (error masking).
