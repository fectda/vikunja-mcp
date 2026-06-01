# Design: Fix Teams Unknown Error

## Technical Approach

Modify `SecureErrorHandler.handleStatusCode` in `src/utils/error-handler.ts` to properly extract error messages from plain objects and fully utilize the `customMessage` argument for all HTTP status codes.

## Architecture Decisions

### Decision: Extracting message from plain objects

**Choice**: Add a branch in `handleStatusCode` to check `typeof error === 'object'` and extract the `message` property.
**Alternatives considered**: Deep-merging error details or using a utility library to parse errors.
**Rationale**: `SecureErrorHandler.transform` already uses a simple `Object.prototype.hasOwnProperty.call(error, 'message')` check. Duplicating this simple branch maintains consistency and avoids pulling in heavy dependencies for simple object parsing.

### Decision: Utilizing `customMessage` for non-404 errors

**Choice**: Use `customMessage` as the prefix for the final error message when provided (e.g., `${customMessage}: ${sanitizedAPIError}`), while 404 continues to just return the `customMessage` outright.
**Alternatives considered**: Ignore `customMessage` for non-404 errors (current behavior), or use `customMessage` as a fallback only when the API error is completely opaque.
**Rationale**: When `customMessage` is provided by the caller, it offers valuable domain context about what the application was trying to do. By combining this context with the actual sanitized API error, we provide the best developer experience without swallowing root causes.

## Data Flow

    API Client (throws object) ──→ wrapToolError ──→ handleStatusCode
                                                           │
                                                           ├─→ Extracts `error.message` (New)
                                                           ├─→ Applies `customMessage` prefix (New)
                                                           └─→ Sanitizes and returns MCPError

## File Changes

| File                         | Action | Description                                                                                        |
| ---------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| `src/utils/error-handler.ts` | Modify | Update `handleStatusCode` to extract `.message` from plain objects and use `customMessage` prefix. |

## Interfaces / Contracts

No changes to external interfaces. The signature of `handleStatusCode` remains exactly the same:

```typescript
handleStatusCode(
  error: unknown,
  operation: string,
  resourceId?: string | number,
  customMessage?: string
): MCPError
```

## Testing Strategy

| Layer | What to Test                             | Approach                                                                                                   |
| ----- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Unit  | `handleStatusCode` extracting message    | Pass a plain object `{ statusCode: 500, message: "Teams error" }` and assert the message is extracted.     |
| Unit  | `handleStatusCode` using `customMessage` | Pass a `customMessage` to non-404 errors and assert it forms the correct prefix instead of "Failed to...". |
| Unit  | Fallbacks                                | Continue asserting that truly opaque errors fall back to "Unknown error".                                  |

## Migration / Rollout

No migration required. This is an internal utility fix that immediately improves error visibility.

## Open Questions

- [ ] None.
