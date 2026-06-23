# Design: fix-projects-update-identifier

## Technical Approach

The `projects.update` tool (and other CRUD operations) currently pass a hardcoded `customMessage` (`"Project with ID ${id} not found"`) to `handleStatusCodeError`. Due to the previous `fix-unknown-error-handler` change, the error handler now respects `customMessage` for ALL status codes, not just 404s. This causes real API validation errors (e.g., 400 Bad Request for an invalid or duplicate `identifier`) to be masked by the misleading "Project not found" message.

The fix is to remove the hardcoded `customMessage` argument from all `handleStatusCodeError` calls in `src/tools/projects/crud.ts` and `src/tools/projects/hierarchy.ts`. The `error-handler.ts` already natively generates the exact same 404 message (`"Project with ID ${id} not found"`) using its `extractResourceType` fallback logic. For non-404 status codes, removing `customMessage` allows the handler to extract and propagate the actual API error message, correctly exposing validation errors to the user.

## Architecture Decisions

### Decision: Remove hardcoded `customMessage` arguments

**Choice**: Remove the `customMessage` argument from 6 callsites of `handleStatusCodeError`.
**Alternatives considered**:

- Dynamically build the `customMessage` based on the exact status code before calling the handler.
- Modify `handleStatusCodeError` to ignore `customMessage` for non-404s.
  **Rationale**: `handleStatusCodeError` is designed to provide excellent defaults. It natively falls back to exactly `"Project with ID ${id} not found"` on 404 when `customMessage` is absent. Removing the redundant argument eliminates the masking bug with minimal code changes while leveraging the centralized error handler's intended behavior.

### Decision: Update mock tests to simulate 400 status codes

**Choice**: Update the "should handle API errors" tests for the affected operations to attach `.statusCode = 400` to the mock errors.
**Alternatives considered**: Leave tests as-is, since they currently throw standard `Error` objects without a status code.
**Rationale**: Simulating a real HTTP API error with a status code ensures the test suite actively prevents regressions of this error-masking bug. If the masking bug returns, these tests will fail because they would incorrectly receive a "not found" message instead of the expected API error message.

## Data Flow

    API (400 Bad Request: "Identifier already exists")
         │
         ▼
    Node-Vikunja Client throws Error (statusCode: 400, message: "Identifier already exists")
         │
         ▼
    crud.ts catches error
    Calls handleStatusCodeError(error, 'Failed to update project', id)  // No customMessage
         │
         ▼
    SecureErrorHandler.handleStatusCode
    - Is 404? No.
    - Has customMessage? No.
    - Extracts message: "Identifier already exists"
    - Returns MCPError(API_ERROR, "Failed to update project: Identifier already exists")

## File Changes

| File                              | Action | Description                                                                                                                                                                                                       |
| --------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/tools/projects/crud.ts`      | Modify | Remove `customMessage` arg (`"Project with ID ${id} not found"`) from calls to `handleStatusCodeError` in `getProject`, `updateProject`, `deleteProject`, `archiveProject`, and `unarchiveProject`.               |
| `src/tools/projects/hierarchy.ts` | Modify | Remove `customMessage` arg from the `handleStatusCodeError` call in `moveProject`.                                                                                                                                |
| `tests/tools/projects.test.ts`    | Modify | Update "should handle API errors" tests for `get`, `update`, `delete`, `archive`, `unarchive`, and `move` subcommands to attach `.statusCode = 400` to the mock `Error` to ensure real API errors are not masked. |

## Interfaces / Contracts

No changes to interfaces or contracts. `handleStatusCodeError` already takes `customMessage` as an optional 4th parameter.

## Testing Strategy

| Layer | What to Test          | Approach                                                                                                                                                                                  |
| ----- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit  | Real API Errors (400) | Modify `tests/tools/projects.test.ts` API error tests to set `.statusCode = 400` on the mock error and verify it returns `"Failed to {operation}: {API Error}"` instead of a 404 message. |
| Unit  | 404 Fallback          | Existing 404 tests verify that `"Project with ID {id} not found"` is correctly generated. These will remain untouched and should pass.                                                    |

## Migration / Rollout

No migration required.

## Open Questions

- [ ] None. The error handler's native fallback logic has been verified to exactly match the previously hardcoded 404 message.
