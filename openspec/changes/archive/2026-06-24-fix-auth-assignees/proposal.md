# Proposal: Fix Authentication for Assignee & Label Operations

## Summary

Fix critical bug where Vikunja API endpoints for task assignees and labels fail silently when using API tokens (`tk_*`). The root cause is a condition in auto-login that prevents JWT generation when an API token exists in `.env`, combined with circuit breaker caching bugs and missing JWT refresh.

## Motivation

Users cannot assign people to tasks or apply labels — operations that report success via MCP but do not persist in Vikunja. This breaks core task management workflows. The issue has been confirmed as intentional behavior by Vikunja upstream (go-vikunja/vikunja#399 — closed as "not planned").

## Scope

- **In scope**: Auto-login fix, circuit breaker fix, JWT refresh, error messages, logging
- **Out of scope**: Major architectural refactors, new MCP tools beyond login

## Approach

Fix in priority order:

1. Remove `!vikunjaApiToken` condition to enable JWT auto-login
2. Fix circuit breaker naming in retry system
3. Improve error messages for auth failures
4. Add auth type logging
5. Implement real JWT refresh
6. Add login MCP subcommand

## Rollback Plan

Revert `src/index.ts` auto-login condition to original. All other changes are additive and non-breaking.

## Risk Assessment

- **JWT expiration (~24h)**: Mitigated by refresh implementation and clear logging
- **Breaking changes**: None — all changes are backward compatible
- **Test impact**: Existing tests mocked, should pass without changes

## Affected Modules

- `src/index.ts` — Auto-login logic
- `src/utils/retry.ts` — Circuit breaker naming
- `src/tools/auth.ts` — Refresh and login
- `src/auth/AuthManager.ts` — Token update method
- `src/tools/tasks/assignees/index.ts` — Error messages
- `src/tools/tasks/assignees/AssigneeOperationsService.ts` — Error messages
