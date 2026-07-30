# -*- coding: utf-8 -*-
"""Recover emptied __init__ implementations into concrete modules; fix imports."""
import re
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
MARKER = (
    "# Package marker only. FORBIDDEN: re-exports or package organization here.\n"
    "# Import concrete modules directly (see development-guides/PYTHON_PYCORE.md).\n"
)

# HEAD __init__ path -> concrete module relative path
RECOVER = {
    "pycore/pyctl/desktop/ui/__init__.py": "pycore/pyctl/desktop/ui/voice_subtitle_ui.py",
    "pycore/callmodule/models/upload/__init__.py": "pycore/callmodule/models/upload/models.py",
    "pycore/callmodule/models/client/__init__.py": "pycore/callmodule/models/client/models.py",
    "pycore/callmodule/controllers/client/__init__.py": "pycore/callmodule/controllers/client/controller.py",
    "pycore/callmodule/controllers/upload/__init__.py": "pycore/callmodule/controllers/upload/controller.py",
    "pycore/callmodule/services/client/__init__.py": "pycore/callmodule/services/client/service.py",
    "pycore/callmodule/services/upload/__init__.py": "pycore/callmodule/services/upload/service.py",
}

# Package import prefix -> concrete module for remaining facades
IMPORT_FIXES = [
    (
        r"from pycore\.callmodule\.rpc_routes import register_rpc_routes",
        "from pycore.callmodule.rpc_routes.register_http_routes import register_http_routes as register_rpc_routes",
    ),
    (
        r"from pycore\.pyfoundations import is_cuda_available",
        "from pycore.pyfoundations.pybasecommon.compute_caps import is_cuda_available",
    ),
    (
        r"from pycore\.pyfoundations import get_global_task_queue",
        "from pycore.pyfoundations.tasks import get_global_task_queue",
    ),
    (
        r"from pycore\.pyfoundations import ENCYCLOPEDIA",
        "from pycore.pyfoundations.pybasecommon.encyclopedia import ENCYCLOPEDIA",
    ),
    (
        r"from pycore\.pyfoundations import third_party",
        "import pycore.pyfoundations.third_party.api as third_party",
    ),
    (
        r"from pycore import check_and_install_dependencies",
        "from pycore.pyfoundations.third_party.api import check_and_install_dependencies",
    ),
    (
        r"from pycore\.pyutils\.rpc_v2 import UnifiedRpcServerRunner",
        "from pycore.pyutils.rpc_v2.runner import RpcServerRunner",
    ),
    (
        r"from pycore\.pyutils\.native_ui import FileMonitor",
        "from pycore.pyutils.native_ui.step7_managers.file_monitor import FileMonitor",
    ),
    (
        r"from pycore\.pyutils\.native_ui import WebViewFramework",
        "from pycore.pyutils.native_ui.step5_main_ui.framework import WebViewFramework",
    ),
    (
        r"from pycore\.pyctl\.desktop\.ui import start_voice_subtitle_ui",
        "from pycore.pyctl.desktop.ui.voice_subtitle_ui import start_voice_subtitle_ui",
    ),
    (
        r"from pycore\.pyctl\.desktop\.ui import VoiceSubtitleUIThread",
        "from pycore.pyctl.desktop.ui.voice_subtitle_ui import VoiceSubtitleUIThread",
    ),
    (
        r"from pycore\.callmodule\.services import ai_batch_translate",
        "import pycore.callmodule.services.ai_batch_translate as ai_batch_translate",
    ),
]


def git_show(rel: str) -> str:
    return subprocess.check_output(
        ["git", "-C", str(REPO), "show", f"HEAD:{rel}"],
        text=True,
        errors="replace",
    )


def recover() -> None:
    for src_rel, dst_rel in RECOVER.items():
        content = git_show(src_rel)
        # Fix ColorPrint import in recovered rpc_routes
        content = content.replace(
            "from pycore import ColorPrint",
            "from pycore.pyfoundations.pybasecommon.color_print import ColorPrint",
        )
        # controllers used relative imports to services packages — fix to concrete
        content = content.replace(
            "from ...services.client import ClientService",
            "from pycore.callmodule.services.client.service import ClientService",
        )
        content = content.replace(
            "from ...services.upload import UploadService",
            "from pycore.callmodule.services.upload.service import UploadService",
        )
        dst = REPO / dst_rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(content, encoding="utf-8")
        print(f"recovered {dst_rel}")
        # keep marker at package __init__
        init = REPO / src_rel
        init.write_text(MARKER, encoding="utf-8")


def fix_imports() -> None:
    changed = 0
    for path in REPO.rglob("*.py"):
        if "__pycache__" in path.parts:
            continue
        if path.name.startswith("_empty_pycore"):
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        new = text
        for pat, repl in IMPORT_FIXES:
            new = re.sub(pat, repl, new)
        # submodule-style services: from pycore.callmodule.services import foo as bar
        def _svc_submod(m: re.Match) -> str:
            name = m.group(1)
            alias = m.group(2)
            if alias:
                return f"import pycore.callmodule.services.{name} as {alias}"
            return f"import pycore.callmodule.services.{name} as {name}"

        new2 = re.sub(
            r"from pycore\.callmodule\.services import (\w+)( as (\w+))?",
            lambda m: (
                f"import pycore.callmodule.services.{m.group(1)} as {m.group(3)}"
                if m.group(3)
                else f"import pycore.callmodule.services.{m.group(1)} as {m.group(1)}"
            ),
            new,
        )
        # route_names submodule
        new2 = new2.replace(
            "from pycore.callmodule.rpc_routes import route_names as rn",
            "import pycore.callmodule.rpc_routes.route_names as rn",
        )
        # step4_startup submodule imports
        new2 = re.sub(
            r"from pycore\.pyutils\.native_ui\.step4_startup import (\w+),\s*(\w+)",
            r"from pycore.pyutils.native_ui.step4_startup.\1 import \1\nfrom pycore.pyutils.native_ui.step4_startup.\2 import \2",
            new2,
        )
        if new2 != text:
            path.write_text(new2, encoding="utf-8")
            changed += 1
            print(f"fixed imports {path.relative_to(REPO)}")
    print(f"import-fix files: {changed}")


def verify_rpc_runner() -> None:
    target = REPO / "pycore/pyutils/rpc_v2/runner.py"
    text = target.read_text(encoding="utf-8")
    if "class RpcServerRunner" not in text:
        for p in (REPO / "pycore/pyutils/rpc_v2").rglob("*.py"):
            t = p.read_text(encoding="utf-8", errors="replace")
            if "class RpcServerRunner" in t:
                print(f"RpcServerRunner found in {p.relative_to(REPO)}")
                return
        print("WARNING: RpcServerRunner not found")
    else:
        print("RpcServerRunner OK in runner.py")


def verify_webview() -> None:
    for p in (REPO / "pycore/pyutils/native_ui").rglob("*.py"):
        t = p.read_text(encoding="utf-8", errors="replace")
        if "class WebViewFramework" in t:
            print(f"WebViewFramework in {p.relative_to(REPO)}")
            return
    print("WARNING: WebViewFramework not found")


def main() -> None:
    recover()
    verify_rpc_runner()
    verify_webview()
    fix_imports()


if __name__ == "__main__":
    main()
