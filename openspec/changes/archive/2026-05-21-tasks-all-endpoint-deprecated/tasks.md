# Tasks: tasks-all-endpoint-deprecated

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

Not needed (Low risk).

## Phase 1: Core Implementation

- [x] 1.1 In `src/client/VikunjaClientFactory.ts`, update `getClient()` to intercept the instantiated `this.clientInstance`.
- [x] 1.2 In `src/client/VikunjaClientFactory.ts`, monkey-patch `this.clientInstance.tasks.getAllTasks` so it overrides the default behavior.
- [x] 1.3 In the monkey-patched `getAllTasks` function, construct a URL pointing to `${this.currentApiUrl}/api/v1/tasks` (or correct base URL path).
- [x] 1.4 In the monkey-patched `getAllTasks` function, append any passed query parameters (`filter`, `sort_by`, `page`, etc.) to the URL as `URLSearchParams`.
- [x] 1.5 In the monkey-patched `getAllTasks` function, use global `fetch` with the `Authorization: Bearer ${this.currentApiToken}` header.
- [x] 1.6 In the monkey-patched `getAllTasks` function, parse the JSON response and return the tasks array as a `Promise<Task[]>`.

## Phase 2: Testing

- [x] 2.1 In `tests/client/VikunjaClientFactory.test.ts`, add a test to verify `getClient()` returns a client with a patched `tasks.getAllTasks` method.
- [x] 2.2 In `tests/client/VikunjaClientFactory.test.ts`, add a test to ensure `getAllTasks` calls `fetch` with the correct `/tasks` URL, query parameters, and Authorization header.
- [x] 2.3 Run existing test suites (`npm run test:coverage`) to verify the mock behavior is covered and thresholds remain met.
