# Proposal: Fix Pre-Existing Test Failures

## Intent

Two tests in `tests/tools/index.test.ts` assert OLD registration behavior — that `registerUsersTool` and `registerExportTool` are NOT called for API-token or unauthenticated scenarios. Commit `b9bc781` intentionally changed `src/tools/index.ts` to register these tools unconditionally when `clientFactory` is available (auth is enforced per-method at runtime to avoid a race condition). The tests were never updated, producing false negatives.

## Scope

### In Scope

- Update test "should register all tools except users and export when using API token auth with clientFactory" to assert positive calls + rename
- Update test "should not register users and export tools when not authenticated with clientFactory" to assert positive calls + rename
- Update associated comments to reflect unconditional registration

### Out of Scope

- No changes to production code (`src/tools/index.ts`)
- No changes to handler-level auth tests (already correct)
- No changes to other test files or specs

## Capabilities

> No spec-level changes — this is a test-only fix updating assertions to match existing code behavior.

### New Capabilities

None

### Modified Capabilities

None

## Approach

For each of the 2 stale tests:

1. Change `expect(registerUsersTool).not.toHaveBeenCalled()` → `expect(registerUsersTool).toHaveBeenCalledTimes(1)` with proper argument matchers
2. Same for `registerExportTool`
3. Rename test descriptions and update comments to reflect that registration is unconditional (auth is runtime, not registration-time)

## Affected Areas

| Area                        | Impact   | Description                                |
| --------------------------- | -------- | ------------------------------------------ |
| `tests/tools/index.test.ts` | Modified | 2 test blocks: assertions, names, comments |

## Risks

| Risk                                         | Likelihood | Mitigation                                                             |
| -------------------------------------------- | ---------- | ---------------------------------------------------------------------- |
| Overlooked test still asserting old behavior | Low        | `npm test` confirms all pass after changes                             |
| Handler-level auth tests broken              | None       | Not changed — already verified in `users.test.ts` and `export.test.ts` |

## Rollback Plan

`git checkout -- tests/tools/index.test.ts` restores the original stale tests. The commit itself is also fully revertible.

## Dependencies

None.

## Success Criteria

- [ ] `npm test` passes with 0 failures
- [ ] `npm run test:coverage` meets thresholds (branches >= 90%, lines >= 95%)
- [ ] `npm run typecheck` passes
- [ ] Handler-level auth coverage in `users.test.ts` and `export.test.ts` still passes
