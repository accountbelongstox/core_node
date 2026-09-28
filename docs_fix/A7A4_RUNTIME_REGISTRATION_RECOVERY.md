# A7A4 Runtime registration recovery

## Findings

1. BUG 5: `vocabShared.toArray` casts the first truthy wrapper field to an array without validating it. An object-valued `languages` or `data` escapes the shared boundary and crashes every consumer that calls `map`. Fix the shared response contract, not the select renderer.
2. BUG 6: the device control loop cannot recover `enrollment_not_found` (404). A persisted pending enrollment absent from the coordinator is polled indefinitely. Its recovery branch also rotates signing keys for every 401/403, including transient signature errors, which can destroy a valid enrollment relationship. Recovery must distinguish missing enrollment, missing credential, revocation, and transport failure.
3. Runtime evidence: the local FrankenPHP and UI services are running. An unauthenticated public roster request returned `401 AUTH_REQUIRED` in 0.138 seconds. This establishes reachability only; it does not establish authenticated roster or operation health.

## Confirmed implementation gap

4. The translation endpoint returns the supported-language catalog as an associative object (`code => name`), while the shared `toArray` helper returns its first truthy wrapper value without checking that it is an array. This violates the JavaScript array boundary described by `Array.isArray()` and sends the object to `LangSelect.map`. The shared normalizer must accept array payloads, unwrap nested array containers, and convert the language catalog object to the typed option list.
5. `RelayEnrollmentService::status` deliberately reports a deleted pending enrollment as `enrollment_not_found` (404), but the Python control loop only treats `device_not_found` and `device_credential_revoked` as enrollment recovery signals. It therefore keeps the stale enrollment ID and polls it forever. The same loop currently rotates the signing key for every 401/403, including timestamp, nonce, body-digest, protocol, and signature errors. Recovery must be driven by the coordinator's explicit credential/enrollment error codes; unrelated authentication failures must retain the identity and retry with backoff.
6. The owner can have one registered device whose heartbeat is temporarily
   stale. The browser selector only auto-designates a fresh online device, while
   the relay transport reports the sole stale device as
   `RELAY_DEVICE_SELECTION_REQUIRED`. This blocks every pycore-manager route
   even though the coordinator can safely create a pairing and queue admission
   until the device resumes claiming operations. Selection must distinguish
   “no device” from “one known device temporarily offline”.

## Official references

- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray
- https://mercure.rocks/docs/hub/config
- https://frankenphp.dev/docs/worker/

## Scope

Record each finding before implementation. Inspect all seven reported bugs and earlier lifecycle requirements. Runtime diagnostics are explicitly requested; do not create, change, or run test suites, use Git, or perform destructive operations.

## Implemented changes

- The shared vocabulary response normalizer now returns only verified arrays, unwraps nested response containers, and converts associative language catalogs into `{ code, name, native? }` options before any consumer can call `map`.
- Pycore enrollment recovery now includes deleted enrollments and explicit credential lifecycle failures (`signature_credential_missing`, `signature_credential_invalid`, and `signature_enrollment_not_found`). Generic HTTP 401/403 responses no longer rotate the device key, preserving the identity across transient or malformed-request failures.
- A sole registered device is now automatically designated even when its last
  heartbeat is stale. Existing pairing/admission semantics can queue the work
  for the device; multiple registered devices still require an explicit choice.
- The Relay target switcher now permits designation of every owned active
  device, including stale-heartbeat entries, and explains that accepted work
  remains queued until the selected device reconnects. The roster/Mercure
  owner stream is started only while the Relay target is selected.

## Validation boundary

No project test suite, build, service start, deployment action, or Git command
was run. Read-only endpoint probes and browser DOM/console diagnostics were
run. Authenticated enrollment recovery and operation completion still require
a real dashboard session and an online remote pyservice for production
acceptance.
