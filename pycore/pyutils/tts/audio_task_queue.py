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
# Upper bound of heap entries walked for one part_view head preview.
_PART_VIEW_WALK_CAP = 5000


def _locally_owned(task: Dict[str, Any]) -> bool:
    """True for a pycore-local copy (orchestration, manual, work lease); a
    Laravel global task (e.g. article_audio) is never taken by an owner."""
    return bool(str(task.get("_local_source") or "").strip())


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
        self._active_dedup_keys: Set[str] = set()
        self._seq = 0
        # Lane task type (contract key) so tier ranking works even when the
        # queued task dicts do not carry task_type themselves.
        self._task_type = str(task_type or "")
        # INTERNAL Part1/Part2 split state: canonical dedup-key resolver and
        # the shared Part1 membership set (owned by the audio queue library,
        # shared by reference so membership updates apply without copying).
        self._dedup_key_of = dedup_key_of
        self._part1_keys: Set[str] = part1_keys if part1_keys is not None else set()
        # Observability counter of heap entries holding Part1 rank: kept
        # incrementally on push/pop, recomputed once after re-rank paths.
        self._part1_count = 0
        self._part1_count_valid = True
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

        Whole-Queue dedup is enforced atomically for both the execution-attempt
        key and canonical audio identity. An active ``task_id:retry_count``
        key may refresh its single queued copy; a different task id for the
        same language/content identity is rejected. A task whose dedup key is
        a Part1 member lands in Part1 automatically.
        """
        return self._push_owned(task)

    @serialized_method
    def push_many(self, tasks: List[Dict[str, Any]]) -> int:
        """Bulk push in ONE owner transaction (cache restore of 10^5+ tasks).

        Same whole-Queue dedup as push(); returns the number inserted. Avoids
        one cross-thread round trip per task, which stalled boot for minutes.
        """
        inserted = 0
        for task in tasks or ():
            if isinstance(task, dict) and self._push_owned(task):
                inserted += 1
        return inserted

    def _push_owned(self, task: Dict[str, Any]) -> bool:
        """push() body; runs only on the owner thread."""
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
                    self._part1_count_valid = False
                return False
            return False
        dedup_key = ""
        if self._dedup_key_of is not None:
            dedup_key = str(self._dedup_key_of(task) or "")
            if dedup_key and dedup_key in self._active_dedup_keys:
                return False
        order = self._order(task, self._seq)
        heapq.heappush(self._heap, (*order, task))
        if order[0] == PART1_RANK:
            self._part1_count += 1
        if task_key:
            self._active_keys.add(task_key)
        if dedup_key:
            self._active_dedup_keys.add(dedup_key)
        self._seq += 1
        return True

    @serialized_method
    def pop(self) -> Optional[Dict[str, Any]]:
        """Pop the current queue head or return None."""
        if not self._heap:
            return None
        entry = heapq.heappop(self._heap)
        if entry[0] == PART1_RANK:
            self._part1_count -= 1
        return entry[-1]

    @serialized_method
    def complete(self, task: Dict[str, Any]) -> None:
        task_key = self._task_key(task)
        if task_key:
            self._active_keys.discard(task_key)
        if self._dedup_key_of is not None:
            dedup_key = str(self._dedup_key_of(task) or "")
            if dedup_key:
                self._active_dedup_keys.discard(dedup_key)

    @serialized_method
    def contains(self, task: Dict[str, Any]) -> bool:
        task_key = self._task_key(task)
        return bool(task_key and task_key in self._active_keys)

    @serialized_method
    def active_count(self) -> int:
        return len(self._active_keys)

    @serialized_method
    def active_dedup_keys(self) -> Set[str]:
        """INTERNAL: canonical identities currently represented in the Queue."""
        return set(self._active_dedup_keys)

    @staticmethod
    def _task_key(task: Dict[str, Any]) -> str:
        task_id = str(task.get("task_id") or "").strip()
        if not task_id:
            return ""
        raw_attempt = task.get("retry_count")
        attempt = int(raw_attempt) if isinstance(raw_attempt, int) else 0
        return f"{task_id}:{max(0, attempt)}"

    @serialized_method
    def prune_where(self, predicate: Callable[[Dict[str, Any]], bool]) -> Tuple[int, List[str]]:
        """Drop every queued entry the predicate selects (whole-Queue);
        returns (pruned count, dedup keys of pruned Part1 members)."""
        return self._prune_owned(predicate)

    def _prune_owned(self, predicate: Callable[[Dict[str, Any]], bool]) -> Tuple[int, List[str]]:
        """prune body; runs only on the owner thread. A pruned entry's active
        key and Part1 membership are released with it."""
        if not self._heap:
            return 0, []
        kept: List[Tuple[int, int, int, int, Dict[str, Any]]] = []
        pruned = 0
        pruned_part1: List[str] = []
        for entry in self._heap:
            task = entry[-1]
            if not isinstance(task, dict) or not predicate(task):
                kept.append(entry)
                continue
            pruned += 1
            self._active_keys.discard(self._task_key(task))
            if self._dedup_key_of is not None:
                dedup_key = str(self._dedup_key_of(task) or "")
                if dedup_key:
                    self._active_dedup_keys.discard(dedup_key)
                    if dedup_key in self._part1_keys:
                        pruned_part1.append(dedup_key)
                    self._part1_keys.discard(dedup_key)
        if pruned:
            self._heap = kept
            heapq.heapify(self._heap)
            self._part1_count_valid = False
        return pruned, pruned_part1

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
            self._part1_count_valid = False
        return changed

    @serialized_method
    def has_dedup_key(self, dedup_key: str) -> bool:
        """INTERNAL: True when any queued entry carries this canonical dedup key.

        Whole-Queue membership check for Part1 fills: an item whose single
        copy already sits in the queue (either part) must NOT be inserted a
        second time — the existing copy is claimed/re-ranked instead.
        """
        return bool(dedup_key and dedup_key in self._active_dedup_keys)

    @serialized_method
    def take_by_dedup_keys(self, dedup_keys: Set[str]) -> Dict[str, Dict[str, Any]]:
        """Remove queued entries with these canonical keys; return {key: task}.

        Whole-Queue take for an owner that generates the items itself (audio
        orchestration settles its own Part1 fill): the ONE queued copy leaves
        the heap exactly like a pop, so no lane worker can generate it a second
        time. Active keys stay held until ``complete(task)`` — an in-flight
        identity is still deduped against new intake. A Laravel global task
        (no ``_local_source``) is never taken.
        """
        if not dedup_keys or self._dedup_key_of is None or not self._heap:
            return {}
        kept: List[Tuple[int, int, int, int, Dict[str, Any]]] = []
        taken: Dict[str, Dict[str, Any]] = {}
        for entry in self._heap:
            task = entry[-1]
            dedup_key = str(self._dedup_key_of(task) or "") if isinstance(task, dict) else ""
            if dedup_key and dedup_key in dedup_keys and dedup_key not in taken and _locally_owned(task):
                taken[dedup_key] = task
                continue
            kept.append(entry)
        if taken:
            self._heap = kept
            heapq.heapify(self._heap)
            self._part1_count_valid = False
        return taken

    def _smallest(self, count: int) -> List[Tuple[int, int, int, int, Dict[str, Any]]]:
        """INTERNAL: the ``count`` smallest heap entries in pop order.

        Walks the heap tree from the root (O(count log count)) instead of
        scanning or sorting the whole heap.
        """
        result: List[Tuple[int, int, int, int, Dict[str, Any]]] = []
        if not self._heap or count <= 0:
            return result
        frontier: List[Tuple[Tuple[int, int, int, int], int]] = [(self._heap[0][:4], 0)]
        size = len(self._heap)
        while frontier and len(result) < count:
            _order, index = heapq.heappop(frontier)
            result.append(self._heap[index])
            for child in (2 * index + 1, 2 * index + 2):
                if child < size:
                    heapq.heappush(frontier, (self._heap[child][:4], child))
        return result

    @serialized_method
    def head_preview(self, limit: int = 1) -> List[Dict[str, Any]]:
        """Read the current queue head value(s) WITHOUT consuming them."""
        count = max(1, int(limit or 1))
        return [dict(entry[-1]) for entry in self._smallest(count)]

    @serialized_method
    def part_view(self, limit: int = 10) -> Dict[str, Any]:
        """Read-only whole-Queue view with the INTERNAL part split made visible.

        Observability only (Queue Center / orchestration visualization): the
        split is reported, never addressable — every mutation stays
        whole-Queue. Counts are maintained (recomputed once after re-rank
        paths); head previews walk the heap root (Part1 entries always sort
        first), never a full scan per read.
        """
        count = max(1, int(limit or 1))
        if not self._part1_count_valid:
            self._part1_count = sum(1 for entry in self._heap if entry[0] == PART1_RANK)
            self._part1_count_valid = True
        part1 = self._part1_count
        walked_part1 = min(part1, _PART_VIEW_WALK_CAP)
        head = self._smallest(walked_part1 + count)
        return {
            "queued": len(self._heap),
            "part1": part1,
            "part2": len(self._heap) - part1,
            "part1_head": [dict(entry[-1]) for entry in head[:min(part1, count)]],
            "part2_head": (
                [dict(entry[-1]) for entry in head[walked_part1:walked_part1 + count]]
                if walked_part1 == part1 else []
            ),
        }

    @serialized_method
    def export_entries(self) -> List[Tuple[Tuple[int, int, int, int], Dict[str, Any]]]:
        """INTERNAL: ``(order, task copy)`` of every queued entry, unsorted.

        Queue-cache persistence only: the caller sorts by ``order`` off the
        owner thread (pop order already encodes part_rank first), so a large
        backlog snapshot never stalls the drain.
        """
        return [(entry[:4], dict(entry[-1])) for entry in self._heap]

    def __len__(self) -> int:
        return len(self._heap)


__all__ = ["AudioTaskQueue", "PART1_RANK", "PART2_RANK"]
