# -*- coding: utf-8 -*-
"""
Code Sync CLIENT-side push receiver.

The CLIENT accepts HTTP frames from the DEV, replies in the same response,
and writes the pushed files under its sync root, SKIPPING any whose canonical
hash already matches. Never deletes (update-only client).
"""

import base64
import binascii
import gzip
import hashlib
import json
import os
import time
import zlib
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from pycore.pyfoundations.atomic_json_store import atomic_write_bytes, atomic_write_json
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.text_eol import normalized_md5
from pycore.pyutils.codesync.file_operations import (
    is_source_authoritative_contract_path,
    normalize_relative_path,
    restore_executable_bit,
)
from pycore.pyutils.codesync.paths import codesync_cache_dir
from pycore.pyutils.codesync.wire_codec import (
    FRAME_FULL_SYNC_COMPLETE,
    FRAME_FULL_SYNC_COMPLETE_ACK,
    _fmt_bytes,
    _fmt_diff,
)


_PENDING_UPDATE_VERSION = 1
# A DEV session counts as connected while it sent a frame this recently (it pings every tick).
FRAME_SESSION_STALE_SECONDS = 45.0


def _safe_cache_segment(segment: str) -> str:
    safe = "".join(
        char if char.isalnum() or char in ".-_" else "_"
        for char in str(segment)
    )
    safe = safe.strip(" ._")
    return safe or "_"


# --------------------------------------------------------------------------- #
# CLIENT side -- apply pushed files                                           #
# --------------------------------------------------------------------------- #
class PushReceiver:
    """Handles DEV frames; owns the pending-update table and frame sessions."""

    def __init__(self, manager):
        self.m = manager
        self._pending_updates: Optional[Dict[str, Dict[str, Any]]] = None
        self._sessions: Dict[str, float] = {}
        init_serialized_owner(self, "codesync.push_receiver.state", "CodeSyncPushReceiverState")

    # ----- frame sessions ---------------------------------------------------- #
    def handle_frame_payload(self, payload: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
        """One POSTed DEV frame: handle it and return its reply in the response."""
        session_id = str((payload or {}).get("session_id") or "").strip()
        frame_id = str((payload or {}).get("frame_id") or "").strip()
        frame = str((payload or {}).get("frame") or "")
        if not session_id or not frame_id or not frame:
            return {"success": False, "error": "session_id, frame_id and frame required"}, 400
        self._touch_session(session_id)
        replies = []
        accepted = self.handle_text(frame, replies.append)
        reply = replies[0] if replies else ""
        return {"success": bool(accepted), "frame_id": frame_id, "reply": reply}, 200 if accepted else 422

    @serialized_method
    def _touch_session(self, session_id: str) -> None:
        now = time.monotonic()
        self._sessions[session_id] = now
        for stale in [sid for sid, seen in self._sessions.items() if now - seen > FRAME_SESSION_STALE_SECONDS]:
            self._sessions.pop(stale, None)

    @serialized_method
    def get_status(self) -> Dict[str, Any]:
        now = time.monotonic()
        return {
            "running": True,
            "connected_sessions": sum(
                1 for seen in self._sessions.values() if now - seen <= FRAME_SESSION_STALE_SECONDS
            ),
        }

    def handle_text(self, text: str, send) -> bool:
        """Process one frame; `send(str)` supplies the reply payload."""
        try:
            msg = json.loads(text)
        except ValueError:
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
                             "name": me.get("name"), "caps": {
                                 "gzip": True,
                                 "manifest_gzip": True,
                                 "full_sync_complete": True,
                             }}))
            self.m.log_sync("connection", "", "DEV connected",
                            peer=msg.get("dev_name") or msg.get("dev_id") or "DEV",
                            direction="receive")
            ColorPrint.green(
                f"[CodeSync Receiver] DEV "
                f"'{msg.get('dev_name') or msg.get('dev_id') or 'unknown'}' connected"
            )
        elif t == "ping":
            send(json.dumps({"type": "pong"}))
        elif t == "manifest":
            self._handle_manifest(msg, send)
        elif t == FRAME_FULL_SYNC_COMPLETE:
            self._handle_full_sync_complete(msg, send)
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

    def _handle_full_sync_complete(self, msg: dict, send) -> None:
        dev_id = msg.get("dev_id") or "_local"
        dev_name = msg.get("dev_name") or ""
        peer = dev_name or (str(dev_id)[:8] if dev_id else "")
        manifest = int(msg.get("manifest") or 0)
        different = int(msg.get("different") or 0)
        written = int(msg.get("written") or 0)
        skipped = int(msg.get("skipped") or 0)
        cached = int(msg.get("cached") or 0)
        errors = int(msg.get("errors") or 0)
        self.m.log_sync(
            "reconcile",
            "",
            "full diff complete",
            details=(f"{manifest} compared, "
                     f"{different} differed, "
                     f"{written} written, "
                     f"{cached} cached, "
                     f"{skipped} skipped, "
                     f"{errors} error(s)"),
            peer=peer,
            direction="receive",
        )
        ColorPrint.green(
            f"[CodeSync Receiver] Full sync complete from '{peer}': "
            f"{manifest} compared, {different} differed, "
            f"{written} written, {cached} cached, {errors} error(s)"
        )
        self.m.set_sync_phase("idle", 0, channel=dev_id, name=dev_name,
                              direction="receive")
        send(json.dumps({"type": FRAME_FULL_SYNC_COMPLETE_ACK}))

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
        root = self.m.sync_target_root().resolve()
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
                    rel_norm = normalize_relative_path(rel)
                    target = (root / rel_norm).resolve()
                    if target == root or root not in target.parents:
                        continue
                    received[rel_norm] = self._received_record(target, f.get("hash"))
        self._save_received(received)
        send(json.dumps({"type": "batch_ack", "results": results}))
        self.m.set_sync_phase("idle", 0, channel=dev_id, name=dev_name,
                              direction="receive")

    # ----- pending cache ---------------------------------------------------- #
    def _prune_synced_pending_updates(self) -> None:
        """Drop deferred entries whose local file already matches the cached hash."""
        root = self.m.sync_target_root().resolve()
        for rel, entry in self._pending_items():
            remote_hash = str(entry.get("hash") or "")
            if not remote_hash:
                self._remove_pending_update(rel)
                continue
            cache_path = str(entry.get("cache_path") or "").strip()
            if not cache_path:
                self._remove_pending_update(rel)
                continue
            cache_path_obj = Path(cache_path)
            if (
                not self._is_within_cache_root(cache_path_obj)
                or not cache_path_obj.is_file()
            ):
                self._remove_pending_update(rel)
                continue
            target = (root / rel).resolve()
            if target == root or root not in target.parents:
                self._remove_pending_update(rel)
                continue
            try:
                local_hash = normalized_md5(target.read_bytes())
            except OSError:
                continue
            if local_hash == remote_hash:
                self._remove_pending_update(rel)

    def get_pending_updates(self) -> dict:
        """Return pending deferred updates for UI queries and external tools."""
        self._prune_synced_pending_updates()
        rows = [
            {
                "rel": rel,
                "hash": str(entry.get("hash") or ""),
                "size": int(entry.get("size") or 0),
                "server_mtime": float(entry.get("server_mtime") or 0.0),
                "cached_at": float(entry.get("cached_at") or 0.0),
                "source_id": str(entry.get("source_id") or ""),
                "source_name": str(entry.get("source_name") or ""),
            }
            for rel, entry in self._pending_items()
        ]
        rows.sort(key=lambda item: float(item.get("cached_at") or 0.0), reverse=True)
        return {"count": len(rows), "files": rows}

    # ----- pending table (owner thread) -------------------------------------- #
    def _table(self) -> Dict[str, Dict[str, Any]]:
        if self._pending_updates is None:
            self._pending_updates = self._load_pending_updates()
        return self._pending_updates

    @serialized_method
    def _pending_items(self) -> list:
        return [(rel, dict(entry)) for rel, entry in self._table().items()]

    @serialized_method
    def _pending_entry(self, rel: str) -> Optional[Dict[str, Any]]:
        entry = self._table().get(rel)
        return dict(entry) if isinstance(entry, dict) else None

    @serialized_method
    def _pending_store(self, rel: str, entry: Dict[str, Any]) -> None:
        self._table()[rel] = dict(entry)
        self._save_pending_updates(self._table())

    @serialized_method
    def _pending_pop(self, rel: str) -> Optional[Dict[str, Any]]:
        entry = self._table().pop(rel, None)
        if entry is not None:
            self._save_pending_updates(self._table())
        return entry

    @staticmethod
    def _pending_updates_dir() -> Path:
        return codesync_cache_dir() / "pending_updates"

    def _pending_updates_file(self) -> Path:
        return self._pending_updates_dir() / "index.json"

    def _cache_root(self) -> Path:
        return self._pending_updates_dir() / "files"

    def _cache_file_path(self, rel: str) -> Path:
        normalized = normalize_relative_path(rel)
        if not normalized:
            normalized = "_root"
        digest = hashlib.sha256(normalized.encode("utf-8", errors="ignore")).hexdigest()
        return self._cache_root() / _safe_cache_segment(digest)

    @staticmethod
    def _coerce_float(value) -> Optional[float]:
        return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None

    @staticmethod
    def _read_json(path: Path) -> Any:
        if not path.is_file():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            ColorPrint.yellow(f"[CodeSync Receiver] state file ignored path={path}: {exc}")
            return None

    @staticmethod
    def _write_json(path: Path, payload: dict) -> None:
        try:
            atomic_write_json(path, payload, indent=None)
        except OSError as exc:
            ColorPrint.red(f"[CodeSync Receiver] state save failed path={path}: {exc}")

    def _load_pending_updates(self) -> dict:
        payload = self._read_json(self._pending_updates_file())
        if not isinstance(payload, dict) or int(payload.get("version") or 0) != _PENDING_UPDATE_VERSION:
            return {}
        entries = {}
        for rel, raw in (payload.get("files") or {}).items():
            if not isinstance(raw, dict) or not str(raw.get("hash") or ""):
                continue
            normalized = normalize_relative_path(rel)
            cache_path = Path(str(raw.get("cache_path") or ""))
            if not cache_path.is_absolute():
                cache_path = self._cache_file_path(normalized)
            if not self._is_within_cache_root(cache_path) or not cache_path.is_file():
                continue
            entries[normalized] = {
                "hash": str(raw.get("hash")),
                "size": int(raw.get("size") or 0),
                "server_mtime": float(raw.get("server_mtime") or 0.0),
                "cached_at": float(raw.get("cached_at") or 0.0),
                "cache_path": str(cache_path),
                "source_id": str(raw.get("source_id") or ""),
                "source_name": str(raw.get("source_name") or ""),
            }
        return entries

    def _save_pending_updates(self, table: dict) -> None:
        self._write_json(
            self._pending_updates_file(),
            {"version": _PENDING_UPDATE_VERSION, "files": table},
        )

    def _set_pending_update(
        self,
        rel: str,
        file_hash: str,
        server_mtime,
        content: bytes,
        peer_id: str,
        peer_name: str,
    ) -> bool:
        normalized = normalize_relative_path(rel)
        cache_path = self._cache_file_path(normalized)
        cache_entry = {
            "hash": str(file_hash or ""),
            "size": int(len(content)),
            "server_mtime": float(server_mtime or 0.0),
            "cached_at": float(time.time()),
            "cache_path": str(cache_path),
            "source_id": str(peer_id or ""),
            "source_name": str(peer_name or ""),
        }

        current = self._pending_entry(normalized)
        if (
            current is not None
            and str(current.get("hash") or "") == str(cache_entry["hash"])
            and int(current.get("size") or 0) == int(cache_entry["size"])
            and cache_path.is_file()
        ):
            return False

        atomic_write_bytes(cache_path, content)
        self._pending_store(normalized, cache_entry)
        return True

    def _remove_pending_update(self, rel: str) -> bool:
        entry = self._pending_pop(normalize_relative_path(rel))
        if not entry:
            return False
        cache_path = str(entry.get("cache_path") or "").strip()
        if cache_path and self._is_within_cache_root(Path(cache_path)):
            try:
                Path(cache_path).unlink(missing_ok=True)
            except OSError as exc:
                ColorPrint.yellow(f"[CodeSync Receiver] pending cache delete failed path={cache_path}: {exc}")
        return True

    def _pending_cache_path(self, normalized_rel: str, entry: dict) -> Path:
        raw = str(entry.get("cache_path") or "").strip()
        if not raw:
            return self._cache_file_path(normalized_rel)
        cache_path = Path(raw)
        if not cache_path.is_absolute():
            return self._cache_file_path(normalized_rel)
        return cache_path

    def _is_within_cache_root(self, cache_path: Path) -> bool:
        root = self._cache_root().resolve()
        resolved = cache_path.resolve()
        root_text = os.path.normcase(str(root))
        resolved_text = os.path.normcase(str(resolved))
        if resolved_text == root_text:
            return True
        return resolved_text.startswith(f"{root_text}{os.sep}")

    def apply_pending_update(self, rel: str) -> dict:
        normalized = normalize_relative_path(rel)
        if not normalized:
            return {"success": False, "error": "missing rel"}

        entry = self._pending_entry(normalized)
        if entry is None:
            return {"success": False, "error": "pending update not found"}

        cache_path = self._pending_cache_path(normalized, entry)
        if not self._is_within_cache_root(cache_path) or not cache_path.is_file():
            self._remove_pending_update(normalized)
            return {"success": False, "error": "cached payload unavailable"}

        try:
            content = cache_path.read_bytes()
        except OSError as exc:
            ColorPrint.yellow(f"[CodeSync Receiver] pending payload read failed rel={normalized}: {exc}")
            return {"success": False, "error": f"unable to read cached payload: {exc}"}

        root = self.m.sync_target_root().resolve()
        target = (root / normalized).resolve()
        if target == root or root not in target.parents:
            self._remove_pending_update(normalized)
            return {"success": False, "error": "path escapes sync root"}

        old_size = target.stat().st_size if target.exists() else 0
        new_size = len(content)
        try:
            self._write_target(target, content, self._coerce_float(entry.get("server_mtime")))
        except OSError as exc:
            ColorPrint.red(f"[CodeSync Receiver] pending apply failed rel={normalized}: {exc}")
            return {"success": False, "error": f"failed to apply payload: {exc}"}

        self._remove_pending_update(normalized)
        received = self._load_received()
        received[normalized] = self._received_record(target, entry.get("hash") or normalized_md5(content))
        self._save_received(received)
        self.m.log_sync(
            "received",
            normalized,
            "pending update applied",
            details=f"{_fmt_bytes(new_size)} (manual apply)",
            size=new_size,
            diff=new_size - old_size,
            peer=str(entry.get("source_name") or entry.get("source_id") or "dev"),
            direction="receive",
        )
        return {
            "success": True,
            "status": "applied",
            "rel": normalized,
            "hash": str(entry.get("hash") or normalized_md5(content)),
            "size": new_size,
        }

    def clear_pending_update(self, rel: str) -> dict:
        normalized = normalize_relative_path(rel)
        if not normalized:
            return {"success": False, "error": "missing rel"}
        removed = self._remove_pending_update(normalized)
        if removed:
            self.m.log_sync(
                "reconcile",
                normalized,
                "pending update cleared",
                details="manual clear",
                direction="receive",
            )
        return {
            "success": True,
            "rel": normalized,
            "removed": bool(removed),
            "status": "cleared" if removed else "missing",
        }

    @staticmethod
    def _write_target(target: Path, content: bytes, server_mtime: Optional[float]) -> None:
        """Write one received file, stamp its mtime and restore the exec bit."""
        atomic_write_bytes(target, content, allow_fallback=True)
        if server_mtime is not None:
            # Never stamp a future time (a clock-skewed peer would put the
            # hot-reload watcher into a restart loop).
            stamp = min(server_mtime, time.time())
            os.utime(target, (stamp, stamp))
        # The exec bit is lost in transfer (a fresh file is written), so on
        # Linux/macOS restore +x for shell scripts and any shebang file.
        restore_executable_bit(target, content)

    @staticmethod
    def _received_table_path() -> Path:
        return codesync_cache_dir() / "received_files.json"

    def _load_received(self) -> dict:
        """Load confirmed hashes and filesystem metadata from prior receives."""
        data = self._read_json(self._received_table_path())
        return data if isinstance(data, dict) else {}

    def _save_received(self, table: dict) -> None:
        self._write_json(self._received_table_path(), table)

    @staticmethod
    def _received_record(target: Path, file_hash: str) -> dict:
        try:
            stat = target.stat()
            return {
                "hash": str(file_hash or ""),
                "size": int(stat.st_size),
                "mtime_ns": int(stat.st_mtime_ns),
                "ctime_ns": int(stat.st_ctime_ns),
            }
        except OSError:
            return {
                "hash": str(file_hash or ""),
                "size": -1,
                "mtime_ns": -1,
                "ctime_ns": -1,
            }

    @staticmethod
    def _received_cache_matches(record, file_hash: str, stat) -> bool:
        return bool(
            isinstance(record, dict)
            and str(record.get("hash") or "") == str(file_hash or "")
            and int(record.get("size", -1)) == int(stat.st_size)
            and int(record.get("mtime_ns", -1)) == int(stat.st_mtime_ns)
            and int(record.get("ctime_ns", -1)) == int(stat.st_ctime_ns)
        )

    def _handle_manifest(self, msg: dict, send) -> None:
        """A dev sends its FULL file table {rel: canonical_hash} on first connect and
        on every reconnect (the real-time full-update diff). We compare it against our
        real on-disk files and reply with the list we still NEED - missing files, or
        files whose content hash differs (a MEANINGFUL update). We NEVER delete: a
        file we have that the dev no longer lists is KEPT (it may be a dev-only env
        difference, an excluded artifact, or something the client still needs to run).
        So the client only ever gains/refreshes files, never loses them."""
        started_at = time.monotonic()
        files = msg.get("files") or {}
        if msg.get("files_gzip"):
            encoded = base64.b64decode(msg.get("files_gzip"))
            files = json.loads(gzip.decompress(encoded).decode("utf-8"))
        if not isinstance(files, dict):
            files = {}
        dev_id = msg.get("dev_id") or "_local"
        dev_name = msg.get("dev_name") or ""
        peer = dev_name or (str(dev_id)[:8] if dev_id else "")
        root = self.m.sync_target_root().resolve()
        received = self._load_received()
        need = []
        hashed = 0
        cached = 0
        total = len(files)
        ColorPrint.blue(
            f"[CodeSync Receiver] Full manifest received from '{peer}': "
            f"comparing {total} file(s)"
        )
        # Build the NEW table from only files we can confirm are present+correct now.
        # Needed files are NOT recorded here - _apply_batch records each as it is
        # actually written, so an interrupted transfer can't leave the table claiming
        # a file the client never received (which would wrongly fast-skip it forever).
        new_table = {}
        self.m.set_sync_phase("scanning", total, channel=dev_id,
                              name=dev_name, direction="receive")
        for index, (rel, h) in enumerate(files.items(), 1):
            if index % 250 == 0:
                self.m.set_sync_phase("scanning", total - index, channel=dev_id,
                                      name=dev_name, direction="receive")
            srel = normalize_relative_path(rel)
            target = (root / srel).resolve()
            if target != root and root not in target.parents:
                continue  # never request/accept a path outside the sync root
            if not target.exists():
                need.append(srel)
                continue
            try:
                stat = target.stat()
                if self._received_cache_matches(received.get(srel), h, stat):
                    matches = True
                    cached += 1
                else:
                    matches = normalized_md5(target.read_bytes()) == h
                    hashed += 1
            except OSError:
                matches = False
            if matches:
                self._remove_pending_update(srel)
            if matches:
                new_table[srel] = self._received_record(target, h)
            else:
                need.append(srel)
        # UPDATE-ONLY: the client NEVER deletes. A file we have that is absent from
        # the dev manifest (removed/excluded on the dev, or a dev-only env file) is
        # KEPT. We just retain it in our fast-skip table (when still on disk) so a
        # transient/empty/partial manifest can never make us drop or re-fetch it.
        for rel, record in received.items():
            if rel in new_table or rel in files:
                continue
            target = (root / normalize_relative_path(rel)).resolve()
            if (target == root or root in target.parents) and target.exists():
                new_table[rel] = record
        # Persist the confirmed-present files; needed ones are added by _apply_batch
        # as they are actually written.
        self._save_received(new_table)
        self.m.log_sync("reconnect", "", "full diff complete",
                        details=(f"{len(need)} to fetch, "
                                 f"{len(files) - len(need)} up-to-date "
                                 f"({cached} cached, {hashed} re-hashed); "
                                 f"{time.monotonic() - started_at:.1f}s; "
                                 "update-only, 0 deleted"),
                        peer=peer, direction="receive")
        ColorPrint.green(
            f"[CodeSync Receiver] Full diff complete for '{peer}': "
            f"{total} compared, {len(need)} differ"
        )
        self.m.set_sync_phase("idle", 0, channel=dev_id, name=dev_name,
                              direction="receive")
        send(json.dumps({"type": "need", "need": need}))

    def _apply_one(self, msg: dict, peer: str = "") -> dict:
        """Apply one pushed file; return a result row for the ack. A delete entry
        (legacy dev) is IGNORED - update-only client - and acked as 'skipped'.

        Result fields: rel, status (written|skipped|cached|error), diff (signed byte
        delta new_size - old_size), size (new content size), error on failure.
        """
        rel = msg.get("rel")
        deleted = bool(msg.get("deleted"))
        b64 = msg.get("b64")
        result = {"rel": rel, "status": "error", "diff": 0, "size": 0}
        if not rel or (b64 is None and not deleted):
            result["error"] = "missing rel/b64"
            return result
        rel = normalize_relative_path(rel)
        result["rel"] = rel
        # Contain every write/delete strictly under the sync root: reject path
        # traversal ("../") and absolute rels that would escape it (resolve() also
        # collapses parent symlinks, closing that traversal vector too).
        root = self.m.sync_target_root().resolve()
        target = (root / rel).resolve()
        if target != root and root not in target.parents:
            result["error"] = "path escapes sync root"
            self.m.log_sync("error", rel, "rejected: path escapes sync root",
                            details="blocked", peer=peer, direction="receive")
            return result

        msg_hash = str(msg.get("hash") or "")
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
                current = normalized_md5(target.read_bytes())
                if current == msg_hash:
                    self._remove_pending_update(rel)
                    result["status"] = "skipped"
                    result["diff"] = 0
                    self.m.log_sync("skipped", rel, "up-to-date",
                                    details=f"{_fmt_bytes(new_size)} (delta +0 B)",
                                    size=new_size, diff=0, peer=peer,
                                    direction="receive")
                    return result

                server_mtime = self._coerce_float(msg.get("mtime"))
                should_replace = is_source_authoritative_contract_path(rel)
                if not should_replace and server_mtime is not None:
                    should_replace = server_mtime > target.stat().st_mtime
                if not should_replace:
                    replaced = self._set_pending_update(
                        rel,
                        msg_hash,
                        server_mtime,
                        content,
                        msg.get("dev_id") or "",
                        msg.get("dev_name") or "",
                    )
                    if replaced:
                        result["status"] = "cached"
                        self.m.log_sync(
                            "cached",
                            rel,
                            "content changed; local file is newer, cached",
                            details=(f"incoming {_fmt_bytes(new_size)} from {peer} "
                                     "stored under pending cache"),
                            size=new_size,
                            diff=diff,
                            peer=peer,
                            direction="receive",
                        )
                    else:
                        result["status"] = "skipped"
                    return result

                reason = "content changed"
            else:
                reason = "new file"

            self._write_target(target, content, self._coerce_float(msg.get("mtime")))
            self._remove_pending_update(rel)
            result["status"] = "written"
            self.m.log_sync("received", rel, reason, details=details,
                            size=new_size, diff=diff, peer=peer,
                            direction="receive")
            return result
        except (OSError, binascii.Error, zlib.error, EOFError) as exc:
            # Filesystem / payload-decoding boundary for one pushed file.
            result["status"] = "error"
            result["error"] = str(exc)
            self.m.log_sync("error", rel, str(exc),
                            details=str(exc), size=result.get("size", 0),
                            diff=result.get("diff", 0), peer=peer,
                            direction="receive")
            return result
