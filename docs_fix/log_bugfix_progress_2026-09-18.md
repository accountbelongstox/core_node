# Log bug fix progress

Source: `docs_fix/origin/log.txt` (3,238 lines).
Date: 2026-09-18.
Status: source changes completed; installation and runtime outcomes remain unverified.

## Findings and disposition

Repeated occurrences are grouped by cause. Log line numbers refer to the original file.

| Log evidence | Cause | Disposition |
| --- | --- | --- |
| 316, 343, 412: missing `Python.h` / Python libraries | Embedded Windows Python lacked development files needed by pyopenjtalk, jieba_fast and OpenCC. | Already addressed in current source: Step13 repairs base headers/import libraries and isolated provisioning copies missing files to the venv root and Scripts directory. Existing repair retained. No installer executed. |
| 786: `windows_native_build` property missing | StrictMode access to an optional engine policy field. | Already addressed in current source through `PSObject.Properties` lookup in `Invoke-IsolatedTtsVenvEnsure`. Existing fix retained. |
| 1085: Whisper cannot import `pkg_resources` | Old CosyVoice Whisper setup requires legacy setuptools in its isolated build environment. | Added shared legacy build packages and constraints to CosyVoice policy. Constraints propagate to child build processes. |
| 2461: OpenCC cannot import `cmake` | pip build isolation hides the installed Python CMake package from its launcher. | GPT-SoVITS now bootstraps setuptools, wheel, Cython, CMake and NumPy before installing engine requirements without build isolation. Existing CMake/NumPy compatibility bounds retained. Incompatible build-constraint environment options are cleared for this mode. |
| 512-516, 767-771, 2533-2535: missing NumPy, FastAPI or Transformers | Engine installation stopped before completing dependencies. | Underlying build failures addressed above. Existing health/stamp checks still prevent incomplete environments from being declared ready. Actual dependency repair requires rerunning installers. |
| 1139: missing `voxcpm` | Pre-install environment health check. | Same log confirms successful VoxCPM repair at 1702-1703. No additional source change needed for that occurrence. |
| 1113: Fish Speech repository catalog unavailable | Catalog code silently swallowed failures and accessed optional size/LFS properties under StrictMode; authenticated repositories lacked token headers. The original log does not establish which condition caused this request to fail. | Catalog reads now tolerate absent size/LFS fields, report failures, and use configured HF token headers. Downloads share authentication and reject HTTP error responses with curl `-f`. Repository access/network recovery remains external. |
| Fish checkpoint selection associated with 1113 | Custom repository IDs were reduced to a leaf name and rebuilt under `fishaudio`, losing their owner. | Preserve full configured repo IDs; qualify only bare model names; report unresolved selection before download. |
| 581-582, 2545-2546: WSL path conversion fails | Default WSL shell execution can process Windows path backslashes. Hyper-V firewall warning is also emitted by the environment. | Invoke `wslpath -a -u` through `--exec` with normalized separators. Expose WSL diagnostics. This change does not establish that the distro, drive mount or firewall warning is repaired. |
| 2871, 2905: Azure `SPXERR_INVALID_ARG` | Synthesis output was routed through native file-output configuration. The log alone does not identify the exact rejected native argument. | Use Azure's supported in-memory MP3 output and write result bytes through pathlib. Restore lazy optional SDK access and use synthesis-specific cancellation details. Credentials, region and successful native SDK initialization still need runtime confirmation. |
| 2797: F5-TTS unavailable | Reference audio/text may be absent; health code accepted HTTP errors as readiness. | Require successful JSON health responses. Missing reference configuration remains a user/environment prerequisite; fallback behavior preserved. |
| 2927: Fish Speech returns no audio | Readiness accepted 404/other HTTP errors. SDK fallback also referenced undefined `FishAudio` and `save` names. | Require successful JSON health; register shared lazy SDK getters; handle MP3 bytes/streams with the SDK's save helper as fallback. Actual upstream/cloud availability remains external. |
| 2678 onward: word/sentence scheduler callbacks time out repeatedly | Heartbeat diff synchronization let network failures escape and retried every tick. | Centralize diff failure reporting and a 30-second offline cooldown in the shared worker base. Preserve persistent mirrors/cursors and local processing. Endpoint changes bypass the old endpoint's cooldown. |
| 2786-2794, 3028-3029: remote audio lookup timeouts | Orchestration attempted downloads despite recent shared failed health probes. | Reuse recent endpoint health before optional remote cache lookup; proceed to local synthesis while the endpoint is known down. |
| 3206-3226: QueueCenterRealtimeThread exits | Probe worker wait was shorter than possible connect-plus-read time. A map timeout escaped before the reconnect loop's exception boundary. | Add optional per-item timeout results to the shared bus map; preserve default behavior for other callers. Laravel probes allow connect/read overhead and record timeout failures. Move endpoint resolution inside the existing reconnect boundary; verify the resolved endpoint's recorded health before subscribing. |
| 2721 onward: repeated rejected `/queue/submit` requests | Qwen accepts one active job; callers kept posting during capacity contention. | After capacity rejection, inspect status and reconcile the stable job ID while waiting. Submit again when capacity opens. Keep capacity/recovery budgets across error-type changes so retries cannot repeatedly reset their deadlines. A first rejection or admission race can still legitimately occur. |
| 2689 onward: duplicate Relay offline state logs | Shared Mercure reconnect code emitted offline in both exception handlers and finally. | Emit one offline notification from finally and preserve detailed failure information. Existing reconnect backoff retained. |
| 3050-3052: attention-mask warnings | Parler adapter discarded tokenizer masks. Bark also has internal generation paths that do not forward masks to every submodel. | Pass both description and prompt attention masks to Parler generation. Bark's internal upstream warning remains documented; no third-party source or weights modified. |
| Compiler C4267/C4146; setuptools license/wheel warnings; ChatTTS tuple-cache deprecation; weight_norm/Encodec warnings; missing Flash Attention 2; model config dumps | Third-party build/runtime notices, deprecations or optional acceleration messages. | Catalogued separately. They do not by themselves establish failed synthesis. No warning suppression, mandatory Flash Attention install, third-party edits or model-weight changes introduced. |
| Laravel health/media/result TLS timeouts and Mercure/Relay reconnect failures | The log shows all three Laravel candidates unreachable; the local candidate refused connections. | Client recovery and pacing defects addressed. Source changes cannot restore an unavailable remote server, TLS path or missing local service. Durable result outbox and retry behavior retained. |

## Changed files

- `pycore/pyutils/common/python_env/runtime_policy.py`
- `pycore/pyutils/common/python_env/isolated_venv.py`
- `pycore/pyfoundations/serialized_worker.py`
- `pycore/pyutils/laravel/endpoint_manager.py`
- `pycore/pyctl/queue_center/snapshot_service.py`
- `pycore/pyctl/laravel/worker_base.py`
- `pycore/pyutils/common/mercure_client.py`
- `pycore/pyctl/audio_orchestration/orch_resources.py`
- `pycore/pyutils/tts/qwen/client.py`
- `pycore/pyutils/tts/azure_engine.py`
- `pycore/pyutils/tts/parler_engine.py`
- `pycore/pyutils/tts/f5tts_engine.py`
- `pycore/pyutils/tts/fishspeech_engine.py`
- `pycore/pyutils/tts/tts_orchestrator.py`
- `pycore/pyfoundations/python_package_policy.py`
- `pycore/pyfoundations/third_party/_getters_optional.py`
- `pycore/pyfoundations/third_party/api.py`
- `scripts/shells/win/win_common/DockerWslBridge.ps1`
- `scripts/shells/win/win_common/TtsInstallAssetsCommon.ps1`
- `scripts/shells/win/install_powershells/Step56_InstallFishspeech.ps1`

## Completion limits

Source reviewed without running tests, builds, installers, services or verification commands, as required by AGENTS.md. No tests created or modified; no Git operations performed. Existing environments, caches, weights and credentials were preserved.

Pending runtime confirmation: CosyVoice/GPT-SoVITS dependency installation, WSL path translation and Docker readiness, model repository access, configured F5/Fish synthesis, Azure SDK synthesis, Laravel reachability and delivery replay. These are not reported as operationally repaired.

## Upstream evidence

- Legacy Whisper setup imports `pkg_resources`: [Whisper setup.py](https://github.com/openai/whisper/blob/v20240930/setup.py). This corroborates the dependency mechanism seen in the logged older Whisper build.
- OpenCC invokes the `cmake` executable: [OpenCC setup.py](https://github.com/BYVoid/OpenCC/blob/ver.1.1.9/setup.py).
- Azure supports `audio_config=None` and result `audio_data`: [Azure speech synthesis](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis).
- Fish Audio documents SDK conversion and saving MP3 audio: [Fish Audio SDK quickstart](https://docs.fish.audio/developer-guide/sdk-guide/quickstart).
- Parler supports prompt and encoder attention masks: [Parler implementation](https://github.com/huggingface/parler-tts/blob/main/parler_tts/modeling_parler_tts.py).
- Bark's semantic/coarse internal generation explains residual upstream mask notices: [Bark implementation](https://github.com/huggingface/transformers/blob/v4.46.1/src/transformers/models/bark/modeling_bark.py).
