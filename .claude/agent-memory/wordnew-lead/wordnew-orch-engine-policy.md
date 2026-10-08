---
name: wordnew-orch-engine-policy
description: 2026-10-08 engine policy change (only en sentences GPU-only) as implemented in wordnew/shared orchestration - the non-obvious decisions behind canGenerate, capability, direct windows and the monitor reporter
metadata:
  type: project
---

User-approved R13/R4 change: only English sentences are qwen3tts/GPU-only; words, phrases, zh sentences and meaning clips run on CPU or GPU. Implemented in `orchClipScheduler.ts` (`canGenerate`, `cursorKey`, `capabilityKey` on `OrchClipChannel`), `WordNewLaneCapability.ts` (cache of `ui/queue_center/lane_capability` per direct/relay machine), `WordNewBookPlanAssigner.ts`, `WordNewBookAudioPlan.ts`, `WordNewMonitorReporter.ts`, `WordNewOrchMeaningWatch.ts`.

Decisions that are not obvious from the code:
- "Asked pycore" for R4 = direct pycore while usable, else relay pycore, else none (R3 keeps the relay out while direct is up). Laravel generates a clip iff Laravel is usable and the asked pycore cannot generate it, so pycore stage and Laravel stage own disjoint clips.
- Unknown capability (old pycore, not read yet) = can generate everything; a lane declaring an empty language list = cannot (Laravel reads claims the same way). Capability TTL 60 s, re-read at run start and on selection/channel/pairing change.
- Stage cursors are keyed by selected machine (`wordNewPycoreLink.selectedUrl`) / Laravel endpoint id, never by the address in use; generate cursors also carry the capability signature.
- Direct window sid = `direct:<first 6 chars of the short device id>`; short device id = stable orch device id without `d-`/dashes, 16 chars (`orchClientDeviceId`). The post carries `device_id` and `direct_node_sid`; an empty window list is still posted once after windows were posted (drops this device's direct ranges).
- The pycore RPC answer is flat (`{success, node_sid, device_id, compute_class, lanes:{lane:{engines,languages}}}`); the relay contract already allows the route.

**Why:** a CPU direct pycore used to block Laravel (old R4) while it could not make en sentences, so en sentences and zh meanings stalled in `generating`.

**How to apply:** when touching generate stages keep the gate re-read before each request (R5/S8) and keep the drill (S13 matrix, S14, randomized capability rounds) in step; the drill script lives in `docs_fix/TEST_20261001_ORCH_CLIP_SCHEDULER_DRILL.md`.
