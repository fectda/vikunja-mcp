# Proposal: fix-projects-move

## Intent

The `projects.move` tool fails for valid project IDs due to missing the required `title` field in the API update payload, and improperly sending an empty object `{}` instead of `{ parent_project_id: 0 }` for root moves. Furthermore, an aggressive error mask hides the API rejection behind a generic "not found" message. This change will fix the payload formulation and expose the real validation failures.

## Scope

### In Scope

- Include `title` from the current project in `updateData` during `moveProject()`.
- Set `parent_project_id: 0` when `parentProjectId` is `undefined` in `moveProject()`.
- Safely append the upstream error message to 404s in `handleStatusCodeError()` to expose actual API validation failures.
- Update existing `move` tests in `projects.test.ts` to assert the correct payload structure.

### Out of Scope

- Other subcommands of `vikunja_projects` tool.
- Other tools' error handling.
- Modifications to the Zod schema for project updates.

## Capabilities

### New Capabilities

None

### Modified Capabilities

- `project-tools`: The move requirement changes to correctly formulate the payload with `title` and `parent_project_id: 0`, and the tool must propagate sanitized upstream validation errors rather than masking them.

## Approach

1. In `src/tools/projects/hierarchy.ts`, `moveProject` already fetches `currentProject`. We will assign `updateData.title = currentProject.title`. If `parentProjectId` is undefined, assign `updateData.parent_project_id = 0`.
2. In `src/utils/error-handler.ts`, update `handleStatusCodeError` for 404s: extract the underlying error message, pass it through `this.sanitize()`, and append it to the default `[Resource] with ID [id] not found` string.
3. In `tests/tools/projects.test.ts`, update the `move` subcommand test assertions to expect `title` and `parent_project_id: 0`.

## Affected Areas

| Area                              | Impact   | Description                                                |
| --------------------------------- | -------- | ---------------------------------------------------------- |
| `src/tools/projects/hierarchy.ts` | Modified | Fix move payload (add `title`, fix `parent_project_id: 0`) |
| `src/utils/error-handler.ts`      | Modified | Expose sanitized upstream 404 messages                     |
| `tests/tools/projects.test.ts`    | Modified | Update mock assertions to match the new payload            |

## Risks

| Risk                                    | Likelihood | Mitigation                                                                                                |
| --------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| Leaking sensitive info in 404 messages  | Low        | Ensure the appended message is passed through the existing `sanitize()` method.                           |
| Existing tests break due to new payload | High       | Update `mockClient.projects.updateProject` assertions in tests to expect `title` and `parent_project_id`. |

## Rollback Plan

Revert the changes to `hierarchy.ts` and `error-handler.ts`. The old behavior of omitting `title` and sending `{}` for root moves will return, restoring the bug but preventing any new regressions.

## Dependencies

- None

## Success Criteria

- [ ] `projects.move` with valid IDs successfully moves the project.
- [ ] `projects.move` with `parentProjectId: undefined` moves the project to root (sets `parent_project_id: 0`).
- [ ] `projects.move` with an invalid payload returns a real validation error, not a masked "not found" error.
- [ ] Existing coverage thresholds are maintained.
