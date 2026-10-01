# -*- coding: utf-8 -*-
"""Port ownership of the managed TTS servers: detect a listener this process
did not start and reclaim a stale pycore-launched orphan; a listener pycore
did not launch is never touched."""

import os
from pathlib import Path
from typing import Any, List, Optional
from urllib.parse import urlparse

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_psutil
from pycore.pyutils.common.port_utils import is_port_in_use
from pycore.pyutils.tts.engine_registry import tts_engine_registry
from pycore.pyutils.tts.tts_server_launch import ASSETS_DIR


def _listener_pids(psutil: Any, port: int) -> List[int]:
    """Return process IDs currently listening on one TCP port."""
    pids = set()
    for conn in psutil.net_connections(kind="tcp"):
        local_address = getattr(conn, "laddr", None)
        if not local_address or getattr(local_address, "port", None) != port:
            continue
        if conn.status == psutil.CONN_LISTEN and conn.pid:
            pids.add(int(conn.pid))
    return sorted(pids)


def _launched_by_pycore(psutil: Any, pid: int, engine: str) -> bool:
    """True when the process runs a pycore launch of ``engine``: its command
    line or working directory lies in the engine staging dir or the pycore TTS
    assets dir (every start_command launches from there)."""
    adapter = tts_engine_registry.get(engine)
    roots = (str(adapter.staging_dir().resolve()), str(ASSETS_DIR.resolve()))
    proc = psutil.Process(pid)
    locations = [str(part) for part in proc.cmdline()] + [str(Path(proc.cwd()).resolve())]
    return any(location.startswith(root) for location in locations for root in roots)


def _foreign_listener_pids(engine: str) -> Optional[List[int]]:
    adapter = tts_engine_registry.get(engine)
    if adapter is None:
        return None
    port = urlparse(adapter.base_url()).port or 0
    if not port:
        return None
    psutil = get_third_package_psutil()
    try:
        return _listener_pids(psutil, port)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[tts] {engine} port {port} listener inspection failed: {exc}")
        return None


def foreign_server_present(engine: str) -> Optional[bool]:
    adapter = tts_engine_registry.get(engine)
    if adapter is None:
        return None
    port = urlparse(adapter.base_url()).port or 0
    if not port:
        return None
    return is_port_in_use(port)


def stop_foreign_server(engine: str) -> Optional[bool]:
    """Terminate a stale pycore-launched server that this process does not own
    and that is LISTENING on this engine's port - an orphan from a previous
    pycore run (its stdout pipe is dead, so every synth request 500s instantly
    while /health keeps passing). A listener pycore did not launch is never
    touched. Returns True when reclaimed, False when a listener remains, and
    None when listener ownership cannot be inspected. An already-free port is
    success."""
    adapter = tts_engine_registry.get(engine)
    if adapter is None:
        return False
    port = urlparse(adapter.base_url()).port or 0
    if not port:
        return False
    listener_pids = _foreign_listener_pids(engine)
    if listener_pids is None:
        return None
    if not listener_pids:
        return True
    psutil = get_third_package_psutil()
    try:
        if os.getpid() in listener_pids:
            ColorPrint.yellow(
                f"[tts] refusing to reclaim {engine} port {port} from this process"
            )
            return False
        not_ours = [pid for pid in listener_pids if not _launched_by_pycore(psutil, pid, engine)]
        if not_ours:
            ColorPrint.yellow(
                f"[tts] {engine} port {port} is held by a process pycore did not "
                f"launch (pid={not_ours}); leaving it running"
            )
            return False
        for pid in listener_pids:
            try:
                proc = psutil.Process(pid)
                proc.terminate()
                try:
                    proc.wait(timeout=8)
                except psutil.TimeoutExpired:
                    proc.kill()
                    proc.wait(timeout=8)
            except psutil.NoSuchProcess:
                pass
            except Exception as exc:  # noqa: BLE001
                ColorPrint.yellow(
                    f"[tts] failed to stop foreign {engine} server "
                    f"(pid={pid}, port={port}): {exc}"
                )
        remaining = _listener_pids(psutil, port)
        if remaining:
            ColorPrint.yellow(
                f"[tts] foreign {engine} listener still owns port {port}: {remaining}"
            )
            return False
        for pid in listener_pids:
            ColorPrint.yellow(
                f"[tts] stopped foreign {engine} server "
                f"(pid={pid}) on port {port}"
            )
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[tts] {engine} port {port} reclaim failed: {exc}")
        return None
    return True


__all__ = ["foreign_server_present", "stop_foreign_server"]
