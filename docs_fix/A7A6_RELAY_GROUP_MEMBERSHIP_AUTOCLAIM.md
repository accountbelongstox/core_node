# A7A6 Relay group membership auto-claim

## Reported symptom

Both remote pycore devices (Kimi, Pi) surface `RELAY_DEVICE_ENROLLMENT_REQUIRED`
in the UI, and the pycore console loops:

```
[PY_RELAY_AGENT] Enrollment poll timed out after 600s; restarting enrollment flow.
[PY_RELAY_AGENT] Created enrollment ...; waiting for UI claim.
```

The user requirement: a pycore device started on Windows or any system must
relay through the laravel_main deployment at `https://api.si.12gm.com` and
become usable in the UI group (`https://12gm.com`) without console access to
the device. pycore never runs on the relay host.

## Findings

1. The `RELAY_DEVICE_ENROLLMENT_REQUIRED` string no longer exists in current
   source. It was removed from `PycoreLaravelRelayTransport.ensurePair` in
   commit `91fc0af64` (2026-09-15); current code raises the server-supplied
   `RELAY_GROUP_EMPTY` with a translated message
   (`core/integrations/pycore/PycoreLaravelRelayTransport.ts:287-292`,
   `core/integrations/laravel/LaravelRelayRoster.ts:165-171`,
   `app/Apps/Relay/RelayServices/RelayDeviceService.php:135-136`). The
   production UI at 12gm.com is therefore running a stale pre-`91fc0af64`
   bundle. The remote pycore agents are stale too: the exact log line
   "Enrollment poll timed out after 600s" does not exist in current
   `pycore/pyctl/relay/laravel_relay_agent_service.py`. Both stale builds
   still describe the same trigger: the owned roster is empty because no
   enrollment is ever claimed.

1a. Runtime evidence (user-supplied, 2026-09-15): the deployed remote agent
    source confirms the stale build. Its `_enrollment_flow` creates an
    enrollment, polls `get_enrollment_status` every 5s up to
    `self._enrollment_poll_timeout` (600s), then restarts the flow — the
    exact production loop. Two properties matter for the fix:
    - The stale agent's status poll consumes `state=claimed` + `credential`
      identically to current code, so server-side auto-claim heals deployed
      agents without a forced pycore redeploy: the claim lands within one
      admin roster read, the next poll (<= 5s) picks up the credential, and
      heartbeat plus the Mercure subscriber start.
    - The stale build still rotates signing keys on every 401/403 and lacks
      the A7A4/A7A5 recovery lifecycle, so a normal code sync of the remote
      pycore remains required as follow-up convergence; it is not a blocker
      for group membership.

2. The enrollment claim path is the root defect. The device agent creates an
   enrollment (`POST /api/relay/device-enrollments`), prints a claim code to
   its own console, and polls status every 5s
   (`pycore/pyctl/relay/laravel_relay_agent_service.py:393-460`). The only UI
   discovery path is a human copying that code into the pycore-manager chip
   (`apps/pycore-manager/components/PcPycoreTargetSwitcher.tsx:122-137`,
   placeholder "Claim code from the Pycore log",
   `apps/pycore-manager/pc-locales/PcEnCore.ts:43,48`). No owner endpoint lists
   pending enrollments (`routes/RelayRouter/RelayApi.php:38-56`), the roster
   response type carries only owned devices
   (`core/integrations/laravel/LaravelRelayAPI.ts:9-16",
   `RelayDeviceService::rosterSnapshot` reads `RelayDeviceModel` only), and no
   Mercure event announces a pending enrollment
   (`config/pycore_relay_contract.json:102-109";
   `RelayEnrollmentService::create` publishes nothing). On a headless remote
   device nobody copies the code, the enrollment expires after
   `enrollment_retention_seconds` (600), and the loop restarts forever.

3. The server already contains the intended remedy as dead code:
   `RelayEnrollmentService::autoClaimPending($userId)`
   (`app/Apps/Relay/RelayServices/RelayEnrollmentService.php:250-273`) claims
   every pending enrollment for a user using the server-side encrypted claim
   code copy (`claim_code_encrypted`, stored at creation line 84 precisely for
   this). It has zero call sites. `claim()` itself is complete: ownership
   conflict guards, credential rotation, post-commit presence publication
   (lines 227-229), so an auto-claimed device broadcasts
   `relay.device.presence` to every connected UI session through the existing
   outbox.

4. The user's premise that FrankenPHP long-connection capability is missing
   is not supported by the code. The relay transport is already SSE-only:
   `93_install_frankenphp.sh` delegates to the shared pipeline which embeds
   the Mercure module in all three variants (apt/prebuilt/compiled, pinned
   FrankenPHP v1.12.7 / Mercure v0.24.2 in `config/service_contract.json`);
   the rendered Caddyfile carries the `mercure` directive with JWT/CORS/
   `heartbeat 20s`/`write_timeout 0s`/`subscriptions`
   (`scripts/shells/linux/common/frankenphp_runtime_common.sh:550-552`);
   the hub is reachable at `https://api.si.12gm.com/.well-known/mercure`
   through the domain route proxy to the native `:9000` hub; publishing uses
   the native in-worker `mercure_publish()` with a JWT POST fallback
   (`app/Services/Realtime/MercurePublisher.php`); both subscribers are SSE
   clients with `Last-Event-ID` resume and bounded reconnect
   (`pycore/pyutils/common/mercure_client.py`,
   `core/integrations/laravel/LaravelMercureConnection.ts`). There is no
   WebSocket, socket.io, Reverb or Pusher usage anywhere in the relay path.

5. Residual transport-chain defects (minor):
   a. No readiness probe verifies the installed FrankenPHP binary actually
      embeds the Mercure module. `fm_binary_compile_complete`
      (`scripts/shells/linux/common/frankenphp_runtime_common.sh:389-398`)
      checks the dnspod module and PHP extension floor only; a Mercure-less
      binary would surface only as a Caddy config-load failure.
   b. The on-disk rendered `storage/frankenphp/Caddyfile` and
      `routes/12gm.com.caddy` predate the current renderers (missing the
      `stream_close_delay` block added 2026-09-15). Self-heals on the next
      175 convergence because `fm_caddyfile_ensure` content-compares, but
      "live config" currently differs from "current code".
   c. `pycore/pyutils/common/mercure_client.py:111-112` cites a "hub
      heartbeat (default 40s)"; the contract/deployed value is 20s. Comment
      drift only.
   d. The `:9000` backend binds `0.0.0.0` serving app + hub over plain HTTP
      on the LAN, including subscriber JWTs. Intentional LAN path per the
      Caddyfile comment, recorded here as a security posture note.

6. Remote endpoint resolution is already correct for devices that never run
   on the relay host: the pycore agent resolves its coordinator from the
   contract's absolute public URLs
   (`config/pycore_relay_contract.json:93-100`,
   `pycore/pyutils/laravel/relay_transport.py:45-46`), and the relay agent
   starts automatically whenever pycore runs in mode 2 (`relay-ui`)
   (`pycore/pyutils/common/pyservice_mode.py:10`,
   `pycore/pyctl/runtime/event_handlers.py:413-417`).

## Official references

- https://frankenphp.dev/docs/mercure/ — the built-in Mercure hub is
  FrankenPHP's native "convenient alternative to WebSockets"; it is disabled
  by default and enabled by the Caddyfile `mercure` directive; `publisher_jwt`
  requires `subscriber_jwt`; the hub serves `/.well-known/mercure`;
  `mercure_publish()` publishes from inside the worker.
- https://mercure.rocks/docs/hub/config — private subscriptions (no
  `anonymous`), heartbeat and write timeout govern stream lifetime; the
  deployed `heartbeat 20s` / `write_timeout 0s` matches the documented
  long-lived SSE profile.
- https://mercure.rocks/docs/hub/authorization — subscriber/publisher JWT
  scoping; the per-owner and per-device topic authorization already follows
  it.
- https://caddyserver.com/docs/command-line#caddy-list-modules — the
  `list-modules` subcommand enumerates compiled-in modules; the Mercure
  handler registers as `http.handlers.mercure`, which is the readiness probe
  signal.

## Implementation decisions

- Auto-claim is wired at the group boundary, not on the device path: an
  authenticated owner roster read reconciles pending enrollments before the
  snapshot. This follows the A7A5 decision that registration must use the
  same group roster/presence lifecycle as heartbeat, keeps Laravel the
  authority for group membership, and requires no contract change — so the
  shared contract digest is untouched and already-deployed pycore agents
  (stale or current) interoperate without a contract sync.
- Auto-claim is gated to admin users (`User::isAdmin()`, rolelevel >= 10).
  The claim code was the proof of console access; silent adoption must
  therefore be restricted to the operator class that already owns the
  deployment. Non-admin roster reads never adopt devices; the manual claim
  code path remains available to every authenticated owner.
- Auto-claim is best-effort: a reconciliation failure must never break the
  roster read itself.
- No WebSocket is introduced anywhere; the Mercure SSE chain is retained as
  the single long-connection transport per the official FrankenPHP design.
- The stale production UI bundle and the stale remote pycore builds are
  deployment convergence items: the current code already reports
  `RELAY_GROUP_EMPTY` correctly, and server-side auto-claim makes even stale
  pycore agents join once an admin UI session is open within a retention
  window. Per repository rules no builds, services, or deployments are run
  here; the normal 175/176 convergence and UI build pipeline apply the
  changes.

## Implemented changes

- `RelayOwnerCtl::roster`
  (`poly_apps/laravel_main/app/Apps/Relay/RelayControllers/RelayOwnerCtl.php`)
  now reconciles group membership at the group boundary: for admin users
  (`User::isAdmin()`, rolelevel >= 10) it invokes the previously dead
  `RelayEnrollmentService::autoClaimPending` before the roster snapshot.
  Auto-claim reuses the complete `claim()` path — ownership conflict guards,
  credential rotation, and post-commit `relay.device.presence` publication —
  so connected UI sessions receive the new device over the existing Mercure
  owner topic, and the device agent's next enrollment-status poll (<= 5s)
  receives `claimed` + credential and proceeds to heartbeat and subscription.
  Reconciliation is best-effort: a failure is logged and never breaks the
  roster read. Non-admin roster reads never adopt devices; the manual claim
  code endpoint is unchanged.
- Empty-roster UI hints now describe the automatic path
  (`apps/pycore-manager/pc-locales/PcEnCore.ts`,
  `apps/pycore-manager/pc-locales/PcZhCore.ts`): start Pycore in mode 2
  (relay-ui); pending devices join admin accounts automatically; manual claim
  code entry remains available.
- FrankenPHP binary readiness: `FRANKENPHP_MERCURE_MODULE`
  (`scripts/shells/linux/common/frankenphp_manager.sh`) names the embedded
  hub handler (`http.handlers.mercure`, probed via the existing
  `fm_module_in_bin` / `list-modules` contract). `fm_binary_compile_complete`
  (`scripts/shells/linux/common/frankenphp_runtime_common.sh`) requires it as
  a rebuild trigger, and `laravel_runtime_frankenphp.sh` fails closed before
  supervisor launch on every variant when the live binary lacks the module,
  pointing at the canonical 93 installer.
- `pycore/pyutils/common/mercure_client.py` heartbeat comment aligned with
  the deployed 20s hub heartbeat.

## Validation boundary

Static convergence checks only: PHP token parse of the edited controller,
`bash -n` of all three edited shell scripts, and Python AST parsing of the
edited subscriber module passed. No builds, tests, services, deployments, or
Git operations were run, per repository rules. Remaining convergence items
outside this change set: the production UI bundle and the remote pycore
builds are stale (finding 1/1a) and update through the normal UI build
pipeline and pycore code sync; the on-disk Caddyfile render predates the
current renderer and self-heals on the next 175 convergence (finding 5b).
End-to-end acceptance — a fresh remote pycore joining the group while an
admin UI session is open, presence visible at 12gm.com — requires those
deployments and was not executed here.
