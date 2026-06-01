# PRD — `vikunja-mcp`: Filters `build` action has opaque schema that LLMs cannot call correctly

**⚠️ CRITICAL RULE: THIS PRD MUST BE WRITTEN ENTIRELY IN ENGLISH.**

## Status

**MCP Version**: main (e0cc18d)
**Date**: 2026-06-01
**Reported by**: vikunja-mcp-docker wrapper
**Severity**: Medium

---

## Summary

The `vikunja_filters` tool defines its input schema as `{ action: enum, parameters: Record<string, unknown> }`. The `build` action requires `conditions` (and optionally `groupOperator`) nested inside `parameters`, but the schema does not expose these fields. An LLM calling this tool has no way to know the correct parameter structure. The tool either fails with `"Required: parameters"` (if conditions are passed at top level) or requires the LLM to guess the internal structure of `z.record(z.unknown())`.

---

## Expected Behavior

An LLM should be able to call the `build` action naturally, e.g.:

```
vikunja_filters({
  action: "build",
  conditions: [
    { field: "priority", operator: ">=", value: 3 },
    { field: "done", operator: "=", value: false }
  ],
  groupOperator: "&&"
})
```

The tool schema should expose `conditions` and `groupOperator` at the top level (or have a dedicated schema union per action).

## Actual Behavior

The tool's JSON schema exposes only:

```json
{
  "action": { "type": "string", "enum": ["list","get","create","update","delete","build","validate"] },
  "parameters": { "type": "object", "additionalProperties": {} }
}
```

- If an LLM passes `conditions` at the top level → `MCP error -32602: Required: parameters`
- If an LLM correctly nests inside `parameters` → it works, but only by luck/guessing
- The `BuildFilterSchema` (which defines `conditions` properly) exists in code but is never exposed in the tool's input schema

---

## Steps to Reproduce

1. Inspect the tool schema via `tools/list`
2. Call `vikunja_filters` with `{ action: "build", conditions: [...] }` (natural LLM behavior)
3. Observe the validation error

**Test Data**:
```
VIKUNJA_URL=http://your-vikunja/api/v1
VIKUNJA_USER=test
VIKUNJA_PASSWORD=test
```

---

## Error Logs

```
📋 Tool schema:
{
  "action": { "type": "string", "enum": ["list", ..., "build"] },
  "parameters": { "type": "object", "additionalProperties": {} }
  // ❌ No "conditions" field exposed
}

📋 Call with conditions at top level:
→ MCP error -32602: Input validation error: Invalid arguments for tool vikunja_filters: [
    { "code": "invalid_type", "expected": "object", "received": "undefined",
      "path": ["parameters"], "message": "Required" }
  ]

📋 Call with parameters.conditions (correct nesting):
→ ✅ "Filter built successfully" — works, but requires knowing undocumented internal structure
```

---

## Root Cause Analysis

In `src/tools/filters.ts`, the tool is registered with a flat schema that combines ALL actions under one `z.record(z.unknown())` umbrella:

```typescript
server.tool(
  'vikunja_filters',
  'Manage and build advanced filters for tasks and projects with validation',
  {
    action: z.enum(['list', 'get', 'create', 'update', 'delete', 'build', 'validate']),
    parameters: z.record(z.unknown()),  // ← everything goes here, opaque to LLM
  },
  async ({ action, parameters }) => {
    // ...
    case 'build': {
      const params = BuildFilterSchema.parse(parameters);  // ← hidden schema
      // BuildFilterSchema expects { conditions: [...], groupOperator?: '&&'|'||' }
```

The `BuildFilterSchema` has a proper definition with `conditions` and `groupOperator`:

```typescript
const BuildFilterSchema = z.object({
  conditions: z.array(z.object({
    field: z.enum(['done', 'priority', 'percentDone', 'dueDate', ...]),
    operator: z.enum(['=', '!=', '>', '>=', '<', '<=', 'like', 'in', 'not in']),
    value: z.union([z.string(), z.number(), z.boolean(), z.array(...)]),
  })),
  groupOperator: z.enum(['&&', '||']).optional(),
});
```

But this schema is never exposed to the tool's input — it's only used internally inside the handler after the generic `parameters` object is already validated.

---

## Proposed Solution

### Option A: Split each action into its own tool

Register separate tools for each action:

```typescript
server.tool('vikunja_filters_list',  { projectId: z.number().optional(), ... }, handler);
server.tool('vikunja_filters_build', {
  conditions: z.array(...),        // ← properly exposed!
  groupOperator: z.enum(['&&', '||']).optional(),
}, handler);
server.tool('vikunja_filters_create', { name: z.string(), ... }, handler);
// ... etc
```

**Pros**: Clean separation, LLM sees exact schemas per action, Zod handles validation automatically.
**Cons**: Breaks the single-tool API design. Requires client-side changes if tools are referenced by name.

### Option B: Use discriminated union for action-specific parameters

Define the schema as a discriminated union on `action`:

```typescript
server.tool('vikunja_filters', '...', {
  action: z.enum(['list', 'create', 'update', 'delete', 'build', 'validate']),
  // Flatten build-specific params to top level (optional for other actions)
  conditions: BuildFilterSchema.shape.conditions.optional(),
  groupOperator: BuildFilterSchema.shape.groupOperator.optional(),
  // Other actions' params
  id: z.string().optional(),
  name: z.string().optional(),
  // ... etc
}, handler);
```

This flattens all action parameters but makes them optional, relying on the handler to validate required fields per action.

**Pros**: Backward compatible (single tool name), LLM can see all possible fields.
**Cons**: No strict per-action validation at the schema level (the handler still needs to validate which fields are required for each action). Schema can become large.

### Option C: Hybrid — single tool with `parameters` typed per-action

Use Zod's `discriminatedUnion` for the parameters field:

```typescript
const buildParams = z.object({
  conditions: z.array(...),
  groupOperator: z.enum(['&&', '||']).optional(),
});

const listParams = z.object({
  projectId: z.number().optional(),
  global: z.boolean().optional(),
});

// This doesn't work directly with MCP SDK's tool schema registration
// because the SDK expects a flat Zod object, not a discriminated union.
```

**Problem**: The MCP SDK's `server.tool()` expects a flat Zod object schema, not a discriminated union. The SDK would not properly expose the per-action variants.

### Recommended: Option A + backward-compat wrapper

Create individual tools (`vikunja_filters_build`, `vikunja_filters_list`, etc.) and keep the existing `vikunja_filters` tool as a backward-compatibility wrapper that delegates to the new tools. Over time, clients can migrate to the specific tools.

Or, as a simpler short-term fix:

### Short-term fix: flatten build params

Add `conditions` and `groupOperator` as optional top-level fields alongside `parameters`, so the schema exposes them:

```typescript
server.tool('vikunja_filters', '...', {
  action: z.enum(['list', 'get', 'create', 'update', 'delete', 'build', 'validate']),
  parameters: z.record(z.unknown()).optional(),
  // Build-specific fields exposed to the LLM
  conditions: BuildFilterSchema.shape.conditions.optional(),
  groupOperator: BuildFilterSchema.shape.groupOperator.optional(),
}, async (args) => {
  const { action, parameters, conditions, groupOperator } = args;
  let effectiveParams = parameters || {};

  if (action === 'build' && conditions) {
    effectiveParams = { ...effectiveParams, conditions, groupOperator };
  }

  // ... existing handler logic
});
```

---

## Impact

- **Affected endpoints**: `vikunja_filters` tool, specifically the `build` action
- **Affected users**: All users/LLMs trying to build advanced filters via the MCP
- **Available workaround**: The `build` action works if the caller knows to pass `{ action: "build", parameters: { conditions: [...] } }`. But this is non-obvious from the tool schema.

### Similar pattern in other tools

The same `z.record(z.unknown())` pattern for subcommand parameters exists in:
- `vikunja_filters` — all actions use `parameters: z.record(z.unknown())`
- Other tools may have similar issues with opaque parameter schemas

---

## References

- Source: `src/tools/filters.ts` — `registerFiltersTool()` function
- Source: `src/tools/filters.ts` — `BuildFilterSchema` definition
- MCP SDK tool schema registration: `server.tool()` expects flat Zod objects
