# Tasks: fix-alltasks-endpoint

## Review Workload Forecast

| Field                   | Value             |
| ----------------------- | ----------------- |
| Estimated changed lines | 5-10              |
| 400-line budget risk    | Low               |
| Chained PRs recommended | No                |
| Suggested split         | Not needed        |
| Delivery strategy       | single-pr-default |
| Chain strategy          | pending           |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                              | Likely PR | Notes                        |
| ---- | --------------------------------- | --------- | ---------------------------- |
| 1    | Fix endpoint bug and update tests | PR 1      | Fix double `/api/v1` segment |

## Phase 1: Core Implementation

- [x] 1.1 Edit `src/client/VikunjaClientFactory.ts` to update the `getAllTasks` monkey-patch. Change `new URL(\`${baseUrl}/api/v1/tasks\`)` to `new URL(\`${baseUrl.replace(/\/+$/, '')}/tasks\`)`to prevent duplication of the`/api/v1` segment.

## Phase 2: Testing / Verification

- [x] 2.1 Update `tests/client/VikunjaClientFactory.test.ts` to expect the corrected URL (e.g. `https://test.vikunja.com/tasks`) instead of the buggy `https://test.vikunja.com/api/v1/tasks` in the `fetch` mock assertions.
- [x] 2.2 Run `npm run test:coverage` and `npm run test:mcp` to verify the tests pass and the client uses the correct endpoint.
