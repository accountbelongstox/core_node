---
name: project-pycore-pitfalls
description: Non-obvious pycore pitfalls learned during the D1/D10 audit fixes (serialized calls, engine settings, contracts, static checks)
metadata:
  type: project
---

Pitfalls that are not obvious from reading one file:

- `call_serialized` progress signals must not consume the response guard: a `.started` signal published with the consuming `signal_if_present` hung every untimed call and pycore could not start (fixed 2026-09-27 09:41 with `consume=False`). Re-check this whenever touching `serialized_worker` / `ThreadBus.signal_if_present`.
- UI engine-test extras must never be written to `os.environ` (lanes and orchestration run concurrently); they go through `engine_policy.engine_setting` (ContextVar). Calls that hop to a model owner thread need `copy_context().run` to carry the override.
- Relay route policies and Queue Center endpoint roles live only in the cross-end contracts (`config/pycore_relay_contract.json`, `config/queue_center_contract.json`); a missing entry there is an orchestrator change, not a pycore code change.
- `scripts/pytools/aitools/qwen3tts_tester.py` imports `pycore.pyutils.tts.tts_engine_params`, so that module is not dead even though pycore/UI never import it.
- A new relay device event needs three ends: `RELAY_REQUIRED_EVENTS` in relay_contract.py, Laravel `RelayContract.php $requiredEvents`, and the `RelayDeviceService::event` allowlist (else 422 `device_event_invalid`; pycore only logs `device.event.publish.failed`).
- Importing modules that call `pyfoundations.third_party` getters (e.g. `xdg_desktop_portal` -> jeepney) pip-installs missing packages into the running interpreter; mention it when an import check is used for verification.
- `pycore.pyctl.relay.laravel_relay_agent_service` is shadowed by the package-level singleton of the same name; reach the class via `sys.modules[...]` after `importlib.import_module`.
- During team runs other lanes may start editing a callmodule route file mid-task; re-check `git diff` before each edit and record the concurrent writer in the report.
- Static checks that are allowed and useful (no services): ast.parse + symtable undefined-globals + an AST check that every `from pycore... import X` resolves, plus a module-level import-cycle scan; set `PYTHONDONTWRITEBYTECODE=1` for scratch runs.

**Why:** each of these cost a review round or a startup outage in D1.
**How to apply:** check the relevant item before editing serialized_worker/thread_bus, TTS engine settings, relay/queue contracts, or deleting "dead" TTS modules. See [[feedback-line-endings]].
