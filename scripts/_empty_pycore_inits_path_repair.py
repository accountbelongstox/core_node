# -*- coding: utf-8 -*-
"""Repair module paths mangled by broken relative-import resolution."""
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]

# wrong prefix/module -> correct module (full dotted path used after "from ")
MODULE_MAP = {
    "pycore.pool": "pycore.pythreadpool.pool",
    "pycore.registry": "pycore.pythreadpool.registry",
    "pycore.pyutils.rpc_v2.event_cache": "pycore.pyutils.rpc_v2.common.event_cache",
    "pycore.pyutils.rpc_v2.request_event_table": "pycore.pyutils.rpc_v2.common.request_event_table",
    "pycore.pyutils.rpc_v2.inventory_table": "pycore.pyutils.rpc_v2.common.inventory_table",
    "pycore.pyutils.rpc_v2.request_manager": "pycore.pyutils.rpc_v2.common.request_manager",
    "pycore.pyutils.rpc_v2.rpc_config": "pycore.pyutils.rpc_v2.config.rpc_config",
    "pycore.pyutils.rpc_v2.rpc_protocol": "pycore.pyutils.rpc_v2.protocol.rpc_protocol",
    "pycore.pyutils.rpc_v2.address_provider": "pycore.pyutils.rpc_v2.address.address_provider",
    "pycore.pyutils.rpc_v2.auto_register": "pycore.pyutils.rpc_v2.modules.auto_register",
    "pycore.pyutils.rpc_v2.homepage_routes": "pycore.pyutils.rpc_v2.server.homepage_routes",
    "pycore.pyutils.stt_orchestrator": "pycore.pyutils.stt.stt_orchestrator",
    "pycore.pyutils.native_ui.tkinter_system_tray": "pycore.pyutils.native_ui.step6_tray.tkinter_system_tray",
    "pycore.pyutils.native_ui.tray_config": "pycore.pyutils.native_ui.step1_config.tray_config",
    "pycore.pyutils.native_ui.launcher_with_startup": "pycore.pyutils.native_ui.step3_launcher.launcher_with_startup",
    "pycore.pyutils.native_ui.startup_window_thread": "pycore.pyutils.native_ui.step4_startup.startup_window_thread",
    "pycore.pyutils.native_ui.thread_bus_manager": "pycore.pyutils.native_ui.step7_managers.thread_bus_manager",
    "pycore.pyutils.native_ui.frontend_thread": "pycore.pyutils.native_ui.step9_frontend.frontend_thread",
    "pycore.pyutils.native_ui.frontend_config": "pycore.pyutils.native_ui.step9_frontend.frontend_config",
    "pycore.pyutils.native_ui.frontend_starter": "pycore.pyutils.native_ui.step9_frontend.frontend_starter",
    "pycore.pyutils.native_ui.step5_main_ui.ui_thread": "pycore.pyutils.native_ui.step5_main_ui.pyside6.ui_thread",
    "pycore.pyutils.server.server_runner": "pycore.pyutils.rpc_v2.server.server_runner",
    "pycore.pyutils.openrouter_sdk": "pycore.pyutils.ai_cluster.openrouter.openrouter_client",
    "pycore.pyctl.queue_manager": "pycore.pyctl.desktop.queue_manager",
    "pycore.pyfoundations.heartbeat.heartbeat_thread": "pycore.pyfoundations.heartbeat.thread",
    "pycore.callmodule.platform.windows_tray": "pycore.callmodule.platform.windows_startup_manager",
}

# Longer keys first
ORDERED = sorted(MODULE_MAP.items(), key=lambda kv: -len(kv[0]))


def main() -> None:
    changed = 0
    for path in REPO.rglob("*.py"):
        if "__pycache__" in path.parts or path.name.startswith("_empty_pycore"):
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        new = text
        for wrong, right in ORDERED:
            new = new.replace(f"from {wrong} import", f"from {right} import")
            new = new.replace(f"import {wrong} as", f"import {right} as")
            new = new.replace(f"import {wrong}\n", f"import {right}\n")
        if new != text:
            path.write_text(new, encoding="utf-8")
            changed += 1
            print(f"fixed {path.relative_to(REPO)}")
    print(f"done {changed}")

    # re-scan missing
    import re
    from collections import Counter

    root = REPO / "pycore"
    bad = Counter()
    for p in root.rglob("*.py"):
        if p.name == "__init__.py":
            continue
        t = p.read_text(encoding="utf-8", errors="replace")
        for m in re.finditer(r"from (pycore[\w.]*) import ", t):
            mod = m.group(1)
            base = REPO.joinpath(*mod.split("."))
            if base.with_suffix(".py").exists() or (base / "__init__.py").exists():
                continue
            bad[mod] += 1
    print("--- still missing ---")
    for mod, n in bad.most_common(30):
        print(f"{n:4d} {mod}")


if __name__ == "__main__":
    main()
