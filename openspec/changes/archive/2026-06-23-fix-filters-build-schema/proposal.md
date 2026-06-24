# Proposal: fix-filters-build-schema

## Intent

The `vikunja_filters` MCP tool uses an opaque `parameters: z.record(z.unknown())` schema, hiding the required `conditions` and `groupOperator` fields for the `build` action. This causes LLMs to fail when calling the tool because they cannot know the expected internal structure. We need to expose these fields at the top level of the tool schema so LLMs can correctly build task and project filters.

## Scope

### In Scope

- Flatten `conditions` and `groupOperator` into the `vikunja_filters` tool's top-level schema.
- Update the tool handler to merge these top-level fields into the internal parameters for validation.
- Maintain backward compatibility so existing calls using `parameters: { conditions: ... }` still work.
- Add test coverage for the new flattened parameter format.

### Out of Scope

- Splitting the `vikunja_filters` tool into separate tools (`vikunja_filters_build`, etc.).
- Refactoring other tools' parameter schemas in this change (unless explicitly requested).

## Capabilities

### New Capabilities

- `filter-tool-schema`: Ensures the `vikunja_filters` tool exposes all necessary fields for its actions directly in the MCP schema.

### Modified Capabilities

None.

## Approach

Implement the short-term fix described in the PRD.
Update the `vikunja_filters` tool schema in `src/tools/filters.ts` to explicitly include `conditions` and `groupOperator` as optional top-level fields, using the shapes from `BuildFilterSchema`.
In the handler, if `action === 'build'` and `conditions` are provided at the top level, merge them into the `effectiveParams` object before passing it to `BuildFilterSchema.parse()`.

## Affected Areas

| Area                          | Impact   | Description                                                                |
| ----------------------------- | -------- | -------------------------------------------------------------------------- |
| `src/tools/filters.ts`        | Modified | Update tool schema and handler logic to support flattened build parameters |
| `tests/tools/filters.test.ts` | Modified | Add tests for calling `build` with top-level `conditions`                  |

## Risks

| Risk                                | Likelihood | Mitigation                                                                                                                 |
| ----------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| Schema collision with other actions | Low        | `conditions` and `groupOperator` are specific to filter building and won't conflict with simple fields like `id` or `name` |
| SDK schema generation issues        | Low        | Extracting `BuildFilterSchema.shape.conditions` directly into the tool schema is supported by Zod                          |

## Rollback Plan

Revert the changes to `src/tools/filters.ts` and related tests to restore the opaque `parameters` schema.

## Dependencies

- None

## Success Criteria

- [ ] The `vikunja_filters` tool schema explicitly exposes `conditions` and `groupOperator`.
- [ ] LLMs can call `vikunja_filters` with `{ action: "build", conditions: [...] }` without validation errors.
- [ ] Existing calls using the nested `parameters` object continue to function correctly.
- [ ] Tests pass for both nested and flattened parameter formats.
