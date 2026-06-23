# Task Tools Specification

## Purpose

This spec defines the behavior of task tools, ensuring that bulk-update capabilities properly accept and transmit necessary fields.

## Requirements

### Requirement: Accept Field and Value in Bulk Update

The system MUST accept `field` and `value` properties in the `vikunja_tasks` bulk-update schema and pass them correctly to the underlying API.

#### Scenario: User performs bulk update on tasks

- GIVEN the user invokes `vikunja_tasks` with the bulk-update subcommand
- WHEN the user provides `field` and `value` properties
- THEN the system MUST accept the properties through Zod schema validation
- AND the system MUST include those properties in the payload sent to the API
