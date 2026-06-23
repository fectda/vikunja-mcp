# Proposal: fix-consolidated-prds

## Intent

Resolve three high-severity issues reported in recent PRDs: export password fallback, missing fields in Zod schemas for project/task tools causing silent data loss, and non-functional project sharing endpoints due to incorrect REST route assumptions.

## Scope

### In Scope

- Make `password` optional in export tools and fallback to `process.env.VIKUNJA_EXPORT_PASSWORD`.
- Add `identifier` to `vikunja_projects` update schema.
- Add `field` and `value` to `vikunja_tasks` bulk-update schema.
- Rewrite `getTeamShare` to use `GET /projects/{id}/teams`.
- Rewrite `getLinkShare` to use `GET /projects/{id}/shares`.
- Refactor `deleteLinkShare` to remove the unnecessary pre-flight `GET` check.

### Out of Scope

- Changing Vikunja API behavior or adding new endpoints to the upstream server.
- Switching Zod schemas from `.strip()` to `.passthrough()` globally.

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `export-tools`: Implement environment variable fallback for export passwords.
- `project-tools`: Ensure `identifier` is accepted in updates, and share endpoints correctly map to list-based Vikunja API.
- `task-tools`: Ensure `field` and `value` are accepted in bulk updates.

## Approach

- Update `src/tools/export.ts` schemas to make password optional and check `process.env.VIKUNJA_EXPORT_PASSWORD` inside the handler.
- Update `src/tools/projects/index.ts` to add `identifier: z.string().min(1).max(50).optional()`.
- Update `src/tools/tasks/index.ts` to add `field: z.string().min(1).optional()` and `value: z.unknown().optional()`.
- Update `src/tools/projects/sharing.ts` to replace single-resource GETs with list endpoints and client-side filtering. Remove pre-flight from `deleteLinkShare`.

## Affected Areas

| Area                            | Impact   | Description                                     |
| ------------------------------- | -------- | ----------------------------------------------- |
| `src/tools/export.ts`           | Modified | Schemas and password resolution.                |
| `src/tools/projects/index.ts`   | Modified | Add `identifier` to update schema.              |
| `src/tools/tasks/index.ts`      | Modified | Add `field` and `value` to bulk-update schema.  |
| `src/tools/projects/sharing.ts` | Modified | Fix share REST endpoints and remove pre-flight. |

## Risks

| Risk                             | Likelihood | Mitigation                                                                                 |
| -------------------------------- | ---------- | ------------------------------------------------------------------------------------------ |
| Missing Zod fields silently fail | Low        | Comprehensive round-trip unit tests can be added later; Option A minimizes immediate risk. |
| Incorrect share lookup logic     | Low        | Rely on exact `team_id` or `id` matching against list response.                            |

## Rollback Plan

Revert the commits modifying `src/tools/export.ts`, `src/tools/projects/index.ts`, `src/tools/tasks/index.ts`, and `src/tools/projects/sharing.ts`.

## Dependencies

- Existing Vikunja REST API constraints.
- Wrapper `entrypoint.sh` providing `VIKUNJA_EXPORT_PASSWORD` (already fixed).

## Success Criteria

- [ ] Export requests succeed without explicit password if `VIKUNJA_EXPORT_PASSWORD` is set.
- [ ] Project updates correctly persist the `identifier` field.
- [ ] Bulk task updates correctly apply the `field` and `value`.
- [ ] Getting team/link shares succeeds and returns correct data.
- [ ] Deleting link shares succeeds and doesn't fail on pre-flight.
