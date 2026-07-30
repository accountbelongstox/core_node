# -*- coding: utf-8 -*-
"""Shared THREAD_BUS helpers for the Word Audio TTS queue worker."""

from typing import Any, Dict, Optional, Tuple

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method

_LANGUAGE_ALIASES = {
    "english": "en",
    "chinese": "zh",
    "spanish": "es",
    "french": "fr",
    "german": "de",
    "japanese": "ja",
    "korean": "ko",
    "vietnamese": "vi",
    "lao": "lo",
}


def _language_key(language: Any) -> str:
    value = str(language or "").strip().lower()
    return _LANGUAGE_ALIASES.get(value, value)


class WordTaskQueue:
    """Word-task priority state owned by one THREAD_BUS-backed worker."""

    def __init__(self, tasks: list[Dict[str, Any]]) -> None:
        self._tasks = list(tasks)
        self._tickets: Dict[Tuple[str, str], int] = {}
        self._sequence = 0
        init_serialized_owner(self, "tts.word_task_queue", "TTSWordTaskQueueState")

    @staticmethod
    def _key(task: Dict[str, Any]) -> Tuple[str, str]:
        return (
            str(task.get("md5") or "").strip(),
            _language_key(task.get("language")),
        )

    @serialized_method
    def replace(self, tasks: list[Dict[str, Any]]) -> None:
        self._tasks = list(tasks)

    @serialized_method
    def prioritize(self, md5: str, language: str) -> None:
        key = (str(md5 or "").strip(), _language_key(language))
        if not key[0] or not key[1]:
            return
        self._sequence += 1
        self._tickets[key] = self._sequence
        if len(self._tickets) > 2000:
            oldest = min(self._tickets, key=self._tickets.get)
            self._tickets.pop(oldest, None)

    @serialized_method
    def pop(self) -> Optional[Dict[str, Any]]:
        if not self._tasks:
            return None
        selected_index = 0
        selected_ticket = -1
        selected_key: Optional[Tuple[str, str]] = None
        for index, task in enumerate(self._tasks):
            key = self._key(task)
            ticket = self._tickets.get(key, -1)
            if ticket > selected_ticket:
                selected_index = index
                selected_ticket = ticket
                selected_key = key
        selected = self._tasks.pop(selected_index)
        if selected_key is not None:
            self._tickets.pop(selected_key, None)
        return selected


def run_tts_worker_lane(payload: Dict[str, Any]) -> Dict[str, int]:
    """Drain one word TTS lane; payload and result travel through THREAD_BUS."""
    worker = payload["worker"]
    base = payload["base"]
    tasks = payload["tasks"]
    processed = succeeded = failed = 0
    while True:
        task = worker._next_active_task(tasks)
        if task is None:
            break
        processed += 1
        if worker._process_task(base, task):
            succeeded += 1
        else:
            failed += 1
    return {
        "processed": processed,
        "succeeded": succeeded,
        "failed": failed,
    }


def task_deque(tasks: list[Dict[str, Any]]) -> WordTaskQueue:
    return WordTaskQueue(tasks)


__all__ = ["WordTaskQueue", "run_tts_worker_lane", "task_deque"]
