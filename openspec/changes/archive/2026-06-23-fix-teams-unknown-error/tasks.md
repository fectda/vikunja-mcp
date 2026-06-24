# Tasks: Fix Teams Unknown Error

## Review Workload Forecast

| Field                   | Value             |
| ----------------------- | ----------------- |
| Estimated changed lines | ~20-50 lines      |
| 400-line budget risk    | Low               |
| Chained PRs recommended | No                |
| Suggested split         | single PR         |
| Delivery strategy       | single-pr-default |
| Chain strategy          | pending           |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                                                                                 | Likely PR | Notes                                  |
| ---- | ------------------------------------------------------------------------------------ | --------- | -------------------------------------- |
| 1    | Fix `handleStatusCode` plain object message extraction and `customMessage` prefixing | PR 1      | Base branch: main; includes unit tests |

## Phase 1: Core Implementation

- [x] 1.1 Update `SecureErrorHandler.handleStatusCode` in `src/utils/error-handler.ts` to extract `.message` from plain objects (`typeof error === 'object' && error !== null`).
- [x] 1.2 Update `SecureErrorHandler.handleStatusCode` in `src/utils/error-handler.ts` to combine `customMessage` with the actual API error (e.g. `${customMessage}: ${sanitizedAPIError}`) instead of ignoring it for non-404 status codes.

## Phase 2: Testing

- [x] 2.1 Write unit test in `tests/utils/error-handler.test.ts` to verify `handleStatusCode` extracts message from plain object like `{ statusCode: 500, message: "Teams error" }`.
- [x] 2.2 Write unit test in `tests/utils/error-handler.test.ts` to verify `handleStatusCode` uses `customMessage` as prefix for non-404 errors.
- [x] 2.3 Verify existing fallback tests for "Unknown error" still pass.
