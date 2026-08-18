# ChatTTS Offline Model Readiness Refactor

Date: 2026-08-13

Source: `_prompts/队列中心.txt`, first-part audio queue blocking follow-up.

## Diagnosis

- `.deps_done` represented importable Python packages but was treated as complete ChatTTS readiness.
- The managed server accepted HTTP 200 from `/health` before the model was loaded.
- The API server loaded the model lazily inside the first `/v1/audio/speech` request.
- ChatTTS `source="local"` downloads `rvcmd` from GitHub when local assets are absent. A Queue Center task therefore became a model-install request and failed with HTTP 500 when GitHub was unavailable.
- The fallback client truncated the error before the complete model-source chain was visible.

## Lifecycle Contract

1. `.deps_done` describes packages only.
2. The installer owns `<chattts>/weights` and writes `.model_installed` only after the selected Hugging Face asset set is complete.
3. Runtime readiness requires the sentinel and every ChatTTS asset consumed by the package.
4. A missing model rejects the managed-service lease before process startup, so TTS immediately advances to the next engine without a download attempt.
5. The managed process receives the resolved model directory plus offline Hugging Face and Transformers flags.
6. The API server loads `source="custom"` from the installer-owned directory before binding its port. It never uses ChatTTS's GitHub `rvcmd` downloader.
7. `/health` returns ready only after the model is loaded. Managed startup and external-service adoption use that explicit readiness field rather than HTTP reachability alone.
8. ChatTTS inference is serialized inside the standalone server because the shared model instance is not a per-request object.

## Installer Repair

- Windows and Linux installers distinguish dependency and model sentinels.
- An existing dependency installation authorizes an idempotent missing-model repair on the next normal prerequisite pass; first-time heavy installation remains opt-in.
- The shared Hugging Face installer no longer promotes an unmarked partial model directory to a completed model. ChatTTS requests catalog reconciliation when its exact local readiness probe fails, preserving complete files and resuming incomplete files.

## Queue Center Boundary

Queue payloads, DIFF-ID pages, task claims, Laravel persistence, and worker receipts are unchanged. The fix removes model provisioning from the queue-consumption request path; missing ChatTTS assets now cause a bounded local engine fallback.

## Verification Boundary

Per project instructions, no tests, builds, services, model downloads, or runtime verification commands were executed. Review was static only.
