# Tool Metadata Specification

## Purpose

This spec defines the standardization of tool descriptions and JSON schemas across all surviving MCP tools to improve LLM comprehension, parameter accuracy, and tool selection determinism.

## Requirements

### Requirement: Description Formatting

All MCP tool descriptions MUST follow the "What + When + Returns" format: `{What this tool does}. Use when {when to use it}. Returns {what the LLM can expect back}.`

#### Scenario: Inspecting Tool Descriptions

- GIVEN the LLM requests a list of available tools
- WHEN the MCP server provides the tools
- THEN each tool's description MUST contain the phrase "Use when"
- AND each tool's description MUST contain the phrase "Returns"

### Requirement: Parameter Required Annotations

Tool JSON schemas MUST explicitly annotate mandatory parameters as required at the schema level. Specifically, `vikunja_batch_import` MUST require `projectId`, `format`, and `data`. `vikunja_export_project` MUST require `projectId`.

#### Scenario: Batch Import Schema Validation

- GIVEN the LLM inspects the schema for `vikunja_batch_import`
- WHEN the schema is returned
- THEN `projectId`, `format`, and `data` MUST be listed in the `required` array of the JSON schema

### Requirement: Conditional Requirement Documentation

For master tools (`vikunja_tasks`, `vikunja_projects`) where a parameter like `id` is only required for specific subcommands, the field description MUST explicitly list which subcommands require it.

#### Scenario: Inspecting Conditional Parameters

- GIVEN the LLM inspects the schema for `vikunja_tasks`
- WHEN the description for the `id` field is returned
- THEN it MUST explicitly state that `id` is required for get, update, delete, assign, and other specific subcommands
