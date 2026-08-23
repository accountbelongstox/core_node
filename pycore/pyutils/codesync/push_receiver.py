# -*- coding: utf-8 -*-
"""
Code Sync CLIENT-side push receiver (stdlib only).

The CLIENT accepts HTTP frames from the DEV and writes the pushed files under
its sync root, SKIPPING any whose canonical hash already matches, and logs
updates the sync phase. Never deletes (update-only client).

Stdlib only + codesync siblings (textnorm/wire_codec); never pycore/third_party.
"""

import base64
import gzip
import json
import os
import threading
import time
import hashlib
from pathlib import Path

from pycore.pyutils.codesync.file_operations import (
    atomic_write_bytes,
    is_source_authoritative_contract_path,
    normalize_relative_path,
    restore_executable_bit,
)
from pycore.pyutils.codesync.textnorm import normalized_md5
from pycore.pyutils.codesync.wire_codec import (
    FRAME_FULL_SYNC_COMPLETE,
    FRAME_FULL_SYNC_COMPLETE_ACK,
    _fmt_bytes,
    _fmt_diff,
)
from pycore.pyutils.codesync.runtime import get_codesync_cache_dir, log as ColorPrint


_PENDING_UPDATE_VERSION = 1


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
    """Stateless handler for one HTTP frame with its reply sent over SSE."""

    def __init__(self, manager):
        self.m = manager
        self._pending_updates_dir = get_codesync_cache_dir() / "pending_updates"
        self._pending_updates_path = self._pending_updates_dir / "index.json"
        self._pending_updates = self._load_pending_updates()
        self._pending_updates_lock = threading.Lock()

    def handle_text(self, text: str, send) -> bool:
        """Process one frame; `send(str)` supplies the HTTP ACK payload."""
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
                             "name": me.get("name"), "caps": {
                                 "gzip": True,
                                 "manifest_gzip": True,
                                 "full_sync_complete": True,
                             }}))
            self.m.log_sync("connection", "", "HTTP SSE connected",
                            peer=msg.get("dev_name") or msg.get("dev_id") or "DEV",
                            direction="receive")
            ColorPrint.green(
                f"[CodeSync HTTP/SSE] DEV "
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
            f"[CodeSync HTTP/SSE] Full sync complete from '{peer}': "
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
        with self._pending_updates_lock:
            pending = list(self._pending_updates.items())

        for rel, entry in pending:
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
            except Exception:
                continue
            if local_hash == remote_hash:
                self._remove_pending_update(rel)

    def get_pending_updates(self) -> dict:
        """Return pending deferred updates for UI queries and external tools."""
        self._prune_synced_pending_updates()
        with self._pending_updates_lock:
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
                for rel, entry in self._pending_updates.items()
            ]
            rows.sort(key=lambda item: float(item.get("cached_at") or 0.0), reverse=True)
            return {"count": len(rows), "files": rows}

    def _pending_updates_file(self) -> Path:
        return self._pending_updates_path

    def _cache_root(self) -> Path:
        return self._pending_updates_dir / "files"

    def _cache_file_path(self, rel: str) -> Path:
        normalized = normalize_relative_path(rel)
        if not normalized:
            normalized = "_root"
        digest = hashlib.sha256(normalized.encode("utf-8", errors="ignore")).hexdigest()
        return self._cache_root() / _safe_cache_segment(digest)

    @staticmethod
    def _coerce_float(value) -> float:
        try:
            return float(value)
        except Exception:
            return None

    @staticmethod
    def _atomic_write_json(path: Path, payload: dict) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
        os.replace(str(tmp), str(path))

    def _load_pending_updates(self) -> dict:
        try:
            p = self._pending_updates_file()
            if not p.exists():
                return {}
            payload = json.loads(p.read_text(encoding="utf-8"))
            if not isinstance(payload, dict):
                return {}
            if int(payload.get("version") or 0) != _PENDING_UPDATE_VERSION:
                return {}
            entries = {}
            for rel, raw in (payload.get("files") or {}).items():
                if not isinstance(raw, dict):
                    continue
                file_hash = str(raw.get("hash") or "")
                if not file_hash:
                    continue
                normalized = normalize_relative_path(rel)
                cache_path = Path(str(raw.get("cache_path") or ""))
                if not cache_path.is_absolute():
                    cache_path = self._cache_file_path(normalized)
                if not self._is_within_cache_root(cache_path) or not cache_path.is_file():
                    continue
                entries[normalized] = {
                    "hash": file_hash,
                    "size": int(raw.get("size") or 0),
                    "server_mtime": float(raw.get("server_mtime") or 0.0),
                    "cached_at": float(raw.get("cached_at") or 0.0),
                    "cache_path": str(cache_path),
                    "source_id": str(raw.get("source_id") or ""),
                    "source_name": str(raw.get("source_name") or ""),
                }
            return entries
        except Exception:
            return {}

    def _save_pending_updates(self, table: dict) -> None:
        try:
            payload = {
                "version": _PENDING_UPDATE_VERSION,
                "files": table,
            }
            self._atomic_write_json(self._pending_updates_file(), payload)
        except Exception:
            pass

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

        with self._pending_updates_lock:
            current = self._pending_updates.get(normalized)
            if (
                isinstance(current, dict)
                and str(current.get("hash") or "") == str(cache_entry["hash"])
                and int(current.get("size") or 0) == int(cache_entry["size"])
                and cache_path.is_file()
            ):
                return False

        atomic_write_bytes(cache_path, content)

        with self._pending_updates_lock:
            self._pending_updates[normalized] = cache_entry
            self._save_pending_updates(self._pending_updates)
        return True

    def _remove_pending_update(self, rel: str) -> bool:
        normalized = normalize_relative_path(rel)
        entry = None
        with self._pending_updates_lock:
            entry = self._pending_updates.pop(normalized, None)
            if entry is not None:
                self._save_pending_updates(self._pending_updates)
        if not entry:
            return False

        cache_path = str(entry.get("cache_path") or "").strip()
        if cache_path:
            try:
                resolved = Path(cache_path)
                if self._is_within_cache_root(resolved):
                    resolved.unlink()
            except Exception:
                pass
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
        try:
            root = self._cache_root().resolve()
            resolved = cache_path.resolve()
        except Exception:
            return False
        root_text = os.path.normcase(str(root))
        resolved_text = os.path.normcase(str(resolved))
        if resolved_text == root_text:
            return True
        return resolved_text.startswith(f"{root_text}{os.sep}")

    def apply_pending_update(self, rel: str) -> dict:
        normalized = normalize_relative_path(rel)
        if not normalized:
            return {"success": False, "error": "missing rel"}

        with self._pending_updates_lock:
            entry = self._pending_updates.get(normalized)
        if not isinstance(entry, dict):
            return {"success": False, "error": "pending update not found"}

        cache_path = self._pending_cache_path(normalized, entry)
        if not self._is_within_cache_root(cache_path) or not cache_path.is_file():
            self._remove_pending_update(normalized)
            return {"success": False, "error": "cached payload unavailable"}

        try:
            content = cache_path.read_bytes()
        except Exception as exc:  # noqa: BLE001
            return {"success": False, "error": f"unable to read cached payload: {exc}"}

        root = self.m.sync_target_root().resolve()
        try:
            target = (root / normalized).resolve()
        except Exception:
            self._remove_pending_update(normalized)
            return {"success": False, "error": "bad path"}
        if target == root or root not in target.parents:
            self._remove_pending_update(normalized)
            return {"success": False, "error": "path escapes sync root"}

        old_size = target.stat().st_size if target.exists() else 0
        new_size = len(content)
        try:
            atomic_write_bytes(target, content, allow_fallback=True)
            server_mtime = self._coerce_float(entry.get("server_mtime"))
            if server_mtime is not None:
                try:
                    os.utime(target, (server_mtime, server_mtime))
                except Exception:
                    pass
            restore_executable_bit(target, content)
        except Exception as exc:  # noqa: BLE001
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
    def _received_table_path() -> Path:
        return get_codesync_cache_dir() / "received_files.json"

    def _load_received(self) -> dict:
        """Load confirmed hashes and filesystem metadata from prior receives."""
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
            self._atomic_write_json(p, table)
        except Exception:
            pass

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
            f"[CodeSync HTTP/SSE] Full manifest received from '{peer}': "
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
            try:
                target = (root / srel).resolve()
            except Exception:
                continue
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
                if matches:
                    self._remove_pending_update(srel)
            except Exception:
                matches = False
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
            srel = normalize_relative_path(rel)
            try:
                target = (root / srel).resolve()
            except Exception:
                continue
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
            f"[CodeSync HTTP/SSE] Full diff complete for '{peer}': "
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

            atomic_write_bytes(target, content, allow_fallback=True)
            server_mtime = self._coerce_float(msg.get("mtime"))
            if server_mtime is not None:
                try:
                    os.utime(target, (server_mtime, server_mtime))
                except Exception:
                    pass
            # The exec bit is lost in transfer (a fresh file is written), so on
            # Linux/macOS restore +x for shell scripts and any shebang file so
            # `./x.sh` works, not just `bash x.sh`.
            restore_executable_bit(target, content)
            self._remove_pending_update(rel)
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
