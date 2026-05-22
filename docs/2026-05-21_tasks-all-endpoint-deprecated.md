# PRD — `node-vikunja`: `getAllTasks()` uses removed `/tasks/all` endpoint

**⚠️ CRITICAL RULE: THIS PRD MUST BE WRITTEN ENTIRELY IN ENGLISH.**

## Status

**MCP Version**: v0.2.2 (commit `05be45a`)
**Date**: 2026-05-21
**Reported by**: vikunja-mcp-docker wrapper
**Severity**: Critical

---

## Summary

`node-vikunja` v0.4.0's `TaskService.getAllTasks()` calls the endpoint `/tasks/all`, which was **removed in Vikunja v1.0.0-rc4**. All listing operations in the MCP fail with HTTP 400 when connecting to Vikunja >= v1.0.0.

---

## Expected Behavior

The MCP should successfully list tasks when calling `vikunja_tasks list` or `vikunja_task_crud list`, returning the tasks from the Vikunja instance.

## Actual Behavior

Every list-tasks operation fails with:

```
Failed to list tasks: Invalid model provided: Bad Request
```

The Vikunja API returns:

```json
{"code": 2004, "message": "Invalid model provided: Bad Request"}
```

Vikunja server log:

```
level=ERROR uri="/api/v1/tasks/all?filter=done%3Dfalse&sort_by=due_date" status=400 err="Invalid model provided: Bad Request"
```

---

## Steps to Reproduce

1. Connect any MCP client to a Vikunja instance >= v1.0.0-rc4
2. Call `vikunja_tasks` with `subcommand: "list"`
3. Observe the 400 error

**Test Data**:

```
VIKUNJA_URL=https://vikunja.example.com/api/v1
VIKUNJA_API_TOKEN=tk_xxxxxxxx
```

---

## Error Logs

```
Failed to list tasks: Invalid model provided: Bad Request
```

Vikunja API error docs: error code **2004** = "Invalid model provided."

---

## Wrapper Context

Our wrapper (`vikunja-mcp-docker`) runs the MCP inside a Docker container:

- Base: `node:22-alpine`
- Transport: SSE
- Auth: JWT (auto-login)

The wrapper DOES NOT modify the MCP logic, it only:

1. Auto-login JWT via `/api/v1/login` (if credentials exist)
2. Injects `VIKUNJA_API_TOKEN` as an environment variable

**Verification**: The issue can be reproduced by running the MCP directly (without wrapper):

```bash
cd node_modules/vikunja-mcp && node dist/index.js
```

---

## Proposed Solution

### Root Cause

`node-vikunja` v0.4.0 has the endpoint hardcoded in `src/services/task.service.ts`:

```typescript
async getAllTasks(params?: GetTasksParams): Promise<Task[]> {
    return this.request<Task[]>('/tasks/all', 'GET', undefined, {
        params: params,
    });
}
```

Vikunja v1.0.0 changelog explicitly states:

> **API Route Changes**: `/tasks/all` → `/tasks`: The endpoint to fetch all tasks now lives at just `/tasks` for consistency.

Reference: https://vikunja.io/changelog/whats-new-in-vikunja-1.0.0

### Option A: Fix in `node-vikunja` (recommended)

Change the endpoint in `src/services/task.service.ts` from `/tasks/all` to `/tasks`:

```typescript
async getAllTasks(params?: GetTasksParams): Promise<Task[]> {
    return this.request<Task[]>('/tasks', 'GET', undefined, {
        params: params,
    });
}
```

This is backward-compatible: the `/tasks` endpoint accepts the same query parameters (`filter`, `sort_by`, `page`, `per_page`, `s`, etc.) and works on both old and new Vikunja versions.

### Option B: Workaround in `vikunja-mcp` (alternative)

If `node-vikunja` cannot be updated promptly, the MCP can monkey-patch `getAllTasks` in `VikunjaClientFactory.ts` after instantiating the client:

```typescript
// After client creation, patch getAllTasks to use /tasks instead of /tasks/all
this.clientInstance.tasks.getAllTasks = async (params) => {
    const response = await fetch(`${session.apiUrl}/tasks?${new URLSearchParams(params as any)}`, {
        headers: { Authorization: `Bearer ${session.apiToken}` },
    });
    return response.json();
};
```

---

## Impact

- **Affected endpoints**: All list-tasks operations (`vikunja_tasks list`, `vikunja_task_crud list`)
- **Affected users**: Anyone using the MCP with Vikunja >= v1.0.0-rc4 (including v2.x)
- **Available workaround**: Use `getProjectTasks(projectId, params)` for project-scoped listing — the `/projects/{id}/tasks` endpoint was not removed. Cross-project "get all tasks" has no workaround without this fix.

---

## References

- Vikunja v1.0.0 changelog: https://vikunja.io/changelog/whats-new-in-vikunja-1.0.0
- Homepage discussion #6232 (same error, same fix): https://github.com/gethomepage/homepage/discussions/6232
- Vikunja issue #2163 (same error in RC4): https://github.com/go-vikunja/vikunja/issues/2163
- `node-vikunja` source: `src/services/task.service.ts` line 39 — `this.request<Task[]>('/tasks/all', ...)`
- `node-vikunja` repo: https://github.com/democratize-technology/node-vikunja
