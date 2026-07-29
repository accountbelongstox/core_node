# Python pycore Project Specification

Spec for `pycore`; for pycore code it takes precedence. **REQUIRED** / **FORBIDDEN** / **Rule**.

## 1. Code Standards
- **FORBIDDEN**: any AI must not modify this document unless the user explicitly requests it.
- English only, ASCII only, Python 3.10+, absolute imports from `pycore`.
- **FORBIDDEN**: use `__init__.py` to organize or re-export a package; import the concrete module directly (e.g. `from pycore.foo.bar import X`, not via `pycore.foo`).
- Constants in `pygvar`; never re-implement pyfoundations/pyutils (logging, file, network).
- Static files in `public/`; cache/tmp from pygvar (`CACHE_DIR`, `TMP_DIR`).
- Output via `ColorPrint` (auto-streams to UI), not bare `print()`; report errors with ColorPrint, not raise.
- Imports at file top only (stdlib → third-party → project); never inside a function.
  - `pycore.*` internal: plain top import — never lazy/try-except (a missing internal module is a bug, fail loudly).
  - Optional third-party/platform modules (win32gui, PIL, tkinter…): prefer `pyfoundations/third_party.py` getters, else a top-level `try/except ImportError` → module-level `*_AVAILABLE` flag, guard usage sites.
- **FORBIDDEN** in AI code: try-except (hides errors) — use conditionals / error status / let it propagate.
- Singleton managers (i18n, bus_manager) as module-level globals, never `self.i18n`.

## 2. Architecture — strict one-way layering
```
pyapps
  callmodule           routing/controllers only (no business logic)
  pyctl                high-level orchestration (composition, don't re-implement)
  pyutils / database / pylauncher / pyheartbeat / pygvar   second-layer primitives
  pyfoundations        lowest layer — leaf modules (stdlib + internal pybasecommon)
```
- **pyfoundations** (lowest layer): only stdlib + its own modules (incl. `pyfoundations/pybasecommon`); **never import any other top-level directory** (`pyutils/pyctl/callmodule/database/pylauncher/pyheartbeat/pygvar`).
- **pyutils / database / pylauncher / pyheartbeat / pygvar** (second layer): must not depend on `pyctl` or `callmodule`; `pyutils` cannot reference other `pyutils/*` siblings and only depends on `pyfoundations` (and `pygvar` as a public base).
- **pyctl** (third layer): may import anything below `pyctl` (including `pyutils/database/pylauncher/pyheartbeat/pygvar/pyfoundations`); use it for orchestration/composition, not for implementing low-level public capabilities.
- **callmodule** (fourth layer): no business logic; only RPC v2 routing/controller wiring, and it may import all deeper directories.
- Shared code moves DOWN to a common layer, never sideways; cross-group coordination lives in `pyctl` or via dependency injection.
- **Sole upward exception**: `ColorPrint`→`pyutils.rpc_v2` live log stream — lazy, flag-gated at rpc_v2 startup, through a no-pycore-import leaf, never raises.

## 3. Applications
```
pyapps/{appname}/
  {appname}_main.py       entry — defines start() or main()
  {appname}_config|_i18n|_bus_keys/   namespaced with {appname}_ prefix
  controller/ service/ routes/ model/ scripts/
```
- i18n: key constants only (no hardcoded strings/defaults); call `i18n.extend_translations(...)` in the launcher_config builder before `i18n.get()`.
- BusKeys (THREAD_BUS apps): `{appname}_bus_keys/` exports `{AppName}BusKeys` + `register_bus_keys()`; keys `{appname}.`-prefixed; call it at start of `start()`.

## 4. Threading
- Threading: thread implementations directly subclass `threading.Thread` (names end in `Thread`); data and mutable state use THREAD_BUS-backed owners only; `threading` locks/events/semaphores/locals, ThreadPoolExecutor, Timer, Queue, and `Thread(target=...)` are forbidden; standalone `tts_install_assets/*` subprocess scripts are exempt and may not import pycore; Tkinter objects stay on their UI thread.

## 5. Third-party deps
- Register every package in `pyfoundations/third_party.py` (DEPENDENCY_MAP / OPTIONAL_PACKAGES / WINDOWS_ONLY_PACKAGES / SYSTEM_PACKAGES); it auto-installs missing required ones once per process.
- Lazy loading REQUIRED: obtain packages via `get_third_package_{name}()`, never bare `import`.

## 6. Subsystem constraints
- Heartbeat (`pyfoundations/heartbeat/`): Thread subclasses with THREAD_BUS-backed state; registrations HARD-CODED in `registry.py`, each lib provides TaskModel + TaskHandler.
- Database (`pycore/database/`): table names only via `TableKeys` (`{namespace}.{table}`), never hardcoded; database-specific logic must live in `pycore/database`, higher layers only organize workflows.
- Services: rpc_v2 / callmodule on `:59000`; pyutils re-exported from `pycore.pyutils` with `*_AVAILABLE` flags (GUI needs `PYUTILS_LOAD_GUI=1`); UI shell `poly_apps/pycore_laravel_wordflow_ui`.
