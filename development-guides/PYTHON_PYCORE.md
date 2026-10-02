# Python pycore Specification

Binding for `pycore`. **FORBIDDEN**: AI must not modify this document unless the user explicitly asks.

## 1. Code
- English, ASCII, Python 3.10+, absolute `pycore` imports at file top (stdlib -> third-party -> project). Internal imports are never lazy or wrapped in try.
- Before coding, reuse adjacent implementations and the primitives in section 3. Fix defects at the shared root; never copy or hide them.
- `__init__.py` is a marker, or re-exports prebuilt instances only (no construction, registration or `__getattr__`).
- Shared objects are module instances (`class_a = ClassA()`) with cheap construction and lazy heavy resources. Parameterized objects use a keyed owner (`peer_configs.for_port(p)`). **FORBIDDEN**: `get_*()` accessors and lazy singleton providers. The only exempt getters are the `get_third_package_*()` getters of section 5 and plain query functions that compute a fresh value on each call.
- Output goes through `ColorPrint`, never `print()`. Cache and tmp dirs come from pygvar (`CACHE_DIR`, `TMP_DIR`).
- Errors: no try/except except at boundaries (external I/O, third-party calls, thread `run()`, HTTP/RPC handler top level). A boundary handler reports its context through ColorPrint and returns an explicit error. **FORBIDDEN**: bare `except`, silent swallowing, exceptions as control flow.
- **FORBIDDEN**:
  - version numbers in names (`rpc_v2`, `RelayV3`);
  - compatibility shims (re-exports, alias routes, legacy flags, dual paths). A migration updates every caller in the same change; persisted data uses a one-shot migration;
  - `__main__` demo blocks, demo files or one-off scripts in library code;
  - dead code.
- Merging duplicates: the survivor is built on the newest variant (by git history) and keeps every capability of every variant. A capability is dropped only if provably obsolete, with the reason recorded.
- Refactors must not change AI model runtime logic: selection, priorities, fallbacks, warm-up, load/unload, scheduling, GPU/CPU, provider rotation, status semantics. Genuine bug fixes are allowed and recorded.
- A missing model never blocks startup. It is reported as unavailable through the model gateway.

## 2. Layering (one-way, top imports bottom)
```
pyapps (repo root)
  callmodule      routing only
  pyctl           orchestration
  pylauncher      startup, service starters, tray
  pyheartbeat     heartbeat scheduler
  pythreadpool    pool + registry (no starters)
  pyutils         domain primitives; domains share only pyutils/common
  database        persistence; table names via TableKeys
  pyfoundations   stdlib only (incl. pygvar, thread_bus)
```
- Same-layer imports are forbidden, except `pyheartbeat -> pythreadpool` and `pyutils -> database`.
- Shared code moves down, never sideways.

## 3. Canonical primitives (one implementation each; extend, never re-implement)
| Concern | Owner |
|---|---|
| Time | `pyfoundations/time_utils.py` |
| Atomic files / JSON state | `pyfoundations/atomic_json_store.py` |
| JSON index stores | `pyutils/common/json_index_store.py` |
| Keyset-cursor lists (no offset paging) | `pyutils/common/keyset_cursor.py`; shape in `config/pycore_rpc_contract.json` `keyset_page` |
| Backoff | `pyfoundations/backoff_wait.py` |
| EOL normalization | `pyfoundations/text_eol.py` |
| LAN IP | `pyfoundations/net_probe.py` |
| Paths | `pyfoundations/core_node_dirs.py`, `system_paths.py` |
| Processes / ports | `pyfoundations/process_manager.py`, `pyutils/common/port_utils.py` |
| Task status | `pyfoundations/tasks.py` |
| Running-flag lifecycle | `pyfoundations/serialized_worker.py` |
| SQLite | `database/adapters/sqlite_local.py` |
| HTTP client (bodies are stall-driven, never a fixed deadline) | `pyutils/common/http_client.py` |
| Laravel base URL / requests | `pyutils/laravel/endpoint_manager.py`, `client.py` |
| Route paths (Laravel and pycore) | `config/*_contract.json`; no literals in code |
| Engine registry / status panels | `pyutils/common/engine_registry.py` |
| Event journal | `pyfoundations/event_journal.py`, served only over WS `/api/ws` |
| Relay (one relay; delivery guarantee is per route) | `pyctl/relay/`, `pyutils/common/relay_contract.py` |

## 4. Threading
- Thread subclasses (`*Thread`) only. Shared state lives in THREAD_BUS owners.
- **FORBIDDEN**: locks, events, semaphores, `threading.local`, per-thread maps, `ThreadPoolExecutor`, `Timer`, `queue.Queue`, `Thread(target=)`.
- asyncio is allowed only in the RPC server loop.
- Exempt: `tts_install_assets/*` (never imports pycore) and `bootstrap/*` (stdlib first, may hand off to pycore as its last step).

## 5. Dependencies
- Models, weights, venvs, binaries and Docker images are installed only by the shell prerequisite scripts that `pyservice.sh` / `.ps1` run. Python checks presence and reports the installer step; it never downloads or installs them.
- Model weights have one shared location: `system_paths.get_shared_download_cache_dir()`. On dual boot this is `D:\www\cache`, which Linux sees as `/www/www/cache` via an ntfs3 mount. Every weight path resolves through it, never through a home dir or a literal path. Linux-only tools, venvs and binaries stay on ext4.
- pip packages: register them in `pyfoundations/third_party` and access them via `get_third_package_*()` getters with `*_AVAILABLE` flags. The idempotent self-install stays as the fallback. A getter returns None if the install fails.

## 6. Other
- Apps: `pyapps/{app}/{app}_main.py`, with `{app}_`-prefixed config and i18n modules.
- i18n uses key constants only (no hardcoded strings or defaults); an app calls `i18n.extend_translations(...)` in its launcher config builder before the first `i18n.get()`.
- Do not mix HTML/JS/CSS with Python.

## 7. pycore-dev MCP (read-only development aid)
- `pyctl/devmcp/` serves an official-SDK FastMCP (Streamable HTTP, stateless, JSON) at `/mcp` of the pycore HTTP server, mounted by `callmodule/rpc_routes/dev_mcp_routes.py` through `HttpServer.mount_asgi_endpoint` (the session manager runs in the app lifespan). The path comes from `service_contract.json` `paths.pycore_dev_mcp`; `mcp` is registered in `python_package_policy.py` and read via `get_third_package_mcp()`.
- Direct loopback only: peer and Host loopback, and any `X-Forwarded-*`, `Forwarded`, `X-Real-IP`, `Via` or `Tailscale-*` header is a 403 (the tailnet proxy reaches the same port).
- Observation tools only: Chrome tabs/screenshot/DOM text through the mcp-chrome MCP, Colab cell output, terminal list/text (OCR of a window capture, or the latest stored terminal backup). Never add input, keystroke, shell/SSH or permission tools.
- Claude registration (`pycore-dev`) is written with the `chrome` entry by `mcp_config_provider.*` and the launcher ensure step (`Invoke-AiCliChromeMcpEnsure`, `ai_cli_chrome_mcp_ensure`).
