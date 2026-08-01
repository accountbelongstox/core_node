# -*- coding: utf-8 -*-
"""
Code Sync CLIENT-side push receiver (stdlib only).

The CLIENT accepts HTTP frames from the DEV and writes the pushed files under
the watched root, SKIPPING any whose canonical hash already matches, and logs +
updates the sync phase. Never deletes (update-only client).

Stdlib only + codesync siblings (textnorm/wire_codec); never pycore/third_party.
"""

import base64
import gzip
import json
import os
import time
from pathlib import Path

from pycore.pyutils.codesync.textnorm import normalized_md5
from pycore.pyutils.codesync.wire_codec import (
    FRAME_FULL_SYNC_COMPLETE,
    FRAME_FULL_SYNC_COMPLETE_ACK,
    _fmt_bytes,
    _fmt_diff,
)
from pycore.pyutils.codesync.runtime import get_local_data_dir, log as ColorPrint


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
    """Stateless handler for one HTTP frame with its reply sent over SSE."""

    def __init__(self, manager):
        self.m = manager

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
        self.m.log_sync(
            "reconcile",
            "",
            "full diff complete",
            details=(f"{int(msg.get('manifest') or 0)} compared, "
                     f"{int(msg.get('different') or 0)} differed, "
                     f"{int(msg.get('written') or 0)} written, "
                     f"{int(msg.get('skipped') or 0)} skipped, "
                     f"{int(msg.get('errors') or 0)} error(s)"),
            peer=peer,
            direction="receive",
        )
        ColorPrint.green(
            f"[CodeSync HTTP/SSE] Full sync complete from '{peer}': "
            f"{int(msg.get('manifest') or 0)} compared, "
            f"{int(msg.get('different') or 0)} differed, "
            f"{int(msg.get('written') or 0)} written, "
            f"{int(msg.get('errors') or 0)} error(s)"
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
                    target = (root / str(rel).replace("\\", "/")).resolve()
                    if target == root or root in target.parents:
                        received[rel] = self._received_record(target, f.get("hash"))
        self._save_received(received)
        send(json.dumps({"type": "batch_ack", "results": results}))
        self.m.set_sync_phase("idle", 0, channel=dev_id, name=dev_name,
                              direction="receive")

    # ----- full-sync manifest (sent by the dev on every (re)connect) -------- #
    def _received_table_path(self) -> Path:
        return get_local_data_dir() / "codesync" / "received_files.json"

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
            tmp = p.with_suffix(".json.tmp")
            tmp.write_text(json.dumps(table), encoding="utf-8")
            os.replace(str(tmp), str(p))
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
            try:
                stat = target.stat()
                if self._received_cache_matches(received.get(srel), h, stat):
                    matches = True
                    cached += 1
                else:
                    matches = normalized_md5(target.read_bytes()) == h
                    hashed += 1
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
            srel = str(rel).replace("\\", "/")
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
                        details=f"{len(need)} to fetch, "
                                f"{len(files) - len(need)} up-to-date "
                                f"({cached} cached, {hashed} re-hashed); "
                                f"{time.monotonic() - started_at:.1f}s; "
                                "update-only, 0 deleted",
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

        Result fields: rel, status (written|skipped|error), diff (signed byte delta
        new_size - old_size), size (new content size), error on failure.
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
            # TODO(shared-helper): extract a stdlib-only _atomic_write_bytes(path,
            # content) helper - this tmp+os.replace pattern is duplicated in
            # peer_config.py, sync_settings.py and here (_apply_one + _save_received).
            try:
                tmp.write_bytes(content)
                os.replace(str(tmp), str(target))
            except PermissionError:
                try:
                    tmp.unlink(missing_ok=True)
                except OSError:
                    pass
                target.write_bytes(content)
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
