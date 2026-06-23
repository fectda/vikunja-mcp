## Exploration: fix-teams-members-list

### Current State

In `src/tools/teams.ts`, the `members` subcommand with `memberSubcommand: 'list'` executes the following API call (around line 307):

```typescript
const response = await fetch(`${session.apiUrl}/teams/${teamId}/members`, {
  method: 'GET',
  // ...
});
```

This is meant to retrieve the members of a team. However, it results in a `405 Method Not Allowed` error when called.

### Affected Areas

- `src/tools/teams.ts` — The `members.list` case handles fetching the members. It needs to be updated to target the correct endpoint and parse the embedded array.
- `tests/tools/teams.test.ts` — Tests currently assert that `fetch` is called with `/teams/{id}/members`. The mock and assertion must be updated to match the correct behavior.

### Approaches

1. **Reuse the team resource (`GET /teams/{id}`)** — Call the team endpoint and extract the embedded `members` array.
   - Pros: Matches the API contract perfectly. Identical pattern to the `6b01e22` fix in `projects/team-sharing.ts`. No new abstractions needed.
   - Cons: Fetches slightly more data than strictly necessary (the whole team object), but Vikunja payloads are small so this is negligible.
   - Effort: Low

2. **Extract a shared `getTeam` helper** — Refactor `teams.ts` to use a shared helper for all operations requiring the team object.
   - Pros: More DRY.
   - Cons: Larger refactoring footprint, distracting from the immediate bug fix.
   - Effort: Medium

### Recommendation

**Reuse the team resource (`GET /teams/{id}`) (Approach 1)**. It's the most direct and safest fix, and perfectly mirrors the precedent set by commit `6b01e22`.

### Risks

- If a team has no members, the Vikunja API might omit the `members` property entirely or return `null`. The implementation must defensively default to `[]` (e.g., `team.members ?? []`).
- Tests must be carefully updated since we're changing the mocked HTTP route and the shape of the mock response in `tests/tools/teams.test.ts`.

### Related Work

The proposal `openspec/changes/teams-api-fixes/proposal.md` documented HTTP verb corrections for `teams.update`, `members.add`, `members.update`, and `members.remove`, but it completely missed `members.list`, presumably because it was a `GET` request and the reviewer didn't catch that the route itself was non-existent.

### Ready for Proposal

Yes — The root cause is clear, the fix is trivial and has established precedent. The orchestrator can proceed to the `sdd-propose` phase.
