---
name: project-phrase-pipeline-orch
description: 2026-10-05 phrase pipeline in pycore audio orchestration - decisions, cross-end gaps (Laravel ingest validator kinds, response envelope, locale codes)
metadata:
  type: project
---

Phrase step in pycore orchestration (`orch_books.ensure_sentence_phrases`, `orch_plan` step `phrases`, `orch_resources.BATCH_LANES`, clip routes kind `phrase`).

- Phrase cache `phrase_cache/<lang>.json` under the orchestration data dir keeps only sentences with status done|none; pending/unknown/failed sentences are re-asked each run. A failed Laravel page fails the task with `orch_phrases_fetch_failed` (never silently phrase-less).
- Phrase identity everywhere is local `media_content_id(text)`, never Laravel's returned content_id; the promote route derives it from text and ignores the caller's content_id.
- Word `meaning` in the pattern is still unimplemented (only `phrases` steps keep/emit `meaning`).
- `phrases_by_sentences` answer parsing accepts both `{data:{items}}` and `{items}` because the Laravel side did not exist when written; tighten once the real shape is known.

**Why:** the Laravel `AppQyV1OrchIngestValidator::RESOURCE_KINDS` is `['word','sentence']` and also validates timeline `type`; a phrase timeline entry (`type: phrase`) would 422 (permanent) the task output delivery until Laravel adds `phrase`. `orch_delivery._task_resources` deliberately still sends word|sentence resources only.
**How to apply:** before shipping phrase tasks, confirm the Laravel validator accepts `phrase` timeline types; new message codes (orch_phrase_batch, orch_phrases_loading, orch_phrases_fetch_failed, orch_phrases_pending) need `pc-locales/OrchLocales.ts` entries. See [[project-pycore-pitfalls]].
