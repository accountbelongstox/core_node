# -*- coding: utf-8 -*-
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]

PYGVAR_MODULE = "pycore.pyfoundations.pygvar"

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
        "from pycore.pyutils.pybrowser.fetchers import HTTPFetcher, BrowserFetcher",
        "from pycore.pyutils.pybrowser.fetchers.http_fetcher import HTTPFetcher\n"
        "from pycore.pyutils.pybrowser.fetchers.browser_fetcher import BrowserFetcher\n"
        "",
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
            groups.setdefault(PYGVAR_MODULE, []).append((name, alias))
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
