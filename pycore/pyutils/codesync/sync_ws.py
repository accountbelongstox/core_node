# -*- coding: utf-8 -*-
"""
Code Sync WebSocket push channel (stdlib only).

Direction (per the topology): the DEV is behind NAT and CANNOT be reached, so the
**clients are the WS servers** and the **dev dials out** to each of them and PUSHES
file changes. This flips the old HTTP pull model (client->dev), which NAT blocked.

  * PushSender   (DEV side)    -- for each client peer, open an outbound WS
    (ws_client). The supervisor (which OUTLIVES individual push threads) owns a
    persistent per-client state dict so a client that was offline still receives
    files that changed while it was gone (resume), and a dead peer is retried with
    exponential backoff instead of being respawned every few seconds.
  * PushReceiver (CLIENT side) -- handle pushed messages on a WS the client accepted
    (the stdlib http_server upgrade / FastAPI WS calls handle_text): write the files
    under the watched root, SKIP if the hash already matches, log + phase.

Message protocol (JSON text frames):
  dev->client  {"type":"hello","dev_id","dev_name"}
  client->dev  {"type":"welcome","client_id","name"}

  BATCHED (current):
  dev->client  {"type":"batch","reason":"delta"|"resume","dev_id","dev_name","files":[
                   {"rel","mtime","hash","size","b64"},          # create / modify
                   {"rel","deleted":true}, ...]}                 # propagated delete
  client->dev  {"type":"batch_ack","results":[
                   {"rel","status":"written"|"skipped"|"deleted"|"error",
                    "diff":<int>,"size":<int>,"error"?:<str>}, ...]}

  LEGACY (kept for back-compat with older peers):
  dev->client  {"type":"file","rel","mtime","hash","b64"}
  client->dev  {"type":"ack","rel","status":"written"|"skipped"|"error"}
  dev->client  {"type":"batch_done","count"}
"""

import base64
import hashlib
import json
import os
import threading
import time
from pathlib import Path

from .runtime import (
    log as ColorPrint, is_shutdown_requested, register_shutdown_handler,
)

PUSH_TICK = 1.0          # seconds between incremental delta pushes
MAX_BATCH_BYTES = 8 * 1024 * 1024  # ~8 MB cap on accumulated base64 payload per batch
MAX_BACKOFF = 30         # seconds; backoff is min(MAX_BACKOFF, 2**attempt)


# --------------------------------------------------------------------------- #
# Shared helpers                                                              #
# --------------------------------------------------------------------------- #
def _fmt_bytes(n: int) -> str:
    """Human-readable byte size (B / KB / MB), stdlib only."""
    try:
        n = float(n)
    except Exception:
        return "0 B"
    if n < 1024:
        return f"{int(n)} B"
    if n < 1024 * 1024:
        return f"{n / 1024:.1f} KB"
    return f"{n / (1024 * 1024):.1f} MB"


def _fmt_diff(diff: int) -> str:
    """Signed byte delta as e.g. '+340 B' / '-1.2 KB' / '0 B'."""
    sign = "+" if diff > 0 else ("-" if diff < 0 else "")
    return f"{sign}{_fmt_bytes(abs(int(diff)))}"


# --------------------------------------------------------------------------- #
# CLIENT side -- apply pushed files                                           #
# --------------------------------------------------------------------------- #
class PushReceiver:
    """Stateless-ish handler the WS server endpoint feeds each text frame."""

    def __init__(self, manager):
        self.m = manager

    def handle_text(self, text: str, send) -> bool:
        """Process one frame; `send(str)` replies on the same socket. Returns False
        to signal the connection should close."""
        try:
            msg = json.loads(text)
        except Exception:
            return True
        t = msg.get("type")
        if t == "hello":
            me = self.m.config.get_self()
            send(json.dumps({"type": "welcome", "client_id": self.m.config.machine_id,
                             "name": me.get("name")}))
        elif t == "batch":
            self._apply_batch(msg, send)
        elif t == "file":  # legacy single-file frame
            # dev_id/dev_name carried on the frame attribute the channel per source
            # (handle_text is stateless and shared, so we read identity from the msg).
            dev_id = msg.get("dev_id") or "_local"
            dev_name = msg.get("dev_name") or ""
            peer = dev_name or (str(dev_id)[:8] if dev_id else "")
            res = self._apply_one(msg, peer=peer)
            send(json.dumps({"type": "ack", "rel": res["rel"], "status": res["status"],
                             **({"error": res["error"]} if res.get("error") else {})}))
            self.m.set_sync_phase("idle", 0, channel=dev_id, name=dev_name,
                                  direction="receive")
        elif t == "batch_done":  # legacy end-of-batch marker
            dev_id = msg.get("dev_id") or "_local"
            self.m.set_sync_phase("idle", 0, channel=dev_id,
                                  name=msg.get("dev_name") or "", direction="receive")
        return True

    def _apply_batch(self, msg: dict, send) -> None:
        files = msg.get("files") or []
        # Identity is carried in the message because this handler is stateless and
        # shared across connections; attribute the phase + logs to this dev source.
        dev_id = msg.get("dev_id") or "_local"
        dev_name = msg.get("dev_name") or ""
        peer = dev_name or (str(dev_id)[:8] if dev_id else "")
        self.m.set_sync_phase("receiving", len(files), channel=dev_id,
                              name=dev_name, direction="receive")
        results = []
        for f in files:
            results.append(self._apply_one(f, peer=peer))
        send(json.dumps({"type": "batch_ack", "results": results}))
        self.m.set_sync_phase("idle", 0, channel=dev_id, name=dev_name,
                              direction="receive")

    def _apply_one(self, msg: dict, peer: str = "") -> dict:
        """Apply one pushed file (or deletion); return a result row for the ack.

        Result fields: rel, status (written|skipped|deleted|error), diff (signed
        byte delta new_size - old_size), size (new content size), error on failure.
        """
        rel = msg.get("rel")
        deleted = bool(msg.get("deleted"))
        b64 = msg.get("b64")
        result = {"rel": rel, "status": "error", "diff": 0, "size": 0}
        if not rel or (b64 is None and not deleted):
            result["error"] = "missing rel/b64"
            return result
        rel = str(rel).replace("\\", "/")
        result["rel"] = rel
        # Contain every write/delete strictly under the sync root: reject path
        # traversal ("../") and absolute rels that would escape it (resolve() also
        # collapses parent symlinks, closing that traversal vector too).
        root = self.m.sync_target_root().resolve()
        try:
            target = (root / rel).resolve()
        except Exception:
            result["error"] = "bad path"
            return result
        if target != root and root not in target.parents:
            result["error"] = "path escapes sync root"
            self.m.log_sync("error", rel, "rejected: path escapes sync root",
                            details="blocked", peer=peer, direction="receive")
            return result
        try:
            if deleted:
                # Only files the dev previously pushed reach here (sender diffs its
                # own last_sent), and the path is contained above — so we never
                # remove a client-local file.
                if target.exists() and not target.is_dir():
                    old_size = target.stat().st_size
                    target.unlink()
                    result["status"] = "deleted"
                    result["diff"] = -old_size
                    self.m.log_sync("deleted", rel, "removed on dev",
                                    details=_fmt_bytes(old_size), size=0,
                                    diff=-old_size, peer=peer, direction="receive")
                else:
                    result["status"] = "skipped"
                    self.m.log_sync("skipped", rel, "already absent",
                                    peer=peer, direction="receive")
                return result
            content = base64.b64decode(b64)
            new_size = len(content)
            old_size = target.stat().st_size if target.exists() else 0
            diff = new_size - old_size
            result["size"] = new_size
            result["diff"] = diff
            details = f"{_fmt_bytes(new_size)} (delta {_fmt_diff(diff)})"
            if target.exists():
                cur = hashlib.md5(target.read_bytes()).hexdigest()
                if cur == msg.get("hash"):
                    result["status"] = "skipped"
                    result["diff"] = 0
                    self.m.log_sync("skipped", rel, "up-to-date",
                                    details=f"{_fmt_bytes(new_size)} (delta +0 B)",
                                    size=new_size, diff=0, peer=peer,
                                    direction="receive")
                    return result
                reason = "content changed"
            else:
                reason = "new file"
            target.parent.mkdir(parents=True, exist_ok=True)
            tmp = target.with_suffix(target.suffix + ".cs_tmp")
            try:
                tmp.write_bytes(content)
                os.replace(str(tmp), str(target))
            except Exception:
                # Don't leak the half-written temp file on a failed replace.
                try:
                    tmp.unlink()
                except Exception:
                    pass
                raise
            mtime = msg.get("mtime")
            if mtime:
                try:
                    os.utime(target, (mtime, mtime))
                except Exception:
                    pass
            result["status"] = "written"
            self.m.log_sync("received", rel, reason, details=details,
                            size=new_size, diff=diff, peer=peer,
                            direction="receive")
            return result
        except Exception as exc:
            result["status"] = "error"
            result["error"] = str(exc)
            self.m.log_sync("error", rel, str(exc),
                            details=str(exc), size=result.get("size", 0),
                            diff=result.get("diff", 0), peer=peer,
                            direction="receive")
            return result


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
    def _note_failure(self, peer: dict, exc) -> None:
        """Schedule the next retry with exponential backoff; log only the FIRST
        failure of a streak to avoid spam, and surface a 'retrying' phase."""
        pid = peer.get("id")
        host = peer.get("host")
        port = int(peer.get("port", 59000))
        with self._lock:
            retry = self._peer_retry.setdefault(
                pid, {"attempt": 0, "next_retry_at": 0.0, "logged": False})
            attempt = retry["attempt"]
            delay = min(MAX_BACKOFF, 2 ** attempt)
            retry["next_retry_at"] = time.time() + delay
            retry["attempt"] = attempt + 1
            first = not retry["logged"]
            retry["logged"] = True
        if first:
            ColorPrint.yellow(f"[WsPush] {host}:{port} unreachable ({exc}); "
                              f"retrying with backoff (next in {delay}s)")
        # Reflect backoff in the UI as a 'retrying' phase for THIS peer's channel
        # (attempt is the count).
        try:
            self.m.set_sync_phase("retrying", attempt + 1, channel=pid,
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
        from .ws_client import WSClient
        from .watcher import get_watch_manager
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
            client_id = (json.loads(welcome).get("client_id")) or peer.get("id")
            connected = True
            self._note_success(peer)

            wm = get_watch_manager()
            wm.start()

            # Decide the diff base + first-push reason:
            #   * never seen  -> baseline = current tree (NO bulk send), reason "delta"
            #   * seen before -> reuse stored last_sent (resume offline deltas),
            #                    first push uses reason "resume"
            with self._lock:
                seen = self._client_seen.get(client_id, False)
                if seen:
                    last = dict(self._client_sent.get(client_id, {}))
                else:
                    last = wm.snapshot()
                    self._client_sent[client_id] = dict(last)
                    self._client_seen[client_id] = True
            first_reason = "resume" if seen else "delta"

            if seen:
                ColorPrint.green(f"[WsPush] Reconnected to {peer.get('name') or host}; "
                                 f"resuming from {len(last)} acked files")
            else:
                ColorPrint.green(f"[WsPush] Connected to {peer.get('name') or host} "
                                 f"(baseline {len(last)} files); pushing deltas every "
                                 f"{PUSH_TICK}s")

            client_name = peer.get("name") or host
            reason = first_reason
            while self._running and self.m.is_distributing() and not is_shutdown_requested():
                last = self._push_deltas(ws, wm, last, client_id, reason, client_name)
                reason = "delta"  # only the first push after (re)connect is special
                time.sleep(PUSH_TICK)
        except Exception as exc:
            if not connected:
                self._note_failure(peer, exc)
            else:
                # A mid-sync disconnect after a good connect: stay quiet (last_sent
                # is persisted up to the last ack, so we resume on the next connect).
                ColorPrint.yellow(f"[WsPush] {host}:{port} link dropped mid-sync: {exc}")
        finally:
            ws.close()
            with self._lock:
                self._threads.pop(peer.get("id"), None)

    def _push_deltas(self, ws, wm, last: dict, client_id: str, reason: str,
                     client_name: str = "") -> dict:
        """Diff the shared watcher index against what we last acked for this client;
        push new/modified files in size-bounded BATCHES (one batch_ack round-trip per
        chunk). Persists the advancing last_sent into supervisor-owned state after
        every successful batch so a mid-sync disconnect resumes from the last ack.

        Returns the updated 'last' snapshot."""
        cur = wm.snapshot()
        changed = [(dest, meta) for dest, meta in cur.items()
                   if dest not in last or last[dest][1] != meta[1]]  # new or hash changed
        if not changed:
            return last

        queued = len(changed)
        # Identity stamped on every wire message so the receiver can attribute the
        # phase/log per source dev-end; also used here for the dev-side channel.
        me = self.m.config.get_self()
        dev_id = self.m.config.machine_id
        dev_name = me.get("name") or ""
        peer_label = client_name or (str(client_id)[:8] if client_id else "")
        # 'resume' surfaces the offline-accumulated backlog before we start pushing.
        if reason == "resume":
            self.m.log_sync("reconnect", "", "resumed after reconnect",
                            details=f"{queued} file(s) queued",
                            peer=peer_label, direction="push")
        self.m.set_sync_phase("pushing", queued, channel=client_id,
                              name=client_name, direction="push")

        # Split into chunks bounded by cumulative base64 payload size; never split a
        # single file across batches.
        chunk = []
        chunk_bytes = 0
        chunk_reason = reason  # the first chunk carries 'resume'/'delta'
        remaining = queued

        def flush_chunk(files, batch_reason, files_meta):
            """Send one 'batch', read one 'batch_ack', advance last_sent for acked
            files, and emit per-file logs. Returns the number of files in flight."""
            ws.send_text(json.dumps({"type": "batch", "reason": batch_reason,
                                     "dev_id": dev_id, "dev_name": dev_name,
                                     "files": files}))
            for fm in files_meta:
                dest, fhash, fsize = fm
                self.m.log_sync(
                    "sent", dest,
                    "new file" if dest not in last else "content changed",
                    details=f"{_fmt_bytes(fsize)} -> {client_id[:8]}",
                    size=fsize, peer=peer_label, direction="push")
            ack = ws.recv_text()
            if not ack:
                raise ConnectionError("no batch_ack")
            results = (json.loads(ack).get("results")) or []
            # Advance last_sent only for files the client confirmed written/skipped.
            for r in results:
                rel = r.get("rel")
                status = r.get("status")
                if status in ("written", "skipped") and rel in cur:
                    last[rel] = cur[rel]
            with self._lock:
                self._client_sent[client_id] = dict(last)

        for dest, (mtime, fhash, abspath) in changed:
            try:
                content = Path(abspath).read_bytes()
            except Exception:
                remaining -= 1
                continue
            b64 = base64.b64encode(content).decode("ascii")
            fsize = len(content)
            entry = {"rel": dest, "mtime": mtime, "hash": fhash,
                     "size": fsize, "b64": b64}
            # Flush before adding if this file would push us over the cap (and the
            # chunk is non-empty, so we never split a single file).
            if chunk and (chunk_bytes + len(b64)) > MAX_BATCH_BYTES:
                flush_chunk([c[0] for c in chunk], chunk_reason, [c[1] for c in chunk])
                remaining -= len(chunk)
                self.m.set_sync_phase("pushing", remaining, channel=client_id,
                                      name=client_name, direction="push")
                chunk = []
                chunk_bytes = 0
                chunk_reason = "delta"  # only the first chunk keeps 'resume'
            chunk.append((entry, (dest, fhash, fsize)))
            chunk_bytes += len(b64)

        if chunk:
            flush_chunk([c[0] for c in chunk], chunk_reason, [c[1] for c in chunk])

        self.m.set_sync_phase("idle", 0, channel=client_id, name=client_name,
                              direction="push")
        return last
