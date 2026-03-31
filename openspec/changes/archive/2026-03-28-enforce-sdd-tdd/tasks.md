# Tasks: Enforce SDD + TDD

## Implementation Tasks

- [ ] **1. Rename CLAUDE.md to AGENTS.md**
  - Rename the file using git mv or bash command
  - Verify rename succeeded

- [ ] **2. Update AGENTS.md with SDD requirements**
  - Add SDD Requirements section explaining when to use SDD
  - Include artifact store policy
  - Document command shortcuts (/sdd-new, /sdd-continue, /sdd-ff, etc.)

- [ ] **3. Update AGENTS.md with TDD requirements**
  - Add TDD Requirements section
  - Explain test-first development
  - Document coverage thresholds (90% branches, 95% lines)
  - Include contract test instructions

- [ ] **4. Verify changes**
  - Run: npm run lint
  - Run: npm run typecheck
  - Run: npm run test:coverage

## Dependencies

- None - this is a self-contained documentation change

## Completion Criteria

1. AGENTS.md exists with SDD and TDD sections
2. All pre-commit checks pass
3. SDD artifacts complete (proposal → specs → design → tasks → apply → verify → archive)
