# Bug audit — audio-tts (A6), 2026-09-27

Role: audio-tts. Report only; no code, config, doc or test was changed.
Binding: `docs_fix/REQUIREMENTS_20260927_TEAM_BUG_AUDIT.md`.
Line numbers are from the files as read between 02:00 and 02:44. The user's other
session edited files in this scope during the audit (Cross-scope X7). Every file
modified after 02:10 was re-read between 02:42 and 02:44, and each finding in such
a file is tagged `[in-flight, last read HH:MM]` and cites that version.

Counts: critical 0 · high 6 · medium 11 · low 18 · rule 4 (total 39; AT-015 was
withdrawn after the re-read, see In-flight observations).

---

### AT-001 — A word-cache lookup returns another word's audio when that word's file name starts with `<word>_`; the wrong clip is then reused and uploaded to Laravel [in-flight, last read 02:44]
- severity: high · category: data-corruption · confidence: confirmed
- location: pycore/pyutils/tts/word_audio_cache.py:46-48 (`_stem_prefixes`), :81 (index scan), :143 (`note_stored`), :209 (directory scan) — 02:37 version
- failure scenario: the cache holds `en/it_s_kokoro.mp3` (from the word "it's") and either no `it_kokoro.mp3` or an older one. `find_cached("it","en")` then returns the "it's" clip, because every prefix before a `_` counts as a candidate word and the newest file wins. The same happens for "ice" → `ice_cream_kokoro.mp3` and "don" → `don_t_kokoro.mp3`.
  - The word lane skips synthesis (`_prepare_word_batch` cache check) and `_resolve_audio` delivers that file through the domain report for the "it" dictionary row.
  - Orchestration assembles the same wrong clip into its segments.
  - Once Laravel stores it, `reportWordResult` short-circuits with already_done, so the wrong audio is never corrected.
  - The in-flight 02:39 `laravel_audio_delivery.stage` now records the lane clip in `audio_resource_ledger` as ("word", "it") → the "it's" file, and `audio_resource_delivery.publish` queues it for every Laravel server, so the wrong clip now spreads to all servers.
- evidence: `_stem_prefixes("it_s_kokoro")` → `["it", "it_s"]`. `_safe()` maps `'`, space and `-` to `_`, so contractions and phrases always collide. `lookup_many`/`find_cached_many` look up `_safe(word.lower())` among these prefixes. `laravel_audio_worker_execution.py:569-571, 186-190` use `find_cached`.
- suggested fix: store `{word}` and `{provider}` with a separator `_safe` can never produce (or keep a word→file ledger) and match the exact stem only.

### AT-002 — Every word-lane language is synthesized by Kokoro with a fixed English phonemizer and speaker, so fr/de/es/vi/lo/ja/ko dictionary words get English-G2P audio that is uploaded
- severity: high · category: engine-param-mismatch · confidence: likely (code confirmed; the audible result was not run)
- location: pycore/pyutils/tts/sherpa_engine.py:37, :194-196; pycore/pyutils/tts/batch/kokoro_batch.py:79-93; pycore/pyctl/tts/laravel_audio_worker_execution.py:572-582
- failure scenario: the word full sync pulls every dictionary language from `vocabulary/language-breakdown`. `_prepare_word_batch` groups by language and calls `synthesize_words_to_cache(words, "fr", …)`. `synthesize_words` drops `lang`: `_generate_group_on_owner` uses `KOKORO_TTS_SID` and `generation_config.extra={"lang":"en-gb-x-rp"}` for every word. Kokoro multi-lang supports only en/zh (`engine_policy._LANGUAGES_BY_ENGINE["kokoro"]`).
  - French and Vietnamese words are read with English phonemes. The result passes `validate_mp3` and is uploaded to the dictionary.
  - Kana and Hangul are skipped as unknown tokens, and those groups end in AT-007's per-word fallback.
- evidence: no language gate exists in `_prepare_word_batch`, `synthesize_words_to_cache` or `synthesize_words`. `tts_engine_supports_language` is never consulted on the batch path.
- suggested fix: gate the word batch by `tts_engine_supports_language(WORD_BATCH_ENGINE, lang)`, pass the language to the phonemizer/voice, and fail unsupported languages explicitly.

### AT-003 — Turning a lane OFF (the default immediate stop) synchronously pops and discards the whole lane Queue inside the control RPC, and the offline backlog cannot be restored [in-flight, last read 02:43]
- severity: high · category: lost-tasks / blocking-rpc · confidence: confirmed (the timing figure is an estimate)
- location: pycore/pyctl/tts/laravel_audio_worker.py:662-673 (`_drop_queued_tasks`, 02:24 version); callers pycore/pyctl/laravel/worker_base.py:882-883, pycore/pyctl/queue_center/task_center_service.py:35, :92; pycore/pyutils/tts/audio_queue_center.py:704 (`_claim_restore`)
- failure scenario: in the Queue Center, Word Audio is switched OFF. The contract default is `toggle.graceful_stop=false` and `useQueueCenterHub.tsx:390` sends `graceful_stop:false`. `apply_assist_runtime` → `request_stop(graceful=False)` → `_drop_queued_tasks()` then runs, one `pop_next` + `complete` per task. That is about 6 THREAD_BUS round trips and 2 change signals per task, for the ~130k full-pull backlog, and it runs in the RPC.
  - The switch RPC blocks for minutes, which is an R7 endless spinner.
  - Every orchestration Part1 item is marked failed with "lane stopped before processing".
  - The next persist writes a near-empty snapshot.
  - Switching back ON does not restore it: `restore_from_cache` runs once per process and returns `already_restored`. With Laravel offline the backlog is gone, against §4.5.
  - `apply_assist_runtime` re-applies the lifecycle for every lane on each control call, so toggling any other lane re-runs the drop for each disabled audio lane.
- evidence: see the call chain above. `_drop_queued_tasks` has no bound or yield, and `persist_snapshot` is marked dirty by the next mutation.
- suggested fix: make lane stop a state flag (the drain halts and the Queue and snapshot stay intact), and drop or release only claimed Laravel rows in a background task.

### AT-004 — A Kokoro batch exception during orchestration leaves the task's taken Part1 items unsettled forever (tracker stuck at "processing", dedup key held) [in-flight, last read 02:43]
- severity: high · category: stuck-state · confidence: likely
- location: pycore/pyctl/audio_orchestration/orch_resources.py:323-360 (`_word_batch` after `_claim`; not modified during the audit); pycore/pyutils/tts/audio_queue_center.py:505-547; pycore/pyctl/audio_orchestration/orch_generate.py:395-404 (02:38 version; the crash path still has no `release_owner_queue`)
- failure scenario: `_claim` → `take_local` moves the keys into `_taken`, then `kokoro_batch.synthesize_words_to_cache` raises. Possible causes:
  - `call_serialized` TimeoutError after 900 s. On a CPU host the kokoro owner is shared with pinned sentence/article synthesis, and queue wait counts toward the timeout.
  - `managed_services.lease("kokoro")` raises ManagedServiceUnavailable.
  - An ffmpeg or OS error outside the per-item guards.

  `_settle` is never reached. `_run_generation` marks the task failed and does not release the owner. After that:
  - the keys stay in `_taken` with tracker state PROCESSING and active dedup keys, so the lane and the full pull cannot enqueue those words again;
  - `flush_dirty` persists them;
  - on the next run `take_local` reports them "inflight", and `_await_lane_settled` polls for 900 s before retrying.
- evidence: `settle_local` is the only release of `_taken` for owner-taken keys. There is no try/finally around claim → generate → settle.
- suggested fix: settle claimed keys as failed in a `finally` around each chunk, and call `release_owner_queue` on the crash path.

### AT-005 — The default-on "VRAM reclaim" kills every other GPU compute process at startup and at each qwen3tts launch when free VRAM is below 6 GB
- severity: high · category: destructive-default / rule · confidence: confirmed
- location: pycore/pyutils/tts/memory_gate.py:228-299; pycore/pyutils/tts/runtime_profile.py:108; pycore/pyutils/tts/tts_service_manager.py:563
- failure scenario: on this host (RTX 4060 8 GB), the user runs Ollama, Blender, a training job or pycore's own GPU STT server, and free VRAM is below 6144 MiB. `pin_runtime_profile()`, which runs lazily on the first profile read, or `_qwen3tts_start_command` then terminates and kills every PID from `nvidia-smi --query-compute-apps` except pycore itself. On cards with ≤6 GB total this happens on every qwen launch.
  - With several GPUs, the apps on all GPUs are listed when `device_index=None`.
  - Nothing in docs_fix documents this policy, and it conflicts with the AGENTS.md rule "Never execute destructive actions without explicit approval".
- evidence: `QWEN3TTS_VRAM_RECLAIM` defaults to "1". `victims = [... pid != own_pid]`. It uses `proc.terminate()` then `proc.kill()`.
- suggested fix: default the reclaim OFF (opt-in), and never kill processes the service did not start; fall back to CPU or ask the user instead.

### AT-006 — The f5tts API server allows unauthenticated arbitrary file writes through the upload filename and binds 0.0.0.0 when pycore starts it
- severity: high · category: security · confidence: confirmed (code); precondition: the f5tts server is running (explicit UI start or test)
- location: pycore/tts_install_assets/f5tts_api_server.py:77, :96; pycore/pyutils/tts/tts_service_manager.py:305-313 (f5tts start env sets no host)
- failure scenario: a LAN client posts `/process` with multipart `ref_audio` whose filename is `../../../../root/.ssh/authorized_keys`. `ref_path = tmp_dir / filename` is then written verbatim with the pycore user's rights (root on this Debian host).
- evidence: `ref_path.write_bytes(await ref_audio.read())`. The host default is `"0.0.0.0"`, and pycore passes only `PYCORE_PROJECT_ROOT`.
- suggested fix: ignore the client filename (use a fixed name) and bind to loopback by default in the launcher.

### AT-007 — The Kokoro batch still falls back to per-word synthesis, which violates the single batch entry with no per-word fallbacks
- severity: medium · category: design-invariant · confidence: confirmed
- location: pycore/pyutils/tts/batch/kokoro_batch.py:79-93, :136-139
- failure scenario: one word in a group of 20 sanitizes to empty (`_generate_samples` returns None, e.g. "—", "&" or an emoji) or yields invalid samples. `_generate_group_on_owner` returns None for the whole group, and `batch_common.serial_fallback(kokoro_engine.synthesize, …)` then synthesizes all 20 words one by one: 20 serialized calls and 20 ffmpeg runs.
- evidence: the docstring says "plain per-word serial is the last fallback". This conflicts with docs_fix/REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE.md W1/R2 and the §5.5 "never per-word synthesis" rule.
- suggested fix: return per-word failures from the one batched call (skip the failed index) and remove the serial fallback.

### AT-008 — Orchestration waits by polling a signal nobody sends, every second (up to 900 s for lane items and for the whole book sync)
- severity: medium · category: design-invariant (timer polling) · confidence: confirmed
- location: pycore/pyctl/audio_orchestration/orch_resources.py:199 (`_LANE_WAIT_SIGNAL`); pycore/pyctl/audio_orchestration/orch_books.py:367 (`audio_orchestration.sentences.wait`)
- failure scenario: while items are in flight on a lane worker, the generation thread calls `tracked_states` about once a second for up to 15 minutes. `ensure_book_sentences` polls `load_sync_state()` (a file read) once a second for the whole sync. Neither signal name is ever signalled (grep).
- evidence: this contradicts §5.2 "Every mutation … signals THREAD_BUS audio_queue_center.changed" and the "no timer polling" rule.
- suggested fix: wait on `AUDIO_QUEUE_CHANGED_SIGNAL` (or a per-owner settle signal) and on a job-finished signal from `BackgroundJobs`.

### AT-009 — Word-cache writes keep the word's case but lookups lower-case it, so capitalized dictionary words never hit the cache [in-flight, last read 02:44]
- severity: medium · category: cache-miss / duplicate-work · confidence: confirmed
- location: pycore/pyutils/tts/word_audio_cache.py:42-43 (`get_cache_path` uses `_safe(word)`), :152 and :194 (lookup lower-cases) — 02:37 version
- failure scenario: the lane synthesizes "January", "English" or "Monday", which are stored as `January_kokoro.mp3`. The next `find_cached("January")` looks up `january` and misses, so Kokoro regenerates and the lane re-delivers the word on every pass. Orchestration's lower-case lookups miss those files too.
- evidence: `save_to_cache(word, …)` → `get_cache_path(word…)`, while `lookup_many` does `key = word.strip().lower()`.
- suggested fix: normalize the word (lower-case) in `get_cache_path` and migrate existing files once.

### AT-010 — The qwen3tts queue admits one job, while the sentence lane (3) and orchestration (4) fan out, so the client polls /status every ≤2 s, queue-head order is decided by retry timing, and jobs fail after 900 s [in-flight, last read 02:43]
- severity: medium · category: concurrency-mismatch / polling · confidence: likely
- location: pycore/tts_install_assets/qwen3tts_queue.py:17, :130; pycore/pyutils/tts/qwen/client.py:483-501, :533-549; pycore/pyctl/tts/laravel_audio_worker.py:913; pycore/pyctl/audio_orchestration/orch_resources.py:37
- failure scenario: one sentence is running. Six other submitters get 429 "queue full" and loop in `_submit_with_recovery`, each calling `inspect_queue_job` → GET /status with every job about every 2 s.
  - Whichever poller lands first after completion wins, which breaks "submission order is the only local order" and Laravel head priority.
  - Behind a long agent-history article, sentence tasks fail with "capacity wait exceeded 900s".
  - The server batching (`_take_batch`, max_parallel) can never engage.
- evidence: `DEFAULT_QUEUE_MAX = 1` against the "keep multiple local sentences in flight" comment at laravel_audio_worker.py:913-915.
- suggested fix: let the server queue hold N pending jobs (FIFO), and have clients wait on queue events instead of status polling.

### AT-011 — `_recover_task_status` can overwrite a task that just finished with a stale "generating" copy and mark it failed [in-flight, last read 02:43]
- severity: medium · category: race / lost-update · confidence: likely
- location: pycore/pyctl/audio_orchestration/orch_service.py:375-381 (called from `tasks_list` :347-359, `task_get`, `task_progress`) — 02:38 version
- failure scenario: `tasks_list` reads every task (status "generating"), then computes summaries. Meanwhile the generation thread saves status done plus its segments and returns. When `_task_summary` reaches that task, `is_running` is False, so the stale dict gets status failed and is saved with `orch_store.save_task(task)`, which overwrites the whole record.
  - The final segments, output paths, `generation_finished_at` and progress are lost.
  - The task shows "interrupted".
  - Its output delivery keys on the stale record.
- evidence: `save_task` replaces the whole file, and there is no re-read or version check.
- suggested fix: re-read the task under the file owner before recovering, or only recover at startup (`resume_interrupted_generations`).

### AT-012 — The output `meta_hash` is cached per segment signature but also covers book sentences whose availability changes, so every reconcile re-delivers the task and "delivered" never turns true [in-flight, last read 02:42]
- severity: medium · category: non-idempotent-upload · confidence: likely
- location: pycore/pyctl/audio_orchestration/orch_delivery.py:104-113 (`output_meta_hash` → `cached_hash`), :204 (`cached_task_sentences`), :243, :273-276 (`_deliver_output`) — 02:38 version
- failure scenario: when a book task is first hashed, the book-sentence cache is missing or a sync is running. `cached_task_sentences` returns None (and starts a sync), so the cached hash H1 excludes sentences. Later `_deliver_output` computes H2 with sentences and delivers it.
  - The inventory still yields H1 (the signature is unchanged).
  - H1 ≠ delivered H2, so each online edge or reconcile enqueues another delivery.
  - `output_counts` never shows delivered.
  - The in-flight edit added `cached_hash(..., lambda: ingest["meta_hash"])` in `_deliver_output` (still present at :273-274), but `cached_hash` returns the existing value for an unchanged signature, so H1 is never replaced.
- evidence: `delivery_outbox.cached_hash` computes only on a miss (pyutils/laravel/delivery_outbox.py:317-330).
- suggested fix: exclude volatile or optional fields from `meta_hash`, or make the signature include sentence-cache presence and allow the cache entry to be replaced.

### AT-013 — Output delivery and hashing load every finished segment mp3 of a task into memory at once [in-flight, last read 02:42]
- severity: medium · category: unbounded-memory · confidence: likely
- location: pycore/pyctl/audio_orchestration/orch_delivery.py:96 (`_output_payload`, 02:38 version)
- failure scenario: a 20-hour book in 60-minute segments has about 20 × 57 MB. `enqueue_task_output`, which runs at the end of generation, and each `_deliver_output` build `contents = {index: read_bytes()}`, holding more than 1 GB in RAM, and the hash is computed from the same bytes.
- evidence: `contents = {int(segment["index"]): Path(...).read_bytes() for segment in self._done_segments(task)}`
- suggested fix: stream the hashes (hashlib over file chunks) and upload segments by path one at a time.

### AT-014 — Deleting a task, including the automatic retention prune of prompt-rewrite tasks, leaves its manifest and all segment mp3 files on disk forever [in-flight, last read 02:43]
- severity: medium · category: disk-leak · confidence: confirmed
- location: pycore/pyctl/audio_orchestration/orch_service.py:477-486 (`task_delete`), :489-497 (`_prune_text_tasks`) — 02:38 version
- failure scenario: every prompt rewrite creates a task (`submit_text_task`). After 200 tasks, `_prune_text_tasks` deletes only `tasks/<id>.json`. `manifests/<id>.json` and `output/<slug>/segment_*.mp3` plus `staging/` stay forever, so disk use grows without bound despite the retention cap.
- evidence: `task_delete` calls `orch_store.delete_task` and `release_owner_queue` only, never `delete_manifest` or removal of the output directory.
- suggested fix: delete the manifest and output directory as part of `task_delete`, once any pending output delivery has its payload.

### AT-016 — A UI engine test mutates process-wide environment (QWEN3TTS_SPEAKER/INSTRUCT, COSYVOICE_*, …) for the whole synthesis, and concurrent lane or orchestration work picks it up [in-flight, last read 02:46]
- severity: medium · category: race / engine-param · confidence: likely
- location: pycore/pyutils/tts/engine_policy.py:375-387, :427 (02:43 version); pycore/pyutils/tts/tts_orchestrator.py:612; pycore/pyutils/tts/qwen/engine.py:374
- failure scenario: the user tests qwen3tts with speaker "Ryan" and instruct "angry". While the test runs, which can take minutes, sentence-lane jobs read `QWEN3TTS_INSTRUCT` from the environment, and their cache identity includes `QWEN3TTS_SPEAKER`. The affected sentences are generated in the test voice and style, delivered to Laravel, and cached under a test identity.
- evidence: `os.environ[env_key] = str(value)`, restored only after the synthesis.
- suggested fix: pass engine extras through the request object and never through `os.environ`.

### AT-017 — `tts_test` calls an undefined `_engine_disabled_reason`, so testing any unavailable non-server engine raises NameError
- severity: medium · category: crash · confidence: confirmed
- location: pycore/pyutils/tts/tts_orchestrator.py:693
- failure scenario: in the UI TTS test, pick an in-process or cloud engine that is not available (e.g. kokoro without the model). `not is_server_engine(name) and not engine_available(name)` is true, and the call raises NameError. The RPC fails instead of returning the reason.
- evidence: `_engine_disabled_reason` is defined in `tts_status.py:82` (two arguments) and is not imported into `tts_orchestrator`.
- suggested fix: import it from `tts_status` and call it with `(name, False)`.

### AT-018 — Word tokenization treats a whole CJK clause as one "word", so word steps for zh/ja books generate clause-length "words"
- severity: medium · category: cjk-tokenization · confidence: confirmed
- location: pycore/pyctl/audio_orchestration/orch_words.py:28, :64-74
- failure scenario: a zh book with a `words_all` step on "我喜欢学习中文，因为很有趣。" yields `tokenize` → `["我喜欢学习中文", "因为很有趣"]`.
  - These go to the word lane Part1 and the Kokoro word batch as "words".
  - They get an md5 fill-missing upload that has no dictionary row.
  - new_only read-state lookups use them as words.
- evidence: `_WORD_RE = [^\W\d_]+…` matches runs of Han characters without segmentation.
- suggested fix: use a CJK word segmenter (or the Laravel sentence-words resolver) for zh/ja/ko and skip non-dictionary tokens.

### AT-019 — Lane capacity counts the whole Queue (including the full-pull backlog), so the compatibility accept RPC and bounded dispatch always reject and release claimed tasks [in-flight, last read 02:43]
- severity: low · category: capacity-accounting · confidence: likely
- location: pycore/pyctl/tts/laravel_audio_worker.py:321-329, :625-637; pycore/pyctl/laravel/worker_base.py:804-812
- failure scenario: with about 130k backlog entries, `self._queue.active_count()` is far larger than the concurrency. `local_queue_accept` RPC calls return "at configured concurrency capacity", and non-backlog dispatch releases every claimed task back to Laravel.
- evidence: `active_count()` is `len(_active_keys)` of the whole Queue.
- suggested fix: measure the in-flight work (`_processing`/inflight), not the queued backlog.

### AT-020 — The lane-state publisher wakes every 5 s even when idle and builds the full local audio state
- severity: low · category: timer-polling · confidence: confirmed
- location: pycore/pyctl/queue_center/audio_lane_state.py:168-173
- failure scenario: when nothing changes, `wait_signal(..., timeout=5)` returns None, and `lanes_active()` calls `local_audio_state()`: two worker statuses, outbox stats and section contracts, every 5 s forever.
- suggested fix: arm the heartbeat only while a lane reports active (wait without a timeout otherwise).

### AT-021 — `_start_drain` is a non-atomic check-then-set, so two drain cycles can run at once [in-flight, last read 02:43]
- severity: low · category: race · confidence: suspect
- location: pycore/pyctl/tts/laravel_audio_worker.py:649-657
- failure scenario: `accept_task` (pull thread) and a cycle's `finally` both read `cycle_signal=False` and each start a cycle. The sentence fan-out then doubles past `CONCURRENCY_LIMIT`, and the word lane runs two Kokoro batch loops.
- suggested fix: use a `SerializedValue.compare_and_set` guard, as `request_pull` does.

### AT-022 — The `processing` counter is decremented for tasks that were never marked started
- severity: low · category: counter-drift · confidence: confirmed
- location: pycore/pyctl/tts/laravel_audio_worker_execution.py:712-722, :796-798; pycore/pyctl/tts/laravel_audio_worker_state.py:366-369
- failure scenario: a task whose payload fails `_normalize` returns before `_mark_task_started`, but the `finally` still calls `_mark_task_finished` (`_processing -= 1`). In parallel sentence lanes, a running task's count is erased, so `lanes_active()` and the UI "processing" under-report.
- suggested fix: call `_mark_task_finished` only when started (track a flag).

### AT-023 — When a sentence speaker is selected, the lane writes the central sentence cache under a key orchestration never looks up, so orchestration re-synthesizes lane-settled sentences
- severity: low · category: cache-identity-mismatch · confidence: likely
- location: pycore/pyutils/tts/tts_orchestrator.py:262-268; pycore/pyctl/tts/laravel_audio_worker_state.py:529; pycore/pyctl/audio_orchestration/orch_resources.py:68-80, :441-447
- failure scenario: with the sentence-lane speaker "Vivian", lane output is cached with `speaker="Vivian"`, while orchestration queries `"any:female"`. A deferred item settles DONE, `_resolve_miss(cache_checked=False)` misses, and the sentence is downloaded from Laravel or synthesized a second time, possibly in another voice.
- suggested fix: derive both sides from one cache-identity helper that includes the lane speaker.

### AT-024 — The chunker's abbreviation and initial shields are anchored at end of string, so "Mr." / "Dr." / "J." in the middle of text still split sentences
- severity: low · category: chunking · confidence: confirmed
- location: pycore/tts_install_assets/tts_text_chunking.py:72-73
- failure scenario: kokoro uses a 72/80 character cap, so chunk boundaries fall on units. "…Dr. Smith said…" splits after "Dr.", and a chunk boundary there inserts the 120 ms pause mid-name. Only an abbreviation at the very end of the whole text is protected.
- evidence: `re.compile(r"([A-Za-z][A-Za-z.]*)\.$")` is used with `.sub` on the whole text, without MULTILINE or a word boundary.
- suggested fix: match `\b(abbr)\.(?=\s)` anywhere instead of `$`.

### AT-025 — The qwen3tts code-identity script set omits `tts_text_chunking.py`, which `qwen3tts_synthesis` imports
- severity: low · category: stale-server · confidence: confirmed
- location: pycore/pyutils/tts/tts_service_manager.py:173-182
- failure scenario: after a chunking fix, the managed code-identity contract does not see a change, so a running qwen3tts server keeps the old splitter until it is restarted by hand.
- suggested fix: add `tts_text_chunking.py` (and every sibling it imports) to the qwen3tts script list.

### AT-026 — `prune_absent` drops a Part1-claimed Laravel entry without settling its tracker entry, which stays "queued" forever
- severity: low · category: stuck-state · confidence: likely
- location: pycore/pyutils/tts/audio_task_queue.py:232-277
- failure scenario: a manual promote claims a mirrored Laravel task into Part1, and the next diff no longer lists it. The heap entry and Part1 key are removed, but `_tracked` keeps a QUEUED entry that `_evict_terminal` never evicts. The lane view "tracked.queued" is inflated permanently.
- suggested fix: route pruning through the library so it settles (or drops) tracker entries.

### AT-027 — The sentence full pull reports success with nothing pulled when the language listing is not HTTP 200
- severity: low · category: silent-failure · confidence: confirmed
- location: pycore/pyctl/tts/sentence_audio_full_sync.py:45-64
- failure scenario: an older Laravel without `sentence/without_audio` returns 404. `_fetch_languages` returns `[]`, and `_pull_all` returns `success: true, pulled: 0`. The UI shows a successful sync, and the M8 backlog feed is silently missing.
- suggested fix: return `laravel_failure(status_code=…)` when the listing call fails.

### AT-028 — `group_words` drops empty words while `synthesize_words_to_cache` maps result items by original index (latent misalignment)
- severity: low · category: latent-data-corruption · confidence: confirmed (callers currently filter empty words)
- location: pycore/pyutils/tts/batch/batch_common.py:66; pycore/pyutils/tts/batch/kokoro_batch.py:194
- failure scenario: any caller that passes `["a", " ", "b"]` gets `result.items` of length 2, so "b" receives no audio and word index 1 (" ") would receive "b"'s clip. A future caller without filtering would cache wrong audio.
- suggested fix: keep index alignment (mark empty inputs failed) instead of filtering.

### AT-029 — The chattts and f5tts servers bind 0.0.0.0 with no authentication when pycore starts them
- severity: low · category: security · confidence: confirmed
- location: pycore/tts_install_assets/chattts_api_server.py:241; pycore/tts_install_assets/f5tts_api_server.py:96; pycore/pyutils/tts/tts_service_manager.py (chattts/f5tts envs set no HOST)
- failure scenario: any LAN host can use the GPU models through these servers (and AT-006 for f5tts).
- suggested fix: pass loopback `*_HOST` from the launcher, as done for melotts/voxcpm2/fishspeech.

### AT-030 — The f5tts `/process` endpoint is `async` but runs blocking inference on the event loop, and leaks one temp directory per request
- severity: low · category: blocking-async / leak · confidence: confirmed
- location: pycore/tts_install_assets/f5tts_api_server.py:70-90
- failure scenario: during synthesis, `/health` does not answer, so managed-service health checks fail. Each call leaves `f5tts_*` (ref and out wav) in TMP_DIR.
- suggested fix: use a sync `def` (threadpool), and clean up the tmp dir after the response.

### AT-031 — The VoxCPM2 server ignores the `speed` (and language) the client sends
- severity: low · category: engine-param-mismatch · confidence: confirmed
- location: pycore/pyutils/tts/voxcpm2_engine.py:160; pycore/tts_install_assets/voxcpm2_api_server.py (`SynthRequest.speed` unused)
- failure scenario: an orchestrator rate or speed has no effect on voxcpm2 output.
- suggested fix: time-stretch once server-side, as qwen does, or drop the field.

### AT-032 — `_stop_foreign_server` terminates any process listening on an engine's port
- severity: low · category: destructive-default · confidence: confirmed
- location: pycore/pyutils/tts/tts_service_manager.py (`_stop_foreign_server`)
- failure scenario: the user runs their own GPT-SoVITS `api_v2` on 9880 (the documented `GPTSOVITS_URL` bind). A managed start kills it.
- suggested fix: reclaim only PIDs that pycore launched (a pid file or code identity).

### AT-033 — Any saved engine order that starts with "edge" is treated as legacy and reset on every reload [in-flight, last read 02:46]
- severity: low · category: settings-loss · confidence: confirmed (effective with `TTS_RUNTIME_PROFILE=off`)
- location: pycore/pyutils/tts/engine_policy.py:172-174 (02:43 version)
- failure scenario: the user moves edge to the front, and the next `reload_tts_priority` persists the gptsovits-first default again.
- suggested fix: migrate only the exact `_LEGACY_SAVED_ORDERS` tuples, once (store a migration marker).

### AT-034 — The Qwen durable synthesis operation re-runs on an idempotent re-submit and discards the audio it produces
- severity: low · category: feature-breaking · confidence: confirmed (the route is currently unused by the UI)
- location: pycore/pyctl/tts/qwen/operation_service.py:52-58, :117-124
- failure scenario: re-submitting with the same `idempotency_key` starts `_run` again even for a completed operation. `result_json` keeps only `bytes: len(audio)`, so the audio is unretrievable.
- suggested fix: skip `_run` for terminal operations, and store the audio (a path or asset) in the result.

### AT-035 — The edge availability probe has no timeout and runs on the edge client's state-owner thread
- severity: low · category: blocking · confidence: likely
- location: pycore/pyutils/tts/edge/client.py (`test_availability` → `_probe`)
- failure scenario: a stalled WebSocket blocks the owner thread, so `initialize()` / `EdgeTTSEngineAdapter.available()` callers wait up to 300 s (the `call_serialized` timeout), stalling status and word synthesis.
- suggested fix: wrap `_probe` in `asyncio.wait_for(get_synth_timeout())` and run it off the owner thread.

### AT-036 — nvidia-smi subprocesses have no timeout in the qwen3tts and chattts servers
- severity: low · category: blocking · confidence: suspect
- location: pycore/tts_install_assets/qwen3tts_gpu.py:42-53 (under `_GPU_SNAPSHOT_LOCK` via `/status`); pycore/tts_install_assets/chattts_api_server.py `_free_vram_mb`
- failure scenario: nvidia-smi hangs (driver reset or mismatch), so every `/status` blocks, and pycore's capacity waiters time out and fail jobs.
- suggested fix: add `timeout=` to `subprocess.run`.

### AT-037 — Dead duplicate TTS worker and queue implementations, plus per-word synthesis and Laravel-upload side routes [in-flight, last read 02:44]
- severity: low · category: rule (duplicate/dead code) · confidence: confirmed
- location: pycore/pyutils/tts/edge/thread_manager.py, edge/worker_thread.py, edge/parser.py, edge/processor.py, edge/translator.py, pycore/pyutils/tts/worker_base.py (1 s timer-poll loop), pycore/pyutils/tts/tts_queue_worker_threads.py; pycore/pyctl/tts/word_audio_service.py (`edge_synth`, `fetch_youdao` routes; `missing_batch`, `fix_word_text` unrouted)
- failure scenario: none of the edge/worker modules is imported from outside themselves (grep). The `ui/word_audio/edge_synth` route is a live per-word synthesis surface beside the one Kokoro batch entry. `upload_word_audio` is also a direct Laravel POST; in the 02:40 version it is used only inside the delivery kind `audio_resource_delivery._deliver_resource` (word_audio_service.py 02:28 version: `edge_synth` :356, `fetch_youdao` :304, `missing_batch` :208, `fix_word_text` :395).
- suggested fix: delete the dead modules and routes (AGENTS.md: remove duplicate implementations).

### AT-038 — Three separate chunk-and-concatenate implementations
- severity: low · category: rule (duplicate implementation) · confidence: confirmed
- location: pycore/pyutils/tts/chunked_synthesis.py:220-298; pycore/tts_install_assets/tts_audio_assembly.py (`generate_chunked`, `concatenate_wavs`); pycore/tts_install_assets/qwen3tts_synthesis.py:88-136 (its own `_pack_units` / `_split_long_text`)
- failure scenario: behaviour already diverges. qwen hard-cuts mid-word (`unit[:hard_cap]`) and skips dot shielding and `max_chunks`, while the shared splitter prefers whitespace, and pauses differ.
- suggested fix: route all engines through `tts_text_chunking.split_text` plus one assembly module.

### AT-039 — Orchestration UI text is hardcoded English and raw exception text, and one message is wrong [in-flight, last read 02:43]
- severity: low · category: rule (i18n) · confidence: confirmed
- location: pycore/pyctl/audio_orchestration/orch_generate.py:404 (`generation crashed: {exc}`), :794 (`"all segments failed"` shown when only some segments failed) — 02:38 version, and all `_progress(message=…)` / `append_task_event` strings; rendered raw in poly_apps/…/audio-orchestration/OrchTaskList.tsx:107, :277; pycore/pyutils/tts/tts_engine_params.py notes and hints (e.g. the stale "Qwen3-TTS in-process … downloads HF model")
- failure scenario: zh users see English text and raw Python exceptions, against §4.1 "No raw Python exception text reaches the UI". A partially failed run reads "all segments failed".
- suggested fix: emit stable message codes plus parameters, localized in the UI.

### AT-040 — Raw `threading.Thread` / `threading.Lock` and sleep loops against the PYTHON_PYCORE threading rule
- severity: low · category: rule · confidence: confirmed
- location: pycore/pyctl/tts/batch_startup_selfcheck.py:105, :427-432; pycore/pyutils/tts/edge/recovery.py:28, :55-84 (`time.sleep(15)` probe loop); pycore/pyutils/tts/runtime_profile.py:81
- suggested fix: use Thread subclasses, THREAD_BUS signals and `SerializedValue`.

---

## Cross-scope

- X1 (pycore-runtime + lead + frontend-ui) — AT-003 partners.
  - `worker_base.request_stop(graceful=False)` pops the whole Queue synchronously (worker_base.py:882-900).
  - `task_center_service.QueueCenterControlRequest.graceful_stop` defaults to False (task_center_service.py:35).
  - `apply_assist_runtime` re-runs the lifecycle for all lanes on every control (capability_sync.py:95-100).
  - `config/queue_center_contract.json` `section_contract_defaults.toggle.graceful_stop=false`, and `useQueueCenterHub.tsx:390` hardcodes `graceful_stop:false`.
- X2 (pycore-runtime) — `pyutils/common/serialized_files.py` creates one owner thread per distinct file path and never reclaims it. `orch_store` touches task, manifest, book and partial files per task and book, so the thread count grows with task history (prompt rewrite makes a task per rewrite; deleted tasks keep their threads until restart).
- X3 (pycore-runtime) — `laravel_delivery_outbox.cached_hash` cannot replace a cached value for an unchanged signature, which blocks the AT-012 fix (the 02:32 edit relies on it doing so).
- X4 (laravel-backend / lead, suspect) — dedup identity alignment. pycore keys words by `md5(lower(strip(word)))` and sentences by `media_content_id(text)`. The word full pull keys by Laravel's row `md5`, and the sentence full pull by Laravel's `content_id`. If Laravel normalizes differently, orchestration Part1 fills duplicate full-pull entries and the same audio is generated twice.
- X5 (frontend-ui) — `OrchTaskList.tsx` renders `progress.message` and `event.message` raw (AT-039).
- X6 (pycore-runtime) — `pyfoundations/serialized_worker.call_serialized` counts queue wait toward the timeout. On CPU hosts a long kokoro sentence or article on `tts.kokoro.model` makes a concurrent word batch raise TimeoutError after 900 s (the trigger for AT-004).
- X7 (coordination, lead) — the user's other session (W4/W7 delivery work, per the lead) edited these files in this scope during the audit:
  - orch_service.py (02:21, 02:38)
  - laravel_audio_delivery.py (02:23, 02:39)
  - laravel_audio_worker.py (02:24)
  - orch_delivery.py (02:24, 02:32, 02:38)
  - word_audio_service.py (02:28)
  - word_audio_cache.py (02:36, 02:37)
  - orch_generate.py (02:38)
  - engine_policy.py (02:43)
  - the new files pyutils/tts/audio_resource_ledger.py (02:36, 02:43) and pyctl/tts/audio_resource_delivery.py (02:40)

  All of them were re-read between 02:42 and 02:46. Findings in them are tagged `[in-flight, last read HH:MM]`.
- X8 (pycore-runtime, suspect) — `delivery_outbox._retain_payload` (delivery_outbox.py:451-465, 02:36 version) keys the retained copy by `identity`, raises `ValueError("retained payload digest conflicts …")` when the same identity arrives with different bytes, and never deletes retained copies.
  - A sentence-lane re-synthesis of the same `content_id`/language/variant can produce different bytes: Qwen sampling varies, the cached file may be missing, or the speaker may have changed. That makes `laravel_audio_delivery.stage` raise, and `_process_task` then reports the freshly generated task as failed.
  - Retained copies accumulate without bound under `<cache>/laravel_delivery/`.

## In-flight observations

- The `DeliveryKind(backfill=...)` TypeError that pycore-runtime reported in orch_delivery.py is gone at my 02:42 re-read.
  - No `backfill=` keyword appears anywhere under pycore/ (grep).
  - Every `DeliveryKind(...)` call uses only fields of the dataclass at delivery_outbox.py:139-158 (02:36 version). The callers are orch_delivery.py:52-63, laravel_audio_delivery.py:71-81 and audio_resource_delivery.py:63-73.
  - An AST-only check of the 11 changed or dependent modules confirms that every imported pycore name resolves. This includes `word_audio_cache.cache_root` and `pycore.database.repositories.audio_resource_repository`.
  - Transient mid-edit state; not reported as a bug.
- AT-015 (withdrawn) — "manually promoted local word tasks without `dict_row_id` are synthesized but never uploaded" held in the 02:23 version. In the 02:39 `laravel_audio_delivery.stage`, the clip is recorded in `audio_resource_ledger` and `audio_resource_delivery.publish` queues it for every server. The lane's own server is skipped only when the row has a domain identity, so identity-less local word tasks now reach their server too.
- The manifest-resource kind `audio_orch.resource` moved out of orch_delivery.py into the new pyctl/tts/audio_resource_delivery.py (`audio_cache.resource`, `replaces=("audio_orch.resource",)`).
  - Read at 02:42. No new defect found beyond AT-001 spreading through it and X8.
  - Its ledger bootstrap deliberately skips word-cache files whose names contain more than one `_`, so it does not import AT-001 collisions from disk. Live lane staging still does, through `find_cached`.

## Reviewer items checked (not re-reported; no AT duplicate)

- RV-002 (laravel_audio_worker.py:312-319, 02:24 version) — confirmed. For the word lane, `_pull_task_types()` returns `task_types_for_claimant("pycore", "audio")`. The contract gives both `word_audio` and `article_audio` capability `audio` with claimant pycore (`task_contract.task_types[4]`, `[5]`), so the lane's FULL_SYNC diff mirror also requests `article_audio`.
- RV-010 (word_audio_full_sync.py:62-66) — confirmed. `task_contract.task_types[word_audio].language_priority` is absent, so the fallback list is always `[english/en]`. The listing paths are module constants.

## Coverage

Re-read after 02:10 edits (02:42-02:44): orch_delivery (full), audio_resource_delivery (new, full), audio_resource_ledger (new, full), laravel_audio_delivery (stage and deliver head), orch_generate, orch_service and laravel_audio_worker (the regions cited), word_audio_cache (lookup and store paths), word_audio_service (function map).

Fully read:
- **pyutils/tts:** audio_queue_center, audio_task_queue, audio_queue_cache, word_audio_cache (02:36 re-read of the lookup paths), sentence_audio_cache, audio_validation, tts_orchestrator, tts_text_sanitize, chunked_synthesis, runtime_profile, memory_gate, tts_service_manager, tts_status, engine_registry, queued_synthesis, audio_utils, tts_concurrency, worker_base, tts_queue_worker_threads, kokoro_engine, sherpa_engine, voxcpm2_engine, batch/kokoro_batch, batch/batch_common, batch/batch_constants, batch/__init__, qwen/engine, qwen/client, qwen/events, edge/client, edge/recovery.
- **pyctl/tts:** laravel_audio_worker, laravel_audio_worker_execution, laravel_audio_worker_state, laravel_audio_delivery, audio_lane_activation, audio_lane_full_sync, word_audio_full_sync, sentence_audio_full_sync, word_tts_auto, sentence_audio_auto, word_audio_service, status_service, word_audio_backend_progress, batch_startup_selfcheck, batch_selfcheck_main, qwen/operation_service, qwen/ui_service.
- **pyctl/audio_orchestration:** all 11 modules.
- **pyctl/queue_center:** audio_lane_state.
- **tts_install_assets:** tts_text_chunking, tts_audio_assembly, tts_server_common, qwen3tts_queue, qwen3tts_synthesis, qwen3tts_gpu, qwen3tts_api_server (lines 120-839), chattts_api_server, melotts_api_server, voxcpm2_api_server, fishspeech_api_server, f5tts_api_server.

Partially read or skimmed:
- engine_policy (head, policy helpers, identity, overrides, command formatter; the middle priority helpers only skimmed);
- tts_engine_params (partial);
- qwen/standalone_service (first 140 lines; used only by the tester script);
- qwen/config, qwen/weights (grep);
- qwen3tts_capabilities (speaker resolution only);
- qwen3tts_api_server lines 1-120 (docstring and imports);
- the engine adapters gptsovits, cosyvoice, fishspeech, f5tts, melotts, chattts, gtts_web, streamelements, azure, bark, parler, serialized_model_engine (grep for speed, timeouts, sessions and requests only);
- edge/config, edge/command, edge/parser, edge/processor, edge/translator, edge/thread_manager, edge/worker_thread (import graph only; they are dead code).

Not read:
- tts_engine_probe;
- batch/chattts_batch, batch/gptsovits_batch, batch/parler_batch, batch/resource_monitor (self-check only);
- tts_model_tiers (grep only);
- qwen3tts_web.py and qwen3tts_web_assets (app.js, index.html, style.css);
- chattts_model_files.txt and the *_build_constraints.txt files;
- pycore/database/repositories/audio_resource_repository.py (outside this scope; its existence was checked only).

---

## Addendum (pass 2)

Scope: the files that pass 1 left unread or only skimmed. Read 02:47–02:52; report only, nothing was run.
Counts: critical 0 · high 0 · medium 2 · low 6 · rule 2 (total 10).

### AT-041 — Model-engine "is loaded" probes queue behind in-flight synthesis, and they run on the managed-service owner thread, so a status read during a Kokoro/sherpa/Parler/Bark synthesis freezes every engine lease
- severity: medium · category: blocking / stall · confidence: likely
- location: pycore/pyutils/tts/kokoro_engine.py:113-114 and pycore/pyutils/tts/sherpa_engine.py:288-289 (`call_serialized` on the model queue with no timeout); pycore/pyutils/tts/serialized_model_engine.py:96-101 (Parler/Bark, 900 s); called from pycore/pyutils/common/managed_service.py:374-380, :414-420, :691 (serialized `is_running` / `peek_running` / idle watchdog → `spec.is_loaded()`); registration `tts_service_manager._register_services` (`is_loaded=adapter.is_model_loaded`)
- failure scenario: a Kokoro word batch, or on a CPU host a pinned kokoro sentence or article synthesis, occupies `tts.kokoro.model`. Meanwhile any status read runs, for example:
  - the word lane's `_engine_plan` (`tts_orchestrator.tts_status(refresh=True)` every 60 s, serialized on the word worker's owner),
  - a UI TTS status refresh,
  - `server_runtime_status("kokoro")`.

  Each reaches `managed_services.is_running("kokoro")` on the managed owner thread, which waits for the whole kokoro job. Until that finishes, every other `managed_services` call queues behind it: `_acquire_lease` for qwen3tts sentence jobs and orchestration, and runtime status for all engines. The word worker's state owner (`_log_event`, `_claim_inflight` …) is blocked too. The stall lasts as long as the running synthesis, which can be minutes for a CPU article.
- evidence: `is_model_loaded()` → `call_serialized(_MODEL_QUEUE, _is_model_loaded)` joins the same FIFO as the synthesis calls. `managed_service.is_running` is a `@serialized_method` and calls `spec.is_loaded()` inline.
- suggested fix: keep "loaded" as a plain flag the model owner updates (a `SerializedValue`), so it can be read without entering the model queue.

### AT-042 — With missing or incomplete qwen3tts weights the engine still reports ready, and every sentence task sleeps the 300 s recovery budget before failing
- severity: medium · category: stuck-lane / misleading-status · confidence: likely
- location: pycore/pyutils/tts/qwen/engine.py:61-72 (`available` / `disabled_reason` check the venv only); pycore/pyutils/tts/qwen/weights.py:88-112 (`resolve_model_id(allow_remote=False)` → ""); pycore/pyutils/tts/tts_service_manager.py:506-522 (`_qwen3tts_start_command` returns None); pycore/pyutils/common/managed_service_process.py:154-156 (start fails); pycore/pyutils/tts/tts_orchestrator.py:110-123, :383-401
- failure scenario: the qwen3tts installer was interrupted, so the venv is ready but `staging/weights` fails `local_weights_ready`. Then `disabled_reason()` is None, `config_ready()` is True and `_managed_required_engine_recoverable` is True. Each sentence-lane task or orchestration sentence (`required_engine=qwen3tts`) loops lease → start fails → `BackoffWait` for 300 s, then fails with a generic "unavailable".
  - The lane advances about one task per 5 minutes.
  - No UI surface says that the weights are the problem.
- evidence: the only weight check is inside the start command, which returns None silently.
- suggested fix: fold `qwen_weights.local_weights_ready` (or `resolve_model_id(allow_remote=False)`) into the qwen `config_ready` / `disabled_reason` gate so that recovery is skipped with an actionable reason.

### AT-043 — The "Speed" field of the UI TTS engine test never reaches the engine
- severity: low · category: engine-param-mismatch · confidence: confirmed
- location: pycore/pyutils/tts/tts_orchestrator.py:612-622 (`synthesize_engine` builds the request speed from `rate` only); pycore/pyctl/runtime/local_engine_service.py:30 (passes `speed`); poly_apps/…/components/PcTestEngineProfiles.ts:86, :91, :121, :126, :132, :139 (Speed field)
- failure scenario: testing kokoro, melotts, chattts, cosyvoice or gptsovits at speed 0.5 produces 1.0-speed audio. `speed` sits unused in `**extra_params` and is not in `_ENGINE_ENV_OVERRIDES`.
- suggested fix: map `extra_params["speed"]` into `TTSSynthesisRequest.speed` (or into `rate`).

### AT-044 — The ChatTTS batch requests WAV, but pycore's own ChatTTS server always returns MP3, so the merged batch path never works and every group falls back to per-word calls with a random voice each
- severity: low · category: contract-mismatch / dead-feature · confidence: confirmed
- location: pycore/pyutils/tts/batch/chattts_batch.py:47, :86-98; pycore/tts_install_assets/chattts_api_server.py:213-236 (`response_format` ignored; `_mp3_bytes` + `audio/mpeg`, `spk_emb=sample_random_speaker()` per call)
- failure scenario: `read_wav_samples` fails on MP3 bytes, so `serial_fallback` runs for every group. The batch self-check reports ChatTTS OK, but each word has a different random speaker.
- suggested fix: honour `response_format` in the server (and a fixed speaker seed), or request mp3 and decode it before splitting.

### AT-045 — `SerializedModelEngine.unload` (Parler, Bark) drops the model reference but never releases the CUDA cache
- severity: low · category: gpu-memory-not-released · confidence: likely
- location: pycore/pyutils/tts/serialized_model_engine.py:103-111
- failure scenario: after a Parler or Bark test or an idle unload, the PyTorch caching allocator keeps the VRAM reserved inside the pycore process. nvidia-smi still shows it as used, so:
  - the next qwen3tts launch sees less free VRAM and may fall back to CPU (`_gpu_device_or_fallback`);
  - the reclaim (AT-005) never touches pycore's own PID;
  - the self-check "released" line reports about 0 VRAM freed.
- suggested fix: after dropping the model, run `gc.collect()` and `torch.cuda.empty_cache()` on the owner thread.

### AT-046 — Bark ignores the language and has no long-text chunking, so non-English text uses an English voice and long input is truncated
- severity: low · category: engine-param-mismatch / truncation · confidence: likely
- location: pycore/pyutils/tts/bark_engine.py:72-73, :99-128; pycore/pyutils/tts/engine_policy.py `_LANGUAGES_BY_ENGINE["bark"]` (13 languages); pycore/pyutils/tts/tts_status.py:64-75 (bark is not chunk-capable)
- failure scenario: a zh, de or fr request uses `v2/en_speaker_6`, and a paragraph longer than Bark's ~13 s generation window comes back cut off. The orchestrator nevertheless routes those languages to Bark.
- suggested fix: pick the voice preset per language, and chunk through `tts_text_chunking` (or restrict the Bark language set).

### AT-047 — The CosyVoice client ignores speed and guesses the PCM sample rate from the model name
- severity: low · category: engine-param-mismatch · confidence: suspect
- location: pycore/pyutils/tts/cosyvoice_engine.py:46-67 (`_sample_rate`), :200-235 (`speed` unused)
- failure scenario: a model id without "cosyvoice2" in its name that produces 24 kHz (e.g. a CosyVoice3 checkpoint or a renamed local dir) gets a header written at 22050 Hz, so the audio plays slow and low. Speed changes have no effect.
- suggested fix: take the rate from the server (or `COSYVOICE_SAMPLE_RATE`, mandatory for unknown models), and pass `speed` to the endpoints that support it.

### AT-048 — The qwen3tts web console polls /status every 2.5 s forever and shares the single-slot job queue with pycore's lanes
- severity: low · category: timer-polling / interference · confidence: confirmed
- location: pycore/tts_install_assets/qwen3tts_web_assets/app.js:114-162 (`poll()`), :47-71 (`submit` / `cancel`)
- failure scenario: an open console tab (even hidden) GETs /status every 2.5–5 s, and each call runs nvidia-smi (1 s cache) and serializes all jobs. A console "Queue" submission takes the only queue slot (AT-010), so pycore sentence jobs get 429s. The job table lists pycore's own jobs with a Cancel button that cancels lane work.
- suggested fix: use the existing queue event stream instead of polling, and scope the console's job list and cancel to its own jobs.

### AT-049 — `tts_engine_params.py` is dead, and the UI keeps its own duplicate of the engine test schema
- severity: low · category: rule (duplicate / dead code) · confidence: confirmed
- location: pycore/pyutils/tts/tts_engine_params.py (no importer in pycore/ or the UI; grep); poly_apps/…/components/PcTestEngineProfiles.ts (the live copy)
- failure scenario: the Python schema has drifted from reality ("Qwen3-TTS in-process … downloads HF model", "VoxCPM2 in-process"). The part of AT-039 that refers to tts_engine_params strings reaching the UI is therefore moot; those strings never ship.
- suggested fix: delete the module, or make it the single source the UI fetches.

### AT-050 — Engine availability reasons are hardcoded English UI text, and one hint contradicts itself
- severity: low · category: rule (i18n) · confidence: confirmed
- location: pycore/pyutils/tts/tts_engine_probe.py:43, :151-260 (plus the per-engine `disabled_reason()` strings); unreachable duplicate `return None` at :262
- failure scenario: the TTS status UI shows these reasons verbatim in English. `_self_contained_reason` tells VoxCPM2 users "Python 3.10 is ready", while `voxcpm2_engine.disabled_reason` requires the dedicated Python 3.12.
- suggested fix: return reason codes plus parameters, localized in the UI.

### Pass-2 in-flight notes
- pycore/pyutils/tts/audio_resource_ledger.py `[in-flight, last read 02:52]` (02:43 version, now using `text_parsing.normalize_language_code`): no defect of its own. It records whatever path the producers give it, so AT-001 wrong-word clips enter it through lane staging, and word keys depend on the X4 md5 alignment.
- engine_policy.py `[in-flight, last read 02:50]` (02:43 version): language normalization moved to `text_parsing.normalize_language_code`, and "yue" is still accepted. AT-016 and AT-033 still hold at the line numbers noted above; there is no new finding.

### Pass-2 coverage
Fully read:
- **pyutils/tts:** tts_engine_probe, batch/chattts_batch, batch/gptsovits_batch, batch/parler_batch, batch/resource_monitor, gptsovits_engine, cosyvoice_engine, fishspeech_engine, f5tts_engine, melotts_engine, chattts_engine, gtts_web_engine, streamelements_engine, azure_engine, bark_engine, parler_engine, serialized_model_engine, engine_policy (02:43 version), tts_engine_params, qwen/config, qwen/weights, audio_resource_ledger (02:43 version).
- **tts_install_assets:** tts_model_tiers, qwen3tts_web.py, qwen3tts_web_assets/app.js (it drives the engine: direct synthesis, queue submit and cancel, status polling).

Not read: qwen3tts_web_assets/index.html and style.css (markup and style only).
