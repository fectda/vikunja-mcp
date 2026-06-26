# Proposal: Fix Global Factory Clear on Auth Actions

## Intent

The multi-session-auth change made `AuthManager` and `VikunjaClientFactory` per-session. But `refresh`, `disconnect`, and `login` handlers still call `clearGlobalClientFactory()` which sets the **entire** singleton factory to `null`, destroying cached clients for ALL sessions — not just the calling session. This breaks cross-session isolation in SSE deployments.

## Scope

### In Scope

- Add `cleanupClientFromContext(sessionId?)` to `src/client.ts` that delegates to `VikunjaClientFactory.cleanup(sessionId)`
- Fix `refresh` handler: replace factory destroy+recreate with per-session cleanup
- Fix `disconnect` handler: replace factory destroy w/ per-session cleanup
- Fix `login` handler: replace factory destroy+recreate w/ per-session cleanup
- Update tests to verify cross-session isolation during auth transitions

### Out of Scope

- AuthManager changes (already correct)
- VikunjaClientFactory changes (already has `cleanup(sessionId?)`)
- Other tool handlers (they correctly thread sessionId)

## Capabilities

### New Capabilities

- None — `session-management` spec already covers per-session isolation

### Modified Capabilities

- None — implementation fix only, no spec-level behavior change

## Approach

1. **`src/client.ts`**: Add `cleanupClientFromContext(sessionId?)` that acquires factory mutex, calls `this.clientFactory.cleanup(sessionId)`, releases. Export as convenience function.
2. **`src/client.ts` ClientContext**: Add `cleanupClient(sessionId?)` method delegating to factory.cleanup
3. **`src/tools/auth.ts` refresh** (lines 132-135): Remove 3 global factory calls, replace with `cleanupClientFromContext(sessionId)`
4. **`src/tools/auth.ts` disconnect** (line 162): Replace `clearGlobalClientFactory()` with `cleanupClientFromContext(sessionId)`
5. **`src/tools/auth.ts` login** (lines 204, 210-211): Remove `clearGlobalClientFactory()` and factory recreate calls, add `cleanupClientFromContext(sessionId)` after disconnect

## Affected Areas

| Area                | Impact   | Description                                                                            |
| ------------------- | -------- | -------------------------------------------------------------------------------------- |
| `src/client.ts`     | Modified | Add `cleanupClientFromContext(sessionId?)` + `ClientContext.cleanupClient(sessionId?)` |
| `src/tools/auth.ts` | Modified | All 3 auth handlers: use per-session cleanup instead of global factory destroy         |

## Risks

| Risk                                  | Likelihood | Mitigation                                                                                                         |
| ------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| Missed factory recreate call in login | Low        | Factory is per-session cached; cleanup triggers lazy re-creation on next `getClient()` — no manual recreate needed |
| `cleanup()` removes wrong session     | Low        | SessionId comes from SDK transport UUID, same one threaded through all handlers                                    |
| Null factory after cleanup            | Low        | `cleanup(sessionId)` only deletes map entry, factory instance remains                                              |

## Rollback Plan

1. Revert `src/client.ts` — remove `cleanupClientFromContext()` and `cleanupClient()`
2. Revert `src/tools/auth.ts` — restore `clearGlobalClientFactory()`, `createVikunjaClientFactory()`, `setGlobalClientFactory()` calls
3. Revert test changes

## Dependencies

None — `VikunjaClientFactory.cleanup(sessionId?)` already exists

## Success Criteria

- [ ] `cleanupClientFromContext("alice")` removes only Alice's cached client, Bob's remains valid
- [ ] `refresh` for session A does not invalidate session B's client
- [ ] `disconnect` for session A does not invalidate session B's client
- [ ] `login` for session A does not invalidate session B's client
- [ ] All coverage thresholds maintained (90% branches, 95% lines)
