---
name: project-pycore-pitfalls
description: Non-obvious pycore pitfalls learned during the D1/D10/D7 work (serialized calls, engine settings, contracts, X4 word md5 threading, static checks incl. module-attribute check, route registration auto-resume, merge scope from git)
metadata:
  type: project
---

Pitfalls that are not obvious from reading one file:

- `call_serialized` progress signals must not consume the response guard: a `.started` signal published with the consuming `signal_if_present` hung every untimed call and pycore could not start (fixed 2026-09-27 09:41 with `consume=False`). Re-check this whenever touching `serialized_worker` / `ThreadBus.signal_if_present`.
- UI engine-test extras must never be written to `os.environ` (lanes and orchestration run concurrently); they go through `engine_policy.engine_setting` (ContextVar). Calls that hop to a model owner thread need `copy_context().run` to carry the override.
- Relay route policies and Queue Center endpoint roles live only in the cross-end contracts (`config/pycore_relay_contract.json`, `config/queue_center_contract.json`); a missing entry there is an orchestrator change, not a pycore code change.
- `scripts/pytools/aitools/qwen3tts_tester.py` imports `pycore.pyutils.tts.tts_engine_params`, so that module is not dead even though pycore/UI never import it.
- Shared constants go in `pyfoundations/network_constants.py` once. pycore modules import them. The standalone servers in `tts_install_assets` read them with `getattr(tts_server_common.load_network_constants(), NAME, fallback)`. The reviewer rejects a constant redeclared in a server. pyfoundations modules (even `pybasecommon`) may import `network_constants`.
- Any file path built from RPC params (`item_key`, `format`, names) is a path-traversal finding. Name files from server-side ids (`operation_service` makes uuid `op_…`/`item_…`), allow-list the extension, and check that the resolved parent is the target directory.
- Every registered RPC route with no explicit policy falls to `pycore_relay_contract.json` `route_policy_matching.default_profile = general_action` (exposure `relay`). So removing a route with no in-repo caller can still break an out-of-repo relay client; say so when deleting routes. `pyctl/laravel/worker_base.py` (live) is not the deleted `pyutils/tts/worker_base.py`.
- Word identity (X4) is Laravel's md5 of the exact stored word. Any path that stores or publishes a word clip must pass it on: `audio_resource_ledger.record/entry(md5=)`, `audio_resource_delivery.publish(md5=)`, `word_audio_cache.save_to_cache(md5=)`, `kokoro_batch.synthesize_words_to_cache(md5s)`, `build_local_task(md5=)`. A missing md5 silently re-keys the clip by md5(lower(strip)), which is the transitional fallback for words without a Laravel md5 only. `audio_dedup_key`'s fallback must stay identical to `build_local_task`'s.
- Static checks that are allowed and useful (no services): ast.parse + symtable undefined-globals + an AST check that every `from pycore... import X` resolves, plus a module-level import-cycle scan; set `PYTHONDONTWRITEBYTECODE=1` for scratch runs. Also run a module-attribute check (`import pycore.x.y as alias` then `alias.NAME` must exist): symtable and from-import checks miss it, and a missing `prompt_archive.ARCHIVE_ROOT_ONLY_FIELD` broke all agent-history extraction in D7.
- Never call `register_http_routes` (or `register_local_audio_orchestration_routes`) in a check: it runs `orch_service.resume_interrupted_generations()` and resumes every `generating` orchestration task in the shared data dir. Import the modules only; check routes by grepping the registrars.
- Merge scope: lanes can return `changed: null` while their edits are on disk, and the user may commit working trees mid-run. Derive the window from `git log`/`git diff <backup>..HEAD` plus the working tree, not from lane returns.

**Why:** each of these cost a review round or a startup outage in D1.
**How to apply:** check the relevant item before editing serialized_worker/thread_bus, TTS engine settings, relay/queue contracts, or deleting "dead" TTS modules. See [[feedback-line-endings]].
