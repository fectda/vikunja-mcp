# Proposal: Add Team Project Sharing

## Intent

Allow users to share a project with a team (give team access to a project), complementing the existing link sharing functionality. This enables team-based access control where all team members inherit the specified permission level.

## Scope

### In Scope

- New `share-team` subcommand in `vikunja_projects` tool
- Add team to project with permission level (read/write/admin)
- List, get, update, remove team shares on projects
- Integrate with existing project sharing infrastructure

### Out of Scope

- User-based project sharing (different feature)
- Link sharing modifications
- Bulk team sharing operations

## Approach

Based on Vikunja API documentation, projects can be shared with teams via PUT/DELETE on `/projects/{id}/teams/{teamId}`. The permission levels are: 0=Read, 1=Read&Write, 2=Admin.

Implementation will:

1. Add new module `projects/team-sharing.ts` for team sharing operations
2. Add `share-team`, `list-team-shares`, `get-team-share`, `update-team-share`, `remove-team-share` subcommands
3. Integrate with existing response formatting and error handling
4. Add comprehensive tests following TDD (RED→GREEN→REFACTOR)

## Affected Areas

| Area                                 | Impact    | Description                           |
| ------------------------------------ | --------- | ------------------------------------- |
| `src/tools/projects/index.ts`        | Modified  | Register new team sharing subcommands |
| `src/tools/projects/sharing.ts`      | Reference | Follow existing sharing patterns      |
| `src/tools/projects/team-sharing.ts` | New       | Team sharing operations               |
| `tests/tools/projects/`              | New       | Team sharing tests                    |

## Risks

| Risk                                    | Likelihood | Mitigation                              |
| --------------------------------------- | ---------- | --------------------------------------- |
| API endpoint differs from documentation | Medium     | Implement with fallback to direct fetch |
| Node-vikunja lacks team sharing methods | Medium     | Use direct fetch like teams.ts          |

## Rollback Plan

Revert changes to `src/tools/projects/index.ts` and delete `team-sharing.ts`. Team shares remain on server but no longer accessible via MCP.

## Dependencies

- Vikunja API `/projects/{id}/teams/{teamId}` endpoint
- Existing `vikunja_teams` tool for team ID validation

## Success Criteria

- [ ] User can share project with team via `share-team` subcommand
- [ ] User can list team shares on project
- [ ] User can update team share permissions
- [ ] User can remove team share from project
- [ ] All tests pass with 90%+ branches, 95%+ lines coverage
- [ ] Lint and typecheck pass
