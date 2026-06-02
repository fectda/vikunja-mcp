# Proposal: Consolidate Tools and Descriptions

## Intent

The current MCP server exposes too many tools (24), many of which are duplicates for the same entity (e.g., `vikunja_tasks` vs `vikunja_tasks_assignees`). This creates context bloat for LLMs using the MCP server. We need to consolidate duplicate entity tools under their primary master tools, migrate the previously missing team-sharing subcommands into the master `vikunja_projects` tool, and rewrite all surviving tool descriptions to cleanly follow a "What + When + Returns" format.

## Scope

### In Scope

- Remove 7 duplicate task tool registrations (crud, assignees, bulk, comments, labels, relations, reminders).
- Remove 3 duplicate project tool registrations from `src/tools/projects/index.ts` (crud, hierarchy, sharing).
- Remove `vikunja_projects_team_sharing` tool registration and migrate its 5 subcommands into `vikunja_projects` (`share-team`, `list-team-shares`, `get-team-share`, `update-team-share`, `remove-team-share`).
- Rewrite descriptions for all 13 surviving tools using the "What + When + Returns" format.
- Add schema `required` annotations where possible.
- Update tests referencing removed duplicate tools to use master tools instead.

### Out of Scope

- Changing underlying handler logic (only removing registration boilerplate).
- Modifying helper modules (`src/tools/projects/crud.ts`, `hierarchy.ts`, `sharing.ts`).
- Adding new features or subcommands beyond the team-sharing migration.
- Changes to authentication logic or structure.

## Capabilities

> This section is the CONTRACT between proposal and specs phases.
> The sdd-spec agent reads this to know exactly which spec files to create or update.
> Research `openspec/specs/` before filling this in.

### New Capabilities

- `tool-consolidation`: Consolidates duplicate entity-specific MCP tools under unified master tools to reduce context bloat, migrating any orphaned subcommands to ensure feature parity.
- `tool-metadata`: Standardizes tool descriptions to a "What + When + Returns" format and ensures parameters have `required` annotations.

### Modified Capabilities

- None

## Approach

1.  **Migration & Consolidation**: First, move the 5 team-sharing subcommands from `vikunja_projects_team_sharing` into the main `vikunja_projects` registration in `src/tools/projects/index.ts`.
2.  **Cleanup**: Delete the redundant tool registrations for both tasks (7 files) and projects (3 registrations inside `src/tools/projects/index.ts` and the registration inside `src/tools/projects/team-sharing.ts`). Keep all the underlying handler logic and import it correctly.
3.  **Metadata Enhancement**: For the 13 surviving tools across the project, rewrite their descriptions and verify/add `required` annotations in their Zod schemas.
4.  **Test Updates**: Search for and update all tests that reference the old duplicate tool names (e.g., `vikunja_tasks_assignees`) to use the new master tool names (e.g., `vikunja_tasks`). Ensure no references to non-existent tests (like `mcp-integration.test.js`) are handled incorrectly.

## Affected Areas

| Area                                 | Impact   | Description                                                                               |
| ------------------------------------ | -------- | ----------------------------------------------------------------------------------------- |
| `src/tools/projects/index.ts`        | Modified | Migrate team-sharing subcommands, remove redundant project tool registrations.            |
| `src/tools/projects/team-sharing.ts` | Modified | Remove tool registration, export only handler logic.                                      |
| `src/tools/tasks/*.ts`               | Modified | Remove tool registrations for the 7 duplicate task tools, keeping only the handler logic. |
| `src/tools/**/*.ts`                  | Modified | Update descriptions for all 13 surviving tools and add `required` schema annotations.     |
| `tests/**/*.test.ts`                 | Modified | Update tool name references from duplicates to master tools.                              |

## Risks

| Risk                               | Likelihood | Mitigation                                                                                      |
| ---------------------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| Team-sharing functionality is lost | Low        | Explicitly migrating the 5 subcommands into `vikunja_projects` and verifying through tests.     |
| Handler logic accidentally deleted | Low        | Careful removal of only the `server.tool(...)` boilerplate while retaining functions.           |
| Tests fail due to name mismatch    | Medium     | Thorough global search for old tool names and updating to the master tool names in test setups. |

## Rollback Plan

Revert the Git commits associated with this consolidation change. No database schema changes or data migrations are involved, so a standard Git revert on the codebase is fully sufficient to restore the previous 24-tool state.

## Dependencies

- None

## Success Criteria

- [ ] The MCP server exposes exactly 13 tools (down from 24).
- [ ] `vikunja_projects` includes `share-team`, `list-team-shares`, `get-team-share`, `update-team-share`, and `remove-team-share` subcommands.
- [ ] All tool descriptions follow the "What + When + Returns" format.
- [ ] All test suites pass successfully.
