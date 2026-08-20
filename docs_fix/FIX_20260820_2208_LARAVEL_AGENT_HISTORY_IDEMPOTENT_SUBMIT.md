# Laravel Main agent-history idempotent submit

- **Date:** 2026-08-20 22:08 +10:00
- **Scope:** `poly_apps/laravel_main`, with the pycore caller contract noted below
- **Status:** implemented; not runtime-verified because repository rules prohibit tests, builds, and service execution unless explicitly requested
- **Related:** `FIX_20260816_2242_SINGLE_VERSION_MULTI_SENTENCE_PIPELINE.md`, `FIX_20260816_2309_AGENT_HISTORY_PINNED_QWEN_PIPELINE.md`

## Purpose

Agent-history generation and Laravel delivery now run as independent lanes.
Laravel Main can be offline while pycore continues local article and Qwen
multi-sentence audio generation. When connectivity returns, pycore retries
saved records. The Laravel submit endpoint therefore must make a repeated
delivery converge on the same article instead of generating a new UUID after
an HTTP response is lost.

This change also follows the minimum-step idempotency requirement. Finding the
main article does **not** skip the entire request. Every subordinate step must
independently converge:

1. deterministic audio file write;
2. find-or-create the main article;
3. upsert article words;
4. create the uploaded-document row only when its marker is absent;
5. emit the publication event only when its marker is absent.

## Request contract

`POST /api/app_qy_v1/ai_tools/article/worker/submit` accepts:

```json
{
  "idempotency_key": "article-<pycore-operation-item-id>"
}
```

The field is nullable for non-agent-history callers and is limited to 128
characters. When present, Laravel derives the article identity as:

```text
article_ + first 40 characters of sha256(idempotency_key)
```

The resulting identifier fits the existing 64-character `article_id` column
and unique index. No migration or compatibility-version field is required.

Pycore owns the stable key. Its local record ID is derived from the operation
item instead of a random UUID, and the upload lane sends that record ID as the
Laravel `idempotency_key` on every retry.

## Laravel Main implementation

### Worker submit controller

`AppQyV1ArticleController::workerSubmit` now:

- validates `idempotency_key`;
- derives a deterministic `article_id` when the key is present;
- looks up an existing article before persistence;
- rewrites the deterministic `<article_id>.mp3` through
  `AppQyV1DailyReadingService::replaceAudio` when the article already exists;
- creates the main article only when it is absent;
- continues through word, document, and event steps for both new and resumed
  requests instead of returning from one large idempotency guard;
- stores `idempotency_key` in article metadata for provenance;
- stores `publication_event_emitted` after the publication event step.

The unique `article_id` index remains the final concurrency guard. If two
first submissions race, only one can create the article; a later retry finds
that article and resumes the remaining small steps.

### Article-word step

`AppQyV1ArticleWordModel::createFromArticleWords` now uses `upsert` with the
existing unique identity `article_id + word_md5`. A resumed request updates
word attributes and frequency without inserting duplicate rows.

### Uploaded-document step

`AppQyV1DailyReadingDocumentService::createForWorkerArticle` first reads the
article metadata. If a positive `document_id` is already recorded, that
individual step returns the existing ID. It does not cause the controller to
skip audio, word, or publication-event progression.

## Changed files

| End | File | Purpose |
| --- | --- | --- |
| Laravel Main | `poly_apps/laravel_main/app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1AITools/AppQyV1ArticleController.php` | Stable request identity; resumable find/create, audio, document, and event steps |
| Laravel Main | `poly_apps/laravel_main/app/Apps/AppQyV1/AppQyV1Models/AppQyV1ArticleWordModel.php` | Word-level upsert on the existing composite unique key |
| Laravel Main | `poly_apps/laravel_main/app/Apps/AppQyV1/AppQyV1Services/AppQyV1DailyReadingDocumentService.php` | Document-level idempotency through `metadata.document_id` |
| pycore caller | `pycore/pyctl/agent_history/pipeline/laravel_stage.py` | Adds the stable `idempotency_key` to worker-submit payloads |
| pycore caller | `pycore/pyctl/agent_history/pipeline/worker.py` | Uses a deterministic local record ID and passes it to the upload lane |

## Constraints for future AI changes

- Do not restore a random Laravel article UUID for requests carrying an
  `idempotency_key`.
- Do not replace the small-step progression with an early “article exists”
  return; the existing article may be only partially completed.
- Do not make Laravel availability a prerequisite for pycore local generation.
- Keep `tts_chunked` as the single multi-sentence marker; do not introduce a
  pipeline-version compatibility layer.
- Keep audio replacement deterministic on `<article_id>.mp3` so retries do not
  create additional media files or change the public URL.
- Preserve the existing PostgreSQL unique keys. No schema change is needed for
  this fix.

## Verification boundary

No tests, builds, migrations, services, or runtime verification were executed.
The normal Laravel Main and pycore processes must be restarted through their
existing project startup flow before the new request contract is active.
