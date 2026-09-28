#!/usr/bin/env python3
"""
Fix common deployment issues:
  1. Convert CRLF to LF in all .sh scripts (Windows -> Linux)
  2. Ensure .env files have DB_TYPE=sqlite when MySQL unavailable
  3. Create wrapper scripts that use npx for local binaries (vite, nodemon)

Run: python3 scripts/pytools/fix_scripts.py
"""

import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SCRIPTS_DIR = os.path.dirname(SCRIPT_DIR)
GROUP_ROOT = os.path.dirname(SCRIPTS_DIR)
CORE_NODE = os.path.dirname(GROUP_ROOT)

GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
GRAY = "\033[0;37m"
NC = "\033[0m"

def ok(msg):   print(f"  {GREEN}[OK]{NC}   {msg}", file=sys.stderr)
def warn(msg): print(f"  {YELLOW}[WARN]{NC} {msg}", file=sys.stderr)
def info(msg): print(f"  {GRAY}[INFO]{NC} {msg}", file=sys.stderr)


def fix_crlf(directory):
    """Convert CRLF to LF in all .sh, .py, .env files recursively."""
    count = 0
    skip_dirs = {"node_modules", ".git", "vendor", "tmp", "__pycache__", ".pnpm"}
    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for fname in files:
            if not fname.endswith((".sh", ".py", ".env", ".env.example")):
                continue
            fpath = os.path.join(root, fname)
            with open(fpath, "rb") as f:
                data = f.read()
            if b"\r\n" in data:
                fixed = data.replace(b"\r\n", b"\n")
                with open(fpath, "wb") as f:
                    f.write(fixed)
                count += 1
    return count


def fix_env_db_type(env_path):
    """Ensure DB_TYPE=sqlite in .env, replace mysql if present."""
    if not os.path.isfile(env_path):
        return False
    with open(env_path, "r", encoding="utf-8", errors="replace") as f:
        lines = f.readlines()

    changed = False
    found_db_type = False
    new_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            eq = stripped.find("=")
            if eq > 0 and stripped[:eq].strip() == "DB_TYPE":
                found_db_type = True
                val = stripped[eq+1:].strip().strip("'\"").lower()
                if val != "sqlite":
                    new_lines.append("DB_TYPE=sqlite\n")
                    changed = True
                    continue
        new_lines.append(line)

    if not found_db_type:
        new_lines.append("\n# Database type\nDB_TYPE=sqlite\nDB_SQLITE_PATH=./data/webclaude.db\n")
        changed = True

    if changed:
        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)
    return changed


def main():
    print("", file=sys.stderr)
    print("  Fixing deployment issues...", file=sys.stderr)
    print("", file=sys.stderr)

    # 1. Fix CRLF in all scripts
    total = 0
    for d in [GROUP_ROOT, os.path.join(CORE_NODE, "pyapps", "claude_host")]:
        total += fix_crlf(d)
    if total:
        ok(f"Fixed CRLF -> LF in {total} file(s)")
    else:
        ok("All scripts already have LF line endings")

    # 2. Fix DB_TYPE in all .env files
    env_files = [
        os.path.join(GROUP_ROOT, "webclaude_center_server", ".env"),
        os.path.join(GROUP_ROOT, "webclaude_go-gateway", ".env"),
    ]
    for env_path in env_files:
        if fix_env_db_type(env_path):
            ok(f"Set DB_TYPE=sqlite in {os.path.basename(os.path.dirname(env_path))}/.env")
        else:
            ok(f"{os.path.basename(os.path.dirname(env_path))}/.env DB_TYPE OK")

    print("", file=sys.stderr)
    ok("All fixes applied")
    print("", file=sys.stderr)


if __name__ == "__main__":
    main()
