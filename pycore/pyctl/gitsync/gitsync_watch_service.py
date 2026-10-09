# -*- coding: utf-8 -*-
"""Automatic `dd gitsync` pipeline: each machine runs on its own wall-clock slot, takes the
LAN turn so no two LAN pycores sync at once, announces its result to the LAN peers (which
pull soon after a push) and to the agent bus; an unresolved merge conflict is written to
docs_fix (alert document + first README line) and reminded on the desktop until fixed."""

from __future__ import annotations

import hashlib
import itertools
import json
import os
import random
import socket
import subprocess
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyctl.gitsync.gitsync_lan_turn import PIPELINE, gitsync_lan_turn
from pycore.pyfoundations.atomic_json_store import AtomicJsonStore
from pycore.pyfoundations.event_journal import event_journal
from pycore.pyfoundations.file_lock import FileLockManager
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import IS_WINDOWS
from pycore.pyfoundations.service_contract import value as service_contract_value
from pycore.pyfoundations.system_paths import APP_DATA_DIR, get_core_node_root
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyfoundations.windowless_subprocess import CREATE_NO_WINDOW
from pycore.pyutils.laravel.agent_bus_client import agent_bus_client
from pycore.pyutils.native_ui.step0_i18n.i18n_keys import I18nKeys
from pycore.pyutils.native_ui.step0_i18n.i18n_manager import i18n
from pycore.pyutils.native_ui.step11_desktop.system_notification import show_system_notification

LABEL = "GitSyncWatch"
DATA_DIR = APP_DATA_DIR / "gitsync_watch"
SETTINGS_PATH = DATA_DIR / "settings.json"
HISTORY_PATH = DATA_DIR / "history.json"
SCHEDULER_LOCK_TARGET = DATA_DIR / "scheduler"
STOP_SIGNAL = "gitsync.watch.stop"
SHUTDOWN_HANDLER_NAME = "gitsync_watch"
SHUTDOWN_HANDLER_PRIORITY = 6

DEFAULT_INTERVAL_MINUTES = 5
MIN_INTERVAL_MINUTES = 1
MAX_INTERVAL_MINUTES = 1440
DEFAULT_REMINDER_SECONDS = 10
MIN_REMINDER_SECONDS = 5
MAX_REMINDER_SECONDS = 3600
LOOP_TICK_SECONDS = 1.0
START_DELAY_SECONDS = 30
RUN_TIMEOUT_SECONDS = 600
OUTPUT_TAIL_LINES = 80
HISTORY_MAX_RUNS = 10
HISTORY_DEFAULT_PAGE_SIZE = 10
HISTORY_MAX_PAGE_SIZE = 100
TRIGGER_SCHEDULE = "schedule"
TRIGGER_MANUAL = "manual"
TRIGGER_PEER = "peer"
NOTIFICATION_DURATION_MS = 8000
SLOT_HASH_HEX_CHARS = 8
PEER_PULL_DELAY_MIN_SECONDS = float(PIPELINE["peer_pull_delay_min_seconds"])
PEER_PULL_DELAY_MAX_SECONDS = float(PIPELINE["peer_pull_delay_max_seconds"])
PEER_PULL_MIN_GAP_SECONDS = float(PIPELINE["peer_pull_min_gap_seconds"])
NOTIFY_COMMITS_MAX = int(PIPELINE["notify_commits_max"])
NOTIFY_FILES_MAX = int(PIPELINE["notify_files_max"])
UPSTREAM_REF = "@{u}"
FETCH_HEAD_NAME = "FETCH_HEAD"

COMMIT_DESCRIPTION = "pycore-auto-gitsync"
DD_ENTRY_WINDOWS = "dd.cmd"
DD_ENTRY_LINUX = "dd.sh"
GITSYNC_COMMAND = "gitsync"
MESSAGE_FLAG = "-m"
NONINTERACTIVE_ENV = {"DD_AUTO_CONTINUE": "1", "NONINTERACTIVE": "1", "GIT_TERMINAL_PROMPT": "0"}
BLOCKING_GIT_STATES = ("rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD", "REVERT_HEAD")

CONFLICT_DOC_RELATIVE = service_contract_value("code_sync.conflict_doc")
CONFLICT_README_RELATIVE = service_contract_value("code_sync.conflict_readme")
DOCS_FIX_DIR_NAME = Path(CONFLICT_DOC_RELATIVE).parent.as_posix()
CONFLICT_DOC_NAME = Path(CONFLICT_DOC_RELATIVE).name
README_NAME = Path(CONFLICT_README_RELATIVE).name
README_MARKER = service_contract_value("code_sync.conflict_readme_marker")
README_ALERT_LINE = (
    f"{README_MARKER} **AI: an automatic gitsync hit an unresolved merge conflict. Fix it immediately: "
    f"read `{CONFLICT_DOC_RELATIVE}`, resolve it, then delete that file and this line.**"
)


def _fill(template: str, **values: str) -> str:
    for name, text in values.items():
        template = template.replace("{" + name + "}", text)
    return template


AI_PROMPT = _fill(
    service_contract_value("code_sync.conflict_ai_prompt"),
    repo=str(get_core_node_root()),
    context=_fill(service_contract_value("code_sync.conflict_ai_prompt_doc"), doc=CONFLICT_DOC_RELATIVE),
    cleanup=_fill(
        service_contract_value("code_sync.conflict_ai_prompt_cleanup"),
        doc=CONFLICT_DOC_RELATIVE,
        readme=CONFLICT_README_RELATIVE,
        marker=README_MARKER,
    ),
)


def _clamp(value: Any, low: int, high: int, default: int) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return default
    return max(low, min(high, number))


class GitSyncWatchService:
    def __init__(self) -> None:
        self._root = get_core_node_root()
        self._docs_dir = self._root / DOCS_FIX_DIR_NAME
        self._lock = threading.Lock()
        self._lease_lock = FileLockManager(SCHEDULER_LOCK_TARGET, verbose=False)
        self._lease: Optional[int] = None
        self._thread: Optional[threading.Thread] = None
        # Paused lasts until this process exits: a pycore restart resumes automatic gitsync.
        self._paused = False
        self._running = False
        self._run_requested = False
        self._peer_run_due: Optional[float] = None
        self._last_finished_monotonic = 0.0
        self._waiting_for: Optional[str] = None
        self._last_push: Dict[str, Any] = {}
        # Starts at the boot time so a UI holding a revision of the previous process never matches.
        self._revision_counter = itertools.count(int(time.time() * 1000))
        self._revision = next(self._revision_counter)
        self._last_run_at: Optional[float] = None
        self._last_result = ""
        self._last_output = ""
        settings = self._read_settings()
        self._interval_minutes = settings["interval_minutes"]
        self._reminder_seconds = settings["reminder_seconds"]
        self._history_store = AtomicJsonStore(HISTORY_PATH, lambda: {"total": 0, "runs": []})
        self._history = self._read_history()

    # ---- settings ----

    def _read_settings(self) -> Dict[str, int]:
        try:
            stored = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            stored = {}
        return {
            "interval_minutes": _clamp(stored.get("interval_minutes"), MIN_INTERVAL_MINUTES, MAX_INTERVAL_MINUTES, DEFAULT_INTERVAL_MINUTES),
            "reminder_seconds": _clamp(stored.get("reminder_seconds"), MIN_REMINDER_SECONDS, MAX_REMINDER_SECONDS, DEFAULT_REMINDER_SECONDS),
        }

    def _write_settings(self) -> None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        SETTINGS_PATH.write_text(
            json.dumps({"interval_minutes": self._interval_minutes, "reminder_seconds": self._reminder_seconds}),
            encoding="utf-8",
        )

    def _read_history(self) -> Dict[str, Any]:
        try:
            stored = self._history_store.read()
        except (OSError, ValueError) as exc:
            ColorPrint.yellow(f"[{LABEL}] history read failed: {type(exc).__name__}: {exc}")
            return {"total": 0, "runs": []}
        runs = [run for run in stored.get("runs") or [] if isinstance(run, dict)][:HISTORY_MAX_RUNS]
        return {"total": max(_clamp(stored.get("total"), 0, 2**62, 0), len(runs)), "runs": runs}

    def _record_run(self, run: Dict[str, Any]) -> None:
        with self._lock:
            self._history = {
                "total": self._history["total"] + 1,
                "runs": [run, *self._history["runs"]][:HISTORY_MAX_RUNS],
            }
            snapshot = self._history
        try:
            self._history_store.write(snapshot)
        except OSError as exc:
            ColorPrint.yellow(f"[{LABEL}] history write failed: {exc}")

    # ---- public API (UI routes) ----

    def history(self, offset: int = 0, limit: int = HISTORY_DEFAULT_PAGE_SIZE) -> Dict[str, Any]:
        """One page of the recorded gitsync runs, newest first."""
        offset = max(0, int(offset))
        limit = _clamp(limit or HISTORY_DEFAULT_PAGE_SIZE, 1, HISTORY_MAX_PAGE_SIZE, HISTORY_DEFAULT_PAGE_SIZE)
        with self._lock:
            runs = self._history["runs"]
            total = self._history["total"]
        return {
            "success": True,
            "total": total,
            "recorded": len(runs),
            "offset": offset,
            "limit": limit,
            "runs": runs[offset:offset + limit],
        }

    @property
    def conflict_doc_path(self) -> Path:
        return self._docs_dir / CONFLICT_DOC_NAME

    def _changed(self) -> None:
        """Every state change bumps the revision and wakes UIs on the journal topic (they refetch only then)."""
        self._revision = next(self._revision_counter)
        event_journal.publish_topic(BusSignals.GITSYNC_CHANGED, {"revision": self._revision})

    def state(self, known_revision: Optional[int] = None) -> Dict[str, Any]:
        """Full state, or only the revision when the caller already holds it."""
        if known_revision is not None and known_revision == self._revision:
            return {"success": True, "revision": self._revision, "unchanged": True}
        doc = self.conflict_doc_path
        conflict = doc.is_file()
        return {
            "success": True,
            "revision": self._revision,
            "unchanged": False,
            "paused": self._paused,
            "running": self._running,
            "scheduler_active": self._lease is not None,
            "interval_minutes": self._interval_minutes,
            "reminder_seconds": self._reminder_seconds,
            "last_run_at": self._last_run_at,
            "last_result": self._last_result,
            "run_count": self._history["total"],
            "conflict": conflict,
            "conflict_doc": str(doc),
            "conflict_files": self._unmerged_files() if conflict else [],
            "ai_prompt": AI_PROMPT if conflict else "",
            "waiting_for_turn": self._waiting_for is not None,
            "turn_holder": self._waiting_for or "",
            "last_push": self._last_push,
            "lan": gitsync_lan_turn.snapshot()["peers"],
        }

    # ---- LAN peer API (peer routes) ----

    def peer_claim(self, machine: str, hostname: str, ticket: float) -> Dict[str, Any]:
        reply = gitsync_lan_turn.decide_claim(machine, hostname, ticket)
        if reply["granted"]:
            self._changed()
        return reply

    def peer_release(self, machine: str, hostname: str, summary: Dict[str, Any]) -> Dict[str, Any]:
        """A peer finished; after it pushed, pull soon (jittered, never within the minimum gap of the last run)."""
        gitsync_lan_turn.apply_release(machine, hostname, summary)
        if int(summary.get("pushed") or 0) > 0 and not self._paused:
            due = time.monotonic() + random.uniform(PEER_PULL_DELAY_MIN_SECONDS, PEER_PULL_DELAY_MAX_SECONDS)
            due = max(due, self._last_finished_monotonic + PEER_PULL_MIN_GAP_SECONDS)
            self._peer_run_due = due if self._peer_run_due is None else min(self._peer_run_due, due)
        self._changed()
        return {"success": True}

    def control(
        self,
        paused: Optional[bool] = None,
        interval_minutes: Optional[int] = None,
        reminder_seconds: Optional[int] = None,
        run_now: bool = False,
    ) -> Dict[str, Any]:
        with self._lock:
            if paused is not None and paused != self._paused:
                self._paused = paused
                ColorPrint.blue(f"[{LABEL}] automatic gitsync {'paused until restart' if paused else 'resumed'}")
            changed = False
            if interval_minutes is not None:
                self._interval_minutes = _clamp(interval_minutes, MIN_INTERVAL_MINUTES, MAX_INTERVAL_MINUTES, self._interval_minutes)
                changed = True
            if reminder_seconds is not None:
                self._reminder_seconds = _clamp(reminder_seconds, MIN_REMINDER_SECONDS, MAX_REMINDER_SECONDS, self._reminder_seconds)
                changed = True
            if changed:
                self._write_settings()
            if run_now:
                self._run_requested = True
        self._changed()
        return self.state()

    # ---- scheduler ----

    def start(self) -> bool:
        if self._thread is not None:
            return True
        THREAD_BUS.clear_signal(STOP_SIGNAL)
        self._thread = threading.Thread(target=self._run, name="GitSyncWatchThread", daemon=True)
        self._thread.start()
        THREAD_BUS.register_shutdown_handler(self._shutdown, priority=SHUTDOWN_HANDLER_PRIORITY, name=SHUTDOWN_HANDLER_NAME)
        return True

    def _acquire_lease(self) -> bool:
        waiting_logged = False
        while not self._stopping():
            lease = self._lease_lock.try_hold()
            if lease is not None:
                self._lease = lease
                return True
            if not waiting_logged:
                ColorPrint.blue(f"[{LABEL}] lease held by another pycore process; waiting")
                waiting_logged = True
            if THREAD_BUS.wait_signal(STOP_SIGNAL, timeout=DEFAULT_INTERVAL_MINUTES * 60):
                break
        return False

    @staticmethod
    def _stopping() -> bool:
        return THREAD_BUS.is_shutdown_requested() or bool(THREAD_BUS.get_signal(STOP_SIGNAL, False))

    def _run(self) -> None:
        if not self._acquire_lease():
            return
        ColorPrint.green(f"[{LABEL}] started interval={self._interval_minutes}min reminder={self._reminder_seconds}s")
        next_sync = time.monotonic() + max(START_DELAY_SECONDS, self._slot_delay())
        next_reminder = time.monotonic()
        # True also at start: a README alert left without its document is cleaned once.
        alert_may_remain = True
        while not THREAD_BUS.wait_signal(STOP_SIGNAL, timeout=LOOP_TICK_SECONDS):
            if self._stopping():
                return
            now = time.monotonic()
            if self.conflict_doc_path.is_file():
                # Unfixed conflict (also after a restart): remind, never sync on top of it.
                if not alert_may_remain:
                    self._changed()
                alert_may_remain = True
                if now >= next_reminder:
                    self._remind()
                    next_reminder = now + self._reminder_seconds
                continue
            if alert_may_remain:
                self._remove_readme_alert()
                alert_may_remain = False
                self._changed()
            peer_due = self._peer_run_due is not None and now >= self._peer_run_due
            if self._run_requested or (not self._paused and (now >= next_sync or peer_due)):
                trigger = TRIGGER_MANUAL if self._run_requested else TRIGGER_SCHEDULE if now >= next_sync else TRIGGER_PEER
                self._run_requested = False
                self._peer_run_due = None
                self._sync_once(trigger)
                next_sync = time.monotonic() + self._slot_delay()
                next_reminder = time.monotonic()

    def _slot_delay(self) -> float:
        """Seconds to this machine's next wall-clock slot: a fixed offset (hash of the machine id) inside the
        interval, so machines that share an interval start at different moments."""
        period = self._interval_minutes * 60
        digest = hashlib.sha256(gitsync_lan_turn.machine.encode("utf-8")).hexdigest()[:SLOT_HASH_HEX_CHARS]
        offset = int(digest, 16) % period
        now = time.time()
        return ((now - offset) // period + 1) * period + offset - now

    def _wait_turn(self, seconds: float) -> bool:
        return bool(THREAD_BUS.wait_signal(STOP_SIGNAL, timeout=seconds)) or self._stopping()

    def _on_turn_wait(self, holder: str) -> None:
        self._waiting_for = holder
        self._changed()

    def _shutdown(self) -> None:
        THREAD_BUS.signal(STOP_SIGNAL, True)
        lease, self._lease = self._lease, None
        if lease is not None:
            self._lease_lock.release_hold(lease)

    # ---- one sync ----

    def _command(self) -> List[str]:
        if IS_WINDOWS:
            return ["cmd.exe", "/d", "/c", str(self._root / DD_ENTRY_WINDOWS), GITSYNC_COMMAND, MESSAGE_FLAG, COMMIT_DESCRIPTION]
        return ["bash", str(self._root / DD_ENTRY_LINUX), GITSYNC_COMMAND, MESSAGE_FLAG, COMMIT_DESCRIPTION]

    def _sync_once(self, trigger: str) -> None:
        waiting_since = time.time()
        granted = gitsync_lan_turn.acquire(self._wait_turn, self._on_turn_wait)
        self._waiting_for = None
        if granted is None:
            return
        summary: Dict[str, Any] = {}
        try:
            summary = self._run_gitsync(trigger, waiting_since)
        finally:
            self._last_finished_monotonic = time.monotonic()
            gitsync_lan_turn.release(granted, summary)
            self._changed()
        if summary.get("pushed"):
            self._notify_agents(summary)

    def _run_gitsync(self, trigger: str, waiting_since: float) -> Dict[str, Any]:
        self._running = True
        self._changed()
        started = time.time()
        upstream_before = self._rev_parse(UPSTREAM_REF)
        output = ""
        exit_code: Optional[int] = None
        try:
            completed = subprocess.run(
                self._command(),
                cwd=str(self._root),
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                env={**os.environ, **NONINTERACTIVE_ENV},
                timeout=RUN_TIMEOUT_SECONDS,
                creationflags=CREATE_NO_WINDOW if IS_WINDOWS else 0,
                check=False,
            )
            output = completed.stdout.decode("utf-8", errors="replace") if completed.stdout else ""
            exit_code = completed.returncode
        except subprocess.TimeoutExpired as exc:
            output = (exc.stdout or b"").decode("utf-8", errors="replace") + f"\n[{LABEL}] timeout after {RUN_TIMEOUT_SECONDS}s"
        except OSError as exc:
            output = f"[{LABEL}] could not start gitsync: {exc}"
        finally:
            self._running = False
        self._last_run_at = started
        self._last_output = "\n".join(output.splitlines()[-OUTPUT_TAIL_LINES:])
        conflicted = self._unmerged_files()
        blocking = self._blocking_states()
        if conflicted or blocking:
            self._last_result = "conflict"
            self._record_conflict(conflicted, blocking)
        else:
            self._last_result = "ok"
            ColorPrint.green(f"[{LABEL}] gitsync finished in {time.time() - started:.1f}s")
        movement = self._upstream_movement(upstream_before, started)
        self._record_run({
            "started_at": started,
            "duration_seconds": round(time.time() - started, 1),
            "waited_seconds": round(started - waiting_since, 1),
            "trigger": trigger,
            "result": self._last_result,
            "exit_code": exit_code,
            "conflict_files": len(conflicted),
            "pushed": movement["pushed"],
            "pulled": movement["pulled"],
        })
        summary = {"result": self._last_result, "finished_at": time.time(), **movement}
        if movement["pushed"]:
            self._last_push = {key: summary[key] for key in ("finished_at", "head", "branch", "pushed", "commits")}
        return summary

    def _rev_parse(self, ref: str) -> str:
        return self._git("rev-parse", "--verify", "--quiet", ref).strip()

    def _upstream_movement(self, upstream_before: str, started: float) -> Dict[str, Any]:
        """Commits this run pushed (on the new upstream, not in what the pull fetched) and pulled
        (fetched beyond the old upstream); both are 0 when the pull did not fetch in this run."""
        upstream_after = self._rev_parse(UPSTREAM_REF)
        movement: Dict[str, Any] = {
            "head": upstream_after[:12],
            "branch": self._git("rev-parse", "--abbrev-ref", UPSTREAM_REF).strip(),
            "pushed": 0,
            "pulled": 0,
            "commits": [],
            "files": [],
        }
        git_dir = self._git("rev-parse", "--git-dir").strip()
        fetch_head_path = (Path(git_dir) if Path(git_dir).is_absolute() else self._root / git_dir) / FETCH_HEAD_NAME
        try:
            fetched_now = bool(git_dir) and fetch_head_path.stat().st_mtime >= started
        except OSError:
            fetched_now = False
        fetched = self._rev_parse(FETCH_HEAD_NAME) if fetched_now else ""
        if not fetched or not upstream_after:
            return movement
        if upstream_before:
            movement["pulled"] = self._count(f"{upstream_before}..{fetched}")
        if upstream_after != upstream_before:
            pushed_range = f"{fetched}..{upstream_after}"
            movement["pushed"] = self._count(pushed_range)
            movement["commits"] = [
                line for line in self._git("log", "--no-merges", f"-{NOTIFY_COMMITS_MAX}", "--format=%h %s", pushed_range).splitlines()
                if line.strip()
            ]
            movement["files"] = [
                line for line in self._git("diff", "--name-only", fetched, upstream_after).splitlines() if line.strip()
            ][:NOTIFY_FILES_MAX]
        return movement

    def _count(self, revision_range: str) -> int:
        text = self._git("rev-list", "--count", revision_range).strip()
        return int(text) if text.isdigit() else 0

    # ---- agent bus notice ----

    def _notify_agents(self, summary: Dict[str, Any]) -> None:
        """Pushed commits: overwrite this machine's agent bus note and notify the gitsync channel."""
        hostname = gitsync_lan_turn.hostname
        machine = gitsync_lan_turn.machine
        values = {
            "hostname": hostname,
            "machine": machine,
            "count": str(summary["pushed"]),
            "branch": summary["branch"],
            "head": summary["head"],
            "time": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(summary["finished_at"])),
            "commits": "\n".join(f"- {line}" for line in summary["commits"]) or "-",
            "files": "\n".join(f"- `{path}`" for path in summary["files"]) or "-",
        }
        agent_bus_client.call("note_put", PIPELINE["agent_bus_agent"], {
            "key": f"{PIPELINE['agent_bus_note_prefix']}{machine}",
            "title": _fill(PIPELINE["agent_bus_note_title"], **values),
            "body": _fill(PIPELINE["agent_bus_note_body"], **values),
            "tags": PIPELINE["agent_bus_tags"],
            "refs": [line.split(" ", 1)[0] for line in summary["commits"]],
            "notify": f"channel:{PIPELINE['agent_bus_channel']}",
        })

    def _git(self, *arguments: str) -> str:
        try:
            completed = subprocess.run(
                ["git", *arguments],
                cwd=str(self._root),
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                timeout=30,
                creationflags=CREATE_NO_WINDOW if IS_WINDOWS else 0,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired):
            return ""
        return completed.stdout.decode("utf-8", errors="replace")

    def _unmerged_files(self) -> List[str]:
        return [line.strip() for line in self._git("diff", "--name-only", "--diff-filter=U").splitlines() if line.strip()]

    def _blocking_states(self) -> List[str]:
        git_dir = self._git("rev-parse", "--git-dir").strip()
        if not git_dir:
            return []
        base = Path(git_dir) if Path(git_dir).is_absolute() else self._root / git_dir
        return [name for name in BLOCKING_GIT_STATES if (base / name).exists()]

    # ---- conflict alert ----

    def _record_conflict(self, conflicted: List[str], blocking: List[str]) -> None:
        detected = time.strftime("%Y-%m-%d %H:%M:%S")
        files = "\n".join(f"- `{path}`" for path in conflicted) or "- (no unmerged paths; see the git state below)"
        states = ", ".join(blocking) or "none"
        document = "\n".join((
            "# GITSYNC MERGE CONFLICT - FIX IMMEDIATELY",
            "",
            f"Detected by pycore at {detected} on `{socket.gethostname()}` (repository `{self._root}`).",
            "Automatic gitsync is suspended on this machine until this file is deleted; pycore reminds on the desktop until then.",
            "",
            "## AI instruction",
            "",
            "If you are an AI reading this file, resolve the conflict now:",
            "",
            "1. Resolve every conflicted file below. Keep the new features from both the remote and this machine. Do not roll back any code.",
            "2. `git add` the resolved files and finish with `git commit --no-edit` (or finish/abort the blocking git operation).",
            "3. Run the project's gitsync (`dd.cmd gitsync -m \"resolve merge conflict\"` / `dd.sh gitsync -m \"resolve merge conflict\"`).",
            f"4. Delete this file and the first line of `{CONFLICT_README_RELATIVE}` that starts with `{README_MARKER}`.",
            "",
            "## Conflicted files",
            "",
            files,
            "",
            f"Blocking git state: {states}",
            "",
            "## Last gitsync output",
            "",
            "```text",
            self._last_output,
            "```",
            "",
            "## Prompt to give an AI",
            "",
            "```text",
            AI_PROMPT,
            "```",
            "",
        ))
        try:
            self._docs_dir.mkdir(parents=True, exist_ok=True)
            self.conflict_doc_path.write_text(document, encoding="utf-8")
            self._add_readme_alert()
        except OSError as exc:
            ColorPrint.red(f"[{LABEL}] could not write the conflict alert: {exc}")
        ColorPrint.red(f"[{LABEL}] merge conflict: {len(conflicted)} file(s); alert at {self.conflict_doc_path}")

    def _readme_path(self) -> Path:
        return self._docs_dir / README_NAME

    def _add_readme_alert(self) -> None:
        path = self._readme_path()
        text = path.read_text(encoding="utf-8") if path.is_file() else ""
        if text.startswith(README_MARKER):
            return
        path.write_text(f"{README_ALERT_LINE}\n\n{text}", encoding="utf-8")

    def _remove_readme_alert(self) -> None:
        """The alert document is gone (fixed): drop a README alert line the fixer left behind."""
        path = self._readme_path()
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            return
        if not text.startswith(README_MARKER):
            return
        rest = text.split("\n", 1)[1] if "\n" in text else ""
        path.write_text(rest.lstrip("\n"), encoding="utf-8")

    def _remind(self) -> None:
        show_system_notification(
            i18n.get(I18nKeys.GITSYNC_CONFLICT_TITLE),
            i18n.get(I18nKeys.GITSYNC_CONFLICT_MESSAGE).format(path=CONFLICT_DOC_RELATIVE),
            duration_ms=NOTIFICATION_DURATION_MS,
            copy_text=AI_PROMPT,
        )


gitsync_watch_service = GitSyncWatchService()
