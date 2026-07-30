# pycore-manager — TTS/STT Engine Lifecycle (UI view)

This is the UI/design view of the speech-engine lifecycle surfaced on the AI page
(`/pycore-manager/ai`). The authoritative rules live in the pycore developer spec —
this doc only describes how they are presented and controlled. Do NOT restate the rules.

Source of truth: `development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md`.

---

## 1. What the AI page shows

The Capability tab (`PcAiCapabilityView` → `PcPipelineStatusPanels`) lists engines in
four strips: OCR, Translation, Speech-to-Text, Text-to-Speech, plus a Libraries strip.
Each engine tile shows: version/model-tier badge, a state pill, and a Test button.

Engine classes (mirror the dev spec §1) render differently:
- Class A (edge/azure/gtts/streamelements): no power control; edge is serialized.
- Class B in-process models (sherpa/kokoro/bark/voxcpm2; whisper/vosk/faster-whisper):
  show `model loaded` + idle countdown; no start/stop (load on use).
- Class C API/HTTP servers (chattts/cosyvoice/fishspeech/gptsovits/f5tts/**qwen3tts**/**melotts**):
  show `svc/up` + idle countdown AND power/enable controls (`PcTtsServerControls`). qwen3tts/melotts/
  gptsovits are isolated-venv servers (dev-spec §5).

State pills come from `ttsEngineUiState(installed, available)`: `ready` (available),
`setup` (installed, not yet available), `missing`. `api` tags come from library `kind`.

---

## 2. qwen3tts is ONE server entry

qwen3tts is class C (isolated-venv HTTP server). It MUST appear as a single tile with a
power control — not as two Libraries rows (`qwen_tts` pip + `qwen3tts` api). Its Test
button and controls behave like the other servers: enabling/starting it evicts other TTS
servers (single-active) and it idle-unloads after 3 minutes. First start may take minutes
(venv build + model load); the Test popup copy reflects the venv/server warm-up, not
"in-process".

`PcTtsServerControls` derives its engine list from `engines[].server_engine` (so qwen3tts
appears automatically) rather than a hardcoded list.

---

## 3. Tests

Every Test button opens the shared `PcTestPopup` and runs over the Pycore HTTP API
(`local/{tts,stt,ocr,ai}/test`) via `PycoreApi.testTts/testStt/testOcr/testAiChat`.
If Pycore HTTP is not connected the popup surfaces a clear "not connected" message
(tests do not silently no-op). TTS results play audio; STT/OCR/AI render text.

---

## 4. Settings

The capability drawer / server controls edit the persisted category settings:
`server_auto_manage`, `server_single_active`, `server_idle_shutdown_s` (default 180 =
3 min), `server_enabled` per engine. Engine PRIORITY is edited separately and persisted to
`capability_priorities` (see the word/sentence audio pipeline docs).
