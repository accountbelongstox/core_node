# Pycore Capability Single-Flight Fix

## Cause

The browser requested AI, OCR, STT, TTS, and the capability registry at the
same time. The capability registry repeated several of the same probes. A TTL
cache reduced later calls, but concurrent first reads still crossed the empty
cache together and repeated local health and command checks. The AI capability
view and Queue Center also bypassed the shared browser store.

## Backend changes

The shared status cache now coalesces concurrent misses by key. One caller runs
the loader while the others wait for and reuse its immutable result.

TTS uses a five-minute snapshot for every engine row and a 30-second aggregate
snapshot. Normal reads use installed and known managed-runtime state. HTTP
health, model readiness, and command checks run only for explicit refreshes.
The Laravel audio worker keeps its intentional periodic live planning probe.

AI status uses the same cache. Normal reads use local provider, key, cooldown,
rate, and previously known quota state without network probes. Explicit refresh
may probe providers and remote quota APIs. Key changes, cooldown resets, image
tests, TTS settings, and TTS server actions invalidate the affected snapshots
and the unified capability exchange.

The internal one-second scheduler remains because task workers depend on its
callback contract. Its periodic `Tick` log was removed, and its visible log
identity is now `Scheduler`; it no longer emits a Heartbeat program log.

## UI changes

`ui/capability_status/status` is the single Pycore capability exchange. One
browser-side in-flight request populates AI, OCR, STT, TTS, and the capability
registry. The AI page and Queue Center consume that store instead of calling
`local/ai/status` or `local/tts/status` independently.

The individual `local/*/status` routes remain compatibility APIs and reuse the
same backend snapshots. The duplicate `ui/*_status/status` aliases were removed.

No environment-variable configuration was added. No tests, builds, or services
were run, as required by repository instructions.
