# pycore: AT-037 deletions explained (2026-09-27)

Role: `pycore` coordinator. Read-only investigation. No code was edited, restored or deleted, and no service was run.
Evidence comes from read-only git on `f4f223414^` (the state before the user's commit) and `HEAD` = `f4f223414`. The working tree matches HEAD for `pycore/`, `config/*_contract.json` and the UI route file.

## Who and when

- Role: `pycore`, task `pycore-4` (D1 closeout "audio/TTS and queue fixes"), finding AT-037 of `docs_fix/DESIGN_AUTH_IDENTITY.md`. The finding's full text is in `.claude/agents_shared/bug_audit_20260927/audio-tts.md` ("AT-037": severity low, category rule duplicate/dead code, confidence confirmed).
- The D1 pycore teammate made most of the pycore-4 edits. The D10 session finished the AT-037 remainder, which included the dead route-name constants (`.claude/agents_shared/reports/pycore.md`, AT-037 row).
- The reviewer approved it in round 2 (`.claude/agents_shared/reviews/pycore-4.json`, AT-037): "no pycore/pyapps/scripts reference remains. The only other reference is the UI constant PycoreHttpRoutes.ts:248 (no caller)".
- The deletions were made in the working tree. The user's commit `f4f223414` "CodeHeaderCleanerBak" (2026-09-27 15:57 +1000, 1191 files) recorded them.

## Per item

"Importers at parent" means `git grep` at `f4f223414^` over `pycore/ pyapps/ scripts/ poly_apps/ ncore/ apps/ config/`, with markdown, `.claude/`, `docs_fix/` and `development-guides/` excluded. Imports inside the deleted set are listed separately.

| Item (lines at parent) | What it did | Evidence it was dead or duplicate at `f4f223414^` | Live replacement now (HEAD) |
|---|---|---|---|
| `pycore/pyutils/tts/edge/parser.py` (224) | `TTSFileParser`: parsed a file, URL or text into a `DocumentModel` of sentences, with a JSON cache. | 0 external importers. It was used only inside the deleted set (it imports `edge.processor`). The last package export was removed in `924090ba8` (2026-07-29, old `pyutils/edge_tts/__init__.py`). | Document intake: `pycore/pyutils/document_processing/` (book_processor, book_text_extraction). Sentence intake for orchestration: `pycore/pyctl/audio_orchestration/orch_sources.py:18,64`. |
| `pycore/pyutils/tts/edge/processor.py` (229) | `TTSProcessor`: language detection, sentence split, word extraction, normalization. | 0 external importers; only `edge/parser.py` imported it. | `pycore/pyfoundations/text_parsing.py:448` `split_sentences`; long-text chunking `pycore/pyutils/tts/chunked_synthesis.py:4,45` over `pycore/tts_install_assets/tts_text_chunking.py:214` `split_text`; language detection `pycore/pyctl/translation/manual_translation_service.py:108`. |
| `pycore/pyutils/tts/edge/thread_manager.py` (242) | `TTSThreadManager` started `EdgeTTSWorkerThread`s. `TTSNetworkThread` looped every 60 s over an empty `_request_model_data` stub (`# TODO`). | 0 external importers. Its accessor `get_tts_thread_manager()` was removed in `e87ae401a` (2026-07-31), so nothing could start these threads. | Lane workers: `pycore/pyctl/tts/laravel_audio_worker.py:128` `_run_audio_synth_lane` and `:681` `_drain_cycle`, draining `audio_queue_center.pop_next`. |
| `pycore/pyutils/tts/edge/translator.py` (134) | `TTSTranslator`: sentence and document translation cache on a `SplitFileStore`. | 0 external importers. The last export was removed in `924090ba8` (2026-07-29). It had no translation backend call of its own (cache only). | Translation lane `pycore/pyctl/translation/worker/worker.py:52` `TranslationWorkerService`; `pycore/pyctl/translation/manual_translation_service.py:124` `translate_ai`. |
| `pycore/pyutils/tts/edge/worker_thread.py` (84) | `EdgeTTSWorkerThread(BaseTTSWorkerThread)`: synthesized a queued document, sentence or word with edge-tts into `<voice dir>/<md5>.mp3`. | 0 external importers; only `edge/thread_manager.py` imported it, and that had no importer. | `pycore/pyutils/tts/edge/client.py:364` `synthesize`, `:378` `find_voice_by_locale`, `:536` `edge_tts_client`, called through `pycore/pyutils/tts/tts_orchestrator.py:223` `synthesize` (edge engine branch `:320`, `:416`, `:450`). Edge outage recovery: `pycore/pyutils/tts/edge/recovery.py:59` `EdgeRecoveryProbeThread`, `:84` `start_edge_recovery_probe` (started at `tts_orchestrator.py:106`). |
| `pycore/pyutils/tts/worker_base.py` (104) | `BaseTTSWorkerThread`: a loop pulling `TTSQueueOps.get_*(timeout=1.0)` and waiting `interval=1.0` s on the stop signal when empty. This is a 1 s timer poll. | 0 external importers; its only subclass was `edge/worker_thread.py`. Not to be confused with `pycore/pyctl/laravel/worker_base.py` (`BaseLaravelWorkerService`), which is live and untouched. | State-driven queue `pycore/pyutils/tts/audio_queue_center.py:183` `AudioQueueCenter` (`:942` `pop_next`, `:957` `complete`, `:992` singleton). Workers are woken by queue state, with no timer poll. |
| `pycore/pyutils/tts/tts_queue_worker_threads.py` (87) | `WordTaskQueue` (priority tickets, `pop`) and `run_tts_worker_lane` (drained one word lane). | 0 importers. Its only importer, `pycore/pyctl/tts/word_queue_poller_service.py`, was deleted in `c9663a653` (2026-08-01). | `audio_queue_center.py:440` `promote_local_head` (priority), `:942` `pop_next`; `laravel_audio_worker.py:128` `_run_audio_synth_lane`; word batch `pycore/pyctl/tts/laravel_audio_worker_execution.py:562,578` into `pycore/pyutils/tts/batch/kokoro_batch.py:187` `synthesize_words_to_cache` (the one shared word-batch entry). |
| `word_audio_service.edge_synth` (:356) + route `ui/word_audio/edge_synth` | Per-word edge-tts synthesis that returned base64. | The route was registered (`local_word_audio_routes.py:29-32`), with no caller in any UI, Laravel, ncore, apps or scripts (0 hits for `edge_synth`/`edge-synth`/`edgeSynth` outside pycore). A second synthesis surface beside the one batch entry (AT-037). | General synthesis RPC `tts/synthesize` (`pycore/callmodule/rpc_routes/route_names.py:161`, `tts_routes.py:45` `synthesize_speech`, registered `:120`; `provider='edge'` pins edge). Word batches: `kokoro_batch.py:187`. |
| `word_audio_service.fetch_youdao` (:304) + route `ui/word_audio/fetch_youdao` | Proxied the Youdao CDN (`http://dict.youdao.com/dictvoice`) for a word with an in-memory LRU of 500 entries. | The route was registered (`local_word_audio_routes.py:24-27`). The only non-pycore reference is the constant `poly_apps/pycore_laravel_wordnew_ui/core/integrations/pycore/PycoreHttpRoutes.ts:248` `wordAudioFetchYoudao`, which nothing reads (0 hits for `wordAudioFetchYoudao` or `PycoreHttpRoutes[`). | Real-pronunciation lookup `word_audio_service.py:129` `test`, via `pycore/pyutils/external_apis/word_audio_client.find_pronunciation` (route `ui/word_audio/test`). Missing audio is generated by the Kokoro word batch. |
| `word_audio_service.missing_batch` (:208), constant `UI_WORD_AUDIO_MISSING_BATCH` | Proxied Laravel `GET /api/app_qy_v1/word/audio/missing-batch` for the old browser-side Puter.js batch. | Unrouted: the constant existed, but no `server.post/get` used it. 0 callers. | `pycore/pyctl/tts/word_audio_full_sync.py:33` `WordAudioFullSync` (route `ui/queue_center/word_audio_full_sync`, `route_names.py:232`) pulls words without audio into the word_audio queue. |
| `word_audio_service.fix_word_text` (:395), constant `UI_WORD_AUDIO_FIX_WORD_TEXT` | Proxied Laravel `POST /api/app_qy_v1/word/fix-text` to rewrite garbled word text. | Unrouted: the constant existed with no handler. 0 callers. | None in pycore (it was never reachable). The Laravel endpoint itself remains (`poly_apps/laravel_main/routes/AppQyV1Router/AppQyV1Words.php:74`). |
| Constants `UI_WORD_AUDIO_WORD_AUDIO_MEDIA`, `UI_WORD_AUDIO_UPLOAD_WORD_AUDIO` | Route names only. | Never registered. 0 references outside `route_names.py`. The functions `word_audio_media` and `upload_word_audio` are kept. | `upload_word_audio` is called only by the delivery kind: `pycore/pyctl/tts/audio_resource_delivery.py:283` `_deliver_resource`, `:311`, through `pycore/pyutils/laravel/delivery_outbox.py:1294` `laravel_delivery_outbox`. |

Runtime effect: none for the modules. At the parent, nothing started `TTSThreadManager` or any `BaseTTSWorkerThread`, so their deletion changed no running behavior. The only behavior removed is the two registered but uncalled RPC routes, `ui/word_audio/edge_synth` and `ui/word_audio/fetch_youdao`.

## Rules the deleted code broke

- AGENTS.md: "remove duplicate implementations". Two edge worker/queue stacks and a second per-word synthesis route sat beside the one Kokoro word-batch entry and `audio_queue_center`.
- The pycore rule "queues are state-driven, no timer polling" (`.claude/agents/pycore*.md`; binding requirement `docs_fix/DESIGN_AUDIO_ORCHESTRATION.md`). `worker_base` polled every 1 s, and `TTSNetworkThread` looped every 60 s over an empty stub.
- PYTHON_PYCORE §1: refactor the shared design instead of copying a defect; §4 Threading (line 53) requires THREAD_BUS-backed owners.
- Upload to Laravel goes through the one delivery layer only. `upload_word_audio` survives only inside the delivery kind; `missing_batch` and `fix_word_text` were direct Laravel proxies outside it.

## Remaining references and risk (HEAD)

- `git grep` at HEAD and in the working tree for every deleted module, class and route name finds one hit: `poly_apps/pycore_laravel_wordnew_ui/core/integrations/pycore/PycoreHttpRoutes.ts:248` `wordAudioFetchYoudao: 'ui/word_audio/fetch_youdao'`. It has no reader. It is a shared-UI cross-scope item, already listed in `reports/pycore.md:319`.
- Contracts: `config/*_contract.json` never named these routes at the parent or at HEAD.
- Outside the repo: at the parent, `config/pycore_relay_contract.json` `route_policy_matching.default_profile = general_action` (`exposure: relay`, permission `relay.route.control`). A client outside the repo holding that permission, such as an old UI build or a user script, could have called `ui/word_audio/edge_synth` or `fetch_youdao`, and now gets route-not-found. No such caller exists in the repo, Laravel included.
- A leftover found during this check (not part of AT-037, nothing deleted):
  - `pycore/pyutils/azure_speech/azure_speech_client.py:209` `add_to_queue` still puts items into `pyfoundations/speech_queue_ops.TTSQueueOps`, the queue that `worker_base` drained. It has 0 callers at the parent and at HEAD, so no item is ever stranded.
  - Next owners: `pycore-ai` (azure_speech) and `pycore-architect` (`speech_queue_ops`).
- Laravel keeps `GET /word/audio/missing-batch` and `POST /word/fix-text` (AppQyV1Words.php:69, :74) with no pycore caller. Whether to keep them is for the Laravel family to decide.

## How to restore (user's decision; not run)

- Whole deleted files. Run from the repo root in Git Bash. `core.autocrlf=true`, so `git restore` is preferred because it applies the checkout conversion.
  ```
  git restore --source f4f223414^ -- pycore/pyutils/tts/edge/parser.py pycore/pyutils/tts/edge/processor.py pycore/pyutils/tts/edge/thread_manager.py pycore/pyutils/tts/edge/translator.py pycore/pyutils/tts/edge/worker_thread.py pycore/pyutils/tts/worker_base.py pycore/pyutils/tts/tts_queue_worker_threads.py
  ```
  To restore one file (Git Bash, not PowerShell 5.1, whose `>` re-encodes the output):
  ```
  git show f4f223414^:pycore/pyutils/tts/edge/parser.py > pycore/pyutils/tts/edge/parser.py
  ```
  Their dependencies still exist at HEAD (`edge/config.TTSConfig.resolve_voice/get_voice_dir/TTS_TRANSLATION_DIR`, `speech_queue_ops`, `split_file_store`, `engine_policy.tts_locale/normalize_tts_language`), so they would import. They would still be inert, because nothing imports or starts them.
- Removed routes: do not whole-file restore `pycore/pyctl/tts/word_audio_service.py`, `pycore/callmodule/rpc_routes/local_word_audio_routes.py` or `route_names.py`. The same commit carries other approved pycore-4 fixes in those files. Re-adding a route means re-applying only the hunks from `git diff f4f223414^ f4f223414 -- <file>` for the chosen function, its imports and constants, and its `server.post` registration.
- None of these commands was run. Restoring is the user's decision; after a restore, pycore would re-run the static checks and ask the reviewer again.

## Next owner

- Orchestrator: relay this to the user.
- Shared UI: `PycoreHttpRoutes.ts:248` dead constant (already queued).
- `pycore-ai` and `pycore-architect`: the dead `TTSQueueOps` producer (optional cleanup).
