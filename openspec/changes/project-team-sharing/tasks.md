# Tasks: Project Team Sharing

## Phase 1: Foundation (Types & Validation)

- [x] 1.1 Add `teamId` to zod schema in `src/tools/projects/index.ts`
- [x] 1.2 Add `right` enum supporting string ('read','write','admin') and numeric (0,1,2)

## Phase 2: Core Implementation (team-sharing.ts)

- [x] 2.1 Create `src/tools/projects/team-sharing.ts` module
- [x] 2.2 Implement `shareTeam()` - PUT /projects/{id}/teams/{teamId}
- [x] 2.3 Implement `listTeamShares()` - GET /projects/{id}/teams
- [x] 2.4 Implement `getTeamShare()` - GET /projects/{id}/teams/{teamId}
- [x] 2.5 Implement `updateTeamShare()` - PUT /projects/{id}/teams/{teamId}
- [x] 2.6 Implement `removeTeamShare()` - DELETE /projects/{id}/teams/{teamId}

## Phase 3: Integration (Tool Registration)

- [x] 3.1 Add 'share-team', 'list-team-shares', 'get-team-share', 'update-team-share', 'remove-team-share' to subcommand enum
- [x] 3.2 Add handler cases in switch statement for each new subcommand
- [x] 3.3 Import team-sharing functions and types in index.ts

## Phase 4: Testing (TDD - Write Tests First)

- [x] 4.1 RED: Create `tests/tools/projects/team-sharing.test.ts` with failing tests for share-team
- [x] 4.2 RED: Add failing tests for list-team-shares, get-team-share, update-team-share, remove-team-share
- [x] 4.3 RED: Add failing validation tests (teamId required, invalid right values)
- [x] 4.4 GREEN: Implement team-sharing.ts to pass all tests
- [x] 4.5 GREEN: Update index.ts to pass integration tests
- [x] 4.6 REFACTOR: Verify 90%+ branches, 95%+ lines coverage (all project tests pass)

## Phase 5: Cleanup

- [x] 5.1 Run lint and typecheck - all must pass
- [x] 5.2 Update proposal success criteria to verified state
