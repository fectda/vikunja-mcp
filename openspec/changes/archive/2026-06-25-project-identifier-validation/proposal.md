# Proposal: Project Identifier Validation

## Intent

Two bugs degrade the project update UX: (1) Zod accepts identifiers up to 50 chars, but Vikunja's API rejects anything > 10 chars with a cryptic "Invalid Data" error; (2) the error handler's `Failed to` prefix doubles because the caller already prefixes it, producing `"Failed to Failed to update project: Invalid Data"`.

Fix both so users get clear, immediate feedback instead of confusing API errors.

## Scope

### In Scope

- Change Zod `identifier` schema from `.max(50)` to `.max(10)` in `src/tools/projects/index.ts`
- Fix double-prefix error message in `src/tools/projects/crud.ts` line 488
- Update/add tests for the 10-char limit and the error message fix

### Out of Scope

- Adding identifier validation to `validateProjectData()` in `validation.ts` (Zod schema is sufficient; API returns the same error for other field issues)
- Applying the same Zod fix to other tools (only project identifier has this mismatch)
- Changing the shared `error-handler.ts` behavior (the fix is caller-local)

## Capabilities

### Modified Capabilities

- `project-tools`: Zod validation for `identifier` changes from 50-char max to 10-char max; update error message for the `update` subcommand no longer double-prefixes

### New Capabilities

None

## Approach

1. **Zod fix**: Change `z.string().min(1).max(50)` → `z.string().min(1).max(10)` on line 127 of `index.ts`. Users now get a clear `VALIDATION_ERROR` before the API call.
2. **Error message fix**: Change `handleStatusCodeError(error, 'Failed to update project', id)` → `handleStatusCodeError(error, 'update project', id)` at `crud.ts:488`. The handler already adds `Failed to `.
3. **Tests**: Update existing update-project tests to verify the 10-char rejection and the correct error message format.

## Affected Areas

| Area                              | Impact   | Description                                |
| --------------------------------- | -------- | ------------------------------------------ |
| `src/tools/projects/index.ts:127` | Modified | Zod max from 50 → 10                       |
| `src/tools/projects/crud.ts:488`  | Modified | Remove redundant `Failed to ` prefix       |
| `tests/tools/projects/`           | Modified | Coverage for 10-char limit + error message |

## Risks

| Risk                                               | Likelihood | Mitigation                                                                   |
| -------------------------------------------------- | ---------- | ---------------------------------------------------------------------------- |
| Existing identifiers > 10 chars exist in user data | Low        | API already rejects them; Zod only adds earlier detection                    |
| Error message regression for other update failures | Low        | The change removes only the redundant prefix — message format stays the same |

## Rollback Plan

Revert `index.ts:127` to `.max(50)` and `crud.ts:488` to `'Failed to update project'`. Both are single-line changes.

## Dependencies

None.

## Success Criteria

- [ ] Zod rejects identifiers > 10 chars with `VALIDATION_ERROR` before the API call
- [ ] Update error message reads `"Failed to update project: <reason>"` (no double prefix)
- [ ] All existing tests pass, new tests cover the 10-char limit
- [ ] `npm run test:coverage` still meets 90% branches, 95% lines
