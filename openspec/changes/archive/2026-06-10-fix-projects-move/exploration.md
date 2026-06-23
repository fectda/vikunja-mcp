## Exploration: fix-projects-move

### Current State

In `src/tools/projects/hierarchy.ts` (lines 282-359), the `moveProject` function attempts to update a project's parent by passing an `updateData` object to `client.projects.updateProject()`. If `parentProjectId` is undefined (to move to root), it passes an empty object `{}`. Furthermore, it completely omits the `title` field from the update payload. When the API inevitably rejects the request (as updates require `title`), the catch block calls `handleStatusCodeError(error, 'move project', id)`.

### Root Cause

1. **Missing Required Field (`title`)**: As documented in `crud.ts`, all Vikunja project updates require the `title` field to be present; otherwise, they are rejected with an "Invalid Data" or 404 error depending on route handling. `moveProject` does not include `title`, leading to an API rejection.
2. **Empty Payload for Root Moves**: When moving a project to the root hierarchy (`parentProjectId === undefined`), the function sends an empty payload `{}` instead of `{ parent_project_id: 0 }`, causing the Vikunja API to ignore the relationship update entirely.
3. **Error Masking**: In `src/utils/error-handler.ts` (lines 138-157), `handleStatusCodeError` strictly overrides _any_ 404 error with a hardcoded `[Resource] with ID [id] not found` message. This successfully masked the API's actual rejection, causing the wrapper/developer to believe the child project ID was missing rather than the payload being malformed.

### Related Work

- **projects-update-bug**: Overlaps heavily. The `projects-update-bug` spec correctly identifies that omitting `parent_project_id` preserves the parent, and explicit `0` is required to remove the parent.
- **fix-projects-update-identifier**: Overlaps with the `handleStatusCodeError` error masking pattern where actual API validation/routing errors are hidden by hardcoded "not found" text.

### Proposed Fix Shape

1. **`src/tools/projects/hierarchy.ts`**: Update `moveProject` to include `title: currentProject.title` in `updateData` (matching the `crud.ts` workaround). Explicitly assign `parent_project_id = 0` when `parentProjectId` is undefined.
2. **`src/utils/error-handler.ts`**: Update `handleStatusCodeError` to safely append the original error message to the 404 string if available, preventing future error masking.
3. **`tests/tools/projects.test.ts`**: Update the `move` subcommand tests to assert `toHaveBeenCalledWith` on `mockClient.projects.updateProject`, verifying that `title` and `parent_project_id: 0` are actually passed.

### Affected Files

- `src/tools/projects/hierarchy.ts`
- `src/utils/error-handler.ts`
- `tests/tools/projects.test.ts`

### Test Strategy

- Add `expect(mockClient.projects.updateProject).toHaveBeenCalledWith(id, { title: '...', parent_project_id: newParentId })` to the existing "move to new parent" test.
- Add `expect(mockClient.projects.updateProject).toHaveBeenCalledWith(id, { title: '...', parent_project_id: 0 })` to the existing "move to root" test.
- Validate that `handleStatusCodeError` propagates underlying Vikunja messages for 404s without compromising the security sanitization layer.

### Risks

- Modifying `error-handler.ts` must ensure we do not inadvertently leak sensitive security information (e.g., token details) that the `sanitize` method currently strips.

### Ready for Proposal

Yes. The orchestrator can proceed to `sdd-propose`.
