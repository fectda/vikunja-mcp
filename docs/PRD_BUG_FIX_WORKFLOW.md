# Bug PRD Workflow

## Summary

This document establishes the AUTOMATIC workflow I follow whenever you provide a bug PRD in the `docs/` folder. You do not need to remind me — this flow is documented and applied by default.

---

## Automatic Bug Resolution Flow

```
PRD received → SDD (explore + propose + spec + design + tasks) → TDD → apply → verify → archive
```

### Step 1: Detect Bug PRD

**How I identify it:**

- New file in `docs/` containing bug details
- Keywords: "bug", "fix", "error", "issue", "regression", "fail", "crash"
- PRD structure with steps to reproduce, expected vs actual behavior

### Step 2: SDD Workflow (Mandatory)

**Command**: `/sdd-new <bug-name>`

The full SDD flow executes automatically:

| Phase       | Action                                        |
| ----------- | --------------------------------------------- |
| **Explore** | Investigate relevant code, analyze root cause |
| **Propose** | Document the solution approach with tradeoffs |
| **Spec**    | Write specs with test scenarios               |
| **Design**  | Create technical design and architecture      |
| **Tasks**   | Break down into actionable tasks              |

### Step 3: TDD (Test-First)

**Before writing code:**

1. Write the FAILING test that reproduces the bug
2. Verify the test fails (red)
3. Implement the minimum solution to make it pass (green)
4. Refactor while keeping tests passing

**Mandatory Coverage:**

- Branches: 90%+
- Functions: 98%+
- Lines: 95%+
- Statements: 95%+

### Step 4: Apply + Verify

**Commands:**

- `/sdd-apply <bug-name>` — implement tasks
- `/sdd-verify <bug-name>` — validate against specs

**Pre-commit (always):**

```bash
npm run lint && npm run test:coverage && npm run typecheck && npm run test:contract
```

### Credentials for Testing

**File**: `.env` (never commit — it is in `.gitignore`)

**Supported variables:**

```bash
# Option 1: API Token
VIKUNJA_URL=http://your-server:3456
VIKUNJA_TOKEN=tk_xxxxxxx

# Option 2: Username + Password (automatically generates JWT)
VIKUNJA_URL=http://your-server:3456
VIKUNJA_USERNAME=your-username
VIKUNJA_PASSWORD=your-password
```

**Integration testing command:**

```bash
npm run test:mcp
```

**⚠️ Security rules:**

- **NEVER** commit `.env` — always verify it is in `.gitignore`
- Do not include real credentials in SDD artifacts
- Use test credentials whenever possible
- Mask any credentials that appear in logs

### Step 5: Archive

**Command**: `/sdd-archive <bug-name>`

- Persist artifacts to engram
- Update `docs/BUG_FIXES.md` with the solution
- Document the root cause and the fix

---

## Key Rules

### WHEN to use SDD+TDD

| Type of change               | SDD          | TDD          |
| ---------------------------- | ------------ | ------------ |
| Bug affecting multiple files | ✅ Mandatory | ✅ Mandatory |
| Simple bug (single file)     | ⚠️ Evaluate  | ⚠️ Evaluate  |
| Documentation                | ❌ No        | ❌ No        |
| Minor configuration          | ❌ No        | ❌ No        |

### TDD Principles

1. **Test first** — write the failing test before coding
2. **Minimum code** — only what is necessary to pass the test
3. **Refactor after** — improve without breaking tests
4. **Coverage** — all defensive code must have a test

### SDD Principles

1. **Explore first** — investigate the code before proposing
2. **Precise specs** — clear and verifiable scenarios
3. **Documented design** — architecture with tradeoffs
4. **Actionable tasks** — clear breakdown

---

## Workflow Example

```
1. User: Provides docs/PRD_BUG_AUTH.md
2. Me: Detect that it is a bug PRD
3. Me: Execute /sdd-new fix-auth-bug
   - explore: analyze src/auth/
   - propose: document approach
   - spec: define test scenarios
   - design: solution design
   - tasks: task breakdown
4. Me: Write failing test (reproduces bug)
5. Me: Implement minimal fix
6. Me: /sdd-apply fix-auth-bug
7. Me: /sdd-verify fix-auth-bug
8. Me: /sdd-archive fix-auth-bug
9. Me: Update docs/BUG_FIXES.md
```

---

## Exceptions

### When NOT to follow this flow:

1. **Trivial typo bug** — spelling error in message
2. **Environment config** — environment variables
3. **Docs update** — documentation only

### How I identify exceptions:

- If PRD mentions "fix typo" or "documentation" → simplified flow
- If it requires changes in only 1 file and has existing test coverage → evaluate
- When in doubt → prefer to follow the full flow (safe approach)

---

## Closure Checklist

When resolving a bug, I always verify:

- [ ] Test reproducing the bug is in `tests/`
- [ ] Test passes (green)
- [ ] `npm run test:coverage` passes thresholds
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run test:contract` passes
- [ ] Root cause is documented in `docs/BUG_FIXES.md`
- [ ] Artifact is saved in engram

---

## Final Note

This flow is documented so you do not need to remind me. Whenever I see a new bug PRD in `docs/`, I apply it automatically.

The reference to this workflow is in `AGENTS.md` so any agent working on this repo applies it automatically.

If there are special situations or particular constraints, I document them in the proposal to give you visibility.
