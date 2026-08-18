# -*- coding: utf-8 -*-
"""
Code Sync DEV-side push sender (stdlib only).

Each DEV opens a persistent SSE reply stream on a reachable CLIENT and sends
file frames over HTTP: a full manifest reconcile on every (re)connect, then
incremental deltas. A supervisor thread (outliving individual push threads)
owns persistent per-client state so an offline client resumes the deltas it
missed, and an offline peer is retried once per minute.

Stdlib only + codesync siblings (runtime/textnorm/wire_codec/http_client/watcher);
never pycore/third_party.
"""

import base64
import gzip
import json
import os
import time
import uuid
from pathlib import Path

from pycore.pyfoundations.network_constants import PYCORE_HTTP_PORT

from pycore.pyutils.codesync.runtime import (
    log as ColorPrint, is_shutdown_requested, register_shutdown_handler,
    THREAD_BUS, init_serialized_owner, serialized_method, start_bus_task,
)
from pycore.pyutils.codesync.textnorm import normalize_eol
from pycore.pyutils.codesync.wire_codec import (
    PUSH_TICK, MAX_BATCH_BYTES, OFFLINE_RETRY_SECONDS,
    FRAME_FULL_SYNC_COMPLETE, FRAME_FULL_SYNC_COMPLETE_ACK,
    GZIP_LEVEL, GZIP_MIN_BYTES, GZIP_KEEP_RATIO,
    ENCODE_WORKERS, ENCODE_LOOKAHEAD, _fmt_bytes,
)

from pycore.pyutils.codesync.http_client import HttpFrameClient
from pycore.pyutils.codesync.watcher import get_watch_manager



# --------------------------------------------------------------------------- #
# DEV side -- dial each client and push deltas                                #
# --------------------------------------------------------------------------- #
class PushSender:
    """Maintains one HTTP/SSE push worker per client peer.

    The supervisor owns persistent per-client state that survives an individual
    push thread dying, so an offline client resumes with the deltas it missed:
      * _client_sent[client_id] -> last_sent shared watcher snapshot
      * _client_seen[client_id] -> True once we have ever connected to it
      * _peer_retry[peer_id]    -> {"attempt": int, "next_retry_at": float}
    """

    def __init__(self, manager):
        self.m = manager
        self._running = False
        self._threads = {}        # peer_id -> Thread
        self._client_sent = {}    # client_id -> last_sent snapshot
        self._client_seen = {}    # client_id -> bool
        self._peer_retry = {}     # peer_id -> retry state
        self._connected_peers = set()
        self._running_signal = f"codesync.push_sender.running.{uuid.uuid4().hex}"
        init_serialized_owner(self, "codesync.push_sender.state", "CodeSyncPushState")
        THREAD_BUS.signal(self._running_signal, False)

    def start(self) -> None:
        if not self._begin_start():
            return
        start_bus_task(self._supervisor, thread_name="CodeSync-HttpPush")
        register_shutdown_handler(self.stop, priority=68, name="code_sync_http_push")
        ColorPrint.green("[HttpPush] Sender supervisor started")

    def stop(self) -> None:
        self._set_running(False)

    @serialized_method
    def _begin_start(self) -> bool:
        if self._running:
            return False
        self._running = True
        THREAD_BUS.signal(self._running_signal, True)
        return True

    @serialized_method
    def _set_running(self, running: bool) -> None:
        self._running = running
        THREAD_BUS.signal(self._running_signal, running)

    def _supervisor(self) -> None:
        """Ensure a live push thread per client peer while we are distributing.

        Respects per-peer backoff: a peer in backoff is not respawned before its
        next_retry_at, so unreachable peers stop spamming the log."""
        while THREAD_BUS.get_signal(self._running_signal, False) and not is_shutdown_requested():
            try:
                if self.m.is_distributing():
                    wm = get_watch_manager()
                    try:
                        wm.start()
                    except Exception:
                        pass
                    if self.m.mesh.wait_ready(timeout=3.0):
                        self_id = self.m.config.machine_id
                        now = time.time()
                        for peer in self.m.mesh.client_targets():
                            if peer.get("role") != "client" or peer.get("id") == self_id:
                                continue
                            self._ensure_peer_worker(peer, now)
            except Exception as exc:
                ColorPrint.yellow(f"[HttpPush] supervisor error: {exc}")
            for _ in range(6):  # re-check every ~3s
                if not THREAD_BUS.get_signal(self._running_signal, False) or is_shutdown_requested():
                    return
                time.sleep(0.5)

    @serialized_method
    def _ensure_peer_worker(self, peer: dict, now: float) -> None:
        peer_id = peer.get("id")
        worker = self._threads.get(peer_id)
        if worker is not None and worker.is_alive():
            return
        retry = self._peer_retry.get(peer_id)
        if retry and now < retry.get("next_retry_at", 0):
            return
        self._threads[peer_id] = start_bus_task(
            self._push_to,
            peer,
            thread_name=f"HttpPush-{peer_id}",
        )

    # ----- retry/backoff bookkeeping -------------------------------------- #
    def _note_failure(self, peer: dict, exc, mid_sync: bool = False) -> None:
        """Schedule and record the fixed one-minute retry for a failed peer.

        This applies to both initial connection failures and mid-sync drops.

        Manager notify runs AFTER the PushSender state write so a deadlocked
        Manager cannot pin this owner's worker."""
        info = self._note_failure_state(peer, exc, mid_sync)
        if not info:
            return
        try:
            self.m.set_sync_phase(
                "retrying", info["attempt"], channel=info["pid"],
                name=info["name"], direction="push",
            )
        except Exception:
            pass
        self.m.log_sync(
            "connection",
            "",
            "SSE unavailable",
            details=info["summary"],
            peer=info["name"],
            direction="push",
        )

    @serialized_method
    def _note_failure_state(self, peer: dict, exc, mid_sync: bool = False):
        pid = peer.get("id")
        host = peer.get("host")
        port = int(peer.get("port", PYCORE_HTTP_PORT))
        retry = self._peer_retry.setdefault(
            pid, {"attempt": 0, "next_retry_at": 0.0})
        attempt = retry["attempt"]
        delay = OFFLINE_RETRY_SECONDS
        retry["next_retry_at"] = time.time() + delay
        retry["attempt"] = min(attempt + 1, 16)
        name = peer.get("name") or host
        what = "link dropped mid-sync" if mid_sync else "unreachable"
        ColorPrint.yellow(f"[CodeSync HttpPush] code-sync peer '{name}' "
                          f"(pycore {host}:{port}) {what} ({exc}); "
                          f"retrying in {int(delay)}s")
        return {
            "pid": pid,
            "name": name,
            "attempt": min(attempt + 1, 16),
            "error": str(exc),
            "summary": self._friendly_connection_error(exc, min(attempt + 1, 16), delay),
        }

    @staticmethod
    def _friendly_connection_error(exc, attempt: int, delay: float) -> str:
        message = str(exc or "")
        lowered = message.lower()
        if "10060" in lowered or "timed out" in lowered or "timeout" in lowered:
            label = "Connection timed out"
        elif "10061" in lowered or "refused" in lowered:
            label = "Connection refused"
        elif "reset" in lowered or "10054" in lowered:
            label = "Connection reset"
        elif "closed" in lowered:
            label = "Connection closed"
        else:
            label = "Connection failed"
        return f"{label}; retry in {int(delay)}s; attempt {int(attempt)}"

    @serialized_method
    def _note_success(self, peer: dict) -> None:
        """Reset retry state on a successful connect."""
        pid = peer.get("id")
        self._peer_retry[pid] = {"attempt": 0, "next_retry_at": 0.0}

    @serialized_method
    def _set_peer_connected(self, peer_id: str, connected: bool) -> None:
        normalized = str(peer_id or "").strip()
        if connected:
            self._connected_peers.add(normalized)
        else:
            self._connected_peers.discard(normalized)

    @serialized_method
    def get_status(self) -> dict:
        now = time.time()
        return {
            "running": self._running,
            "connected_clients": len(self._connected_peers),
            "clients": sorted(self._connected_peers),
            "retrying": {
                peer_id: {
                    "attempt": int(state.get("attempt") or 0),
                    "next_retry_in": max(
                        0,
                        int(float(state.get("next_retry_at") or 0.0) - now),
                    ),
                }
                for peer_id, state in self._peer_retry.items()
                if peer_id not in self._connected_peers
                and float(state.get("next_retry_at") or 0.0) > now
            },
        }

    # ----- one peer connection -------------------------------------------- #
    def _push_to(self, peer: dict) -> None:
        host = peer.get("host")
        port = int(peer.get("port", PYCORE_HTTP_PORT))
        client_id = peer.get("id")
        client = HttpFrameClient(
            host,
            port,
            self.m.config.machine_id,
        )
        connected = False
        try:
            client.connect()
            me = self.m.config.get_self()
            client.send_text(json.dumps({"type": "hello", "dev_id": self.m.config.machine_id,
                                     "dev_name": me.get("name")}))
            welcome = client.recv_text()
            if not welcome:
                raise ConnectionError("no welcome from client")
            wj = json.loads(welcome)
            client_id = wj.get("client_id") or peer.get("id")
            # Capability negotiation: only compress on the wire if THIS client
            # advertised it (older clients omit caps -> plain base64, unchanged).
            caps = wj.get("caps") or {}
            gzip_ok = bool(caps.get("gzip"))
            manifest_gzip_ok = bool(caps.get("manifest_gzip"))
            completion_ok = bool(caps.get("full_sync_complete"))
            connected = True
            self._set_peer_connected(peer.get("id"), True)
            self._note_success(peer)

            wm = get_watch_manager()
            wm.start()

            client_name = peer.get("name") or host
            pid = peer.get("id")
            self.m.set_sync_phase("scanning", 0, channel=pid,
                                  name=client_name, direction="push")
            while not wm.wait_ready(timeout=5.0):
                if (not THREAD_BUS.get_signal(self._running_signal, False)
                        or not self.m.is_distributing()
                        or is_shutdown_requested()):
                    return
                client.ping()
            # FULL SYNC on EVERY (re)connect (first connect or after any drop): send
            # the full file manifest, let the client reconcile (fetch what differs;
            # it KEEPS everything else - update-only, no deletes), and rebuild the
            # per-client table from scratch. This bounds drift after an offline
            # window without ever removing client files. Incremental deltas follow.
            gz_note = " (gzip)" if gzip_ok else ""
            ColorPrint.green(f"[HttpPush] Connected to {client_name}; running full sync{gz_note}")
            self._clear_client_state(client_id)
            last = self._full_sync(
                client,
                wm,
                client_id,
                client_name,
                pid,
                gzip_ok,
                manifest_gzip_ok,
                completion_ok,
            )
            self._store_client_state(client_id, last)
            ColorPrint.green(f"[HttpPush] {client_name} in sync ({len(last)} files); "
                             f"pushing deltas every {PUSH_TICK}s")

            while THREAD_BUS.get_signal(self._running_signal, False) and self.m.is_distributing() and not is_shutdown_requested():
                last = self._push_deltas(client, wm, last, client_id, "delta",
                                         client_name, pid=pid, gzip_ok=gzip_ok)
                time.sleep(PUSH_TICK)
                # Keepalive: keeps the NAT/proxy mapping warm during idle ticks and
                # fails fast (-> reconnect) if the link has silently died.
                client.ping()
        except Exception as exc:
            # Back off on connect failures AND mid-sync drops; last_sent is
            # persisted up to the last ack so the next connect resumes cleanly.
            self._note_failure(peer, exc, mid_sync=connected)
        finally:
            self._set_peer_connected(peer.get("id"), False)
            client.close()
            self._remove_peer_worker(peer.get("id"))

    @serialized_method
    def _clear_client_state(self, client_id: str) -> None:
        self._client_sent.pop(client_id, None)

    @serialized_method
    def _store_client_state(self, client_id: str, snapshot: dict) -> None:
        self._client_sent[client_id] = dict(snapshot)

    @serialized_method
    def _remove_peer_worker(self, peer_id: str) -> None:
        self._threads.pop(peer_id, None)

    # ----- wire transform: read + normalize + compress + encode AHEAD ------- #
    @staticmethod
    def _entry_size(item) -> float:
        """On-disk size of a shared watcher item; unreadable -> inf
        (sorts last). Used to push SMALL files first so source code converges before
        large binary assets hog a slow link."""
        try:
            return float(item[1][3]) if len(item[1]) > 3 else os.path.getsize(item[1][2])
        except Exception:
            return float("inf")

    @staticmethod
    def _prepare_entry(item, gzip_ok: bool):
        """Turn one shared watcher item into its wire entry: read the
        file, canonicalize text to LF (so the bytes match the watcher hash), gzip
        it when that actually shrinks it, and base64 the result. Returns
        (dest, entry|None, fhash, fsize); entry is None if the file can't be read.
        Compression is per-file and opportunistic: already-compressed blobs
        (png/jpg/zip) don't shrink, so we keep the raw bytes and skip the gzip tag,
        while text/code/config collapse 3-5x BEFORE base64 - the real win for a
        large tree over a slow link."""
        dest, meta = item
        mtime, fhash, abspath = meta[:3]
        try:
            content = normalize_eol(Path(abspath).read_bytes())
        except Exception:
            return (dest, None, fhash, 0)
        fsize = len(content)
        payload = content
        enc = None
        if gzip_ok and fsize >= GZIP_MIN_BYTES:
            try:
                gz = gzip.compress(content, compresslevel=GZIP_LEVEL)
                if len(gz) < fsize * GZIP_KEEP_RATIO:
                    payload, enc = gz, "gzip"
            except Exception:
                payload, enc = content, None
        entry = {"rel": dest, "mtime": mtime, "hash": fhash, "size": fsize,
                 "b64": base64.b64encode(payload).decode("ascii")}
        if enc:
            entry["enc"] = enc
        return (dest, entry, fhash, fsize)

    def _encode_ahead(self, items, gzip_ok: bool):
        """Yield prepared wire entries IN ORDER while a small thread pool reads +
        compresses + encodes files AHEAD of the consumer. The pool keeps preparing
        the next ENCODE_LOOKAHEAD files while the consumer is blocked on a
        batch_ack, so disk + CPU overlap the network round-trip instead of running
        strictly between round-trips. zlib and the read both drop the GIL, so the
        workers parallelize for real. Memory is bounded by the look-ahead window."""
        item_iterator = iter(items)
        window = []

        def submit(item) -> None:
            response_signal = f"codesync.push_sender.encode.{uuid.uuid4().hex}"
            start_bus_task(
                self._prepare_entry,
                item,
                gzip_ok,
                thread_name="CodeSync-Encode",
                response_signal=response_signal,
            )
            window.append(response_signal)

        for _ in range(min(ENCODE_WORKERS, ENCODE_LOOKAHEAD)):
            try:
                submit(next(item_iterator))
            except StopIteration:
                break
        while window:
            response_signal = window.pop(0)
            try:
                submit(next(item_iterator))
            except StopIteration:
                pass
            response = THREAD_BUS.wait_signal(response_signal)
            THREAD_BUS.clear_signal(response_signal)
            if not isinstance(response, dict) or not response.get("success"):
                error = response.get("error", "encoding failed") if isinstance(response, dict) else "encoding failed"
                raise RuntimeError(error)
            yield response.get("result")

    # ----- shared batch streaming (full sync AND delta go through this) ------ #
    def _send_batch(self, client, entries: list, reason: str, dev_id: str,
                    dev_name: str) -> list:
        """Send one 'batch' frame and read its ack; return the ack's results list.
        Defensive: a missing or MALFORMED ack raises ConnectionError so the caller
        backs off and retries rather than proceeding on a half-spoken protocol."""
        client.send_text(json.dumps({"type": "batch", "reason": reason,
                                 "dev_id": dev_id, "dev_name": dev_name,
                                 "files": entries}))
        ack = client.recv_text()
        if not ack:
            raise ConnectionError("no batch_ack")
        try:
            results = (json.loads(ack) or {}).get("results")
        except (ValueError, TypeError):
            raise ConnectionError("malformed batch_ack")
        return results if isinstance(results, list) else []

    def _stream_files(self, client, items, gzip_ok: bool, *, dev_id, dev_name, channel,
                      client_name, peer_label, first_reason, log_reason_for, on_acked):
        """The single push path used by BOTH full sync and delta. Reads + encodes the
        ordered `items` ((dest, meta) tuples) AHEAD of the network, packs them into
        size-bounded batches (never splitting one file), sends each batch and reads
        its ack, logs one 'sent' line per file (reason from log_reason_for(dest)),
        updates the 'pushing' phase, and calls on_acked(results) after every batch.
        Wire reason: a 'resume' first-batch marker downgrades to 'delta' for the
        rest; 'full' and 'delta' persist across all batches (matches pre-refactor).
        Returns the number of files actually sent.

        Keeping one implementation here is the consistency guarantee: resume,
        ordering, batching and progress accounting can never drift between the two
        callers again."""
        total = len(items)
        self.m.set_sync_phase("pushing", total, channel=channel, name=client_name,
                              direction="push")
        chunk: list = []          # wire entry dicts for the current batch
        chunk_meta: list = []     # (dest, fhash, fsize) parallel to chunk (for logs)
        chunk_bytes = 0
        reason = first_reason
        remaining = total
        sent = 0

        def flush():
            nonlocal chunk, chunk_meta, chunk_bytes, reason, remaining
            if not chunk:
                return
            for dest, _fhash, fsize in chunk_meta:
                self.m.log_sync("sent", dest, log_reason_for(dest),
                                details=f"{_fmt_bytes(fsize)} -> {peer_label}",
                                size=fsize, peer=peer_label, direction="push")
            results = self._send_batch(client, chunk, reason, dev_id, dev_name)
            on_acked(results)
            remaining -= len(chunk)
            self.m.set_sync_phase("pushing", max(0, remaining), channel=channel,
                                  name=client_name, direction="push")
            chunk, chunk_meta, chunk_bytes = [], [], 0
            # Only the "resume" marker is first-batch-only (it surfaces the reconnect
            # backlog, then becomes "delta"). "full" persists across a full sync and
            # "delta" stays "delta" - matching the pre-refactor wire reason exactly.
            if reason == "resume":
                reason = "delta"

        for dest, entry, fhash, fsize in self._encode_ahead(items, gzip_ok):
            if entry is None:        # unreadable file: skip, but keep counts honest
                remaining -= 1
                continue
            b64len = len(entry["b64"])
            # Flush the pending chunk BEFORE adding this file if it would exceed the
            # cap (chunk non-empty, so a single oversized file is never split).
            if chunk and (chunk_bytes + b64len) > MAX_BATCH_BYTES:
                flush()
            chunk.append(entry)
            chunk_meta.append((dest, fhash, fsize))
            chunk_bytes += b64len
            sent += 1
        flush()
        return sent

    def _full_sync(self, client, wm, client_id: str, client_name: str, pid: str,
                   gzip_ok: bool = False, manifest_gzip_ok: bool = False,
                   completion_ok: bool = False) -> dict:
        """Full reconcile on (re)connect: send the manifest {rel: hash} of every
        synced file; the client diffs it against its real files and replies with the
        subset it NEEDs (missing or content-differs). Push exactly those in
        size-bounded batches. The client NEVER deletes - files it has that the dev no
        longer lists are kept. Returns the dev's full snapshot, the incremental
        baseline. Only meaningful differences cross the wire, so a reconnect is cheap
        when little changed; convergence is additive (update-only)."""
        started_at = time.monotonic()
        snap = wm.snapshot()
        # Guard against sending an empty manifest. An empty snapshot here almost
        # always means the watcher's first scan of a large tree has not finished yet
        # (NOT "the dev has zero files"). A current (update-only) client keeps its
        # files regardless, but an empty manifest is still WRONG: it makes the client
        # re-confirm nothing, and an OLDER pre-update-only client would treat absent
        # paths as deletions and WIPE itself. Defense-in-depth + correctness: never
        # send it. The watcher swaps its index atomically (never a partial scan), so
        # the only unsafe state is fully empty. The supervisor already gates on
        # wm.ready(), so this is belt-and-suspenders; wait up to 30s and, if it is
        # still empty, abort so the supervisor retries after the index is populated.
        waited = 0.0
        while not snap and waited < 30.0 and THREAD_BUS.get_signal(self._running_signal, False) and not is_shutdown_requested():
            time.sleep(0.5)
            waited += 0.5
            snap = wm.snapshot()
        if not snap:
            raise ConnectionError("watcher index empty (first scan not ready); "
                                  "aborting full sync - never send an empty manifest "
                                  "(re-confirms nothing; would wipe a legacy client)")
        me = self.m.config.get_self()
        dev_id = self.m.config.machine_id
        dev_name = me.get("name") or ""
        channel = pid or client_id
        peer_label = client_name or (str(client_id)[:8] if client_id else "")
        manifest = {dest: meta[1] for dest, meta in snap.items()}

        self.m.set_sync_phase("scanning", len(manifest), channel=channel,
                              name=client_name, direction="push")
        manifest_json = json.dumps(manifest, separators=(",", ":")).encode("utf-8")
        manifest_frame = {"type": "manifest", "dev_id": dev_id, "dev_name": dev_name}
        if manifest_gzip_ok:
            manifest_frame["files_gzip"] = base64.b64encode(
                gzip.compress(manifest_json, compresslevel=GZIP_LEVEL)
            ).decode("ascii")
        else:
            manifest_frame["files"] = manifest
        client.send_text(json.dumps(manifest_frame, separators=(",", ":")))
        reply = client.recv_text()
        if not reply:
            raise ConnectionError("no manifest reply")
        try:
            need_raw = (json.loads(reply) or {}).get("need")
        except (ValueError, TypeError):
            raise ConnectionError("malformed manifest reply")
        need = [d for d in (need_raw or []) if d in snap]
        self.m.log_sync("reconnect", "", "full diff started",
                        details=f"{len(need)}/{len(manifest)} file(s) differ",
                        peer=peer_label, direction="push")
        full_results = []
        if need:
            # SMALL files first: over a slow/flapping link a full sync may not drain a
            # huge tree in one window, so a tiny late-ordered file (e.g. a script)
            # would never arrive before the link drops. Smallest-first lets ALL source
            # code converge quickly; big binaries trail.
            items = [(d, snap[d]) for d in need]
            items.sort(key=self._entry_size)
            self._stream_files(
                client, items, gzip_ok, dev_id=dev_id, dev_name=dev_name, channel=channel,
                client_name=client_name, peer_label=peer_label, first_reason="full",
                log_reason_for=lambda dest: "full sync",
                on_acked=full_results.extend)
        result_counts = {"written": 0, "skipped": 0, "error": 0}
        for result in full_results:
            status = str(result.get("status") or "error")
            result_counts[status if status in result_counts else "error"] += 1
        completion = {
            "type": FRAME_FULL_SYNC_COMPLETE,
            "dev_id": dev_id,
            "dev_name": dev_name,
            "manifest": len(manifest),
            "different": len(need),
            "written": result_counts["written"],
            "skipped": result_counts["skipped"],
            "errors": result_counts["error"],
        }
        if completion_ok:
            client.send_text(json.dumps(completion))
            completion_reply = client.recv_text()
            try:
                completion_type = (json.loads(completion_reply or "") or {}).get("type")
            except (TypeError, ValueError):
                completion_type = ""
            if completion_type != FRAME_FULL_SYNC_COMPLETE_ACK:
                raise ConnectionError("no full_sync_complete_ack")
        self.m.log_sync(
            "reconcile",
            "",
            "full diff complete",
            details=(f"{len(manifest)} compared, {len(need)} differed, "
                     f"{result_counts['written']} written, "
                     f"{result_counts['skipped']} skipped, "
                     f"{result_counts['error']} error(s); "
                     f"{time.monotonic() - started_at:.1f}s"),
            peer=peer_label,
            direction="push",
        )
        self.m.set_sync_phase("idle", 0, channel=channel, name=client_name,
                              direction="push")
        return snap

    def _push_deltas(self, client, wm, last: dict, client_id: str, reason: str,
                     client_name: str = "", pid: str = "", gzip_ok: bool = False) -> dict:
        """Diff the shared watcher index against what we last acked for this client;
        push new/modified files in size-bounded BATCHES (one batch_ack round-trip per
        chunk). NEVER propagates deletions - a file removed/excluded on the dev is
        just dropped from our tracking; the update-only client keeps its copy.
        Persists the advancing last_sent into supervisor-owned state after every
        successful batch so a mid-sync disconnect resumes from the last ack.

        Returns the updated 'last' snapshot."""
        cur = wm.snapshot()
        changed = [(dest, meta) for dest, meta in cur.items()
                   if dest not in last or last[dest][1] != meta[1]]  # new or hash changed
        changed.sort(key=self._entry_size)  # small files first (same rationale as full sync)
        # A path we previously sent that is gone from the watcher index (deleted OR
        # newly excluded on the dev) is simply DROPPED from our own tracking - we do
        # NOT propagate a delete. The client is UPDATE-ONLY: it keeps its local files
        # so its code stays runnable, and the two ends are never forced identical.
        pruned = False
        for d in list(last):
            if d not in cur:
                last.pop(d, None)
                pruned = True
        if not changed:
            if pruned:
                self._store_client_state(client_id, last)
            return last

        queued = len(changed)
        # Identity stamped on every wire message so the receiver can attribute the
        # phase/log per source dev-end; channel = peer id (matches the UI lookup).
        me = self.m.config.get_self()
        dev_id = self.m.config.machine_id
        dev_name = me.get("name") or ""
        channel = pid or client_id
        peer_label = client_name or (str(client_id)[:8] if client_id else "")
        # 'resume' surfaces the offline-accumulated backlog before we start pushing.
        if reason == "resume":
            self.m.log_sync("reconnect", "", "resumed after reconnect",
                            details=f"{queued} change(s) queued",
                            peer=peer_label, direction="push")

        def _on_acked(results):
            # Advance last_sent only for files the client confirmed written/skipped,
            # then persist so a mid-sync drop resumes from exactly here.
            for r in results:
                rel = r.get("rel")
                if r.get("status") in ("written", "skipped") and rel in cur:
                    last[rel] = cur[rel]
            self._store_client_state(client_id, last)

        # "new file" vs "content changed" is decided against `last` AT LOG TIME (before
        # this batch's ack advances it) - each dest is unique, so this stays correct
        # across batches.
        self._stream_files(
            client, changed, gzip_ok, dev_id=dev_id, dev_name=dev_name, channel=channel,
            client_name=client_name, peer_label=peer_label, first_reason=reason,
            log_reason_for=lambda dest: "new file" if dest not in last else "content changed",
            on_acked=_on_acked)

        self.m.set_sync_phase("idle", 0, channel=channel, name=client_name,
                              direction="push")
        return last
