# Spec: filter-tool-schema

## Overview

The `vikunja_filters `build` action should expose its required parameters (`conditions`, `groupOperator`) at the top level of the MCP tool schema so LLMs can discover them without guessing.

## Requirements

### R1: Top-level schema exposure

The `vikunja_filters` tool MUST expose `conditions` and `groupOperator` as optional top-level fields in its Zod schema, using their respective shapes from `BuildFilterSchema`.

### R2: Backward compatibility

Existing callers that pass `parameters: { conditions: [...] }` MUST continue to work unchanged.

### R3: Handler merge

When `action === 'build'` and `conditions` are provided at the top level, the handler MUST merge them into the effective parameters before calling `BuildFilterSchema.parse()`.

## Scenarios

### Scenario 1: Build with top-level conditions

- GIVEN an LLM calls `vikunja_filters` with `{ action: "build", conditions: [{ field: "priority", operator: ">=", value: 3 }] }`
- WHEN the handler processes the call
- THEN it MUST NOT throw a `Required: parameters` validation error
- AND it MUST return a successfully built filter string

### Scenario 2: Build with nested parameters (backward compat)

- GIVEN an existing caller uses `{ action: "build", parameters: { conditions: [...] } }`
- WHEN the handler processes the call
- THEN it MUST work exactly as before

### Scenario 3: Non-build actions ignore top-level fields

- GIVEN a caller uses `{ action: "list", conditions: [...] }`
- WHEN the handler processes the call
- THEN it MUST NOT interpret `conditions` as build parameters
