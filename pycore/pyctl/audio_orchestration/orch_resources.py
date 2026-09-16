import base64
import hashlib
import shutil
import time
import uuid
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_app_cache_dir
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.background_jobs import BackgroundJobs
from pycore.pyutils.common.strtools.normalization import media_content_id
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.progress_upload import laravel_progress_uploader
from pycore.pyutils.tts import word_audio_cache
from pycore.pyutils.tts.audio_delivery_outbox import AUDIO_DELIVERY_PROCESS_ID, audio_delivery_outbox
from pycore.pyutils.tts.audio_validation import validate_mp3
from pycore.pyutils.tts.qwen.config import ENGINE_NAME as QWEN3TTS_ENGINE
from pycore.pyutils.tts.tts_orchestrator import synthesize
from pycore.pyctl.tts import word_audio_service


SENTENCE_AUDIO_PATH = "/api/app_qy_v1/ai_tools/tts/sentence/audio"
SENTENCE_REPORT_PATH = "/api/app_qy_v1/ai_tools/tts/sentence/report"
DELIVERY_LANE = "orchestration"
_delivery_jobs = BackgroundJobs("AudioOrchDelivery")


def resource_id(kind: str, language: str, text: str) -> str:
    content = media_content_id(text) if kind == "sentence" else text.strip().lower()
    return hashlib.sha256(f"{kind}:{language}:{content}".encode("utf-8")).hexdigest()


def _sentence_path(text: str, language: str) -> Path:
    directory = get_app_cache_dir() / "sentence_audio" / language
    directory.mkdir(parents=True, exist_ok=True)
    return directory / f"{media_content_id(text)}.mp3"


def _sentence_metadata(resource: Dict[str, Any], base_url: Optional[str]) -> Dict[str, Any]:
    response = laravel_client.get(
        SENTENCE_AUDIO_PATH, base_url=base_url,
        params={"text": resource["text"], "language": resource["language"], "passive": "1"},
        timeout=30,
    )
    if response.status_code != 200:
        return {"success": False, "error": f"sentence lookup HTTP {response.status_code}"}
    return response.json()


def resolve_audio(
    resource: Dict[str, Any], staging: Path, base_url: Optional[str] = None,
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> Dict[str, Any]:
    kind = resource["kind"]
    text = resource["text"]
    language = resource["language"]
    target = staging / f"{resource['resource_id']}.mp3"
    cached = word_audio_cache.find_cached(text, language) if kind == "word" else _sentence_path(text, language)
    if kind == "sentence" and not cached.is_file():
        cached = cached.with_name(f"{cached.stem}_{QWEN3TTS_ENGINE}.mp3")
    if cached is not None and cached.is_file() and validate_mp3(str(cached))[0]:
        return {"audio_path": str(cached), "source": "cache", "provider": "cache", "status": "ready"}
    if kind == "sentence":
        hit = synthesize(text, language, target, priority_profile="sentence", cache_only=True)
        if hit.get("success"):
            return {"audio_path": str(target), "source": "cache", "provider": hit.get("engine") or "cache", "status": "ready"}
        metadata = _sentence_metadata(resource, base_url)
        if metadata.get("exists") and metadata.get("url"):
            response = laravel_client.get(metadata["url"], base_url=base_url, timeout=60)
            if response.status_code == 200:
                target.write_bytes(response.content)
                if validate_mp3(str(target))[0]:
                    cached = _sentence_path(text, language)
                    shutil.copy2(target, cached)
                    return {"audio_path": str(cached), "source": "laravel", "provider": "laravel", "status": "ready", "synced": True}
    else:
        metadata = word_audio_service.word_audio_media(text, language, base_url=base_url)
        if metadata.get("success") and metadata.get("content_base64"):
            target.write_bytes(base64.b64decode(metadata["content_base64"]))
            if validate_mp3(str(target))[0]:
                cached = word_audio_cache.store_bytes(text, language, "laravel", target.read_bytes())
                return {"audio_path": str(cached), "source": "laravel", "provider": "laravel", "status": "ready", "synced": True}
    result = synthesize(
        text, language, target, priority_profile=kind,
        client_job_id=f"audio-orch:{resource['resource_id']}", progress_callback=progress_callback,
    )
    if not result.get("success") or not target.is_file() or not validate_mp3(str(target))[0]:
        return {"source": "missing", "status": "failed", "error": str(result.get("error") or "audio_validation_failed")}
    provider = str(result.get("engine") or "generated")
    cached = word_audio_cache.store_bytes(text, language, provider, target.read_bytes()) if kind == "word" else _sentence_path(text, language)
    if kind == "sentence":
        shutil.copy2(target, cached)
    return {"audio_path": str(cached), "source": "cache" if result.get("cached") else "generated", "provider": provider, "status": "ready"}


def _deliver(record: Dict[str, Any], progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None) -> Dict[str, Any]:
    delivery_id = record["delivery_id"]
    owner = f"{AUDIO_DELIVERY_PROCESS_ID}:{uuid.uuid4().hex}"
    claimed = audio_delivery_outbox.claim(delivery_id, owner)
    resource = record["resource"]
    if claimed is None:
        return {"success": False, "error": "audio_delivery_in_progress"}
    try:
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
        attempts = int(claimed.get("delivery_attempts") or 0) + 1
        audio_delivery_outbox.patch(delivery_id, {"delivery_attempts": attempts}, owner)
        audio_delivery_outbox.release(delivery_id, owner, error=str(error), retry_at=time.time() + audio_delivery_outbox.retry_delay(attempts, 5, 300))
        ColorPrint.yellow(f"[AudioOrch] delivery={delivery_id} pending: {error}")
        return {"success": False, "error": str(error)}
    audio_delivery_outbox.complete(delivery_id, owner)
    return {"success": True}


def synchronize_audio(resource: Dict[str, Any], base_url: Optional[str], progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None) -> Dict[str, Any]:
    metadata = _sentence_metadata(resource, base_url) if resource["kind"] == "sentence" else word_audio_service.word_audio_media(
        resource["text"], resource["language"], base_url=base_url, metadata_only=True,
    )
    if metadata.get("exists"):
        return {"success": True, "already_uploaded": True}
    audio_path = Path(resource["audio_path"])
    digest = hashlib.sha256(audio_path.read_bytes()).hexdigest()
    endpoint_key = hashlib.sha256(str(base_url or "").encode("utf-8")).hexdigest()[:16]
    record = audio_delivery_outbox.stage_audio({
        "lane": DELIVERY_LANE, "task_id": f"{endpoint_key}:{resource['resource_id']}:{digest}",
        "attempt": 0, "resource": dict(resource), "base_url": base_url,
    }, str(audio_path), get_app_cache_dir())
    result = _deliver(record, progress_callback)
    return {**result, "delivery_id": record["delivery_id"]}


def _recover_deliveries() -> None:
    while audio_delivery_outbox.stats(DELIVERY_LANE)["pending"]:
        for record in audio_delivery_outbox.list_ready(DELIVERY_LANE, limit=25):
            _deliver(record)
        THREAD_BUS.wait_signal("audio_orchestration.delivery.wait", timeout=5)


def recover_deliveries() -> None:
    _delivery_jobs.start("recovery", _recover_deliveries)
