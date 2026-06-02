# Tool Consolidation Specification

## Purpose

This spec defines the consolidation of duplicate entity-specific MCP tools under unified master tools (`vikunja_tasks` and `vikunja_projects`) to reduce LLM context bloat and improve tool selection determinism. It includes the migration of previously missing team-sharing subcommands.

## Requirements

### Requirement: Task Tools Consolidation

The system MUST expose exactly ONE tool for task management named `vikunja_tasks`. All previous standalone tools for tasks (`vikunja_task_crud`, `vikunja_task_assignees`, `vikunja_task_bulk`, `vikunja_task_comments`, `vikunja_task_labels`, `vikunja_task_relations`, `vikunja_task_reminders`) MUST NOT be registered as separate tools.

#### Scenario: Listing Tools shows only one task tool

- GIVEN the LLM requests a list of available tools
- WHEN the MCP server responds
- THEN the response MUST include `vikunja_tasks`
- AND the response MUST NOT include `vikunja_task_crud` or other duplicate task tools
- AND `vikunja_tasks` MUST support all 22 task subcommands

### Requirement: Project Tools Consolidation

The system MUST expose exactly ONE tool for project management named `vikunja_projects`. Previous standalone tools (`vikunja_projects_crud`, `vikunja_projects_hierarchy`, `vikunja_projects_sharing`, `vikunja_projects_team_sharing`) MUST NOT be registered as separate tools.

#### Scenario: Listing Tools shows only one project tool

- GIVEN the LLM requests a list of available tools
- WHEN the MCP server responds
- THEN the response MUST include `vikunja_projects`
- AND the response MUST NOT include `vikunja_projects_crud` or other duplicate project tools

### Requirement: Team Sharing Subcommand Migration

The system MUST include the team-sharing subcommands (`share-team`, `list-team-shares`, `get-team-share`, `update-team-share`, `remove-team-share`) inside the unified `vikunja_projects` tool.

#### Scenario: Executing Team Sharing via Master Tool

- GIVEN the `vikunja_projects` tool is registered
- WHEN the LLM invokes `vikunja_projects` with subcommand `share-team`
- THEN the system MUST route the request to the team-sharing handler and execute it successfully

### Requirement: Test Suite Updates

The test suite MUST NOT reference any of the removed duplicate tools and MUST route all relevant tests through `vikunja_tasks` or `vikunja_projects`.

#### Scenario: Running Tests for Consolidated Tools

- GIVEN the test suite is executed
- WHEN a test related to task assignees runs
- THEN it MUST invoke the `vikunja_tasks` tool with the `assign` or `unassign` subcommand
- AND the test MUST pass successfully
