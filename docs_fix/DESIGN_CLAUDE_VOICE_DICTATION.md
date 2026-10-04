# Claude voice dictation (voice messages typed by Claude Code /voice)

A voice message from the pycore-manager terminal composer is typed into the Claude Code session by Claude Code's own hold-to-talk dictation. pycore plays the recording into a virtual microphone while repeating the push-to-talk key; Claude Code transcribes it (Anthropic speech-to-text, Claude.ai login) and pycore submits the transcript. Claude Code itself is unchanged: voice settings are session-only (`--settings`), never written to settings files.

Linux is done. Windows must implement the same contract (section 5).

## 1. Contract: `config/claude_voice_dictation.json`

| Key | Meaning |
|---|---|
| `pipewire_source` / `pipewire_sink` | Virtual microphone (recorder side) / its playback input |
| `session_settings` | Passed as `claude --settings <json>`: `voiceEnabled`, `voice.enabled`, `voice.mode=hold` |
| `hold_key`, `hold_key_interval_ms` | Push-to-talk key and repeat interval. Claude releases after ~200 ms without a repeat, so keep the interval well below that |
| `loopback_settle_ms`, `recording_warmup_ms`, `recording_tail_ms` | Wait after creating the mic; hold before playback starts; hold after playback ends |
| `transcript_poll_interval_ms`, `transcript_timeout_ms` | Polling the input box for the transcript |

Measured on Claude Code 2.1.288: tap mode finalizes and submits at the first pause in speech, so only hold mode works. Hold mode inserts the full transcript into the input box without submitting. Chinese with English words is transcribed correctly even though Chinese is not in the `/config` dictation language list.

## 2. Launchers (session side)

`scripts/shells/linux/common/claude_team_common.sh`:
- `claude_team_pipewire_runtime_dir`: finds the PipeWire socket: `PIPEWIRE_RUNTIME_DIR`, `XDG_RUNTIME_DIR`, then `/run/user/*`.
- `claude_team_voice_dictation_spec "$@"`: sets `CLAUDE_TEAM_VOICE_ENV` (`PIPEWIRE_RUNTIME_DIR`, `PIPEWIRE_NODE=<source>`) and `CLAUDE_TEAM_VOICE_ARGS` (`--settings <session_settings>`). Both stay empty when there is no PipeWire socket or the caller passes its own `--settings`.

`scripts/linuxenvs/claudeteam.sh` applies the spec on the role/lead path and on the `--device-slot` plain-claude path. It covers standalone, team, agents and grid sessions. The banner prints the env and `--settings <voice dictation>`.

Not covered:
- Remote roles (Claude runs on the server over SSH): no local microphone.
- API-key vendor scripts (`claude1-5`, `ark*`, `claudealibaba`...): `/voice` requires a Claude.ai login.
- Plain `claude` quick commands: started without the launcher.

All of these fall back to the file-path message (section 4).

## 3. pycore (shared logic, platform primitives)

| File | Role |
|---|---|
| `pycore/pyutils/audio_utils/virtual_microphone.py` | Linux primitive. `available()` = not Windows + PipeWire socket + `pw-loopback`, `pw-play`, `ffmpeg`. `decode_to_wav` (ffmpeg, mono 48 kHz). `VirtualMicrophone(source, sink)` context = a `pw-loopback` process; `.play(wav)` = `pw-play --target <sink>` |
| `pycore/pyutils/window/terminal_backend.py` | `prepare_input` (Ctrl+C / clear), `hold_key(window_id, keysym, holding, interval)` (repeats the key while `holding()`), `append_and_submit` (paste without clearing, then Enter), `clear_input` |
| `pycore/pyctl/terminal/terminal_agent_detector.py` | `framed_input_text(text)`: text of the bottom framed input box, else None |
| `pycore/pyctl/terminal/terminal_voice_dictation.py` | Orchestration (platform-neutral): `ready_input`, `dictate` (decode → mic → hold key while playing), `await_transcript`, `resolve_recordings` (only files in the voice store `taud`). Ignores the recording level glyphs `▁…█` and the empty-box placeholder `Try "..."` |
| `pycore/pyctl/terminal/terminal_service.py` | `dictate_voice(window_id, terminal_number, recordings, text, clear_first, interrupt_first)`, serialized; logs the submission with source `voice` |
| Route | `terminalVoice` = `POST ui/terminal/voice` (`pycore_rpc_contract.json`). Relay profile `terminal_voice`, timeout 180 s (`pycore_relay_contract.json`). Params: `window_id`, `terminal_number`, `recordings` (newline-joined attachment paths), `clear_first`, `interrupt_first`; body = text |

Flow of `dictate_voice`:
1. Fail with `terminal_voice_dictation_unavailable` (nothing typed) when the platform is unavailable, the window has no agent input box, or a prompt is waiting.
2. Activate the window, apply clear/interrupt, read the baseline input.
3. Per recording: decode, create the mic, hold the key (warm-up, play, tail), destroy the mic, then poll until the input box shows new, stable text. On timeout: clear the input and return `terminal_voice_no_transcript`.
4. Paste ` <text>` after the transcript (clipboard saved and restored), press Enter.

## 4. UI

`apps/pycore-manager/pages/PcTerminalPage.tsx` `sendInput`: with audio attachments it first calls `terminalApi.dictateTerminalVoice` (`core/integrations/pycore/PycoreApiTerminal.ts`). On success, or on any error other than the fallback set, that result stands. For `terminal_voice_dictation_unavailable`, `terminal_voice_no_transcript`, `terminal_voice_audio_invalid` or a request failure (older pycore), it sends the previous payload: `terminal.voice.agentNote` + text + file paths. The recorder (`usePcVoiceRecorder.ts` over `CapAudioRecorder`) records in-page in browsers and through the native plugin in the Capacitor app.

## 5. Windows parity (to implement)

1. **Virtual microphone:**
   - Implement `virtual_microphone.available()`, `VirtualMicrophone` and `play` for Windows with the same interface.
   - A virtual audio cable is needed (e.g. VB-CABLE: playback device "CABLE Input", recording device "CABLE Output"), installed by the Windows prerequisite scripts, never by Python.
   - Add Windows names to the config (e.g. `windows_capture_device`, `windows_playback_device`). Do not reuse the PipeWire keys.
2. **Capture selection:**
   - Claude Code on Windows records through its native module from the default capture device. No per-process device env like `PIPEWIRE_NODE` is known.
   - Verify first. If there is none, `VirtualMicrophone.__enter__` sets the cable as the default recording device and `__exit__` restores the previous default.
   - `available()` must be false while that cannot be done.
3. **Launchers:**
   - `scripts/shells/win/win_common/ClaudeTeamCommon.ps1` needs an equivalent of `claude_team_voice_dictation_spec`, giving `--settings <session_settings>` (plus any env the capture path needs). Skip it when the caller passes `--settings`.
   - Apply it in `scripts/winenvs/claudeteam.ps1` on the lead/role path and the device-slot path, and show it in the banner.
4. **Keys:**
   - `hold_key` uses the existing `_keys` of `windows_terminal_backend.py`. Each call must take well under `hold_key_interval_ms` so Claude sees continuous repeats.
   - Check the `space` keysym mapping in `press_native_key_combo`.
5. **Unchanged:** the orchestration, route, UI and fallback are platform-neutral and need no change.

## 6. Agent voice-support survey (official docs, checked 2026-10-05)

| Agent | Official voice input | Integration |
|---|---|---|
| Claude Code | Yes: `/voice` hold-to-talk dictation (Claude.ai login) | DONE (this design, Linux + Windows) |
| Codex CLI | Yes since 0.156.0 (DevDay 2026): realtime multimodal voice ON BY DEFAULT, F8 toggle, `/voice` settings picker, bundled audio runtimes for Linux+Windows. The pre-0.156 removal only cleaned up the API-key WebRTC experiment. Audio goes straight to the model - no transcript lands in the input box | DONE (pycore): `dictate_voice(..., agent="codex")` plays each recording through a toggle-play-toggle round (`dictate_realtime`, config key `codex`, backend key `f8`); optional text follows as a normal submission. Caller passes `agent=codex` on the `terminalVoice` route. Requires codex >= 0.156.0 (native ensure keeps it current) |
| Gemini CLI | Yes (experimental): `experimental.voiceMode` enables `/voice` + dictation; `experimental.voice.activationMode` = `push-to-talk` (Space) or `toggle`; `experimental.voice.backend` = `gemini-live` or `whisper` | COMPATIBLE: in push-to-talk mode the existing Claude hold pipeline applies unchanged (FramedInputRule already matches Gemini's input box). TODO: launcher-side enable (session-scoped settings injection) before dictation can be assumed |
| Qwen Code | Yes: `/voice` dictation in CLI/Web Shell/desktop, `voiceModel` ASR (qwen3-asr-flash), push-to-talk `hold`/`tap`; microphone capture is the `@qwen-code/audio-capture` native module | TODO: same virtual-microphone + hold-key path as Claude. Prereqs: qwen must install via pnpm (NOT bun - bun skips the audio-capture build script; ApplicationsList.ps1 keeps QwenCode on pnpm for this), a configured `voiceModel` with ASR credentials, and `terminal_agent_detector` support for qwen's input box |
| dsh / cline / arkcli / others | No official voice input found | Fallback (section 4) |

The UI already covers every agent: `dictate_voice` returns `terminal_voice_dictation_unavailable` for a non-dictation agent and the UI falls back to `terminal.voice.agentNote` + text + file paths. Coverage: Claude + Codex dictation paths implemented; Gemini works over the Claude pipeline once its session enables voice; Qwen pending; everything else falls back.

## 7. Verification

1. Start a session with the launcher env, e.g. `claude_team_voice_dictation_spec` then `claude --permission-mode plan "${CLAUDE_TEAM_VOICE_ARGS[@]}"` in tmux with `CLAUDE_TEAM_VOICE_ENV` exported.
2. Run `TerminalVoiceDictation` with a backend whose `hold_key` sends the key and whose export reads the pane, using a recording copied into the voice store.
3. Expected: the full transcript appears in the input box (18 s Chinese clip: one sentence, about 365 key repeats at 50 ms), and the virtual device is gone afterwards (`wpctl status`).
