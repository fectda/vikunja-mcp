# Design: Enforce SDD + TDD

## Technical Approach

This change enforces SDD and TDD in the project by updating AGENTS.md.

## Current State

- CLAUDE.md exists but doesn't enforce SDD/TDD
- No requirement for test-first development
- Contract test exists but not documented

## Changes Required

### 1. Rename CLAUDE.md → AGENTS.md

### 2. Update AGENTS.md

Add sections:

- SDD Requirements
- TDD Requirements
- Contract Test
- Pre-commit requirements

## File Changes

| File      | Action | Description          |
| --------- | ------ | -------------------- |
| CLAUDE.md | Rename | To AGENTS.md         |
| AGENTS.md | Modify | Add SDD/TDD sections |

## Testing Strategy

| Check         | Approach               |
| ------------- | ---------------------- |
| SDD           | Verify artifacts exist |
| TDD           | Document in AGENTS.md  |
| Contract Test | Already working        |

## Open Questions

None - this is straightforward documentation update.
