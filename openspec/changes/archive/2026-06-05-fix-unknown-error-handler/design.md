# Design: fix-unknown-error-handler

## Technical Approach

Currently, `SecureErrorHandler.handleStatusCode()` only uses the `customMessage` parameter when the error has a 404 status code. For all other status codes, the `customMessage` is discarded in favor of a generic `"Failed to {operation}: {message}"` string. We will modify `handleStatusCode` to use `customMessage` for non-404 errors as well, returning it wrapped in an `API_ERROR`. We must also sanitize the custom message to prevent sensitive information disclosure.

## Architecture Decisions

### Decision: Use customMessage for non-404 errors

**Choice**: Add an early return for non-404 errors when `customMessage` is present.
**Alternatives considered**:

- Modifying all callers to stop passing `customMessage` and construct the `MCPError` themselves (rejected because it's too invasive and defeats the purpose of the centralized handler).
- Ignoring `customMessage` for non-404s (status quo, rejected because it loses context).
  **Rationale**: `customMessage` is provided by the caller to give better context to the error. We should respect it, but safely sanitize it.

### Decision: Sanitize customMessage

**Choice**: Apply `this.sanitize(customMessage)` before returning.
**Alternatives considered**: Returning `customMessage` directly without sanitization.
**Rationale**: Even though callers define `customMessage`, they might interpolate unsanitized error payloads or API responses into it. Centralized sanitization protects against this.

## Data Flow

    Caller (e.g. teams.ts) ──(error, op, id, customMessage)──→ SecureErrorHandler.handleStatusCode()
                                                                       │
                                 ┌── (Yes) ── Is 404? ─────────────────┤
                                 │                                     │ (No)
                         Uses 404 logic                              Has customMessage?
                                                                       │
                                                     ┌── (Yes) ────────┴─────── (No) ──┐
                                                     │                                 │
                                            Sanitize customMessage           Extract default message
                                            Return API_ERROR                 Sanitize and format generic API_ERROR

## File Changes

| File                                | Action | Description                                                                                                           |
| ----------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------- |
| `src/utils/error-handler.ts`        | Modify | Add `if (customMessage) return new MCPError(ErrorCode.API_ERROR, this.sanitize(customMessage));` after the 404 block. |
| `tests/utils/error-handler.test.ts` | Modify | Add tests to verify `customMessage` is used and sanitized for non-404 status code errors.                             |

## Interfaces / Contracts

No new interfaces or changed signatures. The signature of `handleStatusCode` remains:

```typescript
handleStatusCode(
  error: unknown,
  operation: string,
  resourceId?: string | number,
  customMessage?: string,
): MCPError
```

## Testing Strategy

| Layer | What to Test                  | Approach                                                                                                                     |
| ----- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Unit  | non-404 customMessage         | Call `handleStatusCode` with a non-404 error and `customMessage`, assert it returns the custom message wrapped in API_ERROR. |
| Unit  | Sanitization of customMessage | Call with a non-404 error and a `customMessage` containing sensitive info (e.g. a token). Assert the token is redacted.      |

## Migration / Rollout

No migration required.

## Open Questions

- [ ] None. The change is isolated and straightforward.
