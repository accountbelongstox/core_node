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
from pathlib import Path

from pycore.pyutils.codesync.textnorm import normalized_md5
from pycore.pyutils.codesync.wire_codec import _fmt_bytes, _fmt_diff
from pycore.pyutils.codesync.runtime import get_local_data_dir


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
                             "name": me.get("name"), "caps": {"gzip": True}}))
        elif t == "ping":
            send(json.dumps({"type": "pong"}))
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
        return get_local_data_dir() / "codesync" / "received_files.json"

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
        real on-disk files and reply with the list we still NEED - missing files, or
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
        # Needed files are NOT recorded here - _apply_batch records each as it is
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
