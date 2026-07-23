# Python pycore Project Specification

Spec for `pycore`; for pycore code it takes precedence. **REQUIRED** / **FORBIDDEN** / **Rule**.

## 1. Code Standards
- English only, ASCII only, Python 3.10+, absolute imports from `pycore`.
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
pyapps / callmodule     apps — may import anything below
  pyctl                 high-level wrappers (orchestrate, don't re-implement)
  pyutils               independent utility group packages
  pyfoundations         leaf modules — import ONLY pybasecommon + stdlib
  pybasecommon + pygvar kernel — stdlib only, imports nothing else
```
- **pyfoundations**: stdlib + own modules only; never import other `pycore/*`. A top-level module imports ONLY `pybasecommon`, never a sibling (`__init__.py` facade re-export excepted).
- **pybasecommon**: stdlib-only self-contained kernel (color_print, commander, safe_subprocess, encyclopedia, compute_caps); whatever it needs is built inside it.
- **pyutils**: imports pyfoundations/pygvar, never pyctl. Shared base = `pyutils/common` ONLY; FORBIDDEN group↔group or `common`→group sideways imports; no loose root modules.
- **pyctl**: imports anything lower; never imported by a lower layer, never sibling pyctl→pyctl.
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
- Threading: components subclass `threading.Thread` (names end in `Thread`) and exchange data ONLY via THREAD_BUS — manual locks, ThreadPoolExecutor, Timer, Queue, thread-local and `threading.Thread(target=...)` spawns are FORBIDDEN (shared state must be GIL-atomic simple assignments; exempt: standalone `tts_install_assets/*` subprocess scripts, which may not import pycore). Touch Tkinter objects only from the Tkinter thread.

## 5. Third-party deps
- Register every package in `pyfoundations/third_party.py` (DEPENDENCY_MAP / OPTIONAL_PACKAGES / WINDOWS_ONLY_PACKAGES / SYSTEM_PACKAGES); it auto-installs missing required ones once per process.
- Lazy loading REQUIRED: obtain packages via `get_third_package_{name}()`, never bare `import`.

## 6. Subsystem constraints
- MCP (`pyutils/mcp/`): no ColorPrint (breaks JSON-RPC) — stdlib `logging`, STDOUT=JSON-RPC only, tools `async def`→`Dict{success}`; STDIO mode via `PYCORE_MCP_MODE=1`.
- Heartbeat (`pyfoundations/heartbeat/`): Thread-based, no locks (GIL-atomic state machine); registrations HARD-CODED in `registry.py`, each lib provides TaskModel + TaskHandler.
- Database (`pycore/database/`): table names only via `TableKeys` (`{namespace}.{table}`), never hardcoded.
- Services: rpc_v2 / callmodule on `:59000`; pyutils re-exported from `pycore.pyutils` with `*_AVAILABLE` flags (GUI needs `PYUTILS_LOAD_GUI=1`); UI shell `poly_apps/pycore_laravel_wordflow_ui`.
