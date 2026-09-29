from abc import ABC, abstractmethod
from contextvars import copy_context
from pathlib import Path
from typing import Any

from pycore.pyfoundations.serialized_worker import (
    SerializedValue,
    SerializedWorkerThread,
    call_serialized,
)
from pycore.pyutils.common.managed_service_process import release_gpu_memory
from pycore.pyutils.tts.audio_utils import wav_to_mp3


DEFAULT_MODEL_OPERATION_TIMEOUT = 900.0


class SerializedModelEngine(ABC):
    def __init__(
        self,
        queue_name: str,
        thread_name: str,
        wav_suffix: str,
        timeout: float = DEFAULT_MODEL_OPERATION_TIMEOUT,
    ) -> None:
        self._queue_name = queue_name
        self._timeout = timeout
        self._wav_suffix = wav_suffix
        self._resource: Any = None
        # Readable without entering the model queue: a status probe never
        # waits behind an in-flight synthesis.
        self._loaded = SerializedValue(False, f"{thread_name}LoadedState")
        self._worker = SerializedWorkerThread(queue_name, thread_name)
        self._worker.start()

    @abstractmethod
    def available(self) -> bool:
        pass

    @abstractmethod
    def load_resource(self) -> Any:
        pass

    @abstractmethod
    def render_wav(
        self,
        resource: Any,
        text: str,
        lang: str,
        output_wav: Path,
        speed: float,
    ) -> bool:
        pass

    def _load_on_owner(self) -> Any:
        if self._resource is None:
            self._resource = self.load_resource()
            self._loaded.set(self._resource is not None)
        return self._resource

    def _synthesize_on_owner(
        self,
        text: str,
        lang: str,
        output_mp3: Path,
        speed: float,
    ) -> bool:
        resource = self._load_on_owner()
        if resource is None:
            return False
        output_wav = output_mp3.with_suffix(self._wav_suffix)
        output_wav.parent.mkdir(parents=True, exist_ok=True)
        try:
            if not self.render_wav(resource, text, lang, output_wav, speed):
                return False
            return wav_to_mp3(output_wav, output_mp3)
        finally:
            output_wav.unlink(missing_ok=True)

    def synthesize(
        self,
        text: str,
        lang: str,
        output_mp3: Path,
        speed: float = 1.0,
    ) -> bool:
        cleaned = (text or "").strip()
        if not cleaned or not self.available():
            return False
        # The owner runs the call in the caller's context, so request-scoped
        # engine settings (engine_policy.engine_setting) reach the model thread.
        return call_serialized(
            self._queue_name,
            copy_context().run,
            self._synthesize_on_owner,
            cleaned,
            lang,
            output_mp3,
            speed,
            timeout=self._timeout,
        )

    def is_loaded(self) -> bool:
        return bool(self._loaded.get())

    def _unload_on_owner(self) -> None:
        self._resource = None
        self._loaded.set(False)
        release_gpu_memory()

    def unload(self) -> None:
        call_serialized(
            self._queue_name,
            self._unload_on_owner,
            timeout=self._timeout,
        )


__all__ = ["DEFAULT_MODEL_OPERATION_TIMEOUT", "SerializedModelEngine"]
