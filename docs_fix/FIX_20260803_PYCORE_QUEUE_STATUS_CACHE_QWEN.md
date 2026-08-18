# Pycore Queue Status Cache and Qwen Sentence Audio Fix

## Cause

- Queue Center treated retired heartbeat callbacks as processor state. The live response could report `auto_start=true` and `sentence_audio_capability=true` while `heartbeat_enabled=false`, so AI status and Queue Center disagreed.
- System info and system resources bypassed the shared status cache. Capability settings used a separate three-second signal cache.
- STT rows without an explicit `installed` field were normalized to `installed=false` even when available.
- Sentence Audio used the configurable sentence fallback chain instead of requiring qwen3tts.

## Changes

- Added shared cache keys for system info, system resources, and capability settings. System resources use a one-second live-meter TTL; the other snapshots use the shared 30-second TTL. Capability settings writes invalidate their shared snapshot.
- Added a 30-second browser freshness window for the unified capability exchange, so Queue Center reuses the AI page snapshot.
- Added `processor_enabled` as the canonical dispatch-driven state. Legacy `heartbeat_enabled` remains a compatibility projection. Queue Center now composes worker lifecycle from processor state.
- Normalized missing STT `installed` values from availability.
- Fixed the Sentence Audio worker to qwen3tts through a required-engine constraint. Its retained local cache key includes the engine, preventing reuse of older fallback-engine output.
- Updated the Sentence Audio panel to show only qwen3tts readiness and to stop advertising fallback engines.

## Verification Boundary

The reported live endpoints were read before modification to identify the conflicting state. No tests, builds, services, or post-change runtime verification were run.
