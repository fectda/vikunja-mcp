# Tasks: Consolidate Tools and Descriptions

## Review Workload Forecast

| Field                   | Value                                                                 |
| ----------------------- | --------------------------------------------------------------------- |
| Estimated changed lines | ~400                                                                  |
| 400-line budget risk    | Medium                                                                |
| Chained PRs recommended | Yes                                                                   |
| Suggested split         | PR 1 (Tasks) → PR 2 (Projects) → PR 3 (Descriptions) → PR 4 (Schemas) |
| Delivery strategy       | force-chained                                                         |
| Chain strategy          | stacked-to-main                                                       |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal                                             | Likely PR | Notes                    |
| ---- | ------------------------------------------------ | --------- | ------------------------ |
| 1    | Remove duplicate task tools and update tests     | PR 1      | base branch: main        |
| 2    | Consolidate project tools & migrate team-sharing | PR 2      | base branch: PR 1 branch |
| 3    | Rewrite 13 tool descriptions                     | PR 3      | base branch: PR 2 branch |
| 4    | Add schema required annotations                  | PR 4      | base branch: PR 3 branch |

## Phase 1: Task Tools Consolidation

- [ ] 1.1 Remove `server.tool(...)` registrations from `src/tools/task-crud.ts`, `task-assignees.ts`, `task-bulk.ts`, `task-comments.ts`, `task-labels.ts`, `task-relations.ts`, `task-reminders.ts`. Ensure handler functions remain exported.
- [ ] 1.2 Update `src/tools/index.ts` to stop importing and registering the 7 task duplicate tools.
- [ ] 1.3 Find and replace references to old task duplicate tools in integration tests and `tests/tools/task-*.test.ts`, changing them to use `vikunja_tasks` with the corresponding `subcommand`.
- [ ] 1.4 Run `npm run test:coverage` and `npm run lint` to ensure Phase 1 is green.

## Phase 2: Project Tools Consolidation

- [ ] 2.1 Remove tool registrations for `vikunja_projects_crud`, `vikunja_projects_hierarchy`, and `vikunja_projects_sharing` inside `src/tools/projects/index.ts`.
- [ ] 2.2 Remove `server.tool(...)` registration for `vikunja_projects_team_sharing` in `src/tools/projects/team-sharing.ts`, keeping the handlers exported.
- [ ] 2.3 Update `src/tools/index.ts` to remove the `registerProjectTeamSharingTool` import and registration.
- [ ] 2.4 Add `teamId: z.number().positive().optional()` to the args schema of `vikunja_projects` in `src/tools/projects/index.ts`.
- [ ] 2.5 Add `share-team`, `list-team-shares`, `get-team-share`, `update-team-share`, and `remove-team-share` to the `subcommand` enum in `vikunja_projects`.
- [ ] 2.6 Add a switch case in `vikunja_projects` to route these 5 subcommands to their respective handlers in `team-sharing.ts`.
- [ ] 2.7 Update tests referencing the 4 removed project tools to use `vikunja_projects` with the correct subcommand. Run tests.

## Phase 3: Rewrite Descriptions

- [ ] 3.1 Update the description string for `vikunja_auth` in `src/tools/auth.ts`.
- [ ] 3.2 Update the description string for `vikunja_batch_import` in `src/tools/batch-import.ts`.
- [ ] 3.3 Update the description string for `vikunja_filters` in `src/tools/filters.ts`.
- [ ] 3.4 Update the description string for `vikunja_labels` in `src/tools/labels.ts`.
- [ ] 3.5 Update the description string for `vikunja_templates` in `src/tools/templates.ts`.
- [ ] 3.6 Update the description string for `vikunja_users` in `src/tools/users.ts`.
- [ ] 3.7 Update the description string for `vikunja_teams` in `src/tools/teams.ts`.
- [ ] 3.8 Update the description string for `vikunja_webhooks` in `src/tools/webhooks.ts`.
- [ ] 3.9 Update the description strings for all 3 export tools in `src/tools/export.ts`.
- [ ] 3.10 Update the description strings for `vikunja_tasks` (`src/tools/tasks/index.ts`) and `vikunja_projects` (`src/tools/projects/index.ts`).

## Phase 4: Schema Annotations

- [ ] 4.1 Add `required: ['projectId', 'format', 'data']` in the schema for `vikunja_batch_import`.
- [ ] 4.2 Add `required: ['projectId']` in the schema for `vikunja_export_project`.
- [ ] 4.3 Update the description for the `id` field in `vikunja_tasks` to specify it is required for `get`, `update`, `delete`, `assign`, `unassign`, `comment`, `relate`, `unrelate`, `add-reminder`, `remove-reminder`, `list-assignees`, `list-reminders`, `list-labels`, `apply-label`, and `remove-label`.
- [ ] 4.4 Update the description for the `id` field in `vikunja_projects` to specify its required subcommands (e.g., `get`, `update`, `delete`, `archive`).
- [ ] 4.5 Run `npm run typecheck`, `npm run lint`, `npm run test:coverage`, and `npm run test:contract` to verify all updates pass CI checks.
