# -*- coding: utf-8 -*-
"""
Code Sync WebSocket push channel (stdlib only).

Direction (per the topology): the DEV is behind NAT and CANNOT be reached, so the
**clients are the WS servers** and the **dev dials out** to each of them and PUSHES
file changes. This flips the old HTTP pull model (client→dev), which NAT blocked.

  * PushSender   (DEV side)    — for each client peer, open an outbound WS
    (ws_client), set a BASELINE = current tree (no bulk send), then every 1s push
    only created/modified files. Reuses server.py's per-client change tracking.
  * PushReceiver (CLIENT side) — handle pushed messages on a WS the client accepted
    (the stdlib http_server upgrade / FastAPI WS calls handle_text): write the file
    under the watched root, SKIP if the hash already matches, log + phase.

Message protocol (JSON text frames):
  dev→client  {"type":"hello","dev_id","dev_name"}
  client→dev  {"type":"welcome","client_id","name"}
  dev→client  {"type":"file","rel","mtime","hash","b64"}
  client→dev  {"type":"ack","rel","status":"written|skipped|error"}
  dev→client  {"type":"batch_done","count"}
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

PUSH_TICK = 1.0  # seconds between incremental delta pushes


# --------------------------------------------------------------------------- #
# CLIENT side — apply pushed files                                            #
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
        elif t == "file":
            self._apply(msg, send)
        elif t == "batch_done":
            self.m.set_sync_phase("idle")
        return True

    def _apply(self, msg: dict, send) -> None:
        rel = msg.get("rel")
        b64 = msg.get("b64")
        if not rel or b64 is None:
            return
        rel = str(rel).replace("\\", "/")
        self.m.set_sync_phase("receiving")
        target = self.m.sync_target_root() / rel
        try:
            content = base64.b64decode(b64)
            if target.exists():
                cur = hashlib.md5(target.read_bytes()).hexdigest()
                if cur == msg.get("hash"):
                    self.m.log_sync("skipped", rel, "up-to-date")
                    send(json.dumps({"type": "ack", "rel": rel, "status": "skipped"}))
                    return
            target.parent.mkdir(parents=True, exist_ok=True)
            tmp = target.with_suffix(target.suffix + ".cs_tmp")
            tmp.write_bytes(content)
            os.replace(str(tmp), str(target))
            mtime = msg.get("mtime")
            if mtime:
                try:
                    os.utime(target, (mtime, mtime))
                except Exception:
                    pass
            self.m.log_sync("received", rel, f"{len(content)} B")
            send(json.dumps({"type": "ack", "rel": rel, "status": "written"}))
        except Exception as exc:
            self.m.log_sync("error", rel, str(exc))
            send(json.dumps({"type": "ack", "rel": rel, "status": "error", "error": str(exc)}))


# --------------------------------------------------------------------------- #
# DEV side — dial each client and push deltas                                 #
# --------------------------------------------------------------------------- #
class PushSender:
    """Maintains one outbound WS per client peer; pushes baseline-then-deltas."""

    def __init__(self, manager):
        self.m = manager
        self._running = False
        self._threads = {}  # peer_id -> Thread
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
        """Ensure a live push thread per client peer while we are distributing."""
        while self._running and not is_shutdown_requested():
            try:
                if self.m.is_distributing():
                    self_id = self.m.config.machine_id
                    for peer in self.m.config.list_peers():
                        if peer.get("role") != "client" or peer.get("id") == self_id:
                            continue
                        pid = peer.get("id")
                        with self._lock:
                            th = self._threads.get(pid)
                            if th is None or not th.is_alive():
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

    def _push_to(self, peer: dict) -> None:
        from .ws_client import WSClient
        from .watcher import get_watch_manager
        host = peer.get("host")
        port = int(peer.get("port", 59000))
        ws = WSClient(host, port)
        try:
            ws.connect()
            me = self.m.config.get_self()
            ws.send_text(json.dumps({"type": "hello", "dev_id": self.m.config.machine_id,
                                     "dev_name": me.get("name")}))
            welcome = ws.recv_text()
            if not welcome:
                return
            client_id = (json.loads(welcome).get("client_id")) or peer.get("id")
            wm = get_watch_manager()
            wm.start()
            # Baseline = the CURRENT shared index (no bulk push of the existing tree);
            # from here we push only files that are created/modified afterwards.
            last = wm.snapshot()
            ColorPrint.green(f"[WsPush] Connected to {peer.get('name') or host} "
                             f"(baseline {len(last)} files); pushing deltas every {PUSH_TICK}s")
            while self._running and self.m.is_distributing() and not is_shutdown_requested():
                time.sleep(PUSH_TICK)
                last = self._push_deltas(ws, wm, last, client_id)
        except Exception as exc:
            ColorPrint.yellow(f"[WsPush] {host}:{port} link closed: {exc}")
        finally:
            ws.close()
            with self._lock:
                self._threads.pop(peer.get("id"), None)

    def _push_deltas(self, ws, wm, last: dict, client_id: str) -> dict:
        """Diff the shared watcher index against what we last sent this client; push
        new/modified files. Returns the new 'last' snapshot. (Cheap dict compare —
        the expensive scan is shared by the single WatchManager thread.)"""
        cur = wm.snapshot()
        changed = [(dest, meta) for dest, meta in cur.items()
                   if dest not in last or last[dest][1] != meta[1]]  # new or hash changed
        if not changed:
            return cur
        self.m.set_sync_phase("pushing", len(changed))
        for dest, (mtime, fhash, abspath) in changed:
            try:
                content = Path(abspath).read_bytes()
            except Exception:
                continue
            ws.send_text(json.dumps({"type": "file", "rel": dest, "mtime": mtime,
                                     "hash": fhash,
                                     "b64": base64.b64encode(content).decode("ascii")}))
            try:
                ws.recv_text()  # ack (best-effort)
            except Exception:
                pass
            self.m.log_sync("sent", dest, f"→ {client_id[:8]}")
        ws.send_text(json.dumps({"type": "batch_done", "count": len(changed)}))
        self.m.set_sync_phase("idle")
        return cur
