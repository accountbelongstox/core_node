# R4 Part 2, batch 1: reviewer verdicts on audio-tts.md

Recorded by lead from the reviewer's report (2026-09-27, ~02:52; received after the halt).
- The findings were checked against the audio-tts.md text of about 02:39 (AT-001..AT-040, X1–X7) and the code on disk.
- Files changed in-flight: orch_delivery, orch_generate and orch_service (02:38), laravel_audio_delivery (02:39), word_audio_cache (02:37). Every cited defect was still present, so there is no "REFUTED (fixed in-flight)".
- Result: 32 CONFIRMED, 8 PLAUSIBLE, 0 REFUTED.
- Not verified: the AT-001 ledger extension, X8, AT-041..AT-050.

| ID | Verdict | Severity (orig→adj) | Reason |
|---|---|---|---|
| AT-001 | CONFIRMED | high→high | `_stem_prefixes("it_s_kokoro")` gives [it, it_s]. The index and the scan map "it" to the newest such file. `_prepare_word_batch` (exec.py:569) skips synthesis on the hit and uploads the file. |
| AT-002 | CONFIRMED | high→high | `_generate_on_owner` always sets `extra.lang=_kokoro_phonemizer_language()` from env (en-gb-x-rp). `lang` only reaches the merge/serial fallback, and there is no language gate. Laravel has per-language dictionary tables. |
| AT-003 | CONFIRMED | high→high | The control RPC runs `apply_assist_runtime`, then `request_stop(False)`, then `_drop_queued_tasks`, which pops the whole Queue synchronously. This repeats on every control call, and `restore_from_cache` runs once per process. |
| AT-004 | CONFIRMED | high→medium | No try/finally around `_claim`→`_word_batch`→`_settle`, and `call_serialized` raises TimeoutError. `release_owner` does not touch `_taken`. Exception-only, and limited to one chunk. |
| AT-005 | CONFIRMED | high→high | `QWEN3TTS_VRAM_RECLAIM` defaults to "1". pin_runtime_profile (gpu) and the qwen start kill every non-self compute PID when free VRAM is under 6 GB. The policy is not documented. |
| AT-006 | CONFIRMED | high→high | `tmp_dir / ref_audio.filename` is written verbatim, so `../` or an absolute path escapes. The host defaults to 0.0.0.0 and the launcher sets no F5TTS_HOST. Needs the f5tts server running. |
| AT-007 | CONFIRMED | medium→low | `serial_fallback(kokoro_engine.synthesize…)` is still in `_synthesize_group`. It only costs speed on a failed group. |
| AT-008 | CONFIRMED | medium→low | Neither wait signal is ever sent, so both waits are 1 Hz polls. Rule/efficiency issue; results stay correct. |
| AT-009 | CONFIRMED | medium→medium | `get_cache_path` keeps case, the lookup lower-cases, and the index keys come from file names. |
| AT-010 | CONFIRMED | medium→medium | `_queue_max = DEFAULT_QUEUE_MAX = 1` with no env override, against sentence lane CONCURRENCY_LIMIT=3. Clients retry through /status with backoff of at most 2 s. |
| AT-011 | PLAUSIBLE | medium→medium | A stale dict from list_tasks is rewritten as failed if the job finished between the list and `_task_summary`. Timing window. |
| AT-012 | CONFIRMED | medium→medium | The signature covers only generation_id and the segment files, while meta_hash covers sentences, resources, name and status. cached_hash never replaces for an unchanged signature, so output never shows delivered. |
| AT-013 | CONFIRMED | medium→medium | orch_delivery.py:96 reads every done segment's bytes into one dict. |
| AT-014 | CONFIRMED | medium→medium | task_delete removes only tasks/<id>.json. delete_manifest is called only from orch_generate:485, and output_dir is never removed. |
| AT-015 | PLAUSIBLE (withdrawn by finder) | medium→low | Only hits words absent from the full-pull mirror. |
| AT-016 | PLAUSIBLE | medium→medium | `os.environ` is mutated only in the tts_test path. Harm needs a concurrent lane job. |
| AT-017 | CONFIRMED | medium→medium | `_engine_disabled_reason` is neither defined nor imported (checked with ast), so the call raises NameError. |
| AT-018 | CONFIRMED | medium→medium | `_WORD_RE [^\W\d_]+` matches a whole Han run, and the local tokenize path feeds the word steps. |
| AT-019 | CONFIRMED | low→low | `active_count()` includes the queued backlog. |
| AT-020 | CONFIRMED | low→low | audio_lane_state.py:168-173 waits with a 5 s timeout, then builds lanes_active(). |
| AT-021 | PLAUSIBLE | low→low | get_signal followed by signal is not atomic (laravel_audio_worker.py:649-657). |
| AT-022 | CONFIRMED | low→low | The normalize-error return comes before _mark_task_started, but the finally still decrements. |
| AT-023 | CONFIRMED | low→low | The lane caches under speaker=self._speaker, while orchestration looks up "any:female". |
| AT-024 | CONFIRMED | low→low | The pattern ends in `$` without MULTILINE, so it only applies at the end of the text (tts_text_chunking.py:159). |
| AT-025 | CONFIRMED | low→low | The qwen3tts script list omits tts_text_chunking.py, which it imports. |
| AT-026 | CONFIRMED | low→low | prune_absent drops the heap/Part1 keys, but the `_record_part1` tracker entry stays QUEUED. |
| AT-027 | CONFIRMED | low→low | A non-200 response gives rows=[], and `_pull_all` reports success with 0 pulled. |
| AT-028 | CONFIRMED | low→low | Latent index misalignment. |
| AT-029 | CONFIRMED | low→low | chattts and f5tts bind 0.0.0.0 by default. Overlaps AT-006. |
| AT-030 | CONFIRMED | low→low | Blocking f5.infer runs in an async route, and mkdtemp is never cleaned. |
| AT-031 | CONFIRMED | low→low | voxcpm2 never reads speed or language. |
| AT-032 | CONFIRMED | low→low | gptsovits has no adoption contract, so a healthy foreign listener is killed. |
| AT-033 | CONFIRMED | low→low | An edge/chattts-first order is migrated back to the default on every read. |
| AT-034 | CONFIRMED | low→low | Start always spawns `_run`, and the result keeps only a byte count. |
| AT-035 | PLAUSIBLE | low→low | No wait_for around the probe. The bound depends on the edge-tts version's own timeouts. |
| AT-036 | PLAUSIBLE | low→low | No timeout on the nvidia-smi subprocess. A hang needs a driver fault. |
| AT-037 | CONFIRMED | low(rule)→low | The named modules have no external importers. |
| AT-038 | CONFIRMED | low(rule)→low | qwen3tts_synthesis has its own splitter. |
| AT-039 | CONFIRMED | low(rule)→low | Raw exception text is shown, and "all segments failed" appears when only some segments failed. |
| AT-040 | CONFIRMED | low(rule)→low | Raw threading and sleep loops, which PYTHON_PYCORE.md:53 forbids. |
| X1 | CONFIRMED | dup AT-003 | useQueueCenterHub.tsx:390 sends graceful_stop:false. |
| X2 | CONFIRMED | –→medium | One owner thread per file path, never reclaimed. Owner: pycore-runtime. |
| X3 | CONFIRMED | dup AT-012 | cached_hash replaces only on a signature change. |
| X4 | PLAUSIBLE | –→low | Laravel md5(content) vs pycore md5(lower(strip)). |
| X5 | CONFIRMED | dup AT-039 | OrchTaskList.tsx renders the raw message. |
| X6 | CONFIRMED | –→low | The queue wait counts toward the timeout. This triggers AT-004. |
| X7 | n/a | – | Coordination note. |

None of these duplicates RV-002 or RV-010.
