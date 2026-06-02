# PRD — `vikunja-mcp`: Consolidate redundant tools and improve LLM-facing descriptions

**⚠️ CRITICAL RULE: THIS PRD MUST BE WRITTEN ENTIRELY IN ENGLISH.**

## Status

**MCP Version**: main (1d7d310+)
**Date**: 2026-06-01
**Reported by**: vikunja-mcp-docker wrapper
**Severity**: High
**Type**: Architecture / UX

---

## Summary

The Vikunja MCP server registers **24 tools**, more than double the recommended maximum (10–15) for reliable LLM tool selection. Worse, there is massive functional overlap: the task domain alone has **8 separate tools** (`vikunja_task_crud`, `vikunja_task_assignees`, `vikunja_task_bulk`, `vikunja_task_comments`, `vikunja_task_labels`, `vikunja_task_relations`, `vikunja_task_reminders`, and the master `vikunja_tasks`), all of which expose overlapping subcommands. The project domain has **5 tools** (`vikunja_projects`, `vikunja_projects_crud`, `vikunja_projects_hierarchy`, `vikunja_projects_sharing`, `vikunja_projects_team_sharing`). Additionally, many tool descriptions are generic, lacking usage guidance and return-type hints that LLMs rely on for deterministic selection.

This redundancy forces the LLM to choose arbitrarily between functionally identical tools, producing non-deterministic behavior: sometimes it picks the master tool, sometimes a specific one, sometimes it fails to pick any. Twenty-four tools also consume excessive context-window tokens, further degrading selection accuracy.

---

## Current State Analysis

### Full tool inventory (24 tools)

| # | Tool Name | Subcommands / Parameters | Description |
|---|-----------|------------------------|-------------|
| 1 | `vikunja_auth` | `subcommand: connect\|status\|refresh\|disconnect\|login`, `apiUrl?`, `apiToken?`, `username?`, `password?` | "Manage authentication with Vikunja API (connect, status, refresh, disconnect, login)" |
| 2 | `vikunja_batch_import` | `projectId`, `format: csv\|json`, `data`, `skipErrors?`, `dryRun?` | "Import tasks in bulk from CSV or JSON formats with error handling and dry-run support" |
| 3 | `vikunja_filters` | `action: list\|get\|create\|update\|delete\|build\|validate`, `parameters?`, `conditions?`, `groupOperator?` | "Manage and build advanced filters for tasks and projects with validation" |
| 4 | `vikunja_labels` | `subcommand: list\|get\|create\|update\|delete`, `id?`, `title?`, `description?`, `hexColor?` | "Manage task labels with full CRUD operations for organizing and categorizing tasks" |
| 5 | `vikunja_templates` | `subcommand: create\|list\|get\|update\|delete\|instantiate`, `id?`, `projectId?`, `name?`, ... | "Manage task templates for creating consistent tasks and project structures" |
| 6 | `vikunja_users` | `subcommand: current\|search\|settings\|update-settings`, `search?`, `name?`, `language?`, ... | "Manage user profiles, search users, and update user settings" |
| 7 | `vikunja_teams` | `subcommand: list\|create\|get\|update\|delete\|members`, `id?`, `name?`, `memberSubcommand?`, `userId?` | "Manage teams and team memberships for collaborative project management" |
| 8 | `vikunja_webhooks` | `subcommand: list\|get\|create\|update\|delete\|list-events`, `projectId?`, `webhookId?`, `targetUrl?`, ... | "Manage webhooks for integrating Vikunja events with external services" |
| 9 | `vikunja_export_project` | `projectId`, `includeChildren?` | "Export project data including tasks, labels, and metadata in structured format" |
| 10 | `vikunja_request_user_export` | `password?` (falls back to env) | "Request a complete export of user data for privacy and backup purposes" |
| 11 | `vikunja_download_user_export` | `password?` (falls back to env) | "Download previously requested user data export files" |
| 12 | `vikunja_tasks` | `subcommand` (22 values: create, get, update, delete, list, assign, unassign, list-assignees, attach, comment, bulk-create, bulk-update, bulk-delete, relate, unrelate, relations, add-reminder, remove-reminder, list-reminders, apply-label, remove-label, list-labels), plus 30+ parameter fields | "Manage tasks with comprehensive operations (create, update, delete, list, assign, attach files, comment, bulk operations)" |
| **D** | `vikunja_task_crud` | `operation: create\|get\|update\|delete\|list`, `title?`, `description?`, `projectId?`, `dueDate?`, ... | "Manage individual tasks: create, get, update, delete, list" |
| **D** | `vikunja_task_assignees` | `operation: assign\|unassign\|list-assignees`, `id`, `assignees?` | "Manage task assignments: assign users, unassign users, list assignees" |
| **D** | `vikunja_task_bulk` | `operation: bulk-create\|bulk-update\|bulk-delete`, `taskIds?`, `tasks?`, `projectId?` | "Manage bulk task operations: create, update, delete multiple tasks" |
| **D** | `vikunja_task_comments` | `operation: comment`, `id`, `comment`, `commentId?` | "Manage task comments: add comments to tasks" |
| **D** | `vikunja_task_labels` | `operation: apply-label\|remove-label\|list-labels`, `id`, `labels?` | "Manage task labels: apply, remove, list labels" |
| **D** | `vikunja_task_relations` | `operation: relate\|unrelate\|relations`, `id`, `otherTaskId?`, `relationKind?` | "Manage task relationships: relate tasks, unrelate tasks, list relations" |
| **D** | `vikunja_task_reminders` | `operation: add-reminder\|remove-reminder\|list-reminders`, `id`, `reminderDate?`, `reminderId?` | "Manage task reminders: add, remove, list reminders" |
| 20 | `vikunja_projects` | `subcommand` (16 values: list, get, create, update, delete, archive, unarchive, get-children, get-tree, get-breadcrumb, move, create-share, list-shares, get-share, delete-share, auth-share), plus 20+ parameter fields | "Manage projects with full CRUD operations, hierarchy management, and sharing capabilities" |
| **D** | `vikunja_projects_crud` | (CRUD subset of vikunja_projects) | "Project CRUD operations (list, get, create, update, delete, archive, unarchive)" |
| **D** | `vikunja_projects_hierarchy` | (hierarchy subset of vikunja_projects) | "Project hierarchy operations (children, tree, breadcrumb, move)" |
| **D** | `vikunja_projects_sharing` | (sharing subset of vikunja_projects) | "Project sharing operations (create_share, list_shares, get_share, delete_share, auth_share)" |
| **D** | `vikunja_projects_team_sharing` | (team sharing subset of vikunja_projects) | "Manage team-based project sharing (share-team, list-team-shares, get-team-share, update-team-share, remove-team-share)" |

**Legend**: `**D**` = duplicate/overlapping tool proposed for removal.

### Duplicate map

```
TASKS (7 duplicates)
├── vikunja_tasks (master) ──create, get, update, delete, list─────────────────
│                                                                               
├── vikunja_task_crud ......... create, get, update, delete, list               
├── vikunja_task_assignees .... assign, unassign, list-assignees                
├── vikunja_task_bulk ......... bulk-create, bulk-update, bulk-delete           
├── vikunja_task_comments ..... comment                                         
├── vikunja_task_labels ....... apply-label, remove-label, list-labels          
├── vikunja_task_relations .... relate, unrelate, relations                     
└── vikunja_task_reminders .... add-reminder, remove-reminder, list-reminders    

PROJECTS (4 duplicates)
├── vikunja_projects (master) ──list, get, create, update, delete, archive, 
│                               unarchive, get-children, get-tree, get-breadcrumb,
│                               move, create-share, list-shares, get-share, 
│                               delete-share, auth-share
│
├── vikunja_projects_crud ........... subset of above
├── vikunja_projects_hierarchy ...... subset of above
├── vikunja_projects_sharing ........ subset of above
└── vikunja_projects_team_sharing ... subset of above
```

### Description quality audit

| Quality | Count | Examples |
|---------|-------|---------|
| ✅ Good (usage + what + when) | 4 | `vikunja_auth`, `vikunja_batch_import`, `vikunja_webhooks`, `vikunja_filters` (post-fix) |
| ⚠️ Adequate (what, no when) | 10 | `vikunja_tasks`, `vikunja_projects`, `vikunja_labels`, `vikunja_teams`, `vikunja_users`, `vikunja_templates`, `vikunja_export_project`, `vikunja_request_user_export`, `vikunja_download_user_export`, `vikunja_batch_import` |
| ❌ Poor (too generic / misleading) | 10 | All 7 task duplicates + all 4 project duplicates |

---

## Expected Behavior

An LLM agent interacting with the MCP server should reliably:

1. **Find the right tool** for any Vikunja operation without ambiguity
2. **Not have to choose between duplicate tools** that do the same thing
3. **Understand from the description** exactly when to use each tool and what it returns
4. **Have a clear tool hierarchy**: one tool per domain (tasks → `vikunja_tasks`, projects → `vikunja_projects`, etc.)

After consolidation, the server exposes exactly **13 tools**:

| # | Tool | Domain | Subcommand Count |
|---|------|--------|-----------------|
| 1 | `vikunja_auth` | Auth | 5 |
| 2 | `vikunja_batch_import` | Import | 1 (flat) |
| 3 | `vikunja_filters` | Filters | 7 |
| 4 | `vikunja_labels` | Labels | 5 |
| 5 | `vikunja_templates` | Templates | 6 |
| 6 | `vikunja_users` | Users | 4 |
| 7 | `vikunja_teams` | Teams | 6 |
| 8 | `vikunja_webhooks` | Webhooks | 6 |
| 9 | `vikunja_export_project` | Project Export | 1 (flat) |
| 10 | `vikunja_request_user_export` | User Export | 1 (flat) |
| 11 | `vikunja_download_user_export` | User Export | 1 (flat) |
| 12 | **`vikunja_tasks`** (only) | Tasks | 22 |
| 13 | **`vikunja_projects`** (only) | Projects | 16 |

Each description follows this template:

```
{What this tool does}. Use when {when to use it}. Returns {what the LLM can expect back}.
```

Example for `vikunja_tasks`:
```
"Comprehensive task management: create, update, delete, list, assign, comment, 
attach files, set relations, manage reminders and labels. Use for ALL task 
operations including CRUD, assignments, comments, attachments, relations, 
reminders, labels, and bulk operations. Returns task data with status, 
assignees, labels, and metadata."
```

---

## Actual Behavior

The LLM sees 24 tools in the `tools/list` response. The context window is dominated by tool schemas. The LLM must decide between:
- `vikunja_tasks` with `subcommand: "create"` OR `vikunja_task_crud` with `operation: "create"`
- `vikunja_projects` with `subcommand: "create-share"` OR `vikunja_projects_sharing` with `subcommand: "create_share"`

This produces inconsistent behavior:
- **Same prompt, different tool selection across sessions**: The LLM picks arbitrarily
- **Tool not found errors**: The LLM skips tools because it can't differentiate them
- **Wrong subcommand in wrong tool**: The LLM mixes parameters between the duplicate tools
- **Hallucinated error reasons**: When a tool fails (wrong parameters, wrong selection), the LLM invents reasons like "user lacks permissions" instead of recognizing tool misuse

---

## Root Cause Analysis

### Cause 1: Legacy accumulation

The MCP server evolved organically:
1. First, specific tools were added for each operation (`vikunja_task_crud`, `vikunja_task_assignees`, etc.)
2. Later, a master `vikunja_tasks` tool was added to consolidate everything
3. The old tools were never removed

Same pattern for projects.

### Cause 2: No LLM-first design

Tools were designed with a developer API mindset (one endpoint → one tool) rather than an LLM-first mindset (one domain → one tool with clear descriptions). The MCP SDK's `server.tool()` API makes it easy to add tools but provides no guidance on consolidation.

### Cause 3: Descriptions written for humans, not LLMs

Tool descriptions describe WHAT the tool does but not WHEN to use it or WHAT it returns. LLMs rely on this metadata for selection decisions. Compare:

```typescript
// ❌ LLM must guess when to use this
description: 'Manage task comments: add comments to tasks'

// ✅ LLM knows exactly when
description: 'Add, list, and manage comments on tasks. Use when the user asks 
to leave a note, discuss a task, or view conversation history on a specific 
task. Requires a task ID. Returns the comment with author, timestamp, and content.'
```

---

## Proposed Solution

### Option A: Remove duplicates + rewrite descriptions (recommended)

**Phase 1 — Remove duplicate task tools**

Delete these tool registrations (the handler functions can remain as imports used by `vikunja_tasks`):
- `vikunja_task_crud` → remove tool registration only
- `vikunja_task_assignees` → remove tool registration only
- `vikunja_task_bulk` → remove tool registration only
- `vikunja_task_comments` → remove tool registration only
- `vikunja_task_labels` → remove tool registration only
- `vikunja_task_relations` → remove tool registration only
- `vikunja_task_reminders` → remove tool registration only

**Phase 2 — Remove duplicate project tools**

Delete these tool registrations:
- `vikunja_projects_crud` → remove tool registration only
- `vikunja_projects_hierarchy` → remove tool registration only
- `vikunja_projects_sharing` → remove tool registration only
- `vikunja_projects_team_sharing` → remove tool registration only

**Phase 3 — Rewrite all remaining 13 tool descriptions**

Each description must include:
- **What**: The operations the tool supports
- **When**: Use cases and user-intent triggers
- **Returns**: What the LLM can expect in the response

Use this template:

```
{Supported operations summary}. Use when {trigger conditions / user intent}. 
Returns {response type with key fields}.
```

**Phase 4 — Add `required` annotations to input schemas**

Ensure all mandatory fields are marked `.required()` or use a `required` array in the schema. Currently some tools use `.optional()` on fields that are actually required for certain subcommands (e.g., `id` for `get` operations). While Zod validates at the handler level, the MCP schema should hint at typical requirements.

**Note**: `required` annotations for conditional fields (field A is required when subcommand=X) is a known MCP SDK limitation. The workaround is a clear description: `"id: Required when subcommand is 'get', 'update', or 'delete'"`.

---

### Detailed description rewrites

#### 1. vikunja_auth
```
Manage Vikunja authentication: connect, status, refresh, disconnect, and login with 
username/password. Use when the user needs to authenticate, check connection status, 
refresh the session, or disconnect. Returns authentication status and auth type 
(JWT vs API token). See also: VIKUNJA_API_TOKEN env var for auto-login.
```

#### 2. vikunja_batch_import
```
Import tasks in bulk from CSV or JSON format. Use when the user wants to import 
multiple tasks at once from a file or formatted data. Supports dry-run for 
preview. Returns import summary with counts of created, skipped, and failed tasks.
```

#### 3. vikunja_filters
```
Manage saved filters and build filter conditions for tasks and projects. Use when 
the user wants to list, create, update, delete saved filters, or build a filter 
string from conditions (field, operator, value). For building, pass 'conditions' 
as a top-level array alongside 'action: "build"'. Returns filter data or a 
valid filter string.
```

#### 4. vikunja_labels
```
Manage global labels: list, get, create, update, delete. Use when the user wants 
to organize tasks with labels. Labels created here can be applied to any task 
via vikunja_tasks with subcommand 'apply-label'. Returns label data with id, 
title, hexColor, and description.
```

#### 5. vikunja_templates
```
Manage task templates: create, list, get, update, delete, instantiate. Use when 
the user wants to create reusable task templates from existing projects, or 
instantiate a template into a new project. Returns template data with tasks, 
labels, and project structure.
```

#### 6. vikunja_users
```
Manage user profiles: get current user, search users, view and update settings 
and notification preferences. Use when the user asks about their profile, wants 
to find other users, or change settings like language, timezone, or email 
reminders. Requires JWT authentication. Returns user data with profile and 
settings.
```

#### 7. vikunja_teams
```
Manage teams and team memberships: create, list, get, update, delete teams, and 
manage members (add, remove, list, update admin status). Use when the user wants 
to organize users into teams for project sharing. Returns team data with member 
list and permissions.
```

#### 8. vikunja_webhooks
```
Manage webhooks for Vikunja event integration: list, get, create, update, delete 
webhooks, and list available event types. Use when the user wants to receive 
notifications or trigger external services on Vikunja events. Returns webhook 
data with target URL, events, and secret.
```

#### 9. vikunja_export_project
```
Export a project's data including tasks, labels, and metadata in structured 
format. Use when the user wants to back up or migrate a project. Optionally 
include child projects. Returns project data as structured JSON. Requires JWT 
authentication.
```

#### 10. vikunja_request_user_export
```
Request a full data export of the authenticated user's data for privacy, backup, 
or migration. Use when the user wants to download all their Vikunja data. The 
password parameter is optional if VIKUNJA_EXPORT_PASSWORD is set. Returns a 
confirmation message; the export file is available via vikunja_download_user_export 
once ready.
```

#### 11. vikunja_download_user_export
```
Download a previously requested user data export file. Use AFTER calling 
vikunja_request_user_export. The password parameter is optional if 
VIKUNJA_EXPORT_PASSWORD is set. Returns the export file as a download.
```

#### 12. vikunja_tasks
```
THE task management tool: create, get, update, delete, list, assign/unassign users, 
add/list/remove labels, add/list/remove comments, add/list/remove reminders, 
relate/unrelate tasks, attach files, and bulk operations. Use for ALL task 
operations. This is the ONLY task tool you need.
```
**Parameters to keep**: All current `vikunja_tasks` parameters (22 subcommands + 30+ fields). No changes needed.
**Note**: Some Vikunja API fields (`percentDone`, `startDate`, `endDate`, `hexColor`) are not persisted by the MCP (known limitation — see PRD_CONSOLIDATED_BUGS.md).

#### 13. vikunja_projects
```
THE project management tool: list, get, create, update, delete, archive/unarchive, 
get hierarchy (children, tree, breadcrumb), move projects, and manage sharing 
(create/list/get/delete shares, auth-share, team sharing). Use for ALL project 
operations. This is the ONLY project tool you need. For team sharing, use 
subcommand 'share-team' with right: 'read'|'write'|'admin'.
```
**Parameters to keep**: All current `vikunja_projects` parameters (16 subcommands + 20+ fields). No changes needed.

---

### Schema improvements

In addition to descriptions, add `required` annotations where possible:

**vikunja_batch_import**: Add `required: ['projectId', 'format', 'data']` to Zod schema (these are already validated manually but should be schema-level).

**vikunja_export_project**: Add `required: ['projectId']` (already validated).

**vikunja_task_assignees (if kept)**: The `id` field is always required but not marked mandatory in Zod (it uses `.optional()` at schema level, validated inside handler). For `vikunja_tasks` (the survivor), ensure `id` is marked required in the description.

**vikunja_tasks**: For subcommands that require `id` (get, update, delete, assign, unassign, etc.), the description should state: "`id` is required for get, update, delete, assign, unassign, comment, relate, unrelate, add-reminder, remove-reminder, list-assignees, list-reminders, list-labels, apply-label, remove-label operations."

**vikunja_projects**: Similarly for subcommands requiring `id` (get, update, delete, archive, etc.).

---

### Code changes required

#### Files to modify in `src/tools/`:

| File | Change |
|------|--------|
| `src/tools/index.ts` | Stop importing/registering duplicate task and project tools |
| `src/tools/task-crud.ts` | Remove `server.tool(...)` registration, keep handler functions |
| `src/tools/task-assignees.ts` | Remove `server.tool(...)` registration, keep handler functions |
| `src/tools/task-bulk.ts` | Remove `server.tool(...)` registration, keep handler functions |
| `src/tools/task-comments.ts` | Remove `server.tool(...)` registration, keep handler functions |
| `src/tools/task-labels.ts` | Remove `server.tool(...)` registration, keep handler functions |
| `src/tools/task-relations.ts` | Remove `server.tool(...)` registration, keep handler functions |
| `src/tools/task-reminders.ts` | Remove `server.tool(...)` registration, keep handler functions |
| `src/tools/tasks/index.ts` | Update description string only (no logic changes) |
| `src/tools/projects/index.ts` | Remove `registerProjectsCrudTool`, `registerProjectsHierarchyTool`, `registerProjectsSharingTool` calls; update description string |
| `src/tools/projects/team-sharing.ts` | Remove `registerProjectTeamSharingTool` (merged into `vikunja_projects`) |
| `src/tools/auth.ts` | Update description string |
| `src/tools/batch-import.ts` | Update description string |
| `src/tools/filters.ts` | Update description string |
| `src/tools/labels.ts` | Update description string |
| `src/tools/templates.ts` | Update description string |
| `src/tools/users.ts` | Update description string |
| `src/tools/teams.ts` | Update description string |
| `src/tools/webhooks.ts` | Update description string |
| `src/tools/export.ts` | Update description strings for all 3 export tools |

#### Files NOT to modify:

- `src/tools/projects/crud.ts`, `src/tools/projects/hierarchy.ts`, `src/tools/projects/sharing.ts` — These are helper modules (no tool registration), keep as-is

---

### Migration / backward compatibility

Since this is a breaking change (7 task tools + 4 project tools removed), consider:

**Option A (breaking)**: Remove duplicates immediately. Existing code/clients using the specific tools will break. Update tests accordingly.

**Option B (deprecation period)**: Keep duplicate tools but mark them as deprecated in the description and add a deprecation log message. Example:

```typescript
server.tool('vikunja_task_crud', '[DEPRECATED] Use vikunja_tasks instead. ' + 
  'Manage individual tasks: create, get, update, delete, list', {
  // ... keep schema
}, async (args) => {
  logger.warn('vikunja_task_crud is deprecated, use vikunja_tasks instead');
  // ... delegate to vikunja_tasks handler
});
```

After a transition period (e.g., 2 releases), remove the deprecated tools.

**Recommended**: Option A (breaking). The only client is the LLM agent, which has no persistent memory of tool names between sessions. Breaking changes are safe because the LLM reads the `tools/list` response fresh each session.

---

## Impact

### Positive

- **24 → 13 tools** (46% reduction)
- **LLM selection accuracy**: Fewer choices means more deterministic behavior
- **Context window savings**: ~46% fewer tool schemas in the system prompt
- **No more tool ambiguity**: Exactly one tool for tasks, one for projects
- **Better error messages**: Descriptions tell the LLM what to expect
- **Self-documenting**: The descriptions serve as in-prompt documentation

### Negative

- **Breaking change**: Existing scripts/code calling removed tools will break
- **Larger individual tool schemas**: `vikunja_tasks` and `vikunja_projects` have large schemas (22 and 16 subcommands respectively). This is acceptable because the MCP SDK's JSON Schema representation is still compact relative to 11 extra tool registrations.
- **Handler complexity**: The master tools must handle all subcommand validation internally (already done).

### Risk assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| LLM confuses subcommand values within a large tool | Medium | Clearly document each subcommand's required params in the description |
| Breaking changes affect automation | Low | Only the LLM agent uses these tools; no external API consumers |
| Missing subcommand in master tool | Low | Audit: `vikunja_tasks` already covers all 22 subcommands from all 7 duplicates |
| Tests fail after removal | High | Must update test files to call `vikunja_tasks` instead of removed tools |

---

## Test updates required

When removing duplicate tools, update:

| Test file | Change |
|-----------|--------|
| `tests/tools/export.test.ts` | No change needed (calls export tools directly) |
| `tests/utils/error-handler.test.ts` | No change needed |
| Any test calling `vikunja_task_crud` directly | Redirect to `vikunja_tasks` with matching subcommand |
| Any test calling `vikunja_task_assignees` directly | Redirect to `vikunja_tasks` with matching subcommand |
| Any test calling `vikunja_task_bulk` directly | Redirect to `vikunja_tasks` with matching subcommand |
| Any test calling `vikunja_task_comments` directly | Redirect to `vikunja_tasks` with matching subcommand |
| Any test calling `vikunja_task_labels` directly | Redirect to `vikunja_tasks` with matching subcommand |
| Any test calling `vikunja_task_relations` directly | Redirect to `vikunja_tasks` with matching subcommand |
| Any test calling `vikunja_task_reminders` directly | Redirect to `vikunja_tasks` with matching subcommand |
| Any test calling duplicate project tools directly | Redirect to `vikunja_projects` with matching subcommand |

Our existing integration tests in `mcp-integration.test.js` call `vikunja_task_crud`, `vikunja_task_assignees`, `vikunja_task_comments`, `vikunja_task_labels`, `vikunja_task_relations`, and `vikunja_task_reminders`. These must be updated.

---

## Implementation order

```
Phase 1: Remove duplicate task tools (7 tools)
  ├── Remove registration calls from src/tools/index.ts
  ├── Remove server.tool() blocks from each file
  └── Update all tests

Phase 2: Remove duplicate project tools (4 tools)  
  ├── Remove registration calls from src/tools/index.ts
  ├── Remove server.tool() blocks from each file  
  └── Update all tests

Phase 3: Rewrite descriptions (13 tools)
  ├── Update description strings in each tool file
  └── Review for consistency

Phase 4: Schema annotations
  ├── Add required annotations where possible
  ├── Update field descriptions for conditional requirements
  └── Verify with tools/list output
```

Total: 24 → 13 tools.

---

## References

- Source: `src/tools/tasks/index.ts` — master task tool
- Source: `src/tools/projects/index.ts` — master project tool
- Affected removals: `src/tools/task-crud.ts`, `src/tools/task-assignees.ts`, `src/tools/task-bulk.ts`, `src/tools/task-comments.ts`, `src/tools/task-labels.ts`, `src/tools/task-relations.ts`, `src/tools/task-reminders.ts`, `src/tools/projects/team-sharing.ts`
- Helper modules (keep): `src/tools/projects/crud.ts`, `src/tools/projects/hierarchy.ts`, `src/tools/projects/sharing.ts`
- Integration tests: `tests/mcp-integration.test.js` (must update all removed tool calls)

---

## Appendix A: Before/After tool list

### Before (24 tools)
```
vikunja_auth
vikunja_batch_import
vikunja_export_project
vikunja_request_user_export
vikunja_download_user_export
vikunja_filters
vikunja_labels
vikunja_task_assignees       ← DUPLICATE
vikunja_task_bulk            ← DUPLICATE
vikunja_task_comments        ← DUPLICATE
vikunja_task_crud            ← DUPLICATE
vikunja_task_labels          ← DUPLICATE
vikunja_task_relations       ← DUPLICATE
vikunja_task_reminders       ← DUPLICATE
vikunja_teams
vikunja_templates
vikunja_users
vikunja_webhooks
vikunja_projects
vikunja_projects_crud        ← DUPLICATE
vikunja_projects_hierarchy   ← DUPLICATE
vikunja_projects_sharing     ← DUPLICATE
vikunja_projects_team_sharing ← DUPLICATE
vikunja_tasks
```

### After (13 tools)
```
vikunja_auth
vikunja_batch_import
vikunja_export_project
vikunja_request_user_export
vikunja_download_user_export
vikunja_filters
vikunja_labels
vikunja_teams
vikunja_templates
vikunja_users
vikunja_webhooks
vikunja_tasks                ← SURVIVOR (keeps all 22 subcommands)
vikunja_projects             ← SURVIVOR (keeps all 16 subcommands)
```
