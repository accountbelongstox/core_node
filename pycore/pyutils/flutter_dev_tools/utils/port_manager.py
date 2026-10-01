"""
Flutter dev tools server takeover: identify and stop an old design-doc server on its port.

Port lookup, waits and kills delegate to pyutils/common/port_utils.
"""

import urllib.error
import urllib.request
from typing import Any, Dict

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.port_utils import kill_process_using_port, port_process_info, wait_for_port_release


def shutdown_via_http(host: str = "127.0.0.1", port: int = 5757, timeout: int = 5) -> bool:
    url = f"http://{host}:{port}/api/shutdown"
    ColorPrint.plain(f"[PORT-CHECK] Attempting graceful shutdown via {url}...")
    try:
        with urllib.request.urlopen(urllib.request.Request(url, method="POST"), timeout=timeout):
            ColorPrint.plain("[PORT-CHECK] Server acknowledged shutdown request")
            return True
    except (urllib.error.URLError, OSError) as e:
        ColorPrint.yellow(f"[PORT-CHECK] HTTP shutdown failed: url={url} error={e}")
        return False


def is_our_server_process(process_info: Dict[str, Any], port: int = 5757) -> bool:
    if not process_info:
        return False
    name = process_info.get("name", "").lower()
    cmdline = process_info.get("cmdline", "").lower()
    if "python" not in name:
        return False
    is_our_script = (
        "design_doc_tool" in cmdline
        or ("main.py" in cmdline and ("flutter_dev_tools" in cmdline or "design" in cmdline))
    )
    if not is_our_script:
        return False
    return "flutter_dev_tools" in cmdline or "design_doc" in cmdline or str(port) in cmdline


def cleanup_old_server(port: int, auto_kill: bool = True, host: str = "127.0.0.1") -> bool:
    ColorPrint.plain(f"[PORT-CHECK] Checking port {port}...")
    process_info = port_process_info(port)
    if not process_info:
        ColorPrint.plain(f"[PORT-CHECK] Port {port} is free")
        return True

    pid = process_info["pid"]
    cmdline = process_info["cmdline"]
    ColorPrint.plain(f"[PORT-CHECK] Port {port} is in use: PID={pid} name={process_info['name']} "
                     f"command={cmdline[:100] if cmdline else '(unavailable)'}")

    if not is_our_server_process(process_info, port):
        ColorPrint.yellow(f"[PORT-CHECK] PID {pid} on port {port} is not our server; not killing it")
        return False
    if not auto_kill:
        ColorPrint.yellow(f"[PORT-CHECK] Auto-kill disabled; stop PID {pid} manually")
        return False

    if shutdown_via_http(host, port, timeout=3) and wait_for_port_release(port, timeout=5):
        ColorPrint.green(f"[PORT-CHECK] Server on port {port} shut down gracefully")
        return True

    ColorPrint.plain(f"[PORT-CHECK] Killing old server instance (PID: {pid})...")
    if kill_process_using_port(port, force=True):
        ColorPrint.green(f"[PORT-CHECK] Killed old server PID {pid}")
        return True
    ColorPrint.red(f"[PORT-CHECK] Failed to kill PID {pid} on port {port}")
    return False
