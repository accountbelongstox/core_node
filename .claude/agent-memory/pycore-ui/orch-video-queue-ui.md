---
name: orch-video-queue-ui
description: Audio-orchestration UI structure after the queue/video refactor (2026-09-30) and pycore contract quirks that shaped it
metadata:
  type: project
---

Audio orchestration UI (`pages/audio-orchestration/`): task list = per-source tabs via `useOrchTaskListing` (server pagination, push + poll refresh), rows in `OrchTaskRow`, expanded part in `OrchTaskDetail`, video look in `OrchVideoPresetPanel` (+ Toolbar/SettingsForm/Preview, state in `useOrchVideoPresets`, owned by `AudioOrchWorkspace`). API types/methods: `core/integrations/pycore/PycoreApiOrchestration.ts` + `PycoreApiOrchestrationVideo.ts`; locale keys split into `pc-locales/OrchVideoLocales.ts` (spread into orchEn/orchZh).

**Why:** pycore's queue now starts tasks itself, so the only manual start is a de-emphasized "Regenerate" (`task/generate` with `force_fresh`).

**How to apply / contract quirks:**
- `video/preset_save` returns the full list plus `preset_id` (the saved id).
- Generated files load through `task/file_chunk` (1 MiB chunks): `orchFetchTaskFile` in `PycoreApiOrchestrationFiles.ts`, shared Blob/object-URL cache in `orchTaskFileCache.ts` (refcounted, revoked on last release; >300 MB is never buffered).
- A failed task can show Queued/Running again by itself (queue reason `retry`, up to 3 automatic retries with backoff).
- Segment `video_error` and log param `error` are lowercase codes (`orch_video_no_timeline`, `orch_video_no_cards`, `orch_video_render_failed`); route errors are uppercase `ORCH_VIDEO_*`. Both live in `errorCodes` (PcEnCore/PcZhCore).
- `orch_queue_waiting` param `waiting` is a comma-joined string, handled in `orchParamValue` (`orchShared.ts`).
- `task/submit_text` has no UI caller (only server-side producers); its route constant is not in `PycoreHttpRoutes.ts`.
- Shell note: on this box a Bash heredoc holding TSX with many quotes failed to parse; use the Write tool for new files.
