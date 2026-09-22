# -*- coding: utf-8 -*-
"""In-process task ordering shared by Laravel audio workers.

ONE whole-Queue structure per lane (Queue = Part1 + Part2, always both
parts; Part1 is empty until filled). The Part1/Part2 split is INTERNAL to
this class: it exists only as the ``part_rank`` ordering component plus
the shared Part1 membership set — every external actor sees ONE queue.
"""

import heapq
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyutils.common.queue_center_contract import task_language_tier_rank

# Part rank: Part1 members (pycore-local head, filled only by orchestration
# / pycore-manager promotes) always sit IN FRONT of Part2 (Laravel head).
PART1_RANK = 0
PART2_RANK = 1


class AudioTaskQueue:
    """Order head-ticket queues by the canonical claim order.

    Contract language_priority tiers (e.g. sentence_audio 'en'-first) rank
    ahead of queue_position, mirroring the Laravel claim-head SQL so the local
    drain order never re-breaks the remote ordering. FIFO ties are preserved.

    Heap key = (part_rank, language_tier_rank, -queue_position, seq):
    part_rank is the INTERNAL Part1/Part2 split — every Part1 member pops
    before any Part2 item, ahead of queue_position. The queue stays ONE
    whole-Queue structure: dedup, push, pop, and reorders always operate on
    the whole Queue, never on one part in isolation.
    """

    def __init__(
        self,
        queue_name: str = "audio",
        task_type: str = "",
        dedup_key_of: Optional[Callable[[Dict[str, Any]], str]] = None,
        part1_keys: Optional[Set[str]] = None,
    ) -> None:
        # Heap entries: (part_rank, tier_rank, -queue_position, seq, task).
        self._heap: List[Tuple[int, int, int, int, Dict[str, Any]]] = []
        self._active_keys: Set[str] = set()
        self._seq = 0
        # Lane task type (contract key) so tier ranking works even when the
        # queued task dicts do not carry task_type themselves.
        self._task_type = str(task_type or "")
        # INTERNAL Part1/Part2 split state: canonical dedup-key resolver and
        # the shared Part1 membership set (owned by the audio queue library,
        # shared by reference so membership updates apply without copying).
        self._dedup_key_of = dedup_key_of
        self._part1_keys: Set[str] = part1_keys if part1_keys is not None else set()
        init_serialized_owner(
            self,
            f"tts.audio_queue.{queue_name}",
            f"AudioTaskQueueState.{queue_name}",
        )

    def _part_rank(self, task: Dict[str, Any]) -> int:
        """INTERNAL: 0 when the task's dedup key is a Part1 member, else 1."""
        if self._dedup_key_of is None:
            return PART2_RANK
        dedup_key = str(self._dedup_key_of(task) or "")
        return PART1_RANK if dedup_key and dedup_key in self._part1_keys else PART2_RANK

    def _order(self, task: Dict[str, Any], sequence: int) -> Tuple[int, int, int, int]:
        try:
            queue_position = int(task.get("queue_position") or 0)
        except (TypeError, ValueError):
            queue_position = 0
        return (
            self._part_rank(task),
            task_language_tier_rank(task, self._task_type),
            -queue_position,
            sequence,
        )

    @serialized_method
    def push(self, task: Dict[str, Any]) -> bool:
        """Add one execution attempt or refresh a queued duplicate's order.

        Whole-Queue dedup: an active ``task_id:retry_count`` key refreshes
        the single existing copy in place — never a second insertion. A task
        whose dedup key is a Part1 member lands in Part1 automatically.
        """
        task_key = self._task_key(task)
        if task_key and task_key in self._active_keys:
            for index, entry in enumerate(self._heap):
                queued_task = entry[-1]
                if self._task_key(queued_task) != task_key:
                    continue
                order = self._order(task, entry[3])
                if order < entry[:4]:
                    self._heap[index] = (*order, dict(task))
                    heapq.heapify(self._heap)
                return False
            return False
        order = self._order(task, self._seq)
        heapq.heappush(self._heap, (*order, task))
        if task_key:
            self._active_keys.add(task_key)
        self._seq += 1
        return True

    @serialized_method
    def pop(self) -> Optional[Dict[str, Any]]:
        """Pop the current queue head or return None."""
        if not self._heap:
            return None
        return heapq.heappop(self._heap)[-1]

    @serialized_method
    def complete(self, task: Dict[str, Any]) -> None:
        task_key = self._task_key(task)
        if task_key:
            self._active_keys.discard(task_key)

    @serialized_method
    def contains(self, task: Dict[str, Any]) -> bool:
        task_key = self._task_key(task)
        return bool(task_key and task_key in self._active_keys)

    @serialized_method
    def active_count(self) -> int:
        return len(self._active_keys)

    @staticmethod
    def _task_key(task: Dict[str, Any]) -> str:
        task_id = str(task.get("task_id") or "").strip()
        if not task_id:
            return ""
        raw_attempt = task.get("retry_count")
        attempt = int(raw_attempt) if isinstance(raw_attempt, int) else 0
        return f"{task_id}:{max(0, attempt)}"

    @serialized_method
    def reorder(self, ordered_task_ids: List[Any]) -> int:
        """Re-align queued entries with the backend pending claim order.

        Part2 ticket path (Laravel diff): ordered_task_ids IS the claim
        order; each queued task's queue_position is synthesized as a
        descending rank (index 0 -> highest value) so the heap pops the
        queue head first. Queued tasks absent from the list keep their
        relative order behind ranked rows until the just-in-time claim at
        task start drops them. Part1 members keep their front rank — a
        Part2 reorder never demotes them.
        """
        rank: Dict[str, int] = {}
        total = 0
        for raw_id in ordered_task_ids:
            task_id = str(raw_id or "").strip()
            if task_id and task_id not in rank:
                total += 1
                rank[task_id] = total
        if not rank:
            return 0
        changed = 0
        for index, entry in enumerate(self._heap):
            task = entry[-1]
            if not isinstance(task, dict):
                continue
            position = rank.get(str(task.get("task_id") or "").strip())
            if position is None:
                continue
            synthetic = total + 1 - position
            try:
                current = int(task.get("queue_position") or 0)
            except (TypeError, ValueError):
                current = 0
            if current == synthetic:
                continue
            task["queue_position"] = synthetic
            self._heap[index] = (*self._order(task, entry[3]), task)
            changed += 1
        if changed:
            heapq.heapify(self._heap)
        return changed

    @serialized_method
    def move_to_head(self, task_id: Any, queue_position: int) -> bool:
        """Apply one head ticket to a queued entry (whole-Queue operation).

        The entry keeps its current part rank: a Part1 member stays in
        front (whole-Queue dedup — the single copy is never duplicated into
        Part2); a Part2 entry takes the new ticket position.
        """
        task_key = str(task_id or "").strip()
        if not task_key:
            return False
        try:
            position = int(queue_position)
        except (TypeError, ValueError):
            return False
        for index, entry in enumerate(self._heap):
            task = entry[-1]
            if str(task.get("task_id") or "").strip() != task_key:
                continue
            task["queue_position"] = position
            self._heap[index] = (*self._order(task, entry[3]), task)
            heapq.heapify(self._heap)
            return True
        return False

    @serialized_method
    def claim_part1(self, dedup_keys: Set[str]) -> int:
        """INTERNAL: claim already-queued copies of the keys into Part1.

        Whole-Queue dedup: each matching entry is re-ranked with Part1
        rank in place (the ONE copy moves to the front; nothing is
        inserted). Returns the number of re-ranked entries.
        """
        if not dedup_keys or self._dedup_key_of is None:
            return 0
        changed = 0
        for index, entry in enumerate(self._heap):
            task = entry[-1]
            if not isinstance(task, dict):
                continue
            dedup_key = str(self._dedup_key_of(task) or "")
            if not dedup_key or dedup_key not in dedup_keys:
                continue
            order = self._order(task, entry[3])
            if order != entry[:4]:
                self._heap[index] = (*order, task)
                changed += 1
        if changed:
            heapq.heapify(self._heap)
        return changed

    @serialized_method
    def has_dedup_key(self, dedup_key: str) -> bool:
        """INTERNAL: True when any queued entry carries this canonical dedup key.

        Whole-Queue membership check for Part1 fills: an item whose single
        copy already sits in the queue (either part) must NOT be inserted a
        second time — the existing copy is claimed/re-ranked instead.
        """
        if self._dedup_key_of is None or not dedup_key:
            return False
        for entry in self._heap:
            task = entry[-1]
            if not isinstance(task, dict):
                continue
            if str(self._dedup_key_of(task) or "") == dedup_key:
                return True
        return False

    @serialized_method
    def head_preview(self, limit: int = 1) -> List[Dict[str, Any]]:
        """Read the current queue head value(s) WITHOUT consuming them."""
        count = max(1, int(limit or 1))
        return [dict(entry[-1]) for entry in sorted(self._heap)[:count]]

    @serialized_method
    def export_tasks(self) -> List[Dict[str, Any]]:
        """INTERNAL: the whole Queue as ONE list in exact pop order.

        Queue-cache persistence only (the Part1/Part2 split stays internal:
        part membership travels separately as the dedup-key set, and pop
        order already encodes part_rank first).
        """
        return [dict(entry[-1]) for entry in sorted(self._heap)]

    def __len__(self) -> int:
        return len(self._heap)


__all__ = ["AudioTaskQueue", "PART1_RANK", "PART2_RANK"]
