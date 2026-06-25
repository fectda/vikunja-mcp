# PRD — `vikunja-mcp`: `allProjects: true` returns 404 due to double `/api/v1` in monkey-patch

**⚠️ CRITICAL RULE: THIS PRD MUST BE WRITTEN ENTIRELY IN ENGLISH.**

## Status

**MCP Version**: main (latest)
**Date**: 2026-06-01
**Reported by**: vikunja-mcp-docker wrapper
**Severity**: Critical

---

## Summary

When calling `vikunja_tasks` with `subcommand: "list"` and `allProjects: true`, the MCP returns a 404 error. Root cause: the monkey-patch in `VikunjaClientFactory.ts` that fixes the `node-vikunja` `/tasks/all` deprecation has a bug — it constructs the URL with double `/api/v1` path segment.

---

## Expected Behavior

Calling `vikunja_tasks(list, allProjects: true)` should return all tasks across all projects the user has access to.

## Actual Behavior

The API returns 404 Not Found. The MCP error message varies depending on which strategy is active:

- **ClientSideFilteringStrategy** (default): `Failed to list tasks: ...` with 404
- **ServerSideFilteringStrategy** (if enabled): `Invalid model provided: Bad Request` or 404

---

## Steps to Reproduce

1. Connect to any Vikunja instance >= v1.0.0
2. Call `vikunja_tasks` with `subcommand: "list"` and `allProjects: true`
3. Observe 404 error

**Test Data**:
```
VIKUNJA_URL=https://vikunja.example.com/api/v1
VIKUNJA_API_TOKEN=tk_xxxxxxxx
```

---

## Root Cause Analysis

### URL Construction Flow

The `VIKUNJA_URL` env var includes `/api/v1`:
```
VIKUNJA_URL=https://vikunja.example.com/api/v1
```

This URL is passed to `authManager.connect(apiUrl, apiToken)` in `src/index.ts`:

```typescript
authManager.connect(process.env.VIKUNJA_URL, token);
```

So `session.apiUrl = "https://vikunja.example.com/api/v1"`.

### The Bug: `VikunjaClientFactory.ts` line 49

`src/client/VikunjaClientFactory.ts` has a monkey-patch that replaces `client.tasks.getAllTasks()` to bypass `node-vikunja`'s deprecated `/tasks/all` endpoint:

```typescript
this.clientInstance.tasks.getAllTasks = (async (params?) => {
  const baseUrl = this.currentApiUrl || '';
  const url = new URL(`${baseUrl}/api/v1/tasks`);  // <-- BUG: double /api/v1
  ...
}) as OriginalGetAllTasks;
```

Since `this.currentApiUrl = "https://vikunja.example.com/api/v1"`, the constructed URL is:

```
https://vikunja.example.com/api/v1/api/v1/tasks
```

Instead of the correct:

```
https://vikunja.example.com/api/v1/tasks
```

### Why This Affects Both Strategies

Both `ClientSideFilteringStrategy` and `ServerSideFilteringStrategy` call `client.tasks.getAllTasks()` when `allProjects: true` (no `projectId` scoping). The monkey-patch replaces this method at the client instance level, so both strategies hit the broken URL.

### The `sed` Patches in the Dockerfile (Red Herring)

The wrapper's `Dockerfile` applies `sed` patches to `node-vikunja`'s compiled JS to fix `/tasks/all` → `/tasks`. However, these patches are **ineffective** because the monkey-patch in `VikunjaClientFactory.ts` replaces `getAllTasks()` entirely at runtime — the patched `node-vikunja` method is never called.

---

## Proposed Solution

### Option A: Fix the Monkey-Patch URL (Recommended — Minimal Change)

In `src/client/VikunjaClientFactory.ts`, change:

```typescript
const url = new URL(`${baseUrl}/api/v1/tasks`);
```

To:

```typescript
const url = new URL(`${baseUrl}/tasks`);
```

This is the simplest fix. Since `baseUrl` already contains `/api/v1`, appending `/tasks` produces the correct full URL `https://vikunja.example.com/api/v1/tasks`.

**Risk**: None. The Vikunja API docs confirm `/api/v1/tasks` is the correct endpoint. The `node-vikunja` library itself follows the same pattern (`apiUrl + "/tasks"`).

### Option B: Complete Fix — Fork/Patch `node-vikunja` + Remove Monkey-Patch

1. Fix `node-vikunja` upstream (or pin a fork) to use `/tasks` instead of `/tasks/all`
2. Remove the monkey-patch from `VikunjaClientFactory.ts`
3. Remove the `sed` patches from the wrapper's `Dockerfile`

**Risk**: Depends on upstream maintenance. The monkey-patch exists precisely because `node-vikunja` hasn't merged a fix.

### Option C: Direct API Call Without Monkey-Patch

In `VikunjaClientFactory.ts`, instead of monkey-patching `getAllTasks`, add a new method `getAllTasksDirect()` on the factory that bypasses `node-vikunja` entirely and uses `fetch` directly. The `FilteringStrategy` classes would call this new method instead.

**Risk**: More architectural change, requires modifying strategy classes.

---

## Recommendation

**Option A** is the fastest and safest fix. It corrects exactly one character (`/api/v1/tasks` → `/tasks`) with zero side effects.

Once `node-vikunja` upstream fixes `getAllTasks()` to use `/tasks`, both the monkey-patch and the Dockerfile `sed` patches should be removed in a cleanup PR.

---

## Impact

- **Affected endpoints**: `vikunja_tasks list` with `allProjects: true` (or without `projectId`)
- **Affected users**: Anyone using the MCP with Vikunja >= v1.0.0 who needs cross-project task listing
- **Available workaround**: Always specify `projectId` to use `getProjectTasks()` which is not affected

---

## References

- `src/client/VikunjaClientFactory.ts` — monkey-patch with double `/api/v1` bug
- `src/utils/filtering/ClientSideFilteringStrategy.ts` — calls `getAllTasks()` when `allProjects: true`
- `src/utils/filtering/ServerSideFilteringStrategy.ts` — calls `getAllTasks()` when `allProjects: true`
- `src/index.ts` line ~65 — passes `VIKUNJA_URL` (with `/api/v1`) to `authManager.connect()`
- `node-vikunja` source: `src/services/task.service.ts` — `this.request('/tasks/all', ...)`
