# error-handler

## Requirements

### Requirement: Use customMessage for error mapping

The system MUST utilize the provided `customMessage` parameter for all status codes, not just 404 errors. When a `customMessage` is provided, the handler MUST sanitize it before using it to construct the MCPError, while preserving the existing 404 status code logic.

#### Scenario: 404 status code with customMessage

- GIVEN a 404 status code error and a `customMessage`
- WHEN `handleStatusCode` is called
- THEN it returns an MCPError with `ErrorCode.NOT_FOUND`
- AND the error message is the sanitized `customMessage`

#### Scenario: Non-404 status code with customMessage

- GIVEN a non-404 status code error (e.g., 403, 500) and a `customMessage`
- WHEN `handleStatusCode` is called
- THEN it returns an MCPError with `ErrorCode.API_ERROR`
- AND the error message is the sanitized `customMessage`

### Requirement: Extract message from plain objects (Already in place)

The system MUST extract the `message` property from plain error objects when `customMessage` is not provided or applicable.

#### Scenario: Plain object with message property

- GIVEN an error object that is not an `Error` instance or string, but has a `message` property
- WHEN `handleStatusCode` falls through to generic error handling
- THEN it extracts and uses the `message` property from the object
- AND returns an MCPError with the extracted message

### Requirement: Sanitize all custom messages

The system MUST apply `this.sanitize()` to the `customMessage` before wrapping it in an `MCPError` to prevent leaking raw API response strings or bypassing security rules.

#### Scenario: Unsanitized customMessage

- GIVEN a `customMessage` containing unsanitized or potentially unsafe text
- WHEN `handleStatusCode` uses the `customMessage` for an error response
- THEN it MUST pass the message through `this.sanitize()`
- AND construct the MCPError using the sanitized output
