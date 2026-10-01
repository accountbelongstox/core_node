# Python pycore Project Specification

Spec for `pycore`; for pycore code it takes precedence. **REQUIRED** / **FORBIDDEN** / **Rule**.

Related doc:
- `pycore/README.md`

## 1. Code Standards
- **FORBIDDEN**: any AI must not modify this document unless the user explicitly requests it.
- English only, ASCII only, Python 3.10+, absolute imports from `pycore`.
- **REQUIRED before coding**: scan adjacent implementations and the canonical primitives (section 3) for naming, imports, lifecycle, error reporting, and composition style. When a defect is found (layering, dependency, lifecycle, concurrency, transport, duplication), refactor the shared design at its root; never copy, wrap, or hide the defect.
- `__init__.py` is a package marker unless the package owns a shared runtime instance. An instance package may re-export only prebuilt instances from concrete modules with absolute imports and `__all__`; it must not construct objects, run registration, use `__getattr__`, or re-export classes, functions, constants, or submodules.
- Shared instances: created in the concrete module that defines the class (`class_a = ClassA()`); callers import the instance. **FORBIDDEN**: `get_*()` singleton accessors and lazy singleton providers.
  - Construction must be cheap; heavy resources (models, connections, subprocesses) load lazily inside methods of the instance.
  - Parameterized objects use a keyed owner instance (`peer_configs.for_port(port)`), not a module-level accessor.
  - Objects with caller-specific configuration or multiple lifecycles stay classes/factories.
- Static files in `public/`; cache/tmp from pygvar (`CACHE_DIR`, `TMP_DIR`).
- Output via `ColorPrint` (auto-streams to UI), never bare `print()`.
- Imports at file top only (stdlib -> third-party -> project); never inside a function.
  - `pycore.*` internal: plain top import, never lazy/try-except (a missing internal module is a bug, fail loudly).
  - Optional third-party/platform modules: `pyfoundations/third_party` getters (section 6).
- Errors:
  - Default: no try/except. Use conditionals and explicit result/error values; let programming errors propagate.
  - **Allowed only at boundaries**: external I/O (network, filesystem, subprocess, OS/platform APIs), third-party library calls that signal by exception, thread `run()` top level, and HTTP/RPC handler top level.
  - A boundary handler catches the narrowest exception type, reports with `ColorPrint` including operation, inputs, and the exception, and returns an explicit error value.
  - **FORBIDDEN**: bare `except:`, `except Exception: pass`, swallowing without a report, and try/except used for control flow or optional internal imports.
- Singleton managers (i18n, bus_manager) as module-level globals, never `self.i18n`.
- **FORBIDDEN**: version numbers in module, package, class, route, key, or config names (`rpc_v2`, `RelayV3`, `*_v1`). There is one current implementation; it carries the plain name.
- Merging duplicates: the survivor is built on the newest behavior (by git history) and carries every capability of every variant (edge cases, error handling, platform branches, progress/stall detection, auth, logging, contract fields). It is never an arbitrary pick with the other copies deleted. A capability may be dropped only when it is provably obsolete, and the reason is recorded.
- **FORBIDDEN**: compatibility shims. A migration updates every caller in the same change and deletes the old path: no re-export modules, alias routes, legacy flags, dual transports, or "kept for compatibility" code. Persisted data that must be read once is migrated by a one-shot migration step, not dual readers.
- **FORBIDDEN** in library modules: `if __name__ == "__main__"` demo blocks, example/demo files, one-off scripts (they go to `scripts/`), and non-ASCII note files.
- Dead code is deleted, not commented out or left unreferenced.

## 2. Architecture: strict one-way layering
```
pyapps (repo root)       applications
  callmodule             routing/controllers only (no business logic)
  pyctl                  orchestration (composition, don't re-implement)
  pylauncher             process startup, service starters, singleton launch, tray
  pyheartbeat            heartbeat scheduler
  pythreadpool           thread pool + service registry (no starters)
  pyutils                reusable domain primitives
  database               persistence (models, repositories, adapters)
  pyfoundations          lowest layer: stdlib + its own modules (incl. pygvar, pybasecommon, thread_bus)
```
- A layer imports only layers listed below it. Same-layer peers do not import each other; the exceptions are `pyheartbeat -> pythreadpool` and `pyutils -> database`.
- **pyfoundations**: stdlib and its own modules only.
- **database**: `pyfoundations` only. All database-specific logic lives here; table names only via `TableKeys` (`{namespace}.{table}`).
- **pyutils**: `pyutils/common` is the only area shared by all `pyutils` domains. A domain imports only itself, `pyutils/common`, `database`, and `pyfoundations`. Code needed by two domains moves down into `pyutils/common` or `pyfoundations`.
- **pythreadpool**: pool and registry only. Service starters are registered from `pylauncher`, never imported by `pythreadpool`.
- **pyctl** may import anything below it. **callmodule** may import anything below it, but holds only route wiring and parameter binding.
- Shared code moves DOWN to a common layer, never sideways. Cross-group coordination lives in `pyctl` or is injected.

## 3. Canonical primitives (one implementation each)
Re-implementing any of these is **FORBIDDEN**. Extend the owner instead.

| Concern | Owner |
|---|---|
| UTC timestamps | `pyfoundations/time_utils.py` (`utc_now_iso`, `utc_now_ms`) |
| Atomic file writes, JSON state files | `pyfoundations/atomic_json_store.py` |
| Bounded JSON index/history stores | `pyutils/common/json_index_store.py` |
| Retry/backoff delays | `pyfoundations/backoff_wait.py` |
| EOL/text normalization | `pyfoundations/text_eol.py` |
| LAN IP / local network probes | `pyfoundations/net_probe.py` |
| Paths and directories | `pyfoundations/core_node_dirs.py` (primitives), `pyfoundations/system_paths.py` (derived) |
| Process kill/inspection, ports | `pyfoundations/process_manager.py`, `pyutils/common/port_utils.py` |
| Task status enum | `pyfoundations/tasks.py` (`TaskStatus`) |
| Running-flag service lifecycle | `pyfoundations/serialized_worker.py` |
| SSE decoding | `pyfoundations/http_sse.py` |
| SQLite connections (WAL, busy timeout) | `database/adapters/sqlite_local.py` |
| HTTP client and connection pooling | `pyutils/common/http_client.py` |
| Laravel base URL | `pyutils/laravel/endpoint_manager.py` (`laravel_endpoint_manager.resolve()`) |
| Laravel requests (signing, recording, errors) | `pyutils/laravel/client.py` (`laravel_client`) |
| Laravel route paths | `config/*_contract.json` only; path literals in code are **FORBIDDEN** |
| Engine registries and engine status panels | `pyutils/common/engine_registry.py` |
| Local RPC server and event journal | `pyutils/rpc/` |
| Remote relay (pycore <-> Laravel <-> UI) | `pyctl/relay/` + `pyutils/common/relay_contract.py` |

## 4. Applications
```
pyapps/{appname}/
  {appname}_main.py       entry: defines start() or main()
  {appname}_config|_i18n|_bus_keys/   namespaced with {appname}_ prefix
  controller/ service/ routes/ model/ scripts/
```
- i18n: key constants only (no hardcoded strings/defaults); call `i18n.extend_translations(...)` in the launcher_config builder before `i18n.get()`.
- BusKeys (THREAD_BUS apps): `{appname}_bus_keys/` exports `{AppName}BusKeys` + `register_bus_keys()`; keys are `{appname}.`-prefixed; call it at the start of `start()`.

## 5. Threading
- Thread implementations directly subclass `threading.Thread`, with names ending in `Thread`.
- Shared mutable state lives only in THREAD_BUS-backed owners (`serialized_worker`).
- **FORBIDDEN**:
  - locks, RLocks, events, conditions, semaphores
  - `threading.local` and per-thread resource maps keyed by `threading.get_ident()`
  - `ThreadPoolExecutor`, `Timer`, `queue.Queue`, `Thread(target=...)`
- Connection pooling belongs to the canonical HTTP client.
- asyncio is allowed only inside the RPC server event loop.
- Tkinter objects stay on their UI thread.
- Standalone subprocess scripts (`pycore/tts_install_assets/*`, `pycore/bootstrap/*`) are exempt from this section and from `ColorPrint`, and must not import pycore.

## 6. Third-party deps
- Register every package in `pyfoundations/third_party` (DEPENDENCY_MAP / OPTIONAL_PACKAGES / WINDOWS_ONLY_PACKAGES / SYSTEM_PACKAGES); missing required packages are auto-installed once per process.
- **REQUIRED**: obtain packages via the lazy `get_third_package_{name}()` getters, never a bare `import`. Optional modules expose an `*_AVAILABLE` flag through the getter module; usage sites check it.

## 7. Subsystem constraints
- Heartbeat: the scheduler is `pyheartbeat/heartbeat.py`. Task bases (`TaskModel`/`TaskHandler`) are in `pyfoundations/heartbeat/`. Registrations are hard-coded in one registry module, and each lib provides a TaskModel + TaskHandler.
- Services: the local RPC server (`pyutils/rpc`, routed by `callmodule`) listens on `:59000`. pyutils is re-exported from `pycore.pyutils` with `*_AVAILABLE` flags (GUI needs `PYUTILS_LOAD_GUI=1`). The UI shell is `poly_apps/pycore_laravel_wordnew_ui`.
- Relay: there is exactly one relay. Delivery guarantees (read, idempotent write, at-most-once action) are properties of a call on the same relay transport, not separate lanes or stacks.
- **FORBIDDEN**: mixing HTML / JS / CSS / Python code.
