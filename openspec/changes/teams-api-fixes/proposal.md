# Teams API Fixes

## Summary

Document the HTTP method corrections made to the vikunja_teams tool to align with the actual Vikunja API behavior. These fixes were implemented and tested against a real Vikunja instance.

## Problem Statement

The vikunja_teams tool was using incorrect HTTP methods for certain operations, causing API calls to fail. Manual testing against the real Vikunja API revealed the correct methods.

## Changes Made

### 1. teams.update - Changed from PUT to POST

**File**: `src/tools/teams.ts`

**Issue**: The Vikunja API for updating a team requires POST method, not PUT.

**Before**:

```typescript
// Incorrect - PUT doesn't work
const response = await fetch(`${session.apiUrl}/teams/${teamId}`, {
  method: 'PUT',
  ...
});
```

**After**:

```typescript
// Correct - Vikunja API expects POST
const response = await fetch(`${session.apiUrl}/teams/${teamId}`, {
  method: 'POST',
  ...
});
```

**Verified**: ✅ Tested manually - team name and description updates persist correctly

---

### 2. members.add - Uses PUT with user_id

**File**: `src/tools/teams.ts`

**Status**: Already correct - uses PUT method with user_id field

```typescript
const response = await fetch(`${session.apiUrl}/teams/${teamId}/members`, {
  method: 'PUT',
  ...
  body: JSON.stringify({ user_id: userId, admin: args.admin }),
});
```

**Verified**: ✅ Works correctly

---

### 3. members.update - Changed from PUT to POST at /members/{id}/admin endpoint

**File**: `src/tools/teams.ts`

**Issue**: The endpoint for updating member admin status (`/members/{userId}/admin`) requires POST method, not PUT.

**Before**:

```typescript
// Incorrect - PUT doesn't work for admin endpoint
const response = await fetch(`${session.apiUrl}/teams/${teamId}/members/${userId}/admin`, {
  method: 'PUT',
  ...
});
```

**After**:

```typescript
// Correct - Vikunja API expects POST for admin endpoint
const response = await fetch(`${session.apiUrl}/teams/${teamId}/members/${userId}/admin`, {
  method: 'POST',
  ...
  body: JSON.stringify({ admin: args.admin }),
});
```

**Verified**: ✅ Tested manually - admin flag persists correctly

---

### 4. members.remove - Uses DELETE

**File**: `src/tools/teams.ts`

**Status**: Already correct - uses DELETE method

```typescript
const response = await fetch(
  `${session.apiUrl}/teams/${teamId}/members/${userId}`,
  {
    method: 'DELETE',
    ...
  }
);
```

**Known Limitation**: Cannot remove the last member of a team - Vikunja API restriction. Attempting to do so returns an error.

**Verified**: ✅ Works correctly (except for last member case)

---

## Implementation Details

All team operations use direct `fetch` calls instead of the node-vikunja client methods due to:

1. API method mismatches between client and actual API
2. Need for specific HTTP methods that the client doesn't support
3. Better error handling with custom status code processing

## Testing

Manual testing was performed against a real Vikunja instance using `scripts/test-mcp-teams.ts`. All four operations were verified:

- teams.update (POST) ✅
- members.add (PUT) ✅
- members.update (POST) ✅
- members.remove (DELETE) ✅

## Related Files

- `src/tools/teams.ts` - Main implementation
- `tests/tools/teams.test.ts` - Unit tests (mock-based)
- `scripts/test-mcp-teams.ts` - Manual integration tests

## Rollback Plan

To rollback these changes:

1. Revert HTTP method for `teams.update` from POST to PUT
2. Revert HTTP method for `members.update` from POST to PUT

Note: members.add and members.remove were already correct.

## Affected Modules

- `src/tools/teams.ts` - Teams tool implementation
- `tests/tools/teams.test.ts` - Tests may need updates if they assert specific HTTP methods

---

**Status**: Implemented and verified
**Date**: 2026-04-02
