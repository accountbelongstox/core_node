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
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyutils.laravel.progress_upload import laravel_progress_uploader
from pycore.pyutils.tts import sentence_audio_cache, word_audio_cache
from pycore.pyutils.tts.audio_delivery_outbox import AUDIO_DELIVERY_PROCESS_ID, audio_delivery_outbox
from pycore.pyutils.tts.audio_validation import validate_mp3
from pycore.pyutils.tts.engine_policy import (
    configured_tts_priority,
    rotated_engine_exclusions,
    sentence_tts_cache_identity,
    tts_engine_supports_language,
)
from pycore.pyutils.tts.tts_orchestrator import synthesize
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
    if checked_ms and time.time() - checked_ms / 1000.0 <= LARAVEL_AUDIO_HEALTH_TTL_SECONDS and not health.get("healthy"):
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


def resolve_batch(
    resources: List[Dict[str, Any]],
    staging: Path,
    base_url: Optional[str] = None,
    cancel_requested: Optional[Callable[[], bool]] = None,
    progress_callback: Optional[Callable[[int, Dict[str, Any], Dict[str, Any]], None]] = None,
    activity_callback: Optional[Callable[[Dict[str, Any], Dict[str, Any]], None]] = None,
) -> Dict[str, Dict[str, Any]]:
    """Resolve the whole manifest: local caches first in BATCH (one word-cache
    directory scan per language + content-addressed sentence stats), then
    Laravel / local generation for the misses only. Returns
    {resource_id: result}; cancelled before the remaining misses are touched
    when cancel_requested() turns True."""
    items = list(resources)
    results: Dict[str, Dict[str, Any]] = {}
    completed = 0
    sentence_directory = sentence_audio_cache.cache_dir() if any(item["kind"] == "sentence" for item in items) else None
    speaker, instruct, model, speed = sentence_tts_cache_identity(None, None, None)
    engines_by_lang = {}

    def _completed(resource, result) -> None:
        nonlocal completed
        results[resource["resource_id"]] = result
        completed += 1
        if progress_callback is not None:
            progress_callback(completed, resource, result)

    words_by_lang: Dict[str, List[Dict[str, Any]]] = {}
    for resource in items:
        if resource["kind"] == "word":
            words_by_lang.setdefault(str(resource["language"]), []).append(resource)
    for language, group in words_by_lang.items():
        if cancel_requested is not None and cancel_requested():
            return results
        if activity_callback is not None:
            activity_callback(group[0], {"stage": f"scanning local word audio cache ({language})"})
        hits = word_audio_cache.find_cached_many(
            [entry["text"] for entry in group], language,
            cancel_requested=cancel_requested,
            scan_callback=(lambda count: activity_callback(
                group[0], {"stage": f"scanning local word audio cache ({language}): {count} files"},
            )) if activity_callback is not None else None,
        )
        for resource in group:
            if cancel_requested is not None and cancel_requested():
                return results
            path = hits.get(str(resource["text"]).strip().lower())
            if path is not None and validate_mp3(str(path))[0]:
                _completed(resource, {
                    "audio_path": str(path), "source": "cache", "provider": "cache", "status": "ready",
                })

    for scan_index, resource in enumerate(items, 1):
        if cancel_requested is not None and cancel_requested():
            return results
        if scan_index % 100 == 0 and activity_callback is not None:
            activity_callback(resource, {"stage": f"scanning local audio caches: {scan_index}/{len(items)}"})
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

    def _engine_exclusions(resource: Dict[str, Any]) -> tuple:
        # Rotate the per-kind engine fallback order by resource id so parallel
        # workers start on DIFFERENT engines (several local models synthesize
        # concurrently); every worker still falls through the full chain.
        return rotated_engine_exclusions(
            str(resource["kind"]), resource["language"], resource["resource_id"],
        )

    def _resolve_miss(resource: Dict[str, Any]) -> Dict[str, Any]:
        try:
            return resolve_audio(
                resource, staging, base_url=base_url, cache_checked=True,
                excluded_engines=_engine_exclusions(resource),
            )
        except Exception as error:
            ColorPrint.red(f"[AudioOrch] resource={resource['resource_id']} failed: {error}")
            return {"source": "missing", "status": "failed", "error": str(error)}

    for chunk_start in range(0, len(misses), RESOLVE_CHUNK_SIZE):
        if cancel_requested is not None and cancel_requested():
            break
        chunk = misses[chunk_start:chunk_start + RESOLVE_CHUNK_SIZE]
        if activity_callback is not None:
            activity_callback(chunk[0], {"stage": f"resolving audio resources: {chunk_start + 1}-{chunk_start + len(chunk)}/{len(misses)}"})
        chunk_results = map_bus_tasks(_resolve_miss, chunk, max_workers=RESOLVE_PARALLEL_WORKERS)
        for resource, result in zip(chunk, chunk_results):
            _completed(resource, result)
    return results


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
            if not receipt.get("success") or (receipt.get("data") or {}).get("status") not in ("stored", "exists"):
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
    while True:
        for record in audio_delivery_outbox.list_ready(DELIVERY_LANE, limit=25):
            _deliver(record)
        THREAD_BUS.wait_signal("audio_orchestration.delivery.wait", timeout=5)


def recover_deliveries() -> None:
    _delivery_jobs.start("recovery", _recover_deliveries)


def pending_delivery_counts() -> Dict[str, int]:
    return audio_delivery_outbox.pending_counts(DELIVERY_LANE, "generation_id")
