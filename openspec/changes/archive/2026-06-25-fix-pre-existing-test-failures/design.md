# Design: Fix Pre-Existing Test Failures

## Technical Approach

Test-only fix: update 2 stale test blocks in `tests/tools/index.test.ts` where assertions use `not.toHaveBeenCalled()` for `registerUsersTool` and `registerExportTool`. The production code (`src/tools/index.ts`, commit `b9bc781`) registers these tools unconditionally when `clientFactory` is available, because auth is enforced per-method at runtime (avoids an async race condition where auth is established after tool registration). Fix: flip assertions to `toHaveBeenCalledTimes(1)`, rename tests, and update comments.

## Architecture Decisions

| Option                                                                  | Tradeoff                                                                                        | Decision                                                                                   |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `toHaveBeenCalledTimes(1)` + arg matchers vs. just `toHaveBeenCalled()` | Arg matchers verify contract; bare call check is weaker                                         | `toHaveBeenCalledTimes(1)` with `toHaveBeenCalledWith(server, authManager, clientFactory)` |
| Rename tests vs. keep old names                                         | Old names describe wrong behavior (users/export excluded by auth); new names must match reality | Rename both tests to describe "all tools registered" behavior                              |
| Add mock-verification comments vs. leave as-is                          | Comments explain WHY registration is unconditional (runtime auth, not registration-time)        | Update inline comments to reference runtime auth enforcement                               |

## Data Flow

No data flow changes — this is a test-only assertion fix. The registration flow remains:

```
registerTools(server, authManager, clientFactory)
  → registerAuthTool(server, authManager)           // always
  → registerTasksTool(server, authManager, client)   // always
  → if (clientFactory):
       registerProjectsTool(...)                     // always when client
       registerUsersTool(...)                        // unconditional (runtime auth)
       registerExportTool(...)                       // unconditional (runtime auth)
```

## File Changes

| File                        | Action | Description                                                                                 |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| `tests/tools/index.test.ts` | Modify | Lines 114–186 (test 1) and 272–343 (test 2): flip assertions, rename tests, update comments |

## Interfaces / Contracts

No interface changes. The test already imports the correct mocked modules with `jest.mock`. Only assertion expectations change.

## Testing Strategy

| Layer      | What to Test                                                                                       | Approach                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Unit       | `registerUsersTool` and `registerExportTool` are called in API-token and unauthenticated scenarios | `expect(registerUsersTool).toHaveBeenCalledTimes(1)` with argument matchers |
| Regression | All other tests still pass                                                                         | `npm test` and `npm run test:coverage`                                      |

No new tests needed — fixing existing assertions is sufficient.

## Migration / Rollout

No migration required. Single commit with `test:` prefix.

## Open Questions

None.
