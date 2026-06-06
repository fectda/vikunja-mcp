# Explore: fix-team-members-add-schema

## Current State

The `vikunja_teams` tool's `members.add` subcommand currently expects a `userId` argument. When making the API call to Vikunja's `PUT /teams/{id}/members` endpoint, it sends the request body `{"user_id": <number>, "admin": <boolean>}`.
However, Vikunja's API schema for adding a team member requires `username` instead of `user_id`. Because `username` is missing in the payload, Vikunja throws a 400 Bad Request with error code 1005 "The user does not exist." The MCP server wraps this error and propagates it to the user.

## Affected Areas

- `src/tools/teams.ts`:
  - `registerTeamsTool` schema: The schema currently accepts `userId` but lacks `username`. We need to add `username: z.string().optional()` so it can be passed for the `add` operation.
  - `case 'add':` block: The logic checks for `args.userId`, validates it, constructs the body with `user_id`, and passes it in the PUT request. It also returns `userId` in the `createStandardResponse` context.
- `tests/tools/teams.test.ts`:
  - The `members add subcommand` tests check for `userId` validation, success, and error paths. These need to be updated to pass and expect `username` instead.
  - Mock fetch calls in tests need to expect `{"username": "testuser"}` in the request body instead of `{"user_id": 3}`.

## Approaches

**Option A (Recommended by PRD)**: Add `username` to the MCP tool's Zod schema. Update the `members.add` handler to require and use `args.username` instead of `args.userId`. The PUT body will send `{"username": args.username, "admin": args.admin}`.

- _Pros_: Aligns directly with Vikunja's API schema. Solves the underlying bug cleanly and restores the correct behavior.
- _Cons_: Introduces a breaking change for callers that currently rely on `userId` (though the current behavior is broken anyway).

**Option B (Backward Compatibility)**: Keep `userId` in the schema and the `add` handler. Make an additional API call `GET /users/{userId}` to resolve the user's `username`, then send the PUT request with the resolved `username`.

- _Pros_: Preserves the existing `userId` interface for callers.
- _Cons_: Slower due to an extra API roundtrip. Unnecessary complexity. Callers might not even have permissions to list users globally.

## Recommendation

We will proceed with **Option A** as recommended by the PRD. The current `userId` behavior is non-functional due to the API rejection, so changing the interface to `username` is the most direct and correct solution.

## Risks

- Since we are modifying the Zod schema for `vikunja_teams`, we must ensure that `userId` remains available as an optional parameter because the `remove` and `update` subcommands still rely on it.
- Updating tests to use `username` instead of `userId` will touch multiple assertions in `tests/tools/teams.test.ts`.

## Ready for Proposal

Yes. The problem is well-understood, the affected code paths are isolated within the `vikunja_teams` tool, and the solution is straightforward.
