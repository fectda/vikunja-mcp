# Proposal: fix-alltasks-endpoint

## Intent

Fix the `vikunja_tasks` list operation when `allProjects: true` is specified, which currently returns a 404 error. The issue is caused by a malformed URL with a double `/api/v1` path segment in the monkey-patched `getAllTasks` method.

## Scope

### In Scope

- Correcting the URL construction in `VikunjaClientFactory.ts` by removing the redundant `/api/v1` path segment.

### Out of Scope

- Removing the monkey-patch entirely or patching the upstream `node-vikunja` library.
- Removing unused `sed` patches from the docker wrapper.

## Capabilities

> This section is the CONTRACT between proposal and specs phases.
> The sdd-spec agent reads this to know exactly which spec files to create or update.
> Research `openspec/specs/` before filling this in.

### New Capabilities

None

### Modified Capabilities

None

## Approach

Implement Option A from the PRD. In `src/client/VikunjaClientFactory.ts`, modify the monkey-patched `getAllTasks` method. We will change the URL construction from `new URL(\`${baseUrl}/api/v1/tasks\`)` to `new URL(\`${baseUrl}/tasks\`)`. Since `baseUrl`already includes`/api/v1`, this will generate the correct endpoint URL `https://vikunja.example.com/api/v1/tasks`.

## Affected Areas

| Area                                 | Impact   | Description                                                 |
| ------------------------------------ | -------- | ----------------------------------------------------------- |
| `src/client/VikunjaClientFactory.ts` | Modified | Fix the URL construction in the `getAllTasks` monkey-patch. |

## Risks

| Risk                         | Likelihood | Mitigation                                                                                           |
| ---------------------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| Breaking other API calls     | Low        | The fix is isolated to a single method override that only affects the `getAllTasks` call.            |
| URL format changes in future | Low        | The change aligns with how `node-vikunja` expects the API URL to be formatted (including `/api/v1`). |

## Rollback Plan

Revert the change in `src/client/VikunjaClientFactory.ts` to restore the previous URL construction logic (`${baseUrl}/api/v1/tasks`).

## Dependencies

- None

## Success Criteria

- [ ] Calling `vikunja_tasks` with `subcommand: "list"` and `allProjects: true` successfully returns tasks across all projects instead of a 404 error.
