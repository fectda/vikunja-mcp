# PRD — Bug: projects.update (identifier) returns Project not found

**⚠️ CRITICAL RULE: THIS PRD MUST BE WRITTEN ENTIRELY IN ENGLISH.**

## Status
**MCP Version**: 0.2.2 (Commit 8c4096d)
**Date**: 2026-06-24
**Reported by**: vikunja-mcp-docker wrapper
**Severity**: Medium

---

## Summary

The `projects.update` tool fails when attempting to update the `identifier` field. The error message changed after upstream commit `b9cf833` fixed error propagation (removed hardcoded `customMessage` from `crud.ts` and `hierarchy.ts`), revealing the real Vikunja API error. The underlying cause remains unchanged: `identifier` is missing from the Zod schema for updates.

---

## Expected Behavior

When providing a valid project ID and a new `identifier` string to the `projects.update` tool, the MCP should successfully update the project's identifier via the Vikunja API.

## Actual Behavior

The tool fails with `Failed to update project: Invalid Data`. This is the real Vikunja API error now propagated correctly through the fixed error handler. The payload sent to Vikunja is empty/malformed because `identifier` is not in the Zod schema for updates.

The `unsupported_fields` test in `mcp-teams.test.js` also confirms: `project.identifier` is not exposed even though Vikunja natively supports it.

---

## Steps to Reproduce

1. Call `projects.create` to create a new project. Note the ID.
2. Call `projects.update` using the noted ID and set `identifier: "NEW-ID"`.
3. Observe the "Invalid Data" error.

**Test Data**:
```
VIKUNJA_URL=http://16.13.0.16:8092/api/v1
VIKUNJA_API_TOKEN=(valid JWT token)
```

---

## Error Logs

```
❌ projects.update (identifier) — MCP response: Failed to update project: Invalid Data
```

---

## Wrapper Context

Our wrapper (`vikunja-mcp-docker`) runs the MCP inside a Docker container:
- Base: `node:22-alpine`
- Transport: stdio
- Auth: JWT

The wrapper DOES NOT modify the MCP logic, it only:
1. Auto-login JWT via `/api/v1/login` (if credentials exist)
2. Injects `VIKUNJA_API_TOKEN` as an environment variable

**Verification**: The issue can be reproduced by running the MCP directly (without wrapper).

---

## Proposed Solution

Add the `identifier` field to the Zod schema for `projects.update` inside the MCP codebase.

### Option A: Update Zod Schema
```typescript
identifier: z.string().optional().describe('The project identifier'),
```

---

## Impact

- **Affected endpoints**: `vikunja_projects` (subcommand: update)
- **Affected users**: Users attempting to set human-readable identifiers for projects.
- **Available workaround**: No direct workaround via MCP. Must use direct API or Web UI.

---

## References

- [Related issue: BUG MCP-5]
- [Upstream fix `b9cf833`: removed hardcoded customMessage from crud.ts and hierarchy.ts]