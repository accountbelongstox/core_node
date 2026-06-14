# pyutils Layering Audit (2026-06-13)

Companion to `PYTHON_PYCORE.md` §2.2 / §3.2. Records the state of pyutils import
layering after the pyfoundations restructure and the "sanctioned shared base"
spec amendment.

## Model (per amended spec)
- **Shared base tier** inside pyutils = `pyutils/common` + the generic top-level
  modules directly under `pyutils/` (e.g. `robust_downloader`, `system_launcher`,
  `desktop_icon_generator`, `device_manager`, `unified_detector`, `port_utils`,
  `timer_manager`, …). Any pyutils package MAY import from this tier.
- **Forbidden:** a domain package (subdirectory) importing ANOTHER domain package;
  the shared base importing a domain package; any pyutils → `pyctl`.

## Clean results
- **`pyutils → pyctl`: ZERO** in code (only referenced in `.md` docs).
- Edges into `common` / into top-level base modules: **compliant** under the
  amended spec (this is the large majority of the previously-flagged edges).
- **False positives** removed from earlier raw greps:
  - `device_sync → launcher` (19): all are `.md` docs or subprocess command
    *strings* like `'-m', 'pycore.pyutils.launcher.device_sync'` — NOT imports.
  - `native_ui → frontend_launcher`, `rpc_v2 → translator`: docstring/comment only.

## Fixed this pass
- **`whisper_stt → azure_speech`**: the shared `BaseSpeechRecognitionProvider`
  moved `azure_speech/stt_base_provider.py` → `common/stt_base_provider.py`.
  `azure_speech` and `whisper_stt` now both import the STT base from `common`.

## Residual domain→domain / base→domain edges (recommended follow-ups)

These are genuine cross-domain dependencies. Each needs a small design change
(relocate the coordinator UP into `pyctl`, push a shared piece into `common`, or
inject the dependency) — deferred here to avoid destabilizing working subsystems.

| Edge | Files | Recommendation |
|------|-------|----------------|
| `common → edge_tts / azure_speech / whisper_stt` | `common/provider_status.py` (top-level), `common/speech_switch.py` (lazy) | These are speech-provider **coordinators** mis-placed in the base. Relocate to `pyctl/` (coordinator layer), or invert with injected provider factories. Base must not import domain. |
| `tts → edge_tts` | `tts/tts_orchestrator.py` | Move shared `TTSConfig` into `common`; relocate the engine-selecting orchestrator to `pyctl`, or inject the edge client. |
| `video_stream → device` | `video_stream/video_stream_handler.py` (`ScrcpyDevice`) | Inject the device object, or relocate the handler to a coordinator. |
| `device_sync → security.machine_id`, `device_sync → rpc_v2.discovery.local_ip_detector` | `device_sync/peer_config.py` (lazy) | Move the generic `machine_id` + `local_ip_detector` helpers into `common`. |
| `flutter_dev_tools → ocr_cluster` (lazy), `→ rpc_v2.server.fastapi_server` | `flutter_dev_tools/utils/image_analyzer.py`, `flutter_dev_tools/server.py` | flutter_dev_tools is app-like (runs an RPC server + OCR); relocate to the app/`pyctl` layer or inject. |
| `mcp → ocr_cluster` | `mcp/file_processing/*.py` (2 files, `ocr_manager`) | Expose an OCR access point in `common`, or treat these MCP tools as app-layer consumers. |
| `pyservice_cli → device_sync.peer_config` | `pyservice_cli/__main__.py` (lazy, 4×) | pyservice_cli is a CLI (app-like); relocate to the app layer or inject `get_peer_config`. |

Legacy compat shims (low priority, lazy fallbacks): `ai_cluster → openrouter_sdk / deepseek`.
