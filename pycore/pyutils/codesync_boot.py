# -*- coding: utf-8 -*-
"""
Standalone bootstrap for the lightweight Code Sync library.

Run AS A FILE (not `python -m ...`):

    python <repo>/pycore/pyutils/codesync_boot.py <args...>

Because it is run as a file, sys.path[0] becomes this file's directory
(<repo>/pycore/pyutils), so `import codesync` resolves the package as a
TOP-LEVEL name — which means pycore/__init__.py and pycore/pyutils/__init__.py
are NEVER executed. The result: no `third_party`, no CUDA/database init, no heavy
pycore import; only the Python standard library is loaded.

This is the entry point used by `pyservice.sh codesync` / `pyservice.ps1 codesync`.
It must stay stdlib-only and must never `import pycore`.
"""

import os
import sys

# Make `codesync` importable as a top-level package (defensive; running this file
# directly already puts this dir on sys.path[0]).
_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)


def _scan_conflict_markers(pkg_dir):
    """Return the .py files under pkg_dir that contain unresolved git conflict
    markers. codesync writes code into a git working tree, so a `git pull` on a
    client can leave '<<<<<<< / ======= / >>>>>>>' blocks in a module — which is
    invalid Python and would otherwise crash the import with a cryptic traceback
    that systemd then crash-loops. We scan as TEXT (before import) so we can fail
    with a clear, actionable message instead. The angle-bracket markers are never
    valid Python, so matching them gives no false positives."""
    bad = []
    for root, dirs, files in os.walk(pkg_dir):
        dirs[:] = [d for d in dirs if d not in ("__pycache__", ".git")]
        for fn in files:
            if not fn.endswith(".py"):
                continue
            path = os.path.join(root, fn)
            try:
                with open(path, "r", encoding="utf-8", errors="replace") as fh:
                    for line in fh:
                        s = line.rstrip("\r\n")
                        if s.startswith("<<<<<<< ") or s.startswith(">>>>>>> ") \
                                or s == "<<<<<<<" or s == ">>>>>>>":
                            bad.append(path)
                            break
            except Exception:
                continue
    return bad


def _git(repo, *args, timeout=30):
    import subprocess
    try:
        return subprocess.run(["git", "-C", repo, *args], capture_output=True,
                              text=True, timeout=timeout)
    except Exception:
        return None


def _try_autoheal(repo):
    """NON-destructive self-heal: a conflicted `git pull` leaves an interrupted
    merge/rebase whose working tree has '<<<<<<<' markers. Aborting it restores the
    last good committed tree — no committed work is lost. Returns True if it ran an
    abort. Optionally (CODESYNC_AUTOHEAL_HARD=1) a harder reset to the upstream,
    for pure clients that only ever RECEIVE code (this DOES discard local edits)."""
    healed = False
    # `merge --abort` / `rebase --abort` are harmless no-ops when nothing is in
    # progress, so we can try both unconditionally and re-scan afterwards.
    for op in (("merge", "--abort"), ("rebase", "--abort")):
        r = _git(repo, *op)
        if r is not None and r.returncode == 0:
            healed = True
    if os.environ.get("CODESYNC_AUTOHEAL_HARD", "") in ("1", "true", "True"):
        # Determine the upstream; fall back to origin/main.
        up = _git(repo, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")
        target = (up.stdout.strip() if up and up.returncode == 0 and up.stdout.strip()
                  else "origin/main")
        r = _git(repo, "reset", "--hard", target)
        if r is not None and r.returncode == 0:
            healed = True
    return healed


def _preflight():
    pkg = os.path.join(_HERE, "codesync")
    conflicts = _scan_conflict_markers(pkg)
    if not conflicts:
        return
    repo = os.path.dirname(os.path.dirname(_HERE))  # <repo>/pycore/pyutils -> <repo>
    # Try to self-heal a crash-loop: abort an interrupted merge/rebase, re-scan.
    if _try_autoheal(repo):
        if not _scan_conflict_markers(pkg):
            sys.stderr.write("[CodeSync] auto-healed: aborted an interrupted git "
                             "merge/rebase that had left conflict markers; starting.\n")
            sys.stderr.flush()
            return
    msg = ["[CodeSync] ABORT: unresolved git conflict markers in the codesync package:"]
    for p in conflicts:
        msg.append(f"   - {p}")
    msg += [
        "[CodeSync] codesync writes code into this git working tree, so a `git pull`",
        "[CodeSync] on a client can conflict with pushed files. Resolve ON THIS machine,",
        "[CodeSync] then the service will start cleanly:",
        f"[CodeSync]   cd {repo} && git reset --hard origin/main   # pure client: mirror the dev",
        "[CodeSync]   # or hand-edit each file above, removing the <<<<<<< / ======= / >>>>>>> blocks",
        "[CodeSync] Or let it self-heal automatically on a pure client (DISCARDS local",
        "[CodeSync] edits) by setting CODESYNC_AUTOHEAL_HARD=1 in the service environment.",
    ]
    sys.stderr.write("\n".join(msg) + "\n")
    sys.stderr.flush()
    raise SystemExit(2)


_preflight()

import codesync  # noqa: E402  (top-level name; does NOT trigger pycore/__init__.py)

if __name__ == "__main__":
    raise SystemExit(codesync.cli.main(sys.argv[1:]))
