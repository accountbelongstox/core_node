# -*- coding: utf-8 -*-
"""Final pass: fix known broken imports after emptying pycore __init__ markers."""
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]

REPLACEMENTS = [
    (
        "from pycore.pyutils.rpc_v2.server.server_runner import UnifiedRpcServerRunner",
        "from pycore.pyutils.rpc_v2.runner import RpcServerRunner",
    ),
    (
        "from pycore.pyutils.native_ui.step5_main_ui.framework import WebViewFramework",
        "from pycore.pyutils.native_ui.step5_main_ui.pyside6.framework import PySide6Framework as WebViewFramework",
    ),
    (
        "from pycore.pyutils.native_ui.step5_main_ui.framework import PySide6Framework",
        "from pycore.pyutils.native_ui.step5_main_ui.pyside6.framework import PySide6Framework",
    ),
    (
        "from pycore.pyutils.native_ui.step5_main_ui.config import PySide6UIConfig",
        "from pycore.pyutils.native_ui.step5_main_ui.pyside6.config import PySide6UIConfig",
    ),
    (
        "from pycore.pyutils.native_ui.step5_main_ui.system_tray import PySide6TrayMenuItem",
        "from pycore.pyutils.native_ui.step5_main_ui.pyside6.system_tray import PySide6TrayMenuItem",
    ),
    (
        "from pycore.pyfoundations.color_print import ColorPrint",
        "from pycore.pyfoundations.pybasecommon.color_print import ColorPrint",
    ),
    (
        "from pycore.pyfoundations.user_data_store import",
        "from pycore.database.repositories.user_data_store import",
    ),
    (
        "from pycore.pyutils.native_ui.step4_startup.startup_ui_builder import startup_ui_builder",
        "from pycore.pyutils.native_ui.step4_startup import startup_ui_builder",
    ),
    (
        "from pycore.pyutils.native_ui.step4_startup.startup_tray_runner import startup_tray_runner",
        "from pycore.pyutils.native_ui.step4_startup import startup_tray_runner",
    ),
]

# Fix mistaken "from package.mod import mod" when mod is a module file used as attribute
# startup_ui_builder is a module — importing the name from itself is wrong if the module
# doesn't export startup_ui_builder. Check: they import the module for callables inside.


def main() -> None:
    # Revert bad step4 fixes: modules should be imported as modules
    # Correct form:
    #   import pycore.pyutils.native_ui.step4_startup.startup_ui_builder as startup_ui_builder
    special = [
        (
            "from pycore.pyutils.native_ui.step4_startup.startup_ui_builder import startup_ui_builder",
            "import pycore.pyutils.native_ui.step4_startup.startup_ui_builder as startup_ui_builder",
        ),
        (
            "from pycore.pyutils.native_ui.step4_startup.startup_tray_runner import startup_tray_runner",
            "import pycore.pyutils.native_ui.step4_startup.startup_tray_runner as startup_tray_runner",
        ),
        (
            "from pycore.pyutils.native_ui.step4_startup import startup_ui_builder\n"
            "from pycore.pyutils.native_ui.step4_startup import startup_tray_runner",
            "import pycore.pyutils.native_ui.step4_startup.startup_ui_builder as startup_ui_builder\n"
            "import pycore.pyutils.native_ui.step4_startup.startup_tray_runner as startup_tray_runner",
        ),
    ]

    all_repl = REPLACEMENTS + special
    changed = 0
    for path in REPO.rglob("*.py"):
        if "__pycache__" in path.parts or path.name.startswith("_empty_pycore"):
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        new = text
        for old, repl in all_repl:
            new = new.replace(old, repl)
        if new != text:
            path.write_text(new, encoding="utf-8")
            changed += 1
            print(f"fixed {path.relative_to(REPO)}")
    print(f"done files={changed}")
if __name__ == "__main__":
    main()
