# Laravel Main agent-history idempotent submit

- **Date:** 2026-08-20 22:08 +10:00
- **Updated:** 2026-08-20
- **Scope:** `poly_apps/laravel_main`, with the pycore caller contract noted below
- **Status:** implemented; not runtime-verified because repository rules prohibit tests, builds, migrations, and service execution unless explicitly requested
- **Related:** `FIX_20260816_2242_SINGLE_VERSION_MULTI_SENTENCE_PIPELINE.md`, `FIX_20260816_2309_AGENT_HISTORY_PINNED_QWEN_PIPELINE.md`

## Purpose

Agent-history generation and Laravel delivery run as independent lanes. Laravel
Main can be offline while pycore continues local article and Qwen multi-sentence
audio generation. When connectivity returns, pycore retries saved records. The
Laravel endpoint must make repeated delivery converge without creating a
second article, document, audio identity, word row, or Mercure publication
event.

Idempotency is implemented as independent minimum steps. Finding the main
article never skips the rest of the request:

1. insert the deterministic article identity or reuse the existing row;
2. merge submission metadata under an article row lock;
3. replace the deterministic audio artifact and converge its metadata;
4. upsert article words on their existing composite identity;
5. insert or reuse the source-addressed uploaded document;
6. append or reuse the Mercure outbox event and atomically mark publication.

A failure after any committed step leaves the request resumable. A retry runs
the sequence again, and every completed subordinate step independently
converges.

## Request contract

`POST /api/app_qy_v1/ai_tools/article/worker/submit` accepts the existing worker
payload plus:

```json
{
  "idempotency_key": "article-<pycore-operation-item-id>"
}
```

The field is nullable and limited to 128 characters. When present, Laravel
derives the article identity as:

```text
article_ + first 40 characters of sha256(idempotency_key)
```

The identifier fits the existing 64-character `article_id` column and unique
index. Laravel stores only `sha256(idempotency_key)` in metadata and does not
persist the raw key.

The article text, language, English title, Chinese title, reference text, and
reference-language fields form a submission fingerprint. Reusing an
idempotency key with a different fingerprint returns HTTP `409` instead of
mutating an existing logical operation.

Pycore owns the stable key. Its local record ID is derived from the operation
item instead of a random UUID, and the upload lane sends that record ID as the
Laravel `idempotency_key` on every retry.

## Laravel Main implementation

### Request and controller boundary

`AppQyV1WorkerArticleSubmitRequest` owns validation through Laravel Form
Request rules. `AppQyV1ArticleController::workerSubmit` passes validated input
to `AppQyV1AgentHistoryArticleSubmissionService` and maps the result into the
standard API response.

The controller no longer owns persistence, hashing, metadata mutation,
document creation, or outbox emission.

### Submission service

`AppQyV1AgentHistoryArticleSubmissionService` is the single orchestration path.
It derives the article ID, uses `insertOrIgnore` against the existing unique
`article_id` index, validates the stored fingerprint, and invokes every
subordinate step on both first delivery and retry. It never returns early only
because the article exists.

An article identity already owned by another article type is rejected. Two
concurrent first deliveries converge at the database unique key instead of
using a check-then-create race.

### Atomic article metadata

`AppQyV1ArticleModel::mutateMetadataByArticleId` centralizes metadata changes.
It uses the article connection, a Laravel transaction with bounded deadlock
retries, and `lockForUpdate` before reading and replacing metadata.

Audio, document, and publication metadata all reuse this primitive, preventing
overlapping worker retries from overwriting each other's JSON changes.

### Audio step

`AppQyV1DailyReadingService` writes the deterministic path
`daily/<language>/<article_id>.mp3` and records the binary SHA-256 digest as
`metadata.audio_sha256`.

Repeating the same audio request keeps the public URL and replacement
timestamps stable. Replacement timestamps and the first `audio_files` entry
change only when the bytes change or the entry is missing.

### Article-word step

`AppQyV1ArticleWordModel::createFromArticleWords` uses `upsert` with the
existing unique identity `article_id + word_md5`. A retry updates word
attributes and frequency without inserting duplicate rows.

### Uploaded-document step

Uploaded documents expose the reusable producer identity `source_type +
source_key`. Agent-history articles use `source_type=article` and
`source_key=<article_id>`. PostgreSQL enforces a unique composite index on
these columns.

`AppQyV1DailyReadingDocumentService::createForWorkerArticle` uses
`insertOrIgnore`, reads the canonical row, and links `document_id` through the
shared locked metadata mutation. `metadata.document_id` is a denormalized link,
not the uniqueness guard.

### Mercure publication step

`AppQyV1TranslationEventModel::emitOnce` uses the reusable outbox identity
`event + deduplication_key`. The `article.published` event uses the article ID
as its deduplication key.

The keyed outbox insert and `metadata.publication_event_emitted` update run in
the same article transaction while the row is locked. A committed marker
cannot exist without the outbox append, a rolled-back append cannot leave the
marker set, and concurrent submissions cannot append multiple keyed events.
The persistent marker also survives normal outbox pruning.

The normal Laravel realtime outbox publisher remains responsible for Mercure
delivery, retry scheduling, and bounded replay.

## Database alignment

`AppQyV1_2026_08_20_220900_add_submission_idempotency_keys.php` additively
aligns two existing tables:

| Table | Added columns | Added unique identity |
| --- | --- | --- |
| `uploaded_documents` | `source_type`, `source_key` | `source_type + source_key` |
| `translation_events` | `deduplication_key` | `event + deduplication_key` |

The identity columns are nullable, so existing unrelated document and outbox
rows remain valid. The migration uses `SafeMigrationHelper`, does not drop
data, and has a no-op `down()` method. It must be applied through the existing
`php artisan sys:init` deployment flow before the updated endpoint is used.

## Changed files

| End | File | Purpose |
| --- | --- | --- |
| Laravel Main | `poly_apps/laravel_main/app/Apps/AppQyV1/AppQyV1Requests/AppQyV1WorkerArticleSubmitRequest.php` | Worker-submit Form Request contract |
| Laravel Main | `poly_apps/laravel_main/app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1AITools/AppQyV1ArticleController.php` | Validated endpoint boundary |
| Laravel Main | `poly_apps/laravel_main/app/Apps/AppQyV1/AppQyV1Services/AppQyV1AgentHistoryArticleSubmissionService.php` | Minimum-step orchestration and fingerprint enforcement |
| Laravel Main | `poly_apps/laravel_main/app/Apps/AppQyV1/AppQyV1Models/AppQyV1ArticleModel.php` | Transactional row-locked metadata mutation |
| Laravel Main | `poly_apps/laravel_main/app/Apps/AppQyV1/AppQyV1Services/AppQyV1DailyReadingService.php` | Deterministic audio artifact and digest convergence |
| Laravel Main | `poly_apps/laravel_main/app/Apps/AppQyV1/AppQyV1Models/AppQyV1ArticleWordModel.php` | Word upsert on the existing composite key |
| Laravel Main | `poly_apps/laravel_main/app/Apps/AppQyV1/AppQyV1Models/AppQyV1UploadedDocumentModel.php` | Reusable document source identity |
| Laravel Main | `poly_apps/laravel_main/app/Apps/AppQyV1/AppQyV1Services/AppQyV1DailyReadingDocumentService.php` | Source-addressed document insertion and metadata link |
| Laravel Main | `poly_apps/laravel_main/app/Apps/AppQyV1/AppQyV1Models/AppQyV1TranslationEventModel.php` | Idempotent Mercure outbox append |
| Laravel Main | `poly_apps/laravel_main/database/migrations/AppQyV1_2026_08_20_220900_add_submission_idempotency_keys.php` | Additive document and outbox constraints |
| Laravel Main | `poly_apps/laravel_main/lang/en/article.php`, `poly_apps/laravel_main/lang/zh_CN/article.php` | Localized worker-submit messages |
| Pycore caller | `pycore/pyctl/agent_history/pipeline/laravel_stage.py` | Sends the stable Laravel idempotency key |
| Pycore caller | `pycore/pyctl/agent_history/pipeline/worker.py` | Derives the local record identity from the operation item |

## Official Laravel references

- [Database transactions and deadlock retries](https://laravel.com/framework/docs/13.x/database#database-transactions)
- [Query builder pessimistic locking](https://laravel.com/framework/docs/13.x/queries#pessimistic-locking)
- [Query builder upserts](https://laravel.com/framework/docs/13.x/queries#upserts)
- [Form Request validation](https://laravel.com/framework/docs/13.x/validation#form-request-validation)

## Constraints for future changes

- Do not restore a random Laravel article UUID for requests carrying an
  `idempotency_key`.
- Do not replace minimum-step progression with an early “article exists”
  return; the article may be only partially completed.
- Do not move orchestration back into the controller.
- Do not use JSON metadata alone as a document or outbox concurrency guard;
  preserve the database unique identities.
- Keep the publication marker and keyed outbox insertion in the same locked
  transaction.
- Do not make Laravel availability a prerequisite for pycore local generation.
- Keep `tts_chunked` as the single multi-sentence marker; do not introduce a
  pipeline-version compatibility layer.
- Keep audio replacement deterministic on `<article_id>.mp3`.
- Preserve the article, document, word, and outbox PostgreSQL unique keys.

## Verification boundary

No tests, builds, migrations, services, or runtime verification were executed.
The schema alignment and application code become active only after the normal
Laravel Main deployment and `sys:init` flow runs.
