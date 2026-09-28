---
name: client-key-review-checklist
description: How to review client-key (K3) signers/verifiers and route gating across Laravel, pycore, ncore, mcp-chrome; what was checked and what non-blocking gaps recur
metadata:
  type: project
---

Client-key authentication (2026-09-27 audit fix): one shared HMAC key `CORE_NODE_CLIENT_KEY_1` from the dd.sh / dd.cmd secret store. The contract is `config/service_contract.json#client_key_auth`, and the test vectors are in `.claude/agents_shared/client_key_auth/test_vectors.json`.

**Why:** the verdict also stands in for the missing R4 verification. A signer/verifier mismatch only shows up on the server, after every machine call fails closed.

**How to apply:**
- Reproduce the vectors with the owner's real code in the scratchpad. For PHP, load `vendor/autoload.php` and inject `ServiceContract::$document` by reflection to avoid PathMapper. Also feed an unsorted raw query with `%20` and `+`.
- Verifier checklist:
  - the nonce is recorded after the signature check, in a store shared across workers (Laravel: database cache `add`);
  - a request that carries a signature never falls back to login;
  - the key is never logged;
  - the path is signed as sent (Laravel `getPathInfo` assumes a root mount).
- Recurring gap: `SecretStore::getAllIndexed` also returns the bare `CORE_NODE_CLIENT_KEY`, while K1 names only `_1.._5`. Check that the pycore and ncore verifiers use the same rule.
- Route auth: grep the callers of every newly gated route in UI, mcp-chrome, pycore and ncore. Browser calls must go through `client.key_or_dashboard` or the pycore proxy (K6), never `client.key` alone.
- For ncore JS modules that pull in the logger or secret store, copy the file into the scratchpad with those `require`s stubbed by `sed`, then run the vectors and a verify round trip (ok, then replay, then tampered query). This avoids log or disk side effects.
- Recurring gap: a role re-implements the K7 decision locally instead of reusing the shared guard (ncore_backend_main.py vs pycore `local_rpc_guard.evaluate_request`), or re-declares a shared constant (Idempotency-Key, masking helpers). Grep for an existing helper before approving a new one. Sharing the decision function is not enough: the ASGI wrapper also exists (pycore `rpc_v2/http/local_rpc_middleware.py` LocalRpcGuardMiddleware), and local copies drift in the rejection body shape and in raw_path handling (ncore-6).
- K7 Host/Origin checks: feed hostile hostnames through a stubbed copy of each guard, e.g. `127.attacker.example`, `127.0.0.1.nip.io`, bare `::1`, and a request with no Origin. A loopback test must be an IP parse (net.isIPv4 / ipaddress) or exact membership in the contract loopback hosts, never `startsWith('127.')`. ncore's guard shipped with the prefix test and passed ncore-1 unnoticed; it was caught in ncore-7.
- Mass move/delete tasks (ncore rules sweeps): run a scratchpad static resolver over relative requires and package.json `#@` aliases (including `*` patterns) for HEAD (via git show) and the working tree, then diff the unresolved sets. Also look for a file/dir name collision (`x.js` next to a new `x/`: the file wins in require), and for sibling callers of the same missing export the task fixed in one place.
- Shell/secret work: grep the whole repo for `node <enc>.js pwd <password>` argv calls, on the Windows side too (Step5_InstallGitSSH.ps1 was missed once). Destructive installers must re-check every `[ -f ]`/`test` for `$USE_SUDO` consistency on non-root runs.

Related: [[ui-review-patterns]]
