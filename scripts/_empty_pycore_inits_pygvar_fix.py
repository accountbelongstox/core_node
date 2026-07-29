# -*- coding: utf-8 -*-
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]

pygvar_map = {
    "WS_RPC_CONSTANTS": "pycore.pyfoundations.pygvar.ws_rpc_constants",
    "GlobalVarManager": "pycore.pyfoundations.pygvar.global_var_manager",
    "GLOBAL_VARS_DIR": "pycore.pyfoundations.pygvar.global_var_manager",
    "PYTOOLS_TMP_DIR": "pycore.pyfoundations.pygvar.global_var_manager",
}
const = (REPO / "pycore/pyfoundations/pygvar/constants.py").read_text(encoding="utf-8")
for m in re.finditer(r"^([A-Z][A-Z0-9_]*)\s*=", const, re.M):
    pygvar_map[m.group(1)] = "pycore.pyfoundations.pygvar.constants"

SIMPLE = [
    (
        "from pycore.callmodule.controllers.client import ClientController",
        "from pycore.callmodule.controllers.client.controller import ClientController",
    ),
    (
        "from pycore.callmodule.controllers.upload import UploadController",
        "from pycore.callmodule.controllers.upload.controller import UploadController",
    ),
    (
        "from pycore.pyutils.pybrowser.fetchers import HTTPFetcher, BrowserFetcher, IframeFetcher, TampermonkeyFetcher",
        "from pycore.pyutils.pybrowser.fetchers.http_fetcher import HTTPFetcher\n"
        "from pycore.pyutils.pybrowser.fetchers.browser_fetcher import BrowserFetcher\n"
        "from pycore.pyutils.pybrowser.fetchers.iframe_fetcher import IframeFetcher\n"
        "from pycore.pyutils.pybrowser.fetchers.tampermonkey_fetcher import TampermonkeyFetcher",
    ),
    (
        "from pycore.callmodule.platform import system_service_manager as ssm",
        "import pycore.callmodule.platform.system_service_manager as ssm",
    ),
]


def rewrite_pygvar(text: str) -> str:
    def repl(m: re.Match) -> str:
        names = m.group(1)
        groups = {}
        for chunk in names.replace("(", "").replace(")", "").replace("\\", " ").split(","):
            chunk = chunk.strip()
            if not chunk:
                continue
            if " as " in chunk:
                name, alias = [x.strip() for x in chunk.split(" as ", 1)]
            else:
                name, alias = chunk, None
            mod = pygvar_map.get(name, "pycore.pyfoundations.pygvar.constants")
            groups.setdefault(mod, []).append((name, alias))
        lines = []
        for mod, items in groups.items():
            parts = [f"{n} as {a}" if a else n for n, a in items]
            lines.append(f"from {mod} import {', '.join(parts)}")
        return "\n".join(lines)

    text = re.sub(
        r"from pycore\.pyfoundations\.pygvar import \(([^)]+)\)",
        repl,
        text,
        flags=re.S,
    )
    text = re.sub(r"from pycore\.pyfoundations\.pygvar import ([^\n]+)", repl, text)
    return text


def main() -> None:
    n = 0
    for path in REPO.rglob("*.py"):
        if "__pycache__" in path.parts or path.name.startswith("_empty_pycore"):
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        new = text
        for a, b in SIMPLE:
            new = new.replace(a, b)
        new = rewrite_pygvar(new)
        if new != text:
            path.write_text(new, encoding="utf-8")
            n += 1
            print(path.relative_to(REPO))
    print(f"fixed {n}")


if __name__ == "__main__":
    main()
