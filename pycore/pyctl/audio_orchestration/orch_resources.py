import base64
import hashlib
import time
import uuid
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import map_bus_tasks
from pycore.pyfoundations.system_paths import get_app_cache_dir
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.background_jobs import BackgroundJobs
from pycore.pyutils.common.strtools.normalization import media_content_id
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.endpoint_manager import LARAVEL_ONLINE_SIGNAL, laravel_endpoint_manager
from pycore.pyutils.laravel.progress_upload import laravel_progress_uploader
from pycore.pyutils.tts import sentence_audio_cache, word_audio_cache
from pycore.pyutils.tts import runtime_profile
from pycore.pyutils.tts.audio_delivery_outbox import AUDIO_DELIVERY_PROCESS_ID, audio_delivery_outbox
from pycore.pyutils.tts.audio_queue_center import (
    AUDIO_QUEUE_LANES,
    TRACK_DONE,
    TRACK_FAILED,
    audio_queue_center,
)
from pycore.pyutils.tts.audio_validation import validate_mp3
from pycore.pyutils.tts.batch import kokoro_batch
from pycore.pyutils.tts.engine_policy import (
    configured_tts_priority,
    rotated_engine_exclusions,
    sentence_tts_cache_identity,
    tts_engine_supports_language,
)
from pycore.pyutils.tts.tts_orchestrator import synthesize
from pycore.pyctl.audio_orchestration import orch_promote
from pycore.pyctl.tts import word_audio_service


SENTENCE_AUDIO_PATH = "/api/app_qy_v1/ai_tools/tts/sentence/audio"
SENTENCE_REPORT_PATH = "/api/app_qy_v1/ai_tools/tts/sentence/report"
DELIVERY_LANE = "orchestration"
_delivery_jobs = BackgroundJobs("AudioOrchDelivery")
# Manifest resource misses resolve in parallel chunks: different engines run
# concurrently (per-engine leases serialize only same-engine work), and each
# miss rotates its engine fallback order so several local models synthesize
# different words at the same time instead of one serial chain.
RESOLVE_PARALLEL_WORKERS = 4
RESOLVE_CHUNK_SIZE = 40
# Word misses are taken and batch-synthesized in bounded chunks so a lane
# worker draining the same Part1 can share the work item by item.
WORD_BATCH_CHUNK_SIZE = 200
# Upper bound for waiting on items a lane worker already popped.
LANE_SETTLE_TIMEOUT_SECONDS = 900.0
_LANE_WAIT_SIGNAL = "audio_orchestration.lane_settle.wait"
LARAVEL_AUDIO_HEALTH_TTL_SECONDS = 30.0


def resource_id(kind: str, language: str, text: str) -> str:
    content = media_content_id(text) if kind == "sentence" else text.strip().lower()
    return hashlib.sha256(f"{kind}:{language}:{content}".encode("utf-8")).hexdigest()


# --------------------------------------------------------------------------- #
# central cache lookup                                                         #
# Words: word_audio_cache is the single unified base ({word}_{provider}.mp3 — #
# any provider's file counts). Sentences: the content-addressed               #
# tts_sentence_cache shared by every TTS entry point. Nothing is cached       #
# anywhere else.                                                              #
# --------------------------------------------------------------------------- #
def _sentence_engines(language: str) -> List[str]:
    return [
        name
        for name in configured_tts_priority("sentence")
        if tts_engine_supports_language(name, language)
    ]


def sentence_cache_hit(text: str, language: str) -> Optional[Path]:
    """Central sentence cache lookup with the SAME identity tuple
    tts_orchestrator.synthesize uses, iterating the configured sentence engine
    order (audio produced by ANY of them is acceptable)."""
    speaker, instruct, model, speed = sentence_tts_cache_identity(None, None, None)
    for engine in _sentence_engines(language):
        hit = sentence_audio_cache.lookup_or_none(
            text=text, lang=language, speaker=speaker, instruct=instruct,
            engine=engine, fmt="mp3", model_id=model, speed=speed,
        )
        if hit is not None:
            return hit
    return None


def _store_sentence_cache(text: str, language: str, data: bytes) -> Optional[Path]:
    """Store Laravel-downloaded sentence audio into the central cache under the
    CURRENT default sentence engine identity so later runs hit it locally."""
    engines = _sentence_engines(language)
    if not engines or not data:
        return None
    speaker, instruct, model, speed = sentence_tts_cache_identity(None, None, None)
    return sentence_audio_cache.store_result(
        text=text, lang=language, speaker=speaker, instruct=instruct,
        engine=engines[0], fmt="mp3", model_id=model, speed=speed,
        data_bytes=data,
    )


def _sentence_metadata(resource: Dict[str, Any], base_url: Optional[str]) -> Dict[str, Any]:
    response = laravel_client.get(
        SENTENCE_AUDIO_PATH, base_url=base_url,
        params={"text": resource["text"], "language": resource["language"], "passive": "1"},
        timeout=30,
    )
    if response.status_code != 200:
        return {"success": False, "error": f"sentence lookup HTTP {response.status_code}"}
    return response.json()


def _laravel_audio(resource: Dict[str, Any], target: Path, base_url: Optional[str]) -> Optional[Path]:
    kind = resource["kind"]
    text = resource["text"]
    language = resource["language"]
    endpoint = str(base_url or laravel_endpoint_manager.get_active_base_url()).rstrip("/")
    health = laravel_endpoint_manager.last_probe_result(endpoint)
    checked_ms = int(health.get("last_checked") or 0)
    if (
        checked_ms
        and time.time() - checked_ms / 1000.0 <= LARAVEL_AUDIO_HEALTH_TTL_SECONDS
        and not health.get("healthy")
    ):
        return None
    try:
        if kind == "sentence":
            metadata = _sentence_metadata(resource, base_url)
            if not metadata.get("exists") or not metadata.get("url"):
                return None
            response = laravel_client.get(metadata["url"], base_url=base_url, timeout=60)
            if response.status_code != 200:
                return None
            target.write_bytes(response.content)
        else:
            metadata = word_audio_service.word_audio_media(text, language, base_url=base_url)
            if not metadata.get("success") or not metadata.get("content_base64"):
                return None
            target.write_bytes(base64.b64decode(metadata["content_base64"]))
    except Exception as error:
        ColorPrint.yellow(f"[AudioOrch] Laravel audio fetch failed resource={resource['resource_id']}: {error}")
        return None
    if not validate_mp3(str(target))[0]:
        return None
    if kind == "word":
        return word_audio_cache.store_bytes(text, language, "laravel", target.read_bytes())
    return _store_sentence_cache(text, language, target.read_bytes()) or target


def resolve_audio(
    resource: Dict[str, Any], staging: Path, base_url: Optional[str] = None,
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    cache_checked: bool = False,
    excluded_engines: Optional[tuple] = None,
) -> Dict[str, Any]:
    kind = resource["kind"]
    text = resource["text"]
    language = resource["language"]
    target = staging / f"{resource['resource_id']}.mp3"
    if progress_callback is not None:
        progress_callback({"stage": "checking local audio cache"})
    if not cache_checked and kind == "word":
        cached = word_audio_cache.find_cached(text, language)
        if cached is not None and validate_mp3(str(cached))[0]:
            return {"audio_path": str(cached), "source": "cache", "provider": "cache", "status": "ready"}
    elif not cache_checked:
        hit = sentence_cache_hit(text, language)
        if hit is not None and validate_mp3(str(hit))[0]:
            return {"audio_path": str(hit), "source": "cache", "provider": "cache", "status": "ready"}
    if progress_callback is not None:
        progress_callback({"stage": "fetching audio from Laravel"})
    downloaded = _laravel_audio(resource, target, base_url)
    if downloaded is not None:
        return {"audio_path": str(downloaded), "source": "laravel", "provider": "laravel", "status": "ready", "synced": True}
    if progress_callback is not None:
        progress_callback({"stage": "generating audio locally"})
    result = synthesize(
        text, language, target, priority_profile=kind,
        client_job_id=f"audio-orch:{resource['resource_id']}", progress_callback=progress_callback,
        excluded_engines=tuple(excluded_engines or ()),
    )
    if not result.get("success") or not target.is_file() or not validate_mp3(str(target))[0]:
        return {"source": "missing", "status": "failed", "error": str(result.get("error") or "audio_validation_failed")}
    provider = str(result.get("engine") or "generated")
    if kind == "word":
        audio_path = str(word_audio_cache.store_bytes(text, language, provider, target.read_bytes()))
    else:
        # synthesize() already stored sentence audio into the central cache.
        audio_path = str(target)
    return {"audio_path": audio_path, "source": "cache" if result.get("cached") else "generated", "provider": provider, "status": "ready"}


def _await_lane_settled(
    lane: str,
    keys: List[str],
    cancel_requested: Optional[Callable[[], bool]],
    activity: Optional[Callable[[str], None]],
) -> Dict[str, Dict[str, Any]]:
    """Wait for items a lane worker (or another owner) is processing.

    Returns ``{key: tracker entry}`` for keys that reached a terminal state;
    keys still pending at the deadline (or on cancel) are omitted so the
    caller resolves them itself.
    """
    pending = set(keys)
    settled: Dict[str, Dict[str, Any]] = {}
    deadline = time.monotonic() + LANE_SETTLE_TIMEOUT_SECONDS
    while pending and time.monotonic() < deadline:
        if cancel_requested is not None and cancel_requested():
            break
        states = audio_queue_center.tracked_states(lane, sorted(pending))
        for key in list(pending):
            entry = states.get(key)
            if entry is None or entry["state"] in (TRACK_DONE, TRACK_FAILED):
                settled[key] = entry or {}
                pending.discard(key)
        if pending:
            if activity is not None:
                activity(f"waiting for {len(pending)} item(s) in progress on the {lane} lane")
            THREAD_BUS.wait_signal(_LANE_WAIT_SIGNAL, timeout=1)
    return settled


def resolve_batch(
    resources: List[Dict[str, Any]],
    staging: Path,
    base_url: Optional[str] = None,
    cancel_requested: Optional[Callable[[], bool]] = None,
    progress_callback: Optional[Callable[[int, Dict[str, Any], Dict[str, Any]], None]] = None,
    activity_callback: Optional[Callable[[Dict[str, Any], Dict[str, Any]], None]] = None,
    owner: str = "",
) -> Dict[str, Dict[str, Any]]:
    """Resolve the whole manifest (binding: REQUIREMENTS_20260926 §5.5).

    1. Local caches first in BATCH (word-cache index + content-addressed
       sentence stats).
    2. Every miss fills Part1 of ITS lane (words -> word_audio Queue,
       sentences -> sentence_audio Queue) as a local task owned by ``owner``.
    3. Chunk by chunk the resolver ``take_local``s its items, generates them
       (words: one Kokoro batch per language; sentences: Laravel lookup, then
       local synthesis) and ``settle_local``s the outcome; items a lane worker
       already popped are awaited, then read from the cache — one generator
       per item.
    Returns ``{resource_id: result}``; stops before untouched misses when
    ``cancel_requested()`` turns True (the owner's queued items are released).
    """
    items = list(resources)
    results: Dict[str, Dict[str, Any]] = {}
    completed = 0
    sentence_directory = sentence_audio_cache.cache_dir() if any(item["kind"] == "sentence" for item in items) else None
    speaker, instruct, model, speed = sentence_tts_cache_identity(None, None, None)
    engines_by_lang = {}

    def _cancelled() -> bool:
        return cancel_requested is not None and cancel_requested()

    def _completed(resource, result) -> None:
        nonlocal completed
        results[resource["resource_id"]] = result
        completed += 1
        if progress_callback is not None:
            progress_callback(completed, resource, result)

    def _activity(resource: Dict[str, Any], stage: str) -> None:
        if activity_callback is not None:
            activity_callback(resource, {"stage": stage})

    words_by_lang: Dict[str, List[Dict[str, Any]]] = {}
    for resource in items:
        if resource["kind"] == "word":
            words_by_lang.setdefault(str(resource["language"]), []).append(resource)
    for language, group in words_by_lang.items():
        if _cancelled():
            return results
        _activity(group[0], f"scanning local word audio cache ({language})")
        hits = word_audio_cache.find_cached_many(
            [entry["text"] for entry in group], language,
            cancel_requested=cancel_requested,
            scan_callback=(lambda count: activity_callback(
                group[0], {"stage": f"scanning local word audio cache ({language}): {count} files"},
            )) if activity_callback is not None else None,
        )
        for resource in group:
            if _cancelled():
                return results
            path = hits.get(str(resource["text"]).strip().lower())
            if path is not None and validate_mp3(str(path))[0]:
                _completed(resource, {
                    "audio_path": str(path), "source": "cache", "provider": "cache", "status": "ready",
                })

    for scan_index, resource in enumerate(items, 1):
        if _cancelled():
            return results
        if scan_index % 100 == 0:
            _activity(resource, f"scanning local audio caches: {scan_index}/{len(items)}")
        if resource["kind"] != "sentence" or resource["resource_id"] in results:
            continue
        language = resource["language"]
        if language not in engines_by_lang:
            engines_by_lang[language] = _sentence_engines(language)
        for engine in engines_by_lang[language]:
            key = sentence_audio_cache.make_key(resource["text"], language, speaker, instruct, engine, "mp3", model, speed)
            hit = sentence_directory / f"{key}.mp3"
            if validate_mp3(str(hit))[0]:
                _completed(resource, {
                    "audio_path": str(hit), "source": "cache", "provider": "cache", "status": "ready",
                })
                break

    misses = [resource for resource in items if resource["resource_id"] not in results]
    if not misses:
        return results

    # Part1 fill (LOCAL ONLY): each miss enters ITS lane's Part1 as a task
    # owned by this orchestration task. Never notifies Laravel.
    orch_promote.promote_missing_to_queue_head(misses, base_url, owner)
    queue_key = {resource["resource_id"]: orch_promote.resource_queue_key(resource) for resource in misses}
    deferred: Dict[str, List[Dict[str, Any]]] = {"word_audio": [], "sentence_audio": []}

    def _claim(lane: str, chunk: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Take this owner's items; lane-held ones are deferred (awaited)."""
        claim = audio_queue_center.take_local(lane, [queue_key[r["resource_id"]] for r in chunk], owner)
        inflight = set(claim["inflight"])
        own: List[Dict[str, Any]] = []
        for resource in chunk:
            if queue_key[resource["resource_id"]] in inflight:
                deferred[lane].append(resource)
            else:
                own.append(resource)
        return own

    def _settle(lane: str, pairs: List[tuple]) -> None:
        audio_queue_center.settle_local(lane, {
            queue_key[resource["resource_id"]]: {
                "ok": result.get("status") == "ready",
                "provider": result.get("provider") or "",
                "error": result.get("error") or "",
            }
            for resource, result in pairs
        }, owner)

    def _word_batch(language: str, group: List[Dict[str, Any]]) -> None:
        """Pinned Kokoro batch for this owner's word misses (never per-word)."""
        _activity(group[0], (
            f"batch generating missing word audio with "
            f"{runtime_profile.WORD_BATCH_ENGINE} ({language})"
        ))
        output_dir = staging / "word_batch" / language
        batch_result = kokoro_batch.synthesize_words([resource["text"] for resource in group], language, output_dir)
        pairs = []
        for index, resource in enumerate(group):
            item = batch_result.items[index] if index < len(batch_result.items) else None
            if item is None or not item.ok or not validate_mp3(str(item.output_path))[0]:
                result = {
                    "source": "missing",
                    "status": "failed",
                    "provider": runtime_profile.WORD_BATCH_ENGINE,
                    "error": (
                        item.error if item is not None and item.error
                        else "Kokoro batch synthesis produced no valid audio"
                    ),
                }
            else:
                word_audio_cache.save_to_cache(
                    resource["text"], language, runtime_profile.WORD_BATCH_ENGINE, str(item.output_path),
                )
                cache_path = word_audio_cache.get_cache_path(
                    resource["text"], language, runtime_profile.WORD_BATCH_ENGINE,
                )
                result = {
                    "audio_path": cache_path if validate_mp3(cache_path)[0] else str(item.output_path),
                    "source": "generated",
                    "provider": runtime_profile.WORD_BATCH_ENGINE,
                    "status": "ready",
                }
            pairs.append((resource, result))
        _settle("word_audio", pairs)
        for resource, result in pairs:
            _completed(resource, result)

    word_misses_by_language: Dict[str, List[Dict[str, Any]]] = {}
    for resource in misses:
        if resource["kind"] == "word":
            word_misses_by_language.setdefault(str(resource["language"]), []).append(resource)
    for language, group in word_misses_by_language.items():
        for chunk_start in range(0, len(group), WORD_BATCH_CHUNK_SIZE):
            if _cancelled():
                break
            own = _claim("word_audio", group[chunk_start:chunk_start + WORD_BATCH_CHUNK_SIZE])
            if own:
                _word_batch(language, own)

    def _engine_exclusions(resource: Dict[str, Any]) -> tuple:
        # Sentences rotate their model chain across the bounded resolver lanes.
        return rotated_engine_exclusions(
            str(resource["kind"]), resource["language"], resource["resource_id"],
        )

    def _resolve_miss(resource: Dict[str, Any], cache_checked: bool = True) -> Dict[str, Any]:
        try:
            return resolve_audio(
                resource, staging, base_url=base_url, cache_checked=cache_checked,
                excluded_engines=_engine_exclusions(resource),
            )
        except Exception as error:
            ColorPrint.red(f"[AudioOrch] resource={resource['resource_id']} failed: {error}")
            return {"source": "missing", "status": "failed", "error": str(error)}

    sentence_misses = [resource for resource in misses if resource["kind"] == "sentence"]
    for chunk_start in range(0, len(sentence_misses), RESOLVE_CHUNK_SIZE):
        if _cancelled():
            break
        own = _claim("sentence_audio", sentence_misses[chunk_start:chunk_start + RESOLVE_CHUNK_SIZE])
        if not own:
            continue
        _activity(own[0], (
            f"resolving sentence audio: {chunk_start + 1}-{chunk_start + len(own)}/{len(sentence_misses)}"
        ))
        chunk_results = map_bus_tasks(_resolve_miss, own, max_workers=RESOLVE_PARALLEL_WORKERS)
        pairs = list(zip(own, chunk_results))
        _settle("sentence_audio", pairs)
        for resource, result in pairs:
            _completed(resource, result)

    # Items a lane worker already popped: await its outcome, then read the
    # shared cache. A lane-settled sentence was already reported to Laravel
    # by the sentence lane (domain report); words are synchronized by us.
    for lane, waiting in deferred.items():
        if not waiting or _cancelled():
            continue
        settled = _await_lane_settled(
            lane,
            [queue_key[resource["resource_id"]] for resource in waiting],
            cancel_requested,
            lambda stage, first=waiting[0]: _activity(first, stage),
        )
        for resource in waiting:
            if _cancelled():
                break
            entry = settled.get(queue_key[resource["resource_id"]]) or {}
            # Cache first: the lane worker stores its output in the shared
            # cache; only a failed/timed-out lane item is generated here.
            result = _resolve_miss(resource, cache_checked=False)
            if entry.get("state") == TRACK_DONE and result.get("status") == "ready" and result.get("source") == "cache":
                result = {
                    **result,
                    "source": "generated",
                    "provider": str(entry.get("provider") or result.get("provider") or ""),
                    "delivered_by_lane": lane == "sentence_audio",
                }
            _completed(resource, result)

    if _cancelled():
        release_owner_queue(owner)
    return results


def release_owner_queue(owner: str) -> None:
    """Drop the owner's still-queued Part1 items from both lane queues."""
    if not owner:
        return
    for lane in AUDIO_QUEUE_LANES:
        audio_queue_center.release_owner(lane, owner)


def _deliver(record: Dict[str, Any], progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None) -> Dict[str, Any]:
    owner = f"{AUDIO_DELIVERY_PROCESS_ID}:{uuid.uuid4().hex}"
    with audio_delivery_outbox.delivery_scope(record["delivery_id"], owner):
        return _deliver_owned(record, owner, progress_callback)


def _deliver_owned(record: Dict[str, Any], owner: str, progress_callback: Optional[Callable[[Dict[str, Any]], None]]) -> Dict[str, Any]:
    delivery_id = record["delivery_id"]
    claimed = audio_delivery_outbox.claim(delivery_id, owner)
    resource = record["resource"]
    if claimed is None:
        return {"success": False, "error": "audio_delivery_in_progress"}
    attempts = int(claimed.get("delivery_attempts") or 0) + 1
    try:
        audio_delivery_outbox.patch(delivery_id, {"delivery_attempts": attempts}, owner)
        if resource["kind"] == "sentence":
            receipt = laravel_progress_uploader.upload(
                SENTENCE_REPORT_PATH, Path(claimed["audio_path"]).read_bytes(),
                base_url=record.get("base_url"), progress_callback=progress_callback,
                params={"content_id": media_content_id(resource["text"]), "text": resource["text"],
                        "language": resource["language"], "worker_id": "pycore-audio-orchestration",
                        "success": "true", "provider": resource.get("provider") or "cache"},
                reason="audio_orchestration_manifest",
            )
            if not receipt.get("upload_complete"):
                raise RuntimeError("sentence_upload_incomplete")
        else:
            word_audio_service.word_audio_media(resource["text"], resource["language"], base_url=record.get("base_url"), metadata_only=True)
            receipt = word_audio_service.upload_word_audio({
                "md5": hashlib.md5(resource["text"].strip().lower().encode("utf-8")).hexdigest(),
                "lang": resource["language"], "provider": resource.get("provider") or "cache",
                "cleaned_word": resource["text"],
                "audio_base64": base64.b64encode(Path(claimed["audio_path"]).read_bytes()).decode("ascii"),
            }, base_url=record.get("base_url"))
            receipt_status = (receipt.get("data") or {}).get("status")
            if receipt_status == "not_found":
                # No dictionary row for this (lang, md5): fill-missing does not apply
                # to arbitrary book tokens; terminal state, so the outbox does not
                # retry-poison on a permanent 404.
                ColorPrint.gray(
                    f"[AudioOrch] delivery={delivery_id} word not in dictionary; no fill needed"
                )
            elif not receipt.get("success") or receipt_status not in ("stored", "exists"):
                raise RuntimeError(str(receipt.get("error") or receipt.get("message") or "word_upload_incomplete"))
    except Exception as error:
        audio_delivery_outbox.release(delivery_id, owner, error=str(error), retry_at=time.time() + audio_delivery_outbox.retry_delay(attempts, 5, 300))
        ColorPrint.yellow(f"[AudioOrch] delivery={delivery_id} pending: {error}")
        return {"success": False, "error": str(error)}
    if not audio_delivery_outbox.complete(delivery_id, owner):
        return {"success": False, "error": "audio_delivery_ownership_changed"}
    return {"success": True}


def synchronize_audio(resource: Dict[str, Any], base_url: Optional[str], progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None) -> Dict[str, Any]:
    audio_path = Path(resource["audio_path"])
    digest = hashlib.sha256(audio_path.read_bytes()).hexdigest()
    endpoint_key = hashlib.sha256(str(base_url or "").encode("utf-8")).hexdigest()[:16]
    record = audio_delivery_outbox.stage_audio({
        "lane": DELIVERY_LANE, "task_id": f"{endpoint_key}:{resource.get('generation_id') or ''}:{resource['resource_id']}:{digest}",
        "attempt": 0, "resource": dict(resource), "base_url": base_url,
        "generation_id": resource.get("generation_id"),
    }, str(audio_path), get_app_cache_dir())
    recover_deliveries()
    return {"success": True, "queued": True, "delivery_id": record["delivery_id"]}


def _recover_deliveries() -> None:
    last_online_at = 0.0
    while True:
        online = THREAD_BUS.get_signal(LARAVEL_ONLINE_SIGNAL)
        if isinstance(online, dict):
            online_at = float(online.get("at") or 0)
            if online_at > last_online_at:
                # Offline -> online edge: deliver offline-generated audio at
                # once (reset the retry backoff).
                last_online_at = online_at
                audio_delivery_outbox.hurry_pending(DELIVERY_LANE)
        for record in audio_delivery_outbox.list_ready(DELIVERY_LANE, limit=25):
            _deliver(record)
        THREAD_BUS.wait_signal("audio_orchestration.delivery.wait", timeout=5)


def recover_deliveries() -> None:
    _delivery_jobs.start("recovery", _recover_deliveries)


def pending_delivery_counts() -> Dict[str, int]:
    return audio_delivery_outbox.pending_counts(DELIVERY_LANE, "generation_id")
