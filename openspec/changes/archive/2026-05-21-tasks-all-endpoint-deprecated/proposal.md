# Proposal: tasks-all-endpoint-deprecated

## Intent

The `getAllTasks()` method in the external `node-vikunja` library hardcodes the `/tasks/all` endpoint, which was removed in Vikunja v1.0.0-rc4 in favor of `/tasks`. This causes all MCP list-tasks operations (`vikunja_tasks list`) to fail with a 400 Bad Request ("Invalid model provided"). This proposal fixes the listing functionality by monkey-patching the method in the MCP wrapper, bypassing the need for an immediate upstream library release.

## Scope

### In Scope

- Monkey-patching `node-vikunja`'s `getAllTasks` method in `VikunjaClientFactory` or the relevant client wrapper.
- Rerouting the `getAllTasks` call to use the valid `/tasks` endpoint.
- Maintaining compatibility with all existing query parameters (`filter`, `sort_by`, `page`, etc.).
- Ensuring tests continue to pass and correctly cover the list-tasks behavior.

### Out of Scope

- Updating or publishing a new version of `node-vikunja` itself.
- Fixing other endpoints in `node-vikunja` that aren't related to this specific failure.

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `task-listing`: Update the internal routing for retrieving all tasks across projects to use the `/tasks` endpoint instead of `/tasks/all`.

## Approach

As we cannot immediately bump the `node-vikunja` external dependency, we will proceed with Option B from the PRD.
We will intercept the client creation in `src/client.ts` (or wherever `VikunjaClientFactory` resides).
After instantiating the `node-vikunja` client, we will override the `tasks.getAllTasks` method to manually perform the HTTP request to the `/tasks` endpoint, appending the provided query parameters and forwarding the correct Authorization headers from the current session.

## Affected Areas

| Area            | Impact   | Description                                                                                               |
| --------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `src/client.ts` | Modified | Monkey-patch the `getAllTasks` method on the instantiated client to use `/tasks` instead of `/tasks/all`. |

## Risks

| Risk                                                                               | Likelihood | Mitigation                                                                                                                       |
| ---------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Query parameter serialization mismatch between our patch and the original library. | Low        | We will carefully construct the URL search parameters to match the expected format of `node-vikunja` and `Vikunja`.              |
| Session/auth header mismatch when overriding the fetch call.                       | Low        | We have access to the current session tokens inside the client factory and will explicitly pass them in the overridden function. |

## Rollback Plan

Revert the modifications in `src/client.ts` to restore the default `node-vikunja` behavior.

## Dependencies

- `node-vikunja` (already installed).

## Success Criteria

- [ ] Calling `vikunja_tasks list` no longer returns a 400 error.
- [ ] Task listing operations successfully return tasks from Vikunja instances >= v1.0.0.
- [ ] All existing automated tests for task listing pass without modification (or with minor mock adjustments if necessary).
