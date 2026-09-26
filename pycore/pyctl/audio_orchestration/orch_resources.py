import hashlib
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import map_bus_tasks
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.strtools.normalization import media_content_id
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyutils.tts import sentence_audio_cache, word_audio_cache
from pycore.pyutils.tts import runtime_profile
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


SENTENCE_AUDIO_PATH = "/api/app_qy_v1/ai_tools/tts/sentence/audio"
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


def _laravel_sentence_audio(resource: Dict[str, Any], target: Path, base_url: Optional[str]) -> Optional[Path]:
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
        metadata = _sentence_metadata(resource, base_url)
        if not metadata.get("exists") or not metadata.get("url"):
            return None
        response = laravel_client.get(metadata["url"], base_url=base_url, timeout=60)
        if response.status_code != 200:
            return None
        target.write_bytes(response.content)
    except Exception as error:
        ColorPrint.yellow(f"[AudioOrch] Laravel audio fetch failed resource={resource['resource_id']}: {error}")
        return None
    if not validate_mp3(str(target))[0]:
        return None
    return _store_sentence_cache(text, language, target.read_bytes()) or target


def resolve_sentence_audio(
    resource: Dict[str, Any], staging: Path, base_url: Optional[str] = None,
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    cache_checked: bool = False,
    excluded_engines: Optional[tuple] = None,
) -> Dict[str, Any]:
    """One sentence: central cache -> Laravel -> local synthesis. Words never
    come here; they resolve only through the Kokoro batch in resolve_batch."""
    text = resource["text"]
    language = resource["language"]
    target = staging / f"{resource['resource_id']}.mp3"
    if progress_callback is not None:
        progress_callback({"stage": "checking local audio cache"})
    if not cache_checked:
        hit = sentence_cache_hit(text, language)
        if hit is not None and validate_mp3(str(hit))[0]:
            return {"audio_path": str(hit), "source": "cache", "provider": "cache", "status": "ready"}
    if progress_callback is not None:
        progress_callback({"stage": "fetching audio from Laravel"})
    downloaded = _laravel_sentence_audio(resource, target, base_url)
    if downloaded is not None:
        return {"audio_path": str(downloaded), "source": "laravel", "provider": "laravel", "status": "ready", "synced": True}
    if progress_callback is not None:
        progress_callback({"stage": "generating audio locally"})
    result = synthesize(
        text, language, target, priority_profile="sentence",
        client_job_id=f"audio-orch:{resource['resource_id']}", progress_callback=progress_callback,
        excluded_engines=tuple(excluded_engines or ()),
    )
    if not result.get("success") or not target.is_file() or not validate_mp3(str(target))[0]:
        return {"source": "missing", "status": "failed", "error": str(result.get("error") or "audio_validation_failed")}
    # synthesize() already stored sentence audio into the central cache.
    provider = str(result.get("engine") or "generated")
    return {"audio_path": str(target), "source": "cache" if result.get("cached") else "generated", "provider": provider, "status": "ready"}


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
       per item. Words a lane worker failed re-enter the Kokoro batch; no
       word is ever synthesized one by one.
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
            f"{runtime_profile.WORD_BATCH_ENGINE} ({language}): {len(group)} words"
        ))
        outcomes = kokoro_batch.synthesize_words_to_cache(
            [resource["text"] for resource in group], language, staging / "word_batch" / language,
        )
        pairs = [
            (resource, {
                "audio_path": outcome["audio_path"],
                "source": "generated",
                "provider": outcome["provider"],
                "status": "ready",
            } if outcome["ok"] else {
                "source": "missing",
                "status": "failed",
                "provider": outcome["provider"],
                "error": outcome["error"],
            })
            for resource, outcome in zip(group, outcomes)
        ]
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
            return resolve_sentence_audio(
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
    # Failed / timed-out lane words go back through the Kokoro batch, never
    # through a per-word synthesis.
    def _lane_result(entry: Dict[str, Any], lane: str, result: Dict[str, Any]) -> Dict[str, Any]:
        if entry.get("state") == TRACK_DONE and result.get("status") == "ready" and result.get("source") == "cache":
            return {
                **result,
                "source": "generated",
                "provider": str(entry.get("provider") or result.get("provider") or ""),
                "delivered_by_lane": lane == "sentence_audio",
            }
        return result

    for lane, waiting in deferred.items():
        if not waiting or _cancelled():
            continue
        settled = _await_lane_settled(
            lane,
            [queue_key[resource["resource_id"]] for resource in waiting],
            cancel_requested,
            lambda stage, first=waiting[0]: _activity(first, stage),
        )
        if lane == "word_audio":
            retry_by_language: Dict[str, List[Dict[str, Any]]] = {}
            for resource in waiting:
                retry_by_language.setdefault(str(resource["language"]), []).append(resource)
            for language, group in retry_by_language.items():
                if _cancelled():
                    break
                hits = word_audio_cache.find_cached_many([resource["text"] for resource in group], language)
                retry: List[Dict[str, Any]] = []
                for resource in group:
                    path = hits.get(str(resource["text"]).strip().lower())
                    if path is None or not validate_mp3(str(path))[0]:
                        retry.append(resource)
                        continue
                    entry = settled.get(queue_key[resource["resource_id"]]) or {}
                    _completed(resource, _lane_result(entry, lane, {
                        "audio_path": str(path), "source": "cache", "provider": "cache", "status": "ready",
                    }))
                for chunk_start in range(0, len(retry), WORD_BATCH_CHUNK_SIZE):
                    if _cancelled():
                        break
                    _word_batch(language, retry[chunk_start:chunk_start + WORD_BATCH_CHUNK_SIZE])
            continue
        for resource in waiting:
            if _cancelled():
                break
            entry = settled.get(queue_key[resource["resource_id"]]) or {}
            # Cache first: the lane worker stores its output in the shared
            # cache; only a failed/timed-out lane item is generated here.
            _completed(resource, _lane_result(entry, lane, _resolve_miss(resource, cache_checked=False)))

    if _cancelled():
        release_owner_queue(owner)
    return results


def release_owner_queue(owner: str) -> None:
    """Drop the owner's still-queued Part1 items from both lane queues."""
    if not owner:
        return
    for lane in AUDIO_QUEUE_LANES:
        audio_queue_center.release_owner(lane, owner)
