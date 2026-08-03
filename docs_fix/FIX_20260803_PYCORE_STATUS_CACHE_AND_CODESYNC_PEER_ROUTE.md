# Pycore Status Cache and CodeSync Peer Route Fix

## Local status latency

The STT, OCR, and TTS status APIs now share one bounded 30-second snapshot cache. The cache owns immutable copies through a THREAD_BUS-backed state owner, while expensive probes execute outside the cache owner so unrelated status categories do not block each other.

The compatibility status routes reuse the same cached status sources:

- `local/stt/status`
- `local/ocr/status`
- `local/tts/status`
- `ui/capability_status/status`, which returns all three slices plus AI status

The duplicate `ui/stt_status/status`, `ui/ocr_status/status`, and
`ui/tts_status/status` aliases were removed. Pycore UI now reads the unified
capability exchange instead of issuing overlapping requests.

TTS `refresh=1` bypasses and replaces the cache. TTS server or settings changes invalidate the TTS entry immediately.

STT status checks now use package-spec discovery instead of third-party package getters, preventing a status request from loading or installing Whisper and Vosk. TTS and OCR status composition no longer re-probes engines after availability was already calculated.

`ui/user_data/get_system_settings` remains uncached by design. It reads the unified in-memory user-data map and therefore continues to reflect persisted user changes immediately.

## CodeSync compatibility

The main Pycore HTTP service now exposes the same canonical peer endpoints as the standalone and light CodeSync clients:

- `GET /code-sync/peer/status`
- `POST /code-sync/peer/config`
- `POST /code-sync/peer/heartbeat`

These compatibility routes delegate to the existing CodeSync service and manager. Peer discovery, configuration replication, heartbeat handling, SSE transport, and file synchronization logic were not duplicated or changed. The lightweight peer-status snapshot also reuses its code statistics, hostname, and distribution state within one response.

## Configuration and validation policy

No environment-variable configuration was introduced. No tests, builds, or services were run, as required by the repository instructions.
