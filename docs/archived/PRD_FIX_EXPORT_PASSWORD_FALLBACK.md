# PRD — Bug: Export tools not registered (race condition in index.ts)

**⚠️ CRITICAL RULE: THIS PRD MUST BE WRITTEN ENTIRELY IN ENGLISH.**

## Status

**Fork**: fectda/vikunja-mcp
**Date**: 2026-06-25 (rewritten — original was against abandoned upstream)
**Reported by**: vikunja-mcp-docker wrapper
**Severity**: Medium (JWT-only tools not registered due to timing)

---

## Summary

`vikunja_request_user_export` and `vikunja_download_user_export` return `MCP error -32602: Tool vikunja_request_user_export not found`. The tools **exist** in the fork (`fectda/vikunja-mcp`) at `src/tools/export.ts`. The issue is a race condition in `src/index.ts`: `registerTools()` runs inside `factoryInitializationPromise` before `autoLoginWithCredentials()` completes. Export tools require JWT auth at registration time, so they never appear in the tool list.

This PRD replaces the original version (written against `democratize-technology/vikunja-mcp`, which had removed the tools entirely).

---

## Expected Behavior

When the MCP starts with JWT authentication (`VIKUNJA_USER` + `VIKUNJA_PASSWORD`), the export tools should appear in the tool list and be callable:

```
vikunja_projects → found ✓
vikunja_tasks → found ✓
vikunja_request_user_export → found ✓
vikunja_download_user_export → found ✓
```

## Actual Behavior

```
MCP error -32602: Tool vikunja_request_user_export not found
MCP error -32602: Tool vikunja_download_user_export not found
```

---

## Root Cause Analysis

### Startup flow in `src/index.ts`

```typescript
const factoryInitializationPromise = initializeFactory();

async function initializeFactory() {
  await autoLoginWithCredentials();       // Step 1: auth
  const factory = await createVikunjaClientFactory(authManager);
  await setGlobalClientFactory(factory);

  if (authManager.isAuthenticated()) {    // Step 2: register tools
    registerTools(server, authManager, clientFactory);
  }
}
```

### Registration logic in `registerTools()`

```typescript
function registerTools() {
  // Always registered:
  registerAuthTools(server, authManager);       // ✓
  registerProjectTools(server, authManager);     // ✓
  registerTaskTools(server, authManager);        // ✓

  // Conditional — requires JWT:
  if (authManager.isAuthenticated() && authManager.getAuthType() === 'jwt') {
    registerExportTools(server);                 // ❌ never called
  }
}
```

When only `VIKUNJA_API_TOKEN` is set (no user/pass), `authManager.getAuthType()` returns `'api-token'`, so export tools are correctly skipped. **But when JWT auth IS available**, the race condition means `registerTools()` might fire before `autoLoginWithCredentials()` finishes setting the JWT session, so `getAuthType()` still returns undefined.

### Why this happens

`factoryInitializationPromise` is created at module load time, but `autoLoginWithCredentials()` is async — it performs a `fetch()` to `POST /api/v1/login`. If the login request is in-flight when `initializeFactory()` resolves its first `await`, `registerTools()` sees `isAuthenticated() === false` and skips JWT-dependent tools.

---

## Proposed Solution

### Option A: Separate tool registration from auth (recommended)

Split `initializeFactory()` into two phases:

```typescript
const factoryInitializationPromise = initializeFactory();

async function initializeFactory() {
  await autoLoginWithCredentials();
  const factory = await createVikunjaClientFactory(authManager);
  await setGlobalClientFactory(factory);
}

// Register tools AFTER auth is confirmed, not during factory init
server.on('afterInit', () => {
  registerProjectTools(server, authManager);
  registerTaskTools(server, authManager);
  if (authManager.isAuthenticated() && authManager.getAuthType() === 'jwt') {
    registerExportTools(server);
  }
});
```

### Option B: Defer JWT tool registration

Make export tools register dynamically when auth type becomes available:

```typescript
authManager.on('authChanged', (authType) => {
  if (authType === 'jwt') {
    registerExportTools(server);
  }
});
```

---

## Impact

- **Affected endpoints**: `vikunja_request_user_export`, `vikunja_download_user_export`
- **Affected users**: Users who authenticate with JWT (user + password) and need exports
- **Available workaround**: Use API token auth (export tools are JWT-only, so they won't appear either — no workaround via MCP). Use direct Vikunja API for exports.

---

## References

- Source: `src/index.ts` — `initializeFactory()` and `registerTools()`
- Source: `src/tools/export.ts` — export tool implementations (exist in fork)
- Source: `src/auth/AuthManager.ts` — `getAuthType()` and `isAuthenticated()`
