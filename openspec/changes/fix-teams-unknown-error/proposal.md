# Proposal: Fix Teams Unknown Error

## Intent

The `vikunja_teams` tool (specifically the `members` subcommand and others) currently swallows actual API errors (like 404 Not Found or 403 Forbidden) and returns a generic "Unknown error" message. This happens because `SecureErrorHandler.handleStatusCode()` only extracts messages from `Error` instances, strings, and specifically handles 404s, but fails to extract the `.message` property from plain error objects for non-404 status codes. We need to fix this handler so that descriptive API errors are surfaced to the user.

## Scope

### In Scope

- Modify `SecureErrorHandler.handleStatusCode()` to extract the `message` property from plain objects.
- Ensure `customMessage` is used (when provided) for all status codes, not just 404s.

### Out of Scope

- Refactoring the entire error handling architecture.
- Changing all tool callers to throw `Error` instances instead of plain objects (Option B from PRD).

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- None

## Approach

We will implement Option A from the PRD. In `src/utils/error-handler.ts`:

1. In `handleStatusCode()`, modify the `if (this.isStatusCodeError(error))` block to use the `customMessage` for all status codes if it is provided, rather than just 404s.
2. In the fallback branch of `handleStatusCode()`, add a check: `else if (error && typeof error === 'object' && 'message' in error)` to extract the message from plain error objects.

## Affected Areas

| Area                         | Impact   | Description                                                                                        |
| ---------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `src/utils/error-handler.ts` | Modified | `handleStatusCode` method will accurately parse plain object messages and utilize `customMessage`. |

## Risks

| Risk                        | Likelihood | Mitigation                                                                                                                                                        |
| --------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unintended message exposure | Low        | The `sanitize()` method will still run on extracted messages, ensuring no secure info is leaked.                                                                  |
| Breaking other tools        | Low        | The change only affects the generic fallback branch which currently defaults to "Unknown error". Extracting a string where one exists is strictly an improvement. |

## Rollback Plan

Revert the changes in `src/utils/error-handler.ts` to restore the strict `Error` instance or `string` type check, defaulting back to 'Unknown error'.

## Dependencies

- None

## Success Criteria

- [ ] Calling `vikunja_teams` with a non-existent team ID returns a descriptive error (e.g., "Team with ID 999999 not found") instead of "Unknown error".
- [ ] Non-404 API errors (like 403 Forbidden) are properly extracted and displayed to the user via the `customMessage` or the object's `message` property.
- [ ] All tests in the test suite pass, specifically error handling and teams tests.
