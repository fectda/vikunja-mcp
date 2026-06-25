# Spec: fix-pre-existing-test-failures

## Purpose

This change has **no spec-level behavior changes**. It is a test-only fix that updates
stale test assertions in `tests/tools/index.test.ts` to match existing production code
behavior introduced in commit `b9bc781`.

## Rationale

The proposal's Capabilities section explicitly lists zero entries under both "New Capabilities"
and "Modified Capabilities". The production code (`src/tools/index.ts`) is correct and is
**not** modified. Two tests assert old registration behavior that no longer holds —
registration of `registerUsersTool` and `registerExportTool` is now unconditional when
`clientFactory` is available; auth is enforced per-method at runtime.

## Requirements

No ADDED, MODIFIED, REMOVED, or RENAMED requirements for any domain spec.

This artifact exists solely to satisfy the SDD dependency graph:
`proposal → spec → design → tasks → apply → verify → archive`.
