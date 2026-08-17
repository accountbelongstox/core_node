# DESIGN 20260817 2115 - Pycore UI Relay Groups via Laravel Central Server + HTTP/3 Everywhere (INDEX)

Date: 2026-08-17 21:15
Split 2026-08-17 into four part files; this file is the INDEX only (no
content lives here - single source of truth is the part files).

Mercure pivot (binding): the FrankenPHP built-in Mercure hub completely
replaces Reverb as the realtime transport (SSE downstream + server-side
publish); Reverb is fully removed (2026-08-17 decision: code and docs in the
same change set - no migration window, no compat-plane legacy).

Basic norms (binding, restated at the head of every part file; full text
PART_1 §1.9): build from the underlying architecture - no patches, no
thin-compatibility layers, latest specifications; merge common libraries
and duplicate implementations; consult official docs; no multiple agents;
develop strictly per spec; shells never use exit-code/return-value
chaining, trust the previous function's result, detect binaries by file
probing.

## Parts

- `DESIGN_20260817_2115_PYCORE_UI_RELAY_GROUPS_HTTP3_PART_0.md`
  Prerequisite: FrankenPHP server plane (single octane:frankenphp process,
  built-in Mercure hub on 443/h3, plane constants, 28_install_frankenphp.sh,
  frankenphp_manager.sh, dual-end server manager, 132 branch, menu/toolchain,
  acceptance P0-A1..A6).
- `DESIGN_20260817_2115_PYCORE_UI_RELAY_GROUPS_HTTP3_PART_1.md`
  Requirements (binding): 4-group topology, HTTPS-backend relay engagement
  (R1-R9), HTTP/3 H1-H3 (SSE rides h3, no WebSocket), acceptance A1-A7,
  capability-provider rule, development norms.
- `DESIGN_20260817_2115_PYCORE_UI_RELAY_GROUPS_HTTP3_PART_2.md`
  Research: project code findings (incl. already-written relay artifacts);
  official docs - Mercure protocol (v0.x vs 1.0-alpha), FrankenPHP Mercure
  hub, Octane, nginx QUIC, RFC 9220, Tailscale CGNAT; Reverb/broadcasting
  findings kept as historical (pre-pivot) research context only.
- `DESIGN_20260817_2115_PYCORE_UI_RELAY_GROUPS_HTTP3_PART_3.md`
  Implementation plan: topic layout + registries, relay protocol v1,
  hub-auth JWT/cookie security, HTTP/3 work, file-touch list + written-
  artifact sync renames, binding execution order Phase 0 -> backend ->
  pycore library -> UI -> audit, risks, manual checklist.

Status: backend artifacts already written pre-pivot (contract relay block,
service ports, QueueCenterContract accessors, RelayMachineRegistry); sync
renames listed in PART_3 §3.7 are the first Phase 1 step.

Reference input: `docs_fix/origin/b.txt` (FrankenPHP/Mercure revision).
