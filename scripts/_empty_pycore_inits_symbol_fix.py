# -*- coding: utf-8 -*-
"""Fix remaining symbol-from-package imports that empty __init__ broke."""
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]

REPLACEMENTS = [
    # pybasecommon commander helpers
    (
        "from pycore.pyfoundations.pybasecommon import exec_silent, exec_realtime",
        "from pycore.pyfoundations.pybasecommon.commander import exec_silent, exec_realtime",
    ),
    (
        "from pycore.pyfoundations.pybasecommon import exec_silent",
        "from pycore.pyfoundations.pybasecommon.commander import exec_silent",
    ),
    (
        "from pycore.pyfoundations.pybasecommon import exec_realtime",
        "from pycore.pyfoundations.pybasecommon.commander import exec_realtime",
    ),
    (
        "from pycore.pyfoundations.pybasecommon import Commander",
        "from pycore.pyfoundations.pybasecommon.commander import Commander",
    ),
    (
        "from pycore.pyfoundations.pybasecommon import run_background",
        "from pycore.pyfoundations.pybasecommon.commander import run_background",
    ),
    (
        "from pycore.pyfoundations.pybasecommon import exec_silent, exec_realtime, run_background",
        "from pycore.pyfoundations.pybasecommon.commander import exec_silent, exec_realtime, run_background",
    ),
    # third_party
    (
        "from pycore.pyfoundations.third_party import get_third_package_pyside6",
        "from pycore.pyfoundations.third_party.api import get_third_package_pyside6",
    ),
    (
        "from pycore.pyfoundations.third_party import ",
        "from pycore.pyfoundations.third_party.api import ",
    ),
    # voice subtitle recovered file mistakes
    (
        "from pycore.pyfoundations.pybasecommon.color_print import ColorPrint, THREAD_BUS",
        "from pycore.pyfoundations.pybasecommon.color_print import ColorPrint\n"
        "from pycore.pyfoundations.thread_bus.bus import THREAD_BUS",
    ),
    (
        "from pycore.pyutils.native_ui.step5_main_ui.pyside6 import PySide6Framework, PySide6UIConfig",
        "from pycore.pyutils.native_ui.step5_main_ui.pyside6.framework import PySide6Framework\n"
        "from pycore.pyutils.native_ui.step5_main_ui.pyside6.config import PySide6UIConfig",
    ),
    # device symbols
    (
        "from pycore.pyutils.device import AndroidDevice, ScrcpyDevice, DeviceInfo, ServerParams, VideoCodec, ADBManager, ADBDevice",
        "from pycore.pyutils.device.android_device import AndroidDevice\n"
        "from pycore.pyutils.device.scrcpy_device import ScrcpyDevice\n"
        "from pycore.pyutils.device.device_info import DeviceInfo\n"
        "from pycore.pyutils.device.server_params import ServerParams, VideoCodec\n"
        "from pycore.pyutils.device.adb_manager import ADBManager\n"
        "from pycore.pyutils.device.adb_device import ADBDevice",
    ),
    (
        "from pycore.pyutils.device import ScrcpyDevice",
        "from pycore.pyutils.device.scrcpy_device import ScrcpyDevice",
    ),
    (
        "from pycore.pyutils.device import AndroidDevice",
        "from pycore.pyutils.device.android_device import AndroidDevice",
    ),
    (
        "from pycore.pyutils.device import ADBManager",
        "from pycore.pyutils.device.adb_manager import ADBManager",
    ),
    (
        "from pycore.pyutils.device import ADBDevice",
        "from pycore.pyutils.device.adb_device import ADBDevice",
    ),
]


def rewrite_tts_submodules(text: str) -> str:
    """Rewrite tts/common package imports to concrete modules."""
    tts_dir = REPO / "pycore/pyutils/tts"
    common_dir = REPO / "pycore/pyutils/common"
    tts_symbol_map = {
        "TTS_ENGINE_PRIORITY": "pycore.pyutils.tts.tts_orchestrator",
        "best_engine": "pycore.pyutils.tts.tts_orchestrator",
        "engine_available": "pycore.pyutils.tts.tts_orchestrator",
        "report_tts_engine_startup": "pycore.pyutils.tts.tts_orchestrator",
        "synthesize": "pycore.pyutils.tts.tts_orchestrator",
        "synthesize_engine": "pycore.pyutils.tts.tts_orchestrator",
        "tts_status": "pycore.pyutils.tts.tts_orchestrator",
        "tts_test": "pycore.pyutils.tts.tts_orchestrator",
    }

    def fix_pkg(pkg: str, directory: Path, blob: str, symbol_map=None) -> str:
        symbol_map = symbol_map or {}
        groups = {}
        module_imports = []
        for chunk in blob.replace("(", " ").replace(")", " ").replace("\\", " ").split(","):
            chunk = chunk.strip()
            if not chunk:
                continue
            if " as " in chunk:
                name, alias = [x.strip() for x in chunk.split(" as ", 1)]
            else:
                name, alias = chunk, None
            if name in symbol_map:
                mod = symbol_map[name]
                groups.setdefault(mod, []).append((name, alias))
            elif (directory / f"{name}.py").exists():
                a = alias or name
                module_imports.append(f"import {pkg}.{name} as {a}")
            else:
                # leave as-is
                part = f"{name} as {alias}" if alias else name
                module_imports.append(f"from {pkg} import {part}")
        lines = list(module_imports)
        for mod, items in groups.items():
            parts = [f"{n} as {a}" if a else n for n, a in items]
            lines.append(f"from {mod} import {', '.join(parts)}")
        return "\n".join(lines)

    def repl_tts(m: re.Match) -> str:
        return fix_pkg("pycore.pyutils.tts", tts_dir, m.group(1), tts_symbol_map)

    def repl_common(m: re.Match) -> str:
        return fix_pkg("pycore.pyutils.common", common_dir, m.group(1))

    text = re.sub(r"from pycore\.pyutils\.tts import ([^\n]+)", repl_tts, text)
    text = re.sub(r"from pycore\.pyutils\.common import ([^\n]+)", repl_common, text)
    return text


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
        for old, repl in REPLACEMENTS:
            new = new.replace(old, repl)
        new = rewrite_tts_submodules(new)
        if new != text:
            path.write_text(new, encoding="utf-8")
            changed += 1
            print(f"fixed {path.relative_to(REPO)}")
    print(f"done {changed}")


if __name__ == "__main__":
    main()
