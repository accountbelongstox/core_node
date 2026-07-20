# -*- coding: utf-8 -*-
"""
Code Sync DEV-side push sender (stdlib only).

The DEV (behind NAT) dials out to each CLIENT peer over an outbound WS and
PUSHES file changes: a full manifest reconcile on every (re)connect, then
incremental deltas. A supervisor thread (outliving individual push threads)
owns persistent per-client state so an offline client resumes the deltas it
missed, and a dead peer is retried with exponential backoff. See sync_ws.py for
the full message-protocol reference.

Stdlib only + codesync siblings (runtime/textnorm/wire_codec/ws_client/watcher);
never pycore/third_party.
"""

import base64
import gzip
import json
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from .runtime import (
    log as ColorPrint, is_shutdown_requested, register_shutdown_handler,
)
from .textnorm import normalize_eol
from .wire_codec import (
    PUSH_TICK, MAX_BATCH_BYTES, MAX_BACKOFF,
    GZIP_LEVEL, GZIP_MIN_BYTES, GZIP_KEEP_RATIO,
    ENCODE_WORKERS, ENCODE_LOOKAHEAD, _fmt_bytes,
)

from pycore.pyutils.codesync.ws_client import WSClient
from pycore.pyutils.codesync.watcher import get_watch_manager



# --------------------------------------------------------------------------- #
# DEV side -- dial each client and push deltas                                #
# --------------------------------------------------------------------------- #
class PushSender:
    """Maintains one outbound WS per client peer; pushes baseline-then-deltas.

    The supervisor owns persistent per-client state that survives an individual
    push thread dying, so an offline client resumes with the deltas it missed:
      * _client_sent[client_id] -> last_sent snapshot {dest_rel: (mtime, hash, abspath)}
      * _client_seen[client_id] -> True once we have ever connected to it
      * _peer_retry[peer_id]    -> {"attempt": int, "next_retry_at": float,
                                    "logged": bool}
    """

    def __init__(self, manager):
        self.m = manager
        self._running = False
        self._threads = {}        # peer_id -> Thread
        self._client_sent = {}    # client_id -> last_sent snapshot
        self._client_seen = {}    # client_id -> bool
        self._peer_retry = {}     # peer_id -> retry state
        self._index_wait_logged = False  # one-shot "waiting for first scan" log
        self._lock = threading.Lock()

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        threading.Thread(target=self._supervisor, daemon=True, name="CodeSync-WsPush").start()
        register_shutdown_handler(self.stop, priority=68, name="code_sync_ws_push")
        ColorPrint.green("[WsPush] Sender supervisor started")

    def stop(self) -> None:
        self._running = False

    def _supervisor(self) -> None:
        """Ensure a live push thread per client peer while we are distributing.

        Respects per-peer backoff: a peer in backoff is not respawned before its
        next_retry_at, so unreachable peers stop spamming the log."""
        while self._running and not is_shutdown_requested():
            try:
                if self.m.is_distributing():
                    # Start the file index scanning AS SOON AS we are distributing -
                    # before any client connects.
                    wm = get_watch_manager()
                    try:
                        wm.start()
                    except Exception:
                        pass
                    # GATE on the initial scan: do NOT connect/push until the index is
                    # ready. Connecting during the first scan of a large tree would
                    # build an empty manifest, hit the abort guard, and churn the
                    # clients (the "link dropped mid-sync (index empty)" loop). Waiting
                    # here makes that race structurally impossible.
                    if not wm.ready():
                        if not self._index_wait_logged:
                            ColorPrint.blue("[WsPush] waiting for the initial file-index "
                                            "scan to finish before connecting to clients…")
                            self._index_wait_logged = True
                    else:
                        if self._index_wait_logged:
                            ColorPrint.green("[WsPush] file index ready; connecting to clients.")
                            self._index_wait_logged = False
                        self_id = self.m.config.machine_id
                        now = time.time()
                        for peer in self.m.config.list_peers():
                            if peer.get("role") != "client" or peer.get("id") == self_id:
                                continue
                            pid = peer.get("id")
                            with self._lock:
                                th = self._threads.get(pid)
                                if th is not None and th.is_alive():
                                    continue
                                retry = self._peer_retry.get(pid)
                                if retry and now < retry.get("next_retry_at", 0):
                                    continue
                                t = threading.Thread(target=self._push_to, args=(peer,),
                                                     daemon=True, name=f"WsPush-{pid}")
                                self._threads[pid] = t
                                t.start()
            except Exception as exc:
                ColorPrint.yellow(f"[WsPush] supervisor error: {exc}")
            for _ in range(6):  # re-check every ~3s
                if not self._running or is_shutdown_requested():
                    return
                time.sleep(0.5)

    # ----- retry/backoff bookkeeping -------------------------------------- #
    def _note_failure(self, peer: dict, exc, mid_sync: bool = False) -> None:
        """Schedule the next retry with exponential backoff; log only the FIRST
        failure of a streak to avoid spam, and surface a 'retrying' phase. Applies
        to BOTH connect failures and mid-sync drops so a flapping link backs off
        instead of hot-looping every supervisor tick."""
        pid = peer.get("id")
        host = peer.get("host")
        port = int(peer.get("port", 59000))
        with self._lock:
            retry = self._peer_retry.setdefault(
                pid, {"attempt": 0, "next_retry_at": 0.0, "logged": False})
            attempt = retry["attempt"]
            # Cap the exponent: an offline peer otherwise grows `attempt` without
            # bound and recomputes an ever-larger 2**attempt every ~30s forever.
            delay = min(MAX_BACKOFF, 2 ** min(attempt, 16))
            retry["next_retry_at"] = time.time() + delay
            retry["attempt"] = min(attempt + 1, 16)
            first = not retry["logged"]
            retry["logged"] = True
        if first:
            what = "link dropped mid-sync" if mid_sync else "unreachable"
            name = peer.get("name") or host
            # Be explicit this is a CODE-SYNC PEER (a remote pycore on its :59000 RPC
            # port) — NOT the Laravel backend (:9000). The two share a host in some
            # deployments; naming the service here avoids mistaking one for the other.
            ColorPrint.yellow(f"[CodeSync WsPush] code-sync peer '{name}' "
                              f"(pycore {host}:{port}) {what} ({exc}); "
                              f"retrying with backoff (next in {delay}s)")
        # Reflect backoff in the UI as a 'retrying' phase for THIS peer's channel
        # (channel = peer id, matching the UI's per-peer lookup).
        try:
            self.m.set_sync_phase("retrying", min(attempt + 1, 16), channel=pid,
                                  name=(peer.get("name") or host), direction="push")
        except Exception:
            pass

    def _note_success(self, peer: dict) -> None:
        """Reset the backoff streak on a successful connect."""
        pid = peer.get("id")
        with self._lock:
            self._peer_retry[pid] = {"attempt": 0, "next_retry_at": 0.0,
                                     "logged": False}

    # ----- one peer connection -------------------------------------------- #
    def _push_to(self, peer: dict) -> None:
        host = peer.get("host")
        port = int(peer.get("port", 59000))
        ws = WSClient(host, port)
        connected = False
        client_id = peer.get("id")
        try:
            ws.connect()
            me = self.m.config.get_self()
            ws.send_text(json.dumps({"type": "hello", "dev_id": self.m.config.machine_id,
                                     "dev_name": me.get("name")}))
            welcome = ws.recv_text()
            if not welcome:
                raise ConnectionError("no welcome from client")
            wj = json.loads(welcome)
            client_id = wj.get("client_id") or peer.get("id")
            # Capability negotiation: only compress on the wire if THIS client
            # advertised it (older clients omit caps -> plain base64, unchanged).
            gzip_ok = bool((wj.get("caps") or {}).get("gzip"))
            connected = True
            self._note_success(peer)

            wm = get_watch_manager()
            wm.start()

            client_name = peer.get("name") or host
            pid = peer.get("id")
            # FULL SYNC on EVERY (re)connect (first connect or after any drop): send
            # the full file manifest, let the client reconcile (fetch what differs;
            # it KEEPS everything else - update-only, no deletes), and rebuild the
            # per-client table from scratch. This bounds drift after an offline
            # window without ever removing client files. Incremental deltas follow.
            gz_note = " (gzip)" if gzip_ok else ""
            ColorPrint.green(f"[WsPush] Connected to {client_name}; running full sync{gz_note}")
            with self._lock:
                self._client_sent.pop(client_id, None)   # clear the per-peer table
            last = self._full_sync(ws, wm, client_id, client_name, pid, gzip_ok)
            with self._lock:
                self._client_sent[client_id] = dict(last)
            ColorPrint.green(f"[WsPush] {client_name} in sync ({len(last)} files); "
                             f"pushing deltas every {PUSH_TICK}s")

            while self._running and self.m.is_distributing() and not is_shutdown_requested():
                last = self._push_deltas(ws, wm, last, client_id, "delta",
                                         client_name, pid=pid, gzip_ok=gzip_ok)
                time.sleep(PUSH_TICK)
                # Keepalive: keeps the NAT/proxy mapping warm during idle ticks and
                # fails fast (-> reconnect) if the link has silently died.
                ws.ping()
        except Exception as exc:
            # Back off on connect failures AND mid-sync drops; last_sent is
            # persisted up to the last ack so the next connect resumes cleanly.
            self._note_failure(peer, exc, mid_sync=connected)
        finally:
            ws.close()
            with self._lock:
                self._threads.pop(peer.get("id"), None)

    # ----- wire transform: read + normalize + compress + encode AHEAD ------- #
    @staticmethod
    def _entry_size(item) -> float:
        """On-disk size of a (dest, (mtime, hash, abspath)) item; unreadable -> inf
        (sorts last). Used to push SMALL files first so source code converges before
        large binary assets hog a slow link."""
        try:
            return os.path.getsize(item[1][2])
        except Exception:
            return float("inf")

    @staticmethod
    def _prepare_entry(item, gzip_ok: bool):
        """Turn one (dest, (mtime, hash, abspath)) into its wire entry: read the
        file, canonicalize text to LF (so the bytes match the watcher hash), gzip
        it when that actually shrinks it, and base64 the result. Returns
        (dest, entry|None, fhash, fsize); entry is None if the file can't be read.
        Compression is per-file and opportunistic: already-compressed blobs
        (png/jpg/zip) don't shrink, so we keep the raw bytes and skip the gzip tag,
        while text/code/config collapse 3-5x BEFORE base64 - the real win for a
        large tree over a slow link."""
        dest, meta = item
        mtime, fhash, abspath = meta
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
        with ThreadPoolExecutor(max_workers=ENCODE_WORKERS,
                                thread_name_prefix="CsEnc") as ex:
            it = iter(items)
            window = []
            for _ in range(ENCODE_LOOKAHEAD):
                try:
                    window.append(ex.submit(self._prepare_entry, next(it), gzip_ok))
                except StopIteration:
                    break
            while window:
                fut = window.pop(0)
                try:
                    window.append(ex.submit(self._prepare_entry, next(it), gzip_ok))
                except StopIteration:
                    pass
                yield fut.result()

    # ----- shared batch streaming (full sync AND delta go through this) ------ #
    def _send_batch(self, ws, entries: list, reason: str, dev_id: str,
                    dev_name: str) -> list:
        """Send one 'batch' frame and read its ack; return the ack's results list.
        Defensive: a missing or MALFORMED ack raises ConnectionError so the caller
        backs off and retries rather than proceeding on a half-spoken protocol."""
        ws.send_text(json.dumps({"type": "batch", "reason": reason,
                                 "dev_id": dev_id, "dev_name": dev_name,
                                 "files": entries}))
        ack = ws.recv_text()
        if not ack:
            raise ConnectionError("no batch_ack")
        try:
            results = (json.loads(ack) or {}).get("results")
        except (ValueError, TypeError):
            raise ConnectionError("malformed batch_ack")
        return results if isinstance(results, list) else []

    def _stream_files(self, ws, items, gzip_ok: bool, *, dev_id, dev_name, channel,
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
            results = self._send_batch(ws, chunk, reason, dev_id, dev_name)
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

    def _full_sync(self, ws, wm, client_id: str, client_name: str, pid: str,
                   gzip_ok: bool = False) -> dict:
        """Full reconcile on (re)connect: send the manifest {rel: hash} of every
        synced file; the client diffs it against its real files and replies with the
        subset it NEEDs (missing or content-differs). Push exactly those in
        size-bounded batches. The client NEVER deletes - files it has that the dev no
        longer lists are kept. Returns the dev's full snapshot, the incremental
        baseline. Only meaningful differences cross the wire, so a reconnect is cheap
        when little changed; convergence is additive (update-only)."""
        snap = wm.snapshot()  # {dest: (mtime, hash, abspath)}
        # Guard against sending an empty manifest. An empty snapshot here almost
        # always means the watcher's first scan of a large tree has not finished yet
        # (NOT "the dev has zero files"). A current (update-only) client keeps its
        # files regardless, but an empty manifest is still WRONG: it makes the client
        # re-confirm nothing, and an OLDER pre-update-only client would treat absent
        # paths as deletions and WIPE itself. Defense-in-depth + correctness: never
        # send it. The watcher swaps its index atomically (never a partial scan), so
        # the only unsafe state is fully empty. The supervisor already gates on
        # wm.ready(), so this is belt-and-suspenders; wait up to 30s (under the
        # client's 120s read timeout) and, if STILL empty, ABORT - the supervisor
        # retries once the index is populated.
        waited = 0.0
        while not snap and waited < 30.0 and self._running and not is_shutdown_requested():
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
        ws.send_text(json.dumps({"type": "manifest", "dev_id": dev_id,
                                 "dev_name": dev_name, "files": manifest}))
        reply = ws.recv_text()
        if not reply:
            raise ConnectionError("no manifest reply")
        try:
            need_raw = (json.loads(reply) or {}).get("need")
        except (ValueError, TypeError):
            raise ConnectionError("malformed manifest reply")
        need = [d for d in (need_raw or []) if d in snap]
        self.m.log_sync("reconnect", "", "full sync",
                        details=f"{len(need)}/{len(manifest)} file(s) to send",
                        peer=peer_label, direction="push")
        if need:
            # SMALL files first: over a slow/flapping link a full sync may not drain a
            # huge tree in one window, so a tiny late-ordered file (e.g. a script)
            # would never arrive before the link drops. Smallest-first lets ALL source
            # code converge quickly; big binaries trail.
            items = [(d, snap[d]) for d in need]
            items.sort(key=self._entry_size)
            self._stream_files(
                ws, items, gzip_ok, dev_id=dev_id, dev_name=dev_name, channel=channel,
                client_name=client_name, peer_label=peer_label, first_reason="full",
                log_reason_for=lambda dest: "full sync",
                on_acked=lambda results: None)  # full sync: baseline is the whole snap
        self.m.set_sync_phase("idle", 0, channel=channel, name=client_name,
                              direction="push")
        return snap

    def _push_deltas(self, ws, wm, last: dict, client_id: str, reason: str,
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
                with self._lock:
                    self._client_sent[client_id] = dict(last)
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
            with self._lock:
                self._client_sent[client_id] = dict(last)

        # "new file" vs "content changed" is decided against `last` AT LOG TIME (before
        # this batch's ack advances it) - each dest is unique, so this stays correct
        # across batches.
        self._stream_files(
            ws, changed, gzip_ok, dev_id=dev_id, dev_name=dev_name, channel=channel,
            client_name=client_name, peer_label=peer_label, first_reason=reason,
            log_reason_for=lambda dest: "new file" if dest not in last else "content changed",
            on_acked=_on_acked)

        self.m.set_sync_phase("idle", 0, channel=channel, name=client_name,
                              direction="push")
        return last
