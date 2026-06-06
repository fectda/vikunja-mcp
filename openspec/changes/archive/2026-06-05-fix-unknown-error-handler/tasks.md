# Tasks: fix-unknown-error-handler

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

Not needed (change is ~10 lines, well within budget).

## Phase 1: Core Implementation

- [x] 1.1 Modify `handleStatusCode` in `src/utils/error-handler.ts` to return an `API_ERROR` with `customMessage` for non-404 status codes.
- [x] 1.2 Apply `this.sanitize()` to `customMessage` in the new block.

## Phase 2: Testing / Verification

- [x] 2.1 Add unit tests in `tests/utils/error-handler.test.ts` for 403 and 500 errors with `customMessage` (including sanitization check).
- [x] 2.2 Verify the existing 404 logic remains intact.
- [x] 2.3 Run `npm run test:coverage` and ensure metrics meet repository thresholds.
