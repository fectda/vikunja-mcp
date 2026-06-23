# Design: fix-projects-move

## Technical Approach

The change fixes the `move` subcommand payload by ensuring `title` is preserved and setting `parent_project_id: 0` for root moves. It also updates the global `handleStatusCodeError` function to securely propagate upstream error messages for 404 responses, preventing silent validation failures while maintaining the security sanitization layer.

## Architecture Decisions

### Decision: Preserving Title in Move Payload

**Choice**: Fetch `currentProject` and map its `title` directly to `updateData`.
**Alternatives considered**: Passing a partial update without `title` or modifying the API wrapper.
**Rationale**: Vikunja's update API strictly requires `title`. Fetching `currentProject` is already happening in `moveProject()`, so reusing its `title` fulfills the payload requirement with zero additional latency or overhead.

### Decision: Appending Sanitized Upstream Message to 404s

**Choice**: Append `sanitize(error.message)` to the default "not found" text.
**Alternatives considered**: Overwriting the message entirely or preserving the masking.
**Rationale**: Replacing the message entirely might break existing automated error parsing relying on the "not found" phrase. Masking it hides crucial API validation errors (e.g., cycle detection or missing properties). Appending provides transparency to developers while relying on the existing `sanitize()` function to protect sensitive tokens.

### Decision: Explicit parent_project_id 0

**Choice**: Set `updateData.parent_project_id = 0` when `parentProjectId` is undefined.
**Alternatives considered**: Sending an empty object `{}`.
**Rationale**: Sending an empty object fails to trigger the root-move behavior in the API. Vikunja interprets `0` as the explicit instruction to remove the parent relationship.

## Data Flow

    [User] ──(move ID, parentID)──→ [hierarchy.ts] ──(fetch current)──→ [Vikunja API]
                                         │                                   │
                                         └──────(updateData)─────────────────┘
                                                {title, parent_project_id}

## File Changes

| File                              | Action | Description                                                                                        |
| --------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| `src/tools/projects/hierarchy.ts` | Modify | Update `moveProject` payload construction to include `title` and handle `parent_project_id: 0`.    |
| `src/utils/error-handler.ts`      | Modify | Update `handleStatusCodeError` to extract, sanitize, and append `error.message` on 404s.           |
| `tests/tools/projects.test.ts`    | Modify | Update `move` mock assertions to verify `title` and `parent_project_id: 0` are provided correctly. |

## Interfaces / Contracts

No new types or interfaces are introduced. The `updateData` record in `moveProject` will be updated as follows:

```typescript
const updateData: Record<string, unknown> = {
  title: currentProject.title,
};
if (parentProjectId !== undefined) {
  updateData.parent_project_id = parentProjectId;
} else {
  updateData.parent_project_id = 0;
}
```

In `error-handler.ts`, the 404 handling will conditionally extract and append the `error.message`:

```typescript
let upstreamMsg = '';
if (error && typeof error === 'object' && 'message' in error && error.message) {
  upstreamMsg = this.sanitize(String(error.message));
}
```

## Testing Strategy

| Layer | What to Test                     | Approach                                                                                                        |
| ----- | -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Unit  | `hierarchy.ts` payload structure | Assert `mockClient.projects.updateProject` is called with `title` and `parent_project_id` (both valid and `0`). |
| Unit  | `error-handler.ts` 404 behavior  | Verify 404 formatting appends sanitized upstream messages, and skips appending when there's no message.         |
| Unit  | Security                         | Verify that existing security patterns (tokens, files) are still sanitized in the appended 404 strings.         |

## Migration / Rollout

No migration required.

## Open Questions

- [ ] None.
