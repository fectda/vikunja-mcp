# Design: Consolidate Tools and Descriptions

## Technical Approach

We will drastically reduce MCP context bloat by removing duplicate tool registrations. Handlers for specialized subcommands (crud, assignees, bulk, comments, labels, relations, reminders for tasks; and crud, hierarchy, sharing, team-sharing for projects) will be kept as-is, but the `server.tool(...)` registrations will be removed from their individual files. The master tools (`vikunja_tasks` and `vikunja_projects`) will route these commands internally.

Team sharing subcommands will be merged into `vikunja_projects` by extending its Zod enum and `switch` block, redirecting execution to the existing `team-sharing.ts` handlers.

Tool descriptions will be rewritten to fit the "What + When + Returns" pattern, improving deterministic LLM tool selection. `.required()` annotations will be added to the parameter schemas where constraints apply uniformly.

## Architecture Decisions

### Decision: Break existing scripts vs Deprecation Period

**Choice**: Remove redundant tools immediately (Breaking change).
**Alternatives considered**: Warn via `logger.warn` and keep tools for a deprecation period.
**Rationale**: The primary consumer of this server is an LLM agent, not a persistent API client script. LLMs read the available tool schema dynamically on each session, meaning there are no "broken builds" to worry about, and context savings take effect instantly.

### Decision: Centralized vs Decentralized Dispatch

**Choice**: Use `src/tools/tasks/index.ts` and `src/tools/projects/index.ts` as the sole centralized tool routers (master tools).
**Alternatives considered**: Group subcommands into two or three large categories.
**Rationale**: LLM context limits prefer a single clear domain entrypoint. The current handler functions export well, allowing the master tool to delegate logic natively.

## Data Flow

```text
LLM request ──→ MCP SDK (vikunja_projects)
                     │
                     ▼
           subcommand: 'share-team'
                     │
                     ▼
             projects/index.ts
            (switch statement)
                     │
                     ▼
          projects/team-sharing.ts
             shareTeam(args)
                     │
                     ▼
            Vikunja REST API
```

## File Changes

| File                                 | Action | Description                                                                                                                                                                                         |
| ------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/tools/index.ts`                 | Modify | Remove imports and registrations for 7 redundant task tools and 4 project tools.                                                                                                                    |
| `src/tools/task-*.ts` (7 files)      | Modify | Remove `server.tool()` blocks; ensure internal operations are exported.                                                                                                                             |
| `src/tools/projects/index.ts`        | Modify | Add `teamId: z.number().positive().optional()` parameter and 'share-team' etc. to subcommand enum. Delegate to team-sharing methods. Remove `registerProjectTools` export. Update tool description. |
| `src/tools/projects/team-sharing.ts` | Modify | Remove `server.tool()` block; export team sharing handler methods.                                                                                                                                  |
| `src/tools/tasks/index.ts`           | Modify | Update description string to "What + When + Returns" format.                                                                                                                                        |
| `src/tools/*.ts` (all survivors)     | Modify | Update description strings and add Zod `.required()` where uniformly applicable.                                                                                                                    |
| `tests/tools/*.test.ts` (various)    | Modify | Replace old tool name invocations with `vikunja_tasks` or `vikunja_projects`.                                                                                                                       |

## Interfaces / Contracts

The `vikunja_projects` parameter schema will be extended to include team sharing fields:

```typescript
// Add to vikunja_projects args schema in src/tools/projects/index.ts
teamId: z.number().positive().optional(),
```

The enum for subcommands will gain:

```typescript
('share-team', 'list-team-shares', 'get-team-share', 'update-team-share', 'remove-team-share');
```

Descriptions across the codebase will match this format strictly:
`{What this tool does}. Use when {when to use it}. Returns {what the LLM can expect back}.`

## Testing Strategy

| Layer       | What to Test           | Approach                                                                                                        |
| ----------- | ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| Unit        | Existing Tool Handlers | Ensure individual `task-*.test.ts` now call `vikunja_tasks` instead of duplicate tools to verify routing works. |
| Integration | Subcommand execution   | Verify `vikunja_projects` successfully triggers `share-team` handler.                                           |
| Validation  | Schema Constraints     | Ensure tools reject calls missing `.required()` fields properly.                                                |

## Migration / Rollout

No database or state migration required. Just a standard Git rollout. The MCP client must refresh its tool list after upgrade.

## Open Questions

- [ ] None
