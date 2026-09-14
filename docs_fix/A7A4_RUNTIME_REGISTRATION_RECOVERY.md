# A7A4 Runtime registration recovery

## Findings

1. BUG 5: `vocabShared.toArray` casts the first truthy wrapper field to an array without validating it. An object-valued `languages` or `data` escapes the shared boundary and crashes every consumer that calls `map`. Fix the shared response contract, not the select renderer.
2. BUG 6: the device control loop cannot recover `enrollment_not_found` (404). A persisted pending enrollment absent from the coordinator is polled indefinitely. Its recovery branch also rotates signing keys for every 401/403, including transient signature errors, which can destroy a valid enrollment relationship. Recovery must distinguish missing enrollment, missing credential, revocation, and transport failure.
3. Runtime evidence: the local FrankenPHP and UI services are running. An unauthenticated public roster request returned `401 AUTH_REQUIRED` in 0.138 seconds. This establishes reachability only; it does not establish authenticated roster or operation health.

## Official references

- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray
- https://mercure.rocks/docs/hub/config
- https://frankenphp.dev/docs/worker/

## Scope

Record each finding before implementation. Inspect all seven reported bugs and earlier lifecycle requirements. Runtime diagnostics are explicitly requested; do not create, change, or run test suites, use Git, or perform destructive operations.
