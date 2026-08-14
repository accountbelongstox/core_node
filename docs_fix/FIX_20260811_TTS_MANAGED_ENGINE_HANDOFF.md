# Managed TTS Engine Handoff Fix

Date: 2026-08-11

Source: `_prompts/队列中心.txt`, first-part audio queue blocking follow-up.

## Diagnosis

- Agent History rejected stopped managed engines before the orchestrator could start them.
- The fallback orchestrator started an engine before registering its in-flight use.
- A concurrent Qwen3TTS sentence task could enter single-active handoff during that gap and stop the newly started ChatTTS process.
- A stale availability cache could also admit an engine after its fresh managed-service readiness check had failed.

## Shared Lifecycle Refactor

- The shared managed-service owner now exposes one lease operation that atomically starts a service and registers in-flight ownership.
- `ManagedServiceFacade` is the common category base for service registration, manual start/stop, enablement, settings, and canonical server/model runtime fields.
- `EngineAdapter` and `EngineRegistry` are the common engine-definition bases for normalized identity, managed-kind selection, duplicate rejection, lookup, and priority merging.
- TTS, STT, and LLM extend those bases with domain-only behavior. Their lifecycle registration now iterates the canonical adapters instead of maintaining parallel engine-name lists and metadata maps.
- LLM adapters own installation, health, endpoint, model, external-service, and start-command descriptions. Adding a managed LLM no longer implicitly assigns the Ollama start command.
- TTS service and model specifications bind adapter callbacks directly; the derived server/model tuples and lookup wrapper functions were removed.
- TTS notes, concurrency class, package distribution, and model-tier participation now live on each adapter. The orchestrator metadata maps were removed, and the Laravel audio worker reads concurrency through the public orchestrator query instead of a private dictionary.
- STT adapters own availability, display metadata, package distribution, and managed kind. Unknown or duplicate environment-priority entries are filtered by the same merge algorithm used by TTS and LLM.
- TTS, STT, and LLM register through that facade; their domain modules retain only engine-specific commands, probes, synthesis/transcription/chat behavior, and Qwen queue metadata.
- TTS engine modules, managed kinds, health paths, configuration readiness, availability invalidation, synthesis dispatch, and last-error access resolve through the canonical `TTSEngineRegistry` adapters.
- TTS and STT share one managed model-load context instead of maintaining parallel wrappers.
- The old two-stage prepare-then-use contract was removed from the TTS and LLM facades and from every Pycore caller.
- Lease release is the single idle-activity update; duplicate TTS and LLM post-success touches were removed.
- TTS fallback, direct engine tests, Qwen3TTS batch synthesis, STT, and local LLM calls use the same lease primitive.
- Fish Audio SDK readiness is represented in the shared service specification instead of bypassing lifecycle ownership in the TTS facade.
- External local LLM servers are represented explicitly and can be leased only while their health endpoint is reachable.
- Qwen synthesis submission no longer starts the server on the request path. The background operation owns the lease for the complete queue submit-and-wait interval.
- Explicit Qwen model loading and sentence-engine warm-up also use leases, so another TTS server cannot interrupt them.
- Lease acquisition hooks own engine availability-cache invalidation; the TTS orchestrator no longer wraps lifecycle state changes.
- When single-active switching encounters a busy peer, the manager records the target server and stops the superseded peer immediately after its final lease is released. A failed or manually stopped target clears that deferred handoff.
- Lease and watchdog hot paths consume the published category-settings snapshot. Persistent settings are read only during category initialization or explicit refresh/update, not once per synthesis or transcription.
- Expected unavailable lease candidates are skipped without reporting a synthesis command that never ran.
- When Qwen batch acquisition is unavailable, per-variant fallback excludes Qwen instead of repeating the same failed acquisition for every variant.
- Sentence priority is no longer rewritten from current HTTP reachability. A cold but configured Qwen server remains first and is started by its lease; only a failed lease advances the fallback chain.
- Agent History delegates local engine startup and fallback entirely to the central TTS orchestrator.
- Cloud engines retain their lightweight availability preflight.

## Queue Center Boundary

The change does not alter Queue Center payloads, DIFF-ID pages, worker claims, or Laravel persistence. Agent History still completes full-article audio locally before upload, while sentence audio remains on the independent central queue.

## Static Path Evaluation

1. A cold Agent History article enters the local-only profile without checking current server reachability. Each candidate acquires one lease; disabled, uninstalled, or unconfigured candidates exit before synthesis and do not emit a false failed-command record.
   A sentence profile keeps Qwen first even when its process is initially stopped.
2. ChatTTS startup and its in-flight token are committed by the same serialized acquisition. A concurrent Qwen sentence task cannot stop ChatTTS before that token exists.
3. If Qwen becomes the single-active target while ChatTTS is synthesizing, both may overlap only while ChatTTS is busy. Releasing ChatTTS's final lease performs the deferred stop immediately.
4. If Qwen startup fails or Qwen is manually stopped, its target marker is cleared, so an older busy peer is not stopped after the intended replacement disappeared.
5. Qwen synthesis submission returns after durable operation creation. The background operation owns Qwen startup, queue submission, result waiting, and lease release.
6. A forced Qwen reload refuses to stop an engine with active leases and returns a busy error instead of reloading weights during synthesis.
7. Disabled engines reject new leases before installation/configuration probes. Auto-management-off engines may be leased only when already reachable.
   If an engine is disabled while busy, its final lease release performs the deferred stop or model unload.
8. STT model loading and local LLM calls use the same lease and runtime-state primitives; model engines remain parallel while server single-active behavior stays category-scoped.
9. Laravel Queue Center streaming and Qwen queue event long polling remain dedicated long-lived transports. Their request duration does not hold a managed-engine lease or execute on the Queue Center materialization path.
10. Registry construction rejects duplicate normalized names. Priority input is normalized, de-duplicated, restricted to registered engines, and completed with omitted registered engines in canonical order.
11. Faster-Whisper and Azure STT transcription now resolve optional packages through the Pycore third-party facade. The former undefined `WhisperModel` and `speechsdk` references cannot reach their transcription branches.

## Verification Boundary

Per project instructions, no tests, builds, services, or runtime verification commands were executed. Review was static only.
