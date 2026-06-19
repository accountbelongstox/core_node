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
                   {"rel","mtime","hash","size","b64"[, "enc":"gzip"]}, ...]}  # create / modify
  client->dev  {"type":"batch_ack","results":[
                   {"rel","status":"written"|"skipped"|"error",
                    "diff":<int>,"size":<int>,"error"?:<str>}, ...]}

  UPDATE-ONLY: the dev no longer sends deletes and the client NEVER removes local
  files. A legacy `{"rel","deleted":true}` entry from an older dev is acked +
  ignored (status "skipped"), so the client keeps everything it has.

  LEGACY (kept for back-compat with older peers):
  dev->client  {"type":"file","rel","mtime","hash","b64"}
  client->dev  {"type":"ack","rel","status":"written"|"skipped"|"error"}
  dev->client  {"type":"batch_done","count"}
"""

import base64
import gzip
import hashlib
import json
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from .runtime import (
    log as ColorPrint, is_shutdown_requested, register_shutdown_handler,
)
from .textnorm import normalize_eol, normalized_md5

PUSH_TICK = 1.0          # seconds between incremental delta pushes
# Cap on accumulated base64 payload per batch. The client persists its
# received-table after EVERY batch ack, so a SMALLER batch = progress saved more
# often = a flapping/intermittent link converges (each brief window delivers and
# keeps more files, instead of losing a big in-flight batch). 3 MB balances that
# against per-batch round-trip overhead (gzip already packs more files per byte).
MAX_BATCH_BYTES = 3 * 1024 * 1024
MAX_BACKOFF = 30         # seconds; backoff is min(MAX_BACKOFF, 2**attempt)

# --- wire transform tuning (the per-file read+compress+encode pipeline) ----- #
GZIP_LEVEL = 6           # zlib level for compressible files (text/code/config)
GZIP_MIN_BYTES = 256     # don't bother compressing tiny files (header overhead)
GZIP_KEEP_RATIO = 0.92   # only ship gzip if it shrinks the file by >8% (else raw)
ENCODE_WORKERS = 4       # threads that read+normalize+gzip+b64 AHEAD of the network
ENCODE_LOOKAHEAD = 12    # max files prepared ahead of the consumer (bounds memory)


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


# Shell/script extensions that should be executable on Linux/macOS.
_EXEC_EXTS = (".sh", ".bash", ".zsh", ".ksh", ".command")


def _restore_exec_bit(target, content: bytes) -> None:
    """Linux/macOS only: a file received over Code Sync is written fresh, so its
    executable bit is lost. Restore +x for shell scripts (by extension) and for
    any file beginning with a shebang ('#!'), so it can be run directly. The exec
    bit is added only where the read bit is already set (mirrors `chmod +x`'s
    umask-respecting behavior); no-op on Windows."""
    if os.name != "posix":
        return
    name = target.name.lower()
    is_exec = name.endswith(_EXEC_EXTS) or content[:2] == b"#!"
    if not is_exec:
        return
    try:
        mode = os.stat(target).st_mode
        new_mode = mode | ((mode & 0o444) >> 2)  # r -> x for each of u/g/o
        if new_mode != mode:
            os.chmod(target, new_mode)
    except Exception:
        pass


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
        # Skip-update: a client may temporarily reject pushed code. Honor it at the
        # receiver (there is no outbound puller to stop). Control frames still flow.
        if t in ("manifest", "batch", "file") and self.m.is_skip_update():
            if t == "manifest":
                send(json.dumps({"type": "need", "need": [], "skipped": True}))
            return True
        if t == "hello":
            me = self.m.config.get_self()
            # Advertise the wire capabilities we understand so the dev can compress
            # payloads. Older devs ignore `caps` and keep sending plain base64.
            send(json.dumps({"type": "welcome", "client_id": self.m.config.machine_id,
                             "name": me.get("name"), "caps": {"gzip": True}}))
        elif t == "manifest":
            self._handle_manifest(msg, send)
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
        received = self._load_received()
        results = []
        for f in files:
            r = self._apply_one(f, peer=peer)
            results.append(r)
            rel = r.get("rel")
            if rel:
                # Keep the small received-table accurate for the next full-sync diff.
                # Update-only: a written/skipped real file records its hash; a delete
                # entry is IGNORED (file kept), so we never drop it from the table.
                if r.get("status") in ("written", "skipped") and not f.get("deleted"):
                    received[rel] = f.get("hash")
        self._save_received(received)
        send(json.dumps({"type": "batch_ack", "results": results}))
        self.m.set_sync_phase("idle", 0, channel=dev_id, name=dev_name,
                              direction="receive")

    # ----- full-sync manifest (sent by the dev on every (re)connect) -------- #
    def _received_table_path(self) -> Path:
        return (self.m.sync_target_root() / ".data" / "pycore" / "codesync"
                / "received_files.json")

    def _load_received(self) -> dict:
        """The client's SMALL per-sync table {rel: hash} of files it has received,
        used to scope full-sync deletions to ONLY codesync-delivered files (never a
        client-local file) and to speed up the manifest compare."""
        try:
            p = self._received_table_path()
            if p.exists():
                data = json.loads(p.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    return data
        except Exception:
            pass
        return {}

    def _save_received(self, table: dict) -> None:
        try:
            p = self._received_table_path()
            p.parent.mkdir(parents=True, exist_ok=True)
            tmp = p.with_suffix(".json.tmp")
            tmp.write_text(json.dumps(table), encoding="utf-8")
            os.replace(str(tmp), str(p))
        except Exception:
            pass

    def _handle_manifest(self, msg: dict, send) -> None:
        """A dev sends its FULL file table {rel: canonical_hash} on first connect and
        on every reconnect (the real-time full-update diff). We compare it against our
        real on-disk files and reply with the list we still NEED — missing files, or
        files whose content hash differs (a MEANINGFUL update). We NEVER delete: a
        file we have that the dev no longer lists is KEPT (it may be a dev-only env
        difference, an excluded artifact, or something the client still needs to run).
        So the client only ever gains/refreshes files, never loses them."""
        files = msg.get("files") or {}
        dev_id = msg.get("dev_id") or "_local"
        dev_name = msg.get("dev_name") or ""
        peer = dev_name or (str(dev_id)[:8] if dev_id else "")
        root = self.m.sync_target_root().resolve()
        received = self._load_received()
        need = []
        hashed = 0
        # Build the NEW table from only files we can confirm are present+correct now.
        # Needed files are NOT recorded here — _apply_batch records each as it is
        # actually written, so an interrupted transfer can't leave the table claiming
        # a file the client never received (which would wrongly fast-skip it forever).
        new_table = {}
        for rel, h in files.items():
            srel = str(rel).replace("\\", "/")
            try:
                target = (root / srel).resolve()
            except Exception:
                continue
            if target != root and root not in target.parents:
                continue  # never request/accept a path outside the sync root
            if not target.exists():
                need.append(srel)
                continue
            have = received.get(srel)
            if have == h:
                new_table[srel] = h  # FAST path: table says up-to-date (no re-read)
                continue
            if have is None:
                # Untracked (first sync / a pre-existing tree e.g. fresh git clone):
                # confirm against the real file ONCE so we don't re-fetch what's
                # already on disk. Tracked-but-different always needs fetching.
                try:
                    if normalized_md5(target.read_bytes()) == h:
                        hashed += 1
                        new_table[srel] = h
                        continue
                except Exception:
                    pass
                hashed += 1
            need.append(srel)
        # UPDATE-ONLY: the client NEVER deletes. A file we have that is absent from
        # the dev manifest (removed/excluded on the dev, or a dev-only env file) is
        # KEPT. We just retain it in our fast-skip table (when still on disk) so a
        # transient/empty/partial manifest can never make us drop or re-fetch it.
        for rel, h in received.items():
            if rel in new_table or rel in files:
                continue
            srel = str(rel).replace("\\", "/")
            try:
                target = (root / srel).resolve()
            except Exception:
                continue
            if (target == root or root in target.parents) and target.exists():
                new_table[rel] = h
        # Persist the confirmed-present files; needed ones are added by _apply_batch
        # as they are actually written.
        self._save_received(new_table)
        if need:
            self.m.log_sync("reconnect", "", "full sync",
                            details=f"{len(need)} to fetch, "
                                    f"{len(files) - len(need)} up-to-date "
                                    f"({hashed} re-hashed); update-only, 0 deleted",
                            peer=peer, direction="receive")
        send(json.dumps({"type": "need", "need": need}))

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
                # UPDATE-ONLY client: NEVER remove a local file, even when the dev
                # reports it deleted on its side. The client keeps every file it has
                # so its own code stays runnable; the two ends are deliberately NOT
                # forced byte-identical. Ack as "skipped" so the dev can still advance
                # its bookkeeping. (Newer devs don't send deletes at all; this guard
                # keeps older devs safe too.)
                result["status"] = "skipped"
                self.m.log_sync("skipped", rel, "delete ignored (client is update-only)",
                                peer=peer, direction="receive")
                return result
            content = base64.b64decode(b64)
            # `enc` marks a compressed payload (capability-negotiated in welcome);
            # absent/unknown -> raw bytes, so legacy frames keep working unchanged.
            if msg.get("enc") == "gzip":
                content = gzip.decompress(content)
            new_size = len(content)
            old_size = target.stat().st_size if target.exists() else 0
            diff = new_size - old_size
            result["size"] = new_size
            result["diff"] = diff
            details = f"{_fmt_bytes(new_size)} (delta {_fmt_diff(diff)})"
            if target.exists():
                # Compare on the canonical (LF) form so a local CRLF copy is seen
                # as up-to-date (no rewrite loop), matching the sender's hash.
                cur = normalized_md5(target.read_bytes())
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
            # The exec bit is lost in transfer (a fresh file is written), so on
            # Linux/macOS restore +x for shell scripts and any shebang file so
            # `./x.sh` works, not just `bash x.sh`.
            _restore_exec_bit(target, content)
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
                    # Start the file index scanning AS SOON AS we are distributing —
                    # BEFORE any client connects — so a large first scan is already
                    # done by the time _full_sync needs the manifest. Otherwise the
                    # watcher would only start on the first connection and the manifest
                    # could be sent empty (which the client reads as "delete all").
                    try:
                        from .watcher import get_watch_manager
                        get_watch_manager().start()
                    except Exception:
                        pass
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
            ColorPrint.yellow(f"[WsPush] {host}:{port} {what} ({exc}); "
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
            # the full file manifest, let the client reconcile (fetch what differs,
            # delete what's gone), and rebuild the per-client table from scratch.
            # This bounds drift after an offline window. Incremental deltas follow.
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
        while text/code/config collapse 3-5x BEFORE base64 — the real win for a
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

    def _full_sync(self, ws, wm, client_id: str, client_name: str, pid: str,
                   gzip_ok: bool = False) -> dict:
        """Full reconcile on (re)connect: send the manifest {rel: hash} of every
        synced file; the client diffs it against its real files and replies with the
        subset it NEEDs (missing or content-differs). Push exactly those in
        size-bounded batches. The client NEVER deletes — files it has that the dev no
        longer lists are kept. Returns the dev's full snapshot, the incremental
        baseline. Only meaningful differences cross the wire, so a reconnect is cheap
        when little changed; convergence is additive (update-only)."""
        snap = wm.snapshot()  # {dest: (mtime, hash, abspath)}
        # Guard a DESTRUCTIVE empty manifest. An empty snapshot here almost always
        # means the watcher's first scan of a large tree has not finished yet (NOT
        # "the dev has zero files"). The client treats any path absent from the
        # manifest as "deleted on the dev", so sending an empty/partial manifest
        # makes it WIPE every file it received. The watcher swaps its index
        # atomically (never a partial scan), so the only unsafe state is fully
        # empty. Wait up to 30s (kept under the client's 120s read timeout); if it
        # is STILL empty, ABORT this sync rather than send an empty manifest — the
        # supervisor retries once the index is populated.
        waited = 0.0
        while not snap and waited < 30.0 and self._running and not is_shutdown_requested():
            time.sleep(0.5)
            waited += 0.5
            snap = wm.snapshot()
        if not snap:
            raise ConnectionError("watcher index empty (first scan not ready); "
                                  "aborting full sync to avoid a destructive empty "
                                  "manifest that would wipe the client")
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
        need = [d for d in ((json.loads(reply).get("need")) or []) if d in snap]
        self.m.log_sync("reconnect", "", "full sync",
                        details=f"{len(need)}/{len(manifest)} file(s) to send",
                        peer=peer_label, direction="push")
        if not need:
            self.m.set_sync_phase("idle", 0, channel=channel, name=client_name,
                                  direction="push")
            return snap

        def send_batch(entries):
            ws.send_text(json.dumps({"type": "batch", "reason": "full",
                                     "dev_id": dev_id, "dev_name": dev_name,
                                     "files": entries}))
            if not ws.recv_text():
                raise ConnectionError("no batch_ack")

        self.m.set_sync_phase("pushing", len(need), channel=channel,
                              name=client_name, direction="push")
        chunk, chunk_bytes, remaining = [], 0, len(need)
        items = [(d, snap[d]) for d in need if d in snap]
        # SMALL files first: over a slow/flapping link the full sync may not drain a
        # huge tree (GBs of assets) in one connection window, so a tiny late-ordered
        # file (e.g. a script) would never arrive before the link drops. Sending the
        # smallest first lets ALL source code converge quickly; big binaries trail.
        items.sort(key=self._entry_size)
        for dest, entry, fhash, fsize in self._encode_ahead(items, gzip_ok):
            if entry is None:
                remaining -= 1
                continue
            b64len = len(entry["b64"])
            self.m.log_sync("sent", dest, "full sync",
                            details=f"{_fmt_bytes(fsize)} -> {peer_label}",
                            size=fsize, peer=peer_label, direction="push")
            if chunk and (chunk_bytes + b64len) > MAX_BATCH_BYTES:
                send_batch(chunk)
                remaining -= len(chunk)
                self.m.set_sync_phase("pushing", remaining, channel=channel,
                                      name=client_name, direction="push")
                chunk, chunk_bytes = [], 0
            chunk.append(entry)
            chunk_bytes += b64len
        if chunk:
            send_batch(chunk)
        self.m.set_sync_phase("idle", 0, channel=channel, name=client_name,
                              direction="push")
        return snap

    def _push_deltas(self, ws, wm, last: dict, client_id: str, reason: str,
                     client_name: str = "", pid: str = "", gzip_ok: bool = False) -> dict:
        """Diff the shared watcher index against what we last acked for this client;
        push new/modified files in size-bounded BATCHES (one batch_ack round-trip per
        chunk). NEVER propagates deletions — a file removed/excluded on the dev is
        just dropped from our tracking; the update-only client keeps its copy.
        Persists the advancing last_sent into supervisor-owned state after every
        successful batch so a mid-sync disconnect resumes from the last ack.

        Returns the updated 'last' snapshot."""
        cur = wm.snapshot()
        changed = [(dest, meta) for dest, meta in cur.items()
                   if dest not in last or last[dest][1] != meta[1]]  # new or hash changed
        changed.sort(key=self._entry_size)  # small files first (same rationale as full sync)
        # A path we previously sent that is gone from the watcher index (deleted OR
        # newly excluded on the dev) is simply DROPPED from our own tracking — we do
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
        self.m.set_sync_phase("pushing", queued, channel=channel,
                              name=client_name, direction="push")

        def send_batch(entries, batch_reason):
            ws.send_text(json.dumps({"type": "batch", "reason": batch_reason,
                                     "dev_id": dev_id, "dev_name": dev_name,
                                     "files": entries}))
            ack = ws.recv_text()
            if not ack:
                raise ConnectionError("no batch_ack")
            return (json.loads(ack).get("results")) or []

        chunk_reason = reason  # the first chunk keeps the 'resume' marker

        # Created/modified files in size-bounded chunks; never split one file. No
        # deletions are ever sent (update-only client).
        chunk = []
        chunk_bytes = 0
        remaining = len(changed)

        def flush_chunk(files, batch_reason, files_meta):
            """Send one 'batch', read one 'batch_ack', advance last_sent for acked
            files, and emit per-file logs."""
            for fm in files_meta:
                dest, fhash, fsize = fm
                self.m.log_sync(
                    "sent", dest,
                    "new file" if dest not in last else "content changed",
                    details=f"{_fmt_bytes(fsize)} -> {peer_label}",
                    size=fsize, peer=peer_label, direction="push")
            results = send_batch(files, batch_reason)
            # Advance last_sent only for files the client confirmed written/skipped.
            for r in results:
                rel = r.get("rel")
                if r.get("status") in ("written", "skipped") and rel in cur:
                    last[rel] = cur[rel]
            with self._lock:
                self._client_sent[client_id] = dict(last)

        # Read + normalize + (gzip) + encode the changed files AHEAD of the network
        # so the next chunk is being prepared while the current one is in flight.
        for dest, entry, fhash, fsize in self._encode_ahead(changed, gzip_ok):
            if entry is None:
                remaining -= 1
                continue
            b64len = len(entry["b64"])
            # Flush before adding if this file would push us over the cap (and the
            # chunk is non-empty, so we never split a single file).
            if chunk and (chunk_bytes + b64len) > MAX_BATCH_BYTES:
                flush_chunk([c[0] for c in chunk], chunk_reason, [c[1] for c in chunk])
                remaining -= len(chunk)
                self.m.set_sync_phase("pushing", remaining, channel=channel,
                                      name=client_name, direction="push")
                chunk = []
                chunk_bytes = 0
                chunk_reason = "delta"  # only the first chunk keeps 'resume'
            chunk.append((entry, (dest, fhash, fsize)))
            chunk_bytes += b64len

        if chunk:
            flush_chunk([c[0] for c in chunk], chunk_reason, [c[1] for c in chunk])

        self.m.set_sync_phase("idle", 0, channel=channel, name=client_name,
                              direction="push")
        return last
