# Error Handler Specification

## Purpose

Defines the behavioral requirements for the SecureErrorHandler, particularly how it processes and extracts messages from various error types and status codes.

## Requirements

### Requirement: Extract Message from Plain Objects

The system MUST extract the `message` property from plain error objects that are not instances of `Error` but contain a `message` property.

#### Scenario: Plain object with message property

- GIVEN an error that is a plain object with a `message` property
- WHEN `handleStatusCode()` processes the error
- THEN the system MUST extract and return the value of the `message` property
- AND the system MUST NOT return "Unknown error"

### Requirement: Apply Custom Message for All Status Codes

The system MUST apply the provided `customMessage` to errors of any status code, rather than restricting it to only 404 status codes.

#### Scenario: Non-404 status code with custom message

- GIVEN an API error with a non-404 status code (e.g., 403 Forbidden)
- AND a `customMessage` is provided to `handleStatusCode()`
- WHEN `handleStatusCode()` processes the error
- THEN the system MUST include the `customMessage` in the returned error string

#### Scenario: 404 status code with custom message

- GIVEN an API error with a 404 status code
- AND a `customMessage` is provided to `handleStatusCode()`
- WHEN `handleStatusCode()` processes the error
- THEN the system MUST include the `customMessage` in the returned error string
