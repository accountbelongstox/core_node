# -*- coding: utf-8 -*-
"""One-shot: relocate critical __init__ bodies to concrete modules (Phase 1)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "pycore"
MARKER = (
    "# Package marker only. FORBIDDEN: re-exports or package organization here.\n"
    "# Import concrete modules directly (see development-guides/PYTHON_PYCORE.md).\n"
)


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {path.relative_to(ROOT.parent)} ({len(text.splitlines())} lines)")


def move_thread_bus() -> None:
    src = ROOT / "pyfoundations/thread_bus/__init__.py"
    dst = ROOT / "pyfoundations/thread_bus/bus.py"
    text = src.read_text(encoding="utf-8")
    text = text.replace(
        "from pycore import THREAD_BUS",
        "from pycore.pyfoundations.thread_bus.bus import THREAD_BUS",
    )
    text = text.replace(
        "__init__.py (this file)   : ThreadBus facade + THREAD_BUS singleton",
        "bus.py (this file)        : ThreadBus facade + THREAD_BUS singleton",
    )
    write(dst, text)


def move_third_party() -> None:
    src = ROOT / "pyfoundations/third_party/__init__.py"
    dst = ROOT / "pyfoundations/third_party/api.py"
    write(dst, src.read_text(encoding="utf-8"))


def move_pylauncher_register() -> None:
    text = '''# -*- coding: utf-8 -*-
"""Register pylauncher providers into pyfoundations (import once at startup)."""

from pycore.pylauncher.launcher import ServiceLauncher
from pycore.pylauncher.app_executable_launcher import get_app_executable_launcher
from pycore.pyfoundations.app_launcher import register_executable_launcher_provider
from pycore.pyfoundations.service_launcher_provider import register_service_launcher_provider

register_executable_launcher_provider(get_app_executable_launcher)
register_service_launcher_provider(ServiceLauncher)
'''
    write(ROOT / "pylauncher/register_providers.py", text)


def move_database_exports() -> None:
    src = ROOT / "database/__init__.py"
    dst = ROOT / "database/exports.py"
    text = src.read_text(encoding="utf-8")
    text = text.replace(
        "from pycore.pyfoundations.third_party import get_third_package_sqlalchemy",
        "from pycore.pyfoundations.third_party.api import get_third_package_sqlalchemy",
    )
    write(dst, text)


def move_i18n_singleton() -> None:
    mgr = ROOT / "pyutils/native_ui/step0_i18n/i18n_manager.py"
    text = mgr.read_text(encoding="utf-8")
    if "\ni18n =" not in text and not text.rstrip().endswith("i18n = get_i18n_manager()"):
        if "def get_i18n_manager" in text:
            text = text.rstrip() + "\n\n# Module-level singleton (was step0_i18n/__init__.py)\ni18n = get_i18n_manager()\n"
            write(mgr, text)


def main() -> None:
    move_thread_bus()
    move_third_party()
    move_pylauncher_register()
    move_database_exports()
    move_i18n_singleton()
    print("phase1 relocate done")


if __name__ == "__main__":
    main()
