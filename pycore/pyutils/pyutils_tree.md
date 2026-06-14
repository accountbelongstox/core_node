# Directory Tree: pyutils

**Path:** `pycore/pyutils`

As of 2026-06-15 every utility lives inside a functional group package; the only
loose file at the package root is `__init__.py` (the facade). The shared base is
`common/` (see PYTHON_PYCORE.md S2.2 / S3.2): any group MAY import `common`,
`common` MUST NOT import a group, and no group imports a sibling group.

```
pyutils/
├── __init__.py                # package facade: *_AVAILABLE flags + curated re-exports
├── common/                    # SHARED BASE - generic helpers any group may import
│   ├── clipboard_text.py      #   clipboard get/set primitive (used by input.field_input)
│   ├── icon_generator.py      #   DesktopIconGenerator (.png->.ico + shortcut creation)
│   ├── appusermodelid.py      #   AppUserModelID setter
│   ├── system_launcher.py     #   open path/dir/file, start program
│   ├── process_manager.py     #   start/stop/monitor processes
│   ├── app_launcher.py        #   launch app + wait for window (pywinauto)
│   ├── dev_reload.py          #   dev hot-reload watcher
│   ├── robust_downloader.py   #   resumable downloader
│   ├── port_utils.py          #   port availability helpers
│   ├── zip_task_queue.py      #   background zip task queue
│   ├── build_config_parser.py #   app build-config reader
│   ├── capabilities.py        #   cheap CUDA/free-library capability probe
│   ├── window_finder.py        ·  browser_window_detector.py
│   └── speech CONTRACTS only: speech_task_models, speech_config, global_config,
│       stt_base_provider, tts_models, tts_queue_ops (data/base classes the speech
│       groups depend on - the cross-group orchestrators moved to pyctl/speech)
├── window/                    # window & on-screen UI utilities (was window_*.py, ui_analyzer, unified_detector)
│   ├── activator.py · analyzer.py · ops.py · screenshot.py
│   ├── integrated_analyzer.py · ui_analyzer.py · unified_detector.py
├── desktop/                   # desktop shortcut managers + taskbar
│   ├── shortcut_manager.py · universal_shortcut.py · tk_taskbar.py
├── input/                     # input simulation
│   ├── click_handler.py · field_input.py · ime_switch.py · tray_clicker.py
├── image_tools/               # image & media processing
│   ├── image_processor.py · media_compressor.py · dataset_generator.py
│   ├── icon_analyzer.py · icon_utils.py · image_annotator.py · image_comparator.py
│   ├── image_crop.py · image_enhancer.py · image_matcher.py · png_matcher.py
├── device/                    # ADB / scrcpy device layer (now also device_manager.py, scrcpy_init.py)
├── hotkey/                    # hotkey_listener.py (THREAD_BUS) + global_hotkey_listener.py (was loose hotkey_listener.py)
├── examples/                  # sample/template code (singleton_launcher*, desktop_shortcut_manager_example, ...)
│
├── adb/ · api/ · audio_utils/ · azure_speech/ · clipboard/ · control/ · device_sync/
├── edge_tts/ · ensure_library/ · flutter_dev_tools/ · frontend_launcher/ · group/
├── launcher/ · mcp/ · mcp_bridge_with_laravel/ · native_ui/ · nodejs_bridge/
├── ocr_cluster/ · pybrowser/ · pyservice_cli/ · rpc_v2/ · security/ · text_stats/
├── translator/ · tts/ · ultralytics/ · video_stream/ · voc_annotator/ · web/
├── whisper_stt/ · wsrpc/ · ai_cluster/
```

> **`common` is verified clean** - it imports NO group (the former
> `common -> edge_tts/azure_speech/whisper_stt` debt was resolved on 2026-06-15 by
> moving the speech ORCHESTRATORS - `SpeechSwitch`, `ProviderStatus`, the TTS/STT
> switches - to `pycore/pyctl/speech/`, where importing groups is legal. `common`
> keeps only the speech contracts/base classes the groups depend on.)
>
> Remaining cross-group edges are pre-existing GROUP->GROUP feature/infra coupling,
> NOT involving `common`: `tts -> edge_tts` (tts_orchestrator coordinator),
> `mcp`/`flutter_dev_tools -> ocr_cluster` (OCR feature use),
> `flutter_dev_tools -> rpc_v2` (RPC framework), `video_stream -> device`
> (ScrcpyDevice type), `device_sync -> security`/`rpc_v2` (machine-id / LAN-ip
> primitives), `pyservice_cli -> device_sync` (CLI). Correct fixes: relocate
> coordinators to `pyctl/`, push generic primitives (machine_id, local-ip) into
> `common`, or wire by DI. Tracked as follow-up (each touches a working subsystem).

---
*Maintained by hand after the 2026-06-15 pyutils regroup.*
