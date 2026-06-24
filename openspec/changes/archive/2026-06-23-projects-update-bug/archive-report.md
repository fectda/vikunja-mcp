# Archive Report: projects-update-bug

**Status**: SUPERSEDED (intentional partial archive)
**Archived at**: 2026-06-24
**Archive path**: `openspec/changes/archive/2026-06-23-projects-update-bug/`

## Reason for Superseding

This change was never implemented. The `parentProjectId` handling during project updates was addressed by two subsequent changes:

1. **fix-projects-update-identifier** — Archived 2026-06-06
2. **fix-projects-move** — Archived 2026-06-10

Both are merged to main. The core fix described in this change (using `resolvedParentProjectId` in the update payload) was resolved through other implementation paths. No code changes from `projects-update-bug` were ever applied.

## Archive Type: intentional-with-warnings

- No tasks were ever checked off in the tasks artifact
- No `design.md`, `tasks.md`, `verify-report.md`, or `proposal.md` files exist on the filesystem (only specs/)
- User explicitly approved archive as SUPERSEDED
- CRITICAL verification issues: N/A (none existed)

## Engram Observation IDs (for traceability)

| Artifact | Observation ID | Topic Key                        |
| -------- | -------------- | -------------------------------- |
| Proposal | #286           | sdd/projects-update-bug/proposal |
| Spec     | #287           | sdd/projects-update-bug/spec     |
| Design   | #288           | sdd/projects-update-bug/design   |
| Tasks    | #289           | sdd/projects-update-bug/tasks    |

## Spec Sync Decision

Delta specs at `specs/projects/spec.md` were **NOT** merged into main specs (`openspec/specs/`). Reasoning:

- The requirements described (optional parentProjectId in updates, auto-fetching current parent when not provided) were addressed by `fix-projects-update-identifier` and `fix-projects-move`
- The main spec at `openspec/specs/project-tools/spec.md` already documents Error Reporting and Project Move behaviors that cover these concerns
- Merging an unimplemented delta spec into main specs would introduce stale spec requirements

## Archive Contents

- specs/ ✅ (specs/projects/spec.md)

## Filesystem artifacts NOT present (by design — superseded before implementation)

- proposal.md ❌ (never written to filesystem)
- design.md ❌ (never written to filesystem)
- tasks.md ❌ (never written to filesystem)
- verify-report.md ❌ (never created)

## Reconciliation Note

Engram observations #286 (proposal), #287 (spec), #288 (design), and #289 (tasks) remain in persistent memory for historical traceability. The tasks observation contains 4 unchecked items — this is expected for a superseded change that was never implemented.
