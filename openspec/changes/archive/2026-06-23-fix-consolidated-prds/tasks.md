# Tasks: fix-consolidated-prds

## Review Workload Forecast

| Field                   | Value                                      |
| ----------------------- | ------------------------------------------ |
| Estimated changed lines | 150-250 lines                              |
| 400-line budget risk    | Low                                        |
| Chained PRs recommended | Yes                                        |
| Suggested split         | PR 1 (Schema fixes) → PR 2 (Sharing fixes) |
| Delivery strategy       | force-chained                              |
| Chain strategy          | stacked-to-main                            |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                                   | Likely PR | Notes                                                                       |
| ---- | -------------------------------------- | --------- | --------------------------------------------------------------------------- |
| 1    | Export, Project, and Task Schema Fixes | PR 1      | main base; includes tests for export fallback, identifier, bulk field/value |
| 2    | Sharing Endpoints Refactor             | PR 2      | PR 1 branch base; changes to team-sharing.ts and sharing.ts plus tests      |

## Phase 1: Schema and Field Pass-through Fixes

- [x] 1.1 `src/tools/export.ts`: Update export schema to make `password` optional and fallback to `process.env.VIKUNJA_EXPORT_PASSWORD`.
- [x] 1.2 `src/tools/projects/index.ts`: Add `identifier: z.string().min(1).max(50).optional()` to the update schema.
- [x] 1.3 `src/tools/projects/crud.ts`: Pass `identifier` in the project update payload.
- [x] 1.4 `src/tools/tasks/index.ts`: Add `field` and `value` to the bulk-update schema.
- [x] 1.5 `src/tools/tasks/bulk-operations.ts`: Pass `field` and `value` in the task bulk update payload.
- [x] 1.6 Update tests to verify fallback and field pass-through.

## Phase 2: Sharing Endpoints Refactor

- [x] 2.1 `src/tools/projects/team-sharing.ts`: Modify `getTeamShare` to use `getTeamShares` list and client-side filtering by ID.
- [x] 2.2 `src/tools/projects/sharing.ts`: Modify `getLinkShare` to use `getLinkShares` list and client-side filtering by ID.
- [x] 2.3 `src/tools/projects/sharing.ts`: Remove the pre-flight GET check from `deleteLinkShare`.
- [x] 2.4 Update tests to verify client-side list filtering and the removed GET check in DELETE.
