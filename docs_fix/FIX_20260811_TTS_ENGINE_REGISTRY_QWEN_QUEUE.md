# TTS Engine Registry and Qwen Queue Recovery

Date: 2026-08-11

Source: `_prompts/队列中心.txt`, first-part audio queue and Qwen3-TTS concurrency requirements.

## Cause

- TTS availability, synthesis dispatch, managed-service metadata, error lookup, health paths, and cache invalidation were defined independently in multiple modules.
- Managed synthesis acquired a lifecycle lease and then repeated an engine availability probe. That second gate could reject a service which the lifecycle owner had already started successfully.
- Managed server cache invalidation targeted obsolete module-private cache fields, while current engines store availability snapshots in `THREAD_BUS`.
- Qwen queue submissions generated a random client job ID when callers did not provide one. Retries of the same article therefore created independent queue jobs.
- A reachable Qwen HTTP process was considered healthy without proving that its queue consumer implemented the current bounded timeout contract.

## Shared Refactor

- Added one TTS engine adapter base and one registry for availability, uniform synthesis, managed kind, configuration readiness, health metadata, error reporting, model lifecycle, and availability-cache ownership.
- TTS orchestration, managed-service registration, and engine diagnostics now resolve engine behavior through the same registry.
- Removed the post-lease availability gate. The managed-service lease is the authoritative start, readiness, in-flight ownership, and release operation.
- Managed start and stop hooks now clear the actual per-engine `THREAD_BUS` availability signal.
- A successful managed-server start now seeds the shared health cache positively. If a manager-owned process later fails health, the common lifecycle stops it through its owned-process path and never misclassifies it as a foreign listener; an in-flight process remains protected.
- Qwen submissions derive a stable SHA-256 client job ID from text, language, output format, speaker, and instruction when no caller ID is supplied.
- Qwen queue snapshots now expose consumer state, running age, and stalled state. The managed service accepts or adopts a Qwen server only when that queue health contract is present and healthy; incompatible or stalled listeners are reclaimed through the existing managed-service recovery path.

## Queue Center Boundary

Agent History still synthesizes the complete article locally before Laravel upload. Sentence-level work remains in the independent `sentence_audio` Queue Center lane. The refactor changes local engine dispatch and Qwen queue recovery only; it does not merge DIFF-ID pages, claimed payload segments, or Laravel task persistence.

## Runtime Reasoning

1. A local article call resolves one adapter and acquires one managed-service lease.
2. The lease validates installation and configuration, starts or adopts a healthy service, and records in-flight ownership.
3. Qwen receives a content-stable job ID, so retries reuse the same retained or active job.
4. Queue status distinguishes process reachability from consumer health. A missing current contract, stopped consumer, or over-time running job makes the service unhealthy.
5. The lifecycle owner reclaims an unhealthy Qwen listener and starts the current API server before accepting new work.
6. Lease release updates idle activity once; fallback continues through the registry without another readiness probe.

## Verification

- Python AST parsing completed for all changed modules.
- Import-level execution loaded the registry, orchestrator, and service manager and reported all managed server and model groups.
- The running `pyservice.ps1` worker loaded the new code through its existing hot-reload lifecycle. A live TTS status refresh rejected the old Qwen server contract as not running instead of treating its reachable but unverified queue as healthy.
- A live Qwen synthesis generated an 8,492-byte MP3. Repeating the identical request in the same service instance completed in 9 ms API time, retained exactly one queue job, and reused the stable `qwen3tts-...` content ID.
- The live Qwen queue reported `consumer_running=true` and `stalled=false` after recovery.
