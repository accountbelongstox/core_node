# -*- coding: utf-8 -*-
"""Recover __init__ bodies that defined real logic into concrete modules."""
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
MARKER = (
    "# Package marker only. FORBIDDEN: re-exports or package organization here.\n"
    "# Import concrete modules directly (see development-guides/PYTHON_PYCORE.md).\n"
)

# Already relocated — do not recover into duplicate
SKIP = {
    "pycore/pyfoundations/thread_bus/__init__.py",
    "pycore/pyfoundations/third_party/__init__.py",
    "pycore/database/__init__.py",
    "pycore/pylauncher/__init__.py",
    "pycore/__init__.py",
    "pycore/pyfoundations/__init__.py",
    "pycore/pyutils/__init__.py",
}


def git_show(rel: str) -> str:
    return subprocess.check_output(
        ["git", "-C", str(REPO), "show", f"HEAD:{rel}"],
        text=True,
        errors="replace",
    )


def main() -> None:
    listed = subprocess.check_output(
        ["git", "-C", str(REPO), "ls-files", "pycore/**/__init__.py"],
        text=True,
    ).splitlines()

    recover = []
    for rel in listed:
        rel = rel.replace("\\", "/")
        if rel in SKIP:
            continue
        content = git_show(rel)
        if "def " not in content and "class " not in content:
            continue
        # Suggest concrete name: register_*.py or package_api.py
        pkg_dir = REPO / Path(rel).parent
        if "register_" in content and "def register_" in content:
            target = pkg_dir / "register.py"
        else:
            target = pkg_dir / "_package_impl.py"
        recover.append((rel, len(content.splitlines()), target))

    print(f"candidates with def/class: {len(recover)}")
    for rel, lines, target in sorted(recover, key=lambda x: -x[1])[:50]:
        print(f"{lines:4d} {rel} -> {target.relative_to(REPO)}")


if __name__ == "__main__":
    main()
