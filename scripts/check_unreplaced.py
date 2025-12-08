import argparse
import sys
from pathlib import Path


def scan(root: Path, patterns: list[str]) -> int:
    matches = []
    android_root = root / "android"
    skip_dirs = {"node_modules", ".git", ".gradle", "build", ".cxx", "outputs", "intermediates", "generated", ".kotlin"}
    skip_exts = {".so", ".dll", ".exe", ".apk", ".aab", ".dex", ".jar", ".aar"}

    for path in android_root.rglob("*"):
        if any(part in skip_dirs for part in path.parts):
            continue
        if not path.is_file():
            continue
        if path.suffix.lower() in skip_exts:
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        found = False
        for pat in patterns:
            if pat in text:
                matches.append((path, pat))
                found = True
                break
        if found:
            print(f"[SCAN] {path}")

    if not matches:
        print("[SCAN] No occurrences found.")
        return 0

    print("[SCAN] Found occurrences:")
    for p, pat in matches:
        print(f"{p} :: {pat}")
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Scan for unreplaced strings.")
    parser.add_argument("--root", required=True, help="Root directory to scan.")
    parser.add_argument(
        "--patterns",
        nargs="+",
        required=True,
        help="Strings to search for.",
    )
    args = parser.parse_args()
    return scan(Path(args.root), args.patterns)


if __name__ == "__main__":
    sys.exit(main())
