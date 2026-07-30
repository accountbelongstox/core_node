#!/usr/bin/env python3
from pyfoundations.system_paths import map_web_path as _map_web_path, _is_wsl as _is_wsl_util
"""
PostgreSQL cross-environment sync adapter.

Detects when Windows PostgreSQL data is newer than the local Linux/WSL cluster
and syncs via pg_dumpall (Windows) → psql restore (Linux). Called from start.sh
before the PG section so every startup uses the freshest data.

Environment matrix (same physical machine):
  WINDOWS        — native Windows; always authoritative, no sync needed here
  WSL            — WSL2; /mnt/d accessible AND Windows .exe files runnable via
                   binfmt_misc → full auto-sync possible
  LINUX_WIN_MOUNT— native Linux with Windows NTFS disk mounted at /mnt/{X};
                   .exe files NOT available → restore from pre-exported dump file
  LINUX_NATIVE   — no Windows disk; nothing to sync

Binary-format compatibility note (from PostgreSQL docs):
  Windows PG data ≠ Linux PG data (different collation, OID layout, page format).
  Physical file copy between Windows and Linux ALWAYS corrupts the cluster.
  This adapter always uses pg_dumpall / psql (logical export/restore).

Path mapping mirrors system_paths.map_web_path():
  win_pg_root  — /mnt/{X}/www/wwwroot/postgresql  (Windows: D:\\www\\wwwroot\\postgresql)
  linux_pg_dir — /var/lib/postgresql/d             (WSL pg_mount)  OR
                 {base}/www/wwwroot/postgresql      (Linux native)
  win_pg_bin   — /mnt/{X}/.dev_win10/PG/bin  or  /mnt/{X}/.dev_win11/PG/bin
  win_secrets  — /mnt/{X}/var/_core_node/global_var/POSTGRES_PASSWORD
  sync_meta    — /mnt/{X}/var/_core_node/pg_sync_meta.json
  dump_file    — /mnt/{X}/www/wwwroot/postgresql/pg_win_export.sql
"""

import os
import sys
import json
import time
import platform
import subprocess
import shutil
from pathlib import Path
from typing import Optional, Tuple, List

import re

from datetime import datetime, timezone
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint



# ---------------------------------------------------------------------------
# Module-level constants
# ---------------------------------------------------------------------------
_PYCORE_ROOT = Path(__file__).resolve().parent.parent
PROMPT_ATTEMPTS = 3
SYNC_META_FILENAME = 'pg_sync_meta.json'
DUMP_FILENAME = 'pg_win_export.sql'
PG_CONTROL_SUBPATH = Path('data') / 'global' / 'pg_control'
PG_DATA_SUBPATH = Path('data')
# Candidate Windows tool root names under /mnt/{X}
WIN_TOOL_ROOTS = ['.dev_win10', '.dev_win11']
# Timeout (seconds) for PG to start/stop
PG_WAIT_TIMEOUT = 30

# ---------------------------------------------------------------------------
# Optional import of canonical path utilities
# ---------------------------------------------------------------------------
try:
    if str(_PYCORE_ROOT) not in sys.path:
        sys.path.insert(0, str(_PYCORE_ROOT))
    _HAS_MAP = True
except Exception:
    _HAS_MAP = False
    _map_web_path = None
    _is_wsl_util = None


# ---------------------------------------------------------------------------
# Environment constants
# ---------------------------------------------------------------------------
class PgEnv:
    WINDOWS = 'windows'
    WSL = 'wsl'
    LINUX_WIN_MOUNT = 'linux_win_mount'
    LINUX_NATIVE = 'linux_native'


# ---------------------------------------------------------------------------
# Standalone helpers (used when system_paths is not importable)
# ---------------------------------------------------------------------------
def _is_wsl() -> bool:
    if _HAS_MAP and _is_wsl_util is not None:
        return _is_wsl_util()
    if os.path.exists('/mnt/c/Windows'):
        return True
    try:
        with open('/proc/version', 'r') as fh:
            return 'microsoft' in fh.read().lower()
    except OSError:
        return False


def _find_win_mount() -> Optional[Path]:
    """Return the first /mnt/{letter} path that contains a Windows www structure."""
    mnt = Path('/mnt')
    if not mnt.is_dir():
        return None
    for child in sorted(mnt.iterdir()):
        if len(child.name) == 1 and child.name.isalpha():
            if (child / 'www' / 'wwwroot').is_dir():
                return child
    return None


def _pg_run(cmd: List, env: Optional[dict] = None, timeout: int = 60) -> Tuple[int, str, str]:
    """Run a subprocess; return (returncode, stdout, stderr). Never raises."""
    merged_env = None
    if env:
        merged_env = {**os.environ, **env}
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True,
            timeout=timeout, env=merged_env
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, '', 'timeout'
    except FileNotFoundError:
        return -1, '', f'command not found: {cmd[0]}'
    except Exception as exc:
        return -1, '', str(exc)


def _win_path(wsl_path: Path) -> str:
    """Convert /mnt/d/foo/bar → D:\\foo\\bar for passing to Windows .exe."""
    parts = wsl_path.parts
    if len(parts) >= 3 and parts[0] == '/' and parts[1] == 'mnt' and len(parts[2]) == 1:
        drive = parts[2].upper()
        rest = '\\'.join(parts[3:])
        return f'{drive}:\\{rest}' if rest else f'{drive}:\\'
    return str(wsl_path)


def _read_file_stripped(path: Path) -> str:
    """Read a text file and strip whitespace; return '' on error."""
    try:
        return path.read_text(encoding='utf-8', errors='ignore').strip()
    except OSError:
        return ''


def _find_pg_bin_linux() -> Optional[Path]:
    """Locate pg_dumpall binary on the local Linux system."""
    if shutil.which('pg_dumpall'):
        return Path(shutil.which('pg_dumpall')).parent
    for ver in range(20, 13, -1):
        candidate = Path(f'/usr/lib/postgresql/{ver}/bin')
        if (candidate / 'pg_dumpall').exists():
            return candidate
    return None


def _get_pg_version_from_data(data_dir: Path) -> str:
    """Read major version from PG_VERSION file in data dir; empty on error."""
    ver_file = data_dir / 'PG_VERSION'
    if ver_file.exists():
        return _read_file_stripped(ver_file).split('.')[0]
    return ''


def _control_mtime(data_dir: Path) -> float:
    """mtime of data_dir/global/pg_control as Unix timestamp; 0 if missing."""
    ctrl = data_dir / 'global' / 'pg_control'
    try:
        return ctrl.stat().st_mtime
    except OSError:
        return 0.0


def _parse_checkpoint_time(controldata_output: str) -> float:
    """Parse 'Time of latest checkpoint:' from pg_controldata output → Unix ts."""
    for line in controldata_output.splitlines():
        if 'Time of latest checkpoint' in line:
            raw = line.split(':', 1)[-1].strip()
            for fmt in ('%Y-%m-%d %H:%M:%S %Z', '%a %b %d %H:%M:%S %Y %Z', '%Y-%m-%d %H:%M:%S'):
                try:
                    dt = datetime.strptime(raw.split(' (')[0].strip(), fmt)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    return dt.timestamp()
                except ValueError:
                    continue
    return 0.0


# ---------------------------------------------------------------------------
# Main adapter class
# ---------------------------------------------------------------------------
class PgSyncAdapter:
    """Detects environment, compares PG cluster freshness, syncs if needed."""

    def __init__(self) -> None:
        # All instance variables declared at top
        self.env: Optional[str] = None
        self.win_mount: Optional[Path] = None          # /mnt/d
        self.win_pg_root: Optional[Path] = None        # /mnt/d/www/wwwroot/postgresql
        self.win_data_dir: Optional[Path] = None       # win_pg_root/data
        self.win_pg_bin: Optional[Path] = None         # /mnt/d/.dev_win10/PG/bin
        self.win_secrets_dir: Optional[Path] = None    # /mnt/d/var/_core_node/global_var
        self.linux_data_dir: Optional[Path] = None     # /var/lib/postgresql/d or local
        self.linux_pg_bin: Optional[Path] = None       # /usr/lib/postgresql/XX/bin
        self.dump_path: Optional[Path] = None          # where dump file lives
        self.sync_meta_path: Optional[Path] = None     # JSON metadata on shared disk
        self._win_pg_started: bool = False             # did WE start Windows PG?
        self._password_win: str = ''
        self._password_linux: str = ''

    # -----------------------------------------------------------------------
    # Detection
    # -----------------------------------------------------------------------
    def detect(self) -> str:
        """Probe environment and populate all path fields. Returns PgEnv constant."""
        if platform.system() == 'Windows':
            self.env = PgEnv.WINDOWS
            return self.env

        if _is_wsl() or _find_win_mount() is not None:
            self.win_mount = _find_win_mount()
            if self.win_mount:
                self._init_win_paths()
                self.env = PgEnv.WSL if _is_wsl() else PgEnv.LINUX_WIN_MOUNT
            else:
                self.env = PgEnv.LINUX_NATIVE
        else:
            self.env = PgEnv.LINUX_NATIVE

        self._init_linux_paths()
        return self.env

    def _init_win_paths(self) -> None:
        """Populate all Windows-side paths (accessible via /mnt/{X})."""
        m = self.win_mount
        self.win_pg_root = m / 'www' / 'wwwroot' / 'postgresql'
        self.win_data_dir = self.win_pg_root / 'data'
        self.win_secrets_dir = m / 'var' / '_core_node' / 'global_var'
        self.sync_meta_path = m / 'var' / '_core_node' / SYNC_META_FILENAME
        self.dump_path = self.win_pg_root / DUMP_FILENAME
        for tool_root in WIN_TOOL_ROOTS:
            candidate = m / tool_root / 'PG' / 'bin'
            if (candidate / 'pg_dump.exe').exists() or (candidate / 'pg_dumpall.exe').exists():
                self.win_pg_bin = candidate
                break

    def _init_linux_paths(self) -> None:
        """Populate local Linux PG paths."""
        # pg_mount (/var/lib/postgresql/d) is preferred (WSL D-drive image)
        pg_mount = Path('/var/lib/postgresql/d')
        if pg_mount.is_dir():
            self.linux_data_dir = pg_mount
        elif _HAS_MAP and _map_web_path is not None:
            try:
                self.linux_data_dir = _map_web_path('postgresql') / 'data'
            except Exception:
                self.linux_data_dir = None
        if self.linux_data_dir is None:
            # Fallback: query running PG
            rc, stdout, _ = _pg_run(['psql', '-U', 'postgres', '-tAc', 'SHOW data_directory;'])
            if rc == 0 and stdout.strip():
                self.linux_data_dir = Path(stdout.strip())

        self.linux_pg_bin = _find_pg_bin_linux()

    def _read_passwords(self) -> None:
        """Read PG passwords from the global-var stores."""
        if self.win_secrets_dir:
            self._password_win = _read_file_stripped(self.win_secrets_dir / 'POSTGRES_PASSWORD')
        linux_sec = Path('/var/_core_node/global_var/POSTGRES_PASSWORD')
        self._password_linux = _read_file_stripped(linux_sec)
        # Fallback: both might share the same password
        if not self._password_linux and self._password_win:
            self._password_linux = self._password_win

    # -----------------------------------------------------------------------
    # Freshness comparison
    # -----------------------------------------------------------------------
    def compare_freshness(self) -> Tuple[bool, float, float]:
        """
        Compare Windows vs Linux PG cluster freshness.
        Returns (windows_is_newer, win_ts, linux_ts).
        Uses pg_controldata when available, falls back to mtime of pg_control file.
        """
        win_ts = 0.0
        linux_ts = 0.0

        # Windows side
        if self.win_data_dir and self.win_data_dir.is_dir():
            if self.env == PgEnv.WSL and self.win_pg_bin:
                # Can run pg_controldata.exe (Windows exe, runs in WSL via binfmt_misc)
                ctl_exe = self.win_pg_bin / 'pg_controldata.exe'
                if ctl_exe.exists():
                    rc, out, _ = _pg_run([str(ctl_exe), _win_path(self.win_data_dir)], timeout=15)
                    if rc == 0:
                        win_ts = _parse_checkpoint_time(out)
            if not win_ts:
                win_ts = _control_mtime(self.win_data_dir)

        # Linux side
        if self.linux_data_dir and self.linux_data_dir.is_dir():
            ctl_bin = (self.linux_pg_bin / 'pg_controldata') if self.linux_pg_bin else None
            if ctl_bin and ctl_bin.exists():
                rc, out, _ = _pg_run([str(ctl_bin), str(self.linux_data_dir)], timeout=15)
                if rc == 0:
                    linux_ts = _parse_checkpoint_time(out)
            if not linux_ts:
                linux_ts = _control_mtime(self.linux_data_dir)

        return win_ts > linux_ts, win_ts, linux_ts

    # -----------------------------------------------------------------------
    # User prompts
    # -----------------------------------------------------------------------
    @staticmethod
    def _ts_str(ts: float) -> str:
        if not ts:
            return '(unknown)'
        return datetime.datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S')

    def prompt_3x_confirm(self, win_ts: float, linux_ts: float) -> bool:
        """
        Show 3 escalating Y/n prompts before performing a destructive sync.
        Returns True only when all 3 are confirmed (Y/y/Enter).
        Non-interactive (no TTY) → returns False (safe default).
        """
        if not sys.stdin.isatty():
            ColorPrint.plain('[pg-sync] Non-interactive session — skipping sync (run start.sh in a terminal to confirm).', flush=True)
            return False

        win_str = self._ts_str(win_ts)
        linux_str = self._ts_str(linux_ts)
        prompts = [
            (f'\n[pg-sync] Windows PostgreSQL data is NEWER than local Linux data.\n'
             f'  Windows checkpoint : {win_str}\n'
             f'  Linux checkpoint   : {linux_str}\n'
             f'  Sync Windows → Linux? This will pg_dumpall from Windows PG and restore here.\n'),
            (f'[pg-sync] CONFIRM: All current Linux PostgreSQL data will be REPLACED.\n'
             f'  This is a full overwrite (pg_dumpall --clean). Continue?\n'),
            (f'[pg-sync] FINAL CONFIRMATION: Proceed with full Windows→Linux PostgreSQL sync?\n'
             f'  (This is your last chance to cancel.)\n'),
        ]
        for i, msg in enumerate(prompts, 1):
            ColorPrint.plain(msg, end='', flush=True)
            try:
                answer = input(f'  [{i}/{PROMPT_ATTEMPTS}] Update Linux PG from Windows? [Y/n] ').strip()
            except (EOFError, KeyboardInterrupt):
                ColorPrint.plain('\n[pg-sync] Cancelled.', flush=True)
                return False
            if answer.lower() == 'n':
                ColorPrint.plain('[pg-sync] Sync skipped by user.', flush=True)
                return False
        return True

    # -----------------------------------------------------------------------
    # PostgreSQL service control
    # -----------------------------------------------------------------------
    def _stop_local_pg(self) -> bool:
        """Stop local Linux PostgreSQL; returns True when port is free."""
        methods = [
            ['sudo', 'systemctl', 'stop', 'postgresql'],
            ['sudo', 'service', 'postgresql', 'stop'],
        ]
        # pg_ctlcluster with detected version
        ver_file = Path('/etc/postgresql')
        if ver_file.is_dir():
            for v in sorted(ver_file.iterdir(), reverse=True):
                if v.name.isdigit():
                    methods.append(['sudo', 'pg_ctlcluster', v.name, 'main', 'stop'])
                    break
        if self.linux_data_dir and self.linux_pg_bin:
            pg_ctl = self.linux_pg_bin / 'pg_ctl'
            if pg_ctl.exists():
                methods.append([str(pg_ctl), 'stop', '-D', str(self.linux_data_dir), '-m', 'fast'])

        for cmd in methods:
            _pg_run(cmd, timeout=20)

        for _ in range(PG_WAIT_TIMEOUT):
            rc, _, _ = _pg_run(['pg_isready', '-q'], timeout=3)
            if rc != 0:
                return True
            time.sleep(1)
        return False

    def _start_local_pg(self) -> bool:
        """Start local Linux PostgreSQL; returns True when ready."""
        methods = [
            ['sudo', 'systemctl', 'start', 'postgresql'],
            ['sudo', 'service', 'postgresql', 'start'],
        ]
        ver_file = Path('/etc/postgresql')
        if ver_file.is_dir():
            for v in sorted(ver_file.iterdir(), reverse=True):
                if v.name.isdigit():
                    methods.append(['sudo', 'pg_ctlcluster', v.name, 'main', 'start'])
                    break

        for cmd in methods:
            rc, _, _ = _pg_run(cmd, timeout=20)
            if rc == 0:
                break

        for _ in range(PG_WAIT_TIMEOUT):
            rc, _, _ = _pg_run(['pg_isready', '-q'], timeout=3)
            if rc == 0:
                return True
            time.sleep(1)
        return False

    # -----------------------------------------------------------------------
    # Windows PG control (WSL only — runs Windows .exe via binfmt_misc)
    # -----------------------------------------------------------------------
    def _win_pg_is_ready(self) -> bool:
        if not self.win_pg_bin:
            return False
        ready_exe = self.win_pg_bin / 'pg_isready.exe'
        if not ready_exe.exists():
            return False
        rc, _, _ = _pg_run([str(ready_exe), '-h', '127.0.0.1', '-p', '5432'], timeout=5)
        return rc == 0

    def _ensure_win_pg_running(self) -> bool:
        """Start Windows PG if not running. Marks self._win_pg_started for cleanup."""
        if self._win_pg_is_ready():
            return True
        if not self.win_pg_bin or not self.win_data_dir:
            return False
        ctl_exe = self.win_pg_bin / 'pg_ctl.exe'
        if not ctl_exe.exists():
            return False
        win_data = _win_path(self.win_data_dir)
        win_log = _win_path(self.win_pg_root / 'logs' / 'postgres.log')
        ColorPrint.plain('[pg-sync] Starting Windows PostgreSQL to perform dump...', flush=True)
        rc, _, err = _pg_run([str(ctl_exe), 'start', '-D', win_data, '-l', win_log], timeout=30)
        if rc != 0:
            ColorPrint.plain(f'[pg-sync] Warning: pg_ctl.exe start returned {rc}: {err}', flush=True)
        self._win_pg_started = True
        for _ in range(PG_WAIT_TIMEOUT):
            if self._win_pg_is_ready():
                return True
            time.sleep(1)
        return False

    def _stop_win_pg_if_started(self) -> None:
        if not self._win_pg_started or not self.win_pg_bin or not self.win_data_dir:
            return
        ctl_exe = self.win_pg_bin / 'pg_ctl.exe'
        if ctl_exe.exists():
            win_data = _win_path(self.win_data_dir)
            _pg_run([str(ctl_exe), 'stop', '-D', win_data, '-m', 'fast'], timeout=30)
            self._win_pg_started = False
            ColorPrint.plain('[pg-sync] Stopped Windows PostgreSQL (was started by adapter).', flush=True)

    # -----------------------------------------------------------------------
    # Dump and restore
    # -----------------------------------------------------------------------
    def _dump_windows_pg(self) -> bool:
        """
        pg_dumpall.exe --clean → SQL file on shared disk.
        Runs as Windows process (sees Windows localhost:5432).
        """
        if not self.win_pg_bin or not self.dump_path:
            return False
        dump_all = self.win_pg_bin / 'pg_dumpall.exe'
        if not dump_all.exists():
            ColorPrint.plain(f'[pg-sync] pg_dumpall.exe not found at {dump_all}', flush=True)
            return False

        # Write to a temp file first (atomic rename on completion)
        tmp_dump = self.dump_path.with_suffix('.sql.tmp')
        win_tmp = _win_path(tmp_dump)
        self.dump_path.parent.mkdir(parents=True, exist_ok=True)

        ColorPrint.plain(f'[pg-sync] Dumping Windows PG → {tmp_dump} ...', flush=True)
        env = {'PGPASSWORD': self._password_win}
        rc, _, err = _pg_run(
            [str(dump_all), '-h', '127.0.0.1', '-p', '5432',
             '-U', 'postgres', '--clean', '--if-exists', '-f', win_tmp],
            env=env, timeout=600
        )
        if rc != 0 or not tmp_dump.exists() or tmp_dump.stat().st_size < 512:
            ColorPrint.plain(f'[pg-sync] Dump failed (rc={rc}): {err[:300]}', flush=True)
            try:
                tmp_dump.unlink(missing_ok=True)
            except OSError:
                pass
            return False

        # Atomic rename
        try:
            tmp_dump.rename(self.dump_path)
        except OSError as exc:
            ColorPrint.plain(f'[pg-sync] Could not rename dump: {exc}', flush=True)
            shutil.copy2(str(tmp_dump), str(self.dump_path))
            tmp_dump.unlink(missing_ok=True)

        size_mb = self.dump_path.stat().st_size / (1024 * 1024)
        ColorPrint.plain(f'[pg-sync] Dump complete: {self.dump_path} ({size_mb:.1f} MB)', flush=True)
        return True

    def _restore_from_dump(self, dump_path: Path) -> bool:
        """
        psql < dump.sql on the local Linux PG (must already be running).
        Uses --clean dump so it drops/recreates schemas before restore.
        """
        psql_bin = shutil.which('psql')
        if not psql_bin and self.linux_pg_bin:
            psql_bin = str(self.linux_pg_bin / 'psql')
        if not psql_bin:
            ColorPrint.plain('[pg-sync] psql not found — cannot restore.', flush=True)
            return False
        if not dump_path.exists() or dump_path.stat().st_size < 512:
            ColorPrint.plain(f'[pg-sync] Dump file missing or empty: {dump_path}', flush=True)
            return False

        ColorPrint.plain(f'[pg-sync] Restoring from {dump_path} into local PostgreSQL...', flush=True)
        env = {'PGPASSWORD': self._password_linux}
        cmd = [psql_bin, '-h', '127.0.0.1', '-p', '5432', '-U', 'postgres',
               '-d', 'postgres', '-f', str(dump_path)]
        rc, _, err = _pg_run(cmd, env=env, timeout=1200)
        if rc != 0:
            ColorPrint.plain(f'[pg-sync] Restore finished with warnings (rc={rc}). Last stderr: {err[-400:]}', flush=True)
            # psql -f exits 3 on non-fatal errors; treat as partial success
            if rc == 3 or 'ERROR' not in err:
                return True
            return False
        ColorPrint.plain('[pg-sync] Restore complete.', flush=True)
        return True

    # -----------------------------------------------------------------------
    # Sync metadata
    # -----------------------------------------------------------------------
    def _write_sync_meta(self, success: bool, win_ts: float, linux_ts: float) -> None:
        if not self.sync_meta_path:
            return
        meta = {
            'last_sync': time.time(),
            'success': success,
            'direction': 'windows_to_linux',
            'win_checkpoint': win_ts,
            'linux_checkpoint_before': linux_ts,
            'env': self.env,
        }
        try:
            self.sync_meta_path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.sync_meta_path.with_suffix('.json.tmp')
            tmp.write_text(json.dumps(meta, indent=2), encoding='utf-8')
            tmp.rename(self.sync_meta_path)
        except OSError as exc:
            ColorPrint.plain(f'[pg-sync] Could not write sync metadata: {exc}', flush=True)

    def _read_sync_meta(self) -> dict:
        if not self.sync_meta_path or not self.sync_meta_path.exists():
            return {}
        try:
            return json.loads(self.sync_meta_path.read_text(encoding='utf-8'))
        except Exception:
            return {}

    # -----------------------------------------------------------------------
    # High-level sync flows
    # -----------------------------------------------------------------------
    def _sync_wsl(self, win_ts: float, linux_ts: float) -> bool:
        """
        Full WSL sync: Windows pg_dumpall.exe → stop local PG → psql restore → start local PG.
        """
        win_started_ok = self._ensure_win_pg_running()
        if not win_started_ok:
            ColorPrint.plain('[pg-sync] Could not start Windows PostgreSQL — aborting sync.', flush=True)
            return False

        try:
            if not self._dump_windows_pg():
                return False
        finally:
            self._stop_win_pg_if_started()

        ColorPrint.plain('[pg-sync] Stopping local PostgreSQL for restore...', flush=True)
        self._stop_local_pg()

        started = self._start_local_pg()
        if not started:
            ColorPrint.plain('[pg-sync] WARNING: Could not restart local PG. Attempting restore anyway...', flush=True)
        if not self._start_local_pg():
            ColorPrint.plain('[pg-sync] ERROR: Local PG did not start after dump. Manual intervention needed.', flush=True)
            return False

        success = self._restore_from_dump(self.dump_path)
        self._write_sync_meta(success, win_ts, linux_ts)
        if success:
            ColorPrint.plain('[pg-sync] Windows → Linux PostgreSQL sync completed successfully.', flush=True)
        else:
            ColorPrint.plain('[pg-sync] Sync completed with errors. Check psql output above.', flush=True)
        return success

    def _sync_linux_from_dump(self) -> bool:
        """
        Linux native (no .exe): restore from pre-exported dump file on Windows disk.
        If dump file is newer than local Linux data, restores it.
        """
        if not self.dump_path or not self.dump_path.exists():
            return False
        dump_mtime = self.dump_path.stat().st_mtime
        linux_mtime = _control_mtime(self.linux_data_dir) if self.linux_data_dir else 0.0
        if dump_mtime <= linux_mtime:
            return False  # local data is already at least as fresh

        ColorPrint.plain(f'[pg-sync] Found Windows PG export at {self.dump_path} (newer than local data).', flush=True)
        if not sys.stdin.isatty():
            ColorPrint.plain('[pg-sync] Non-interactive — skipping restore. Run start.sh in a terminal to confirm.', flush=True)
            return False

        try:
            answer = input('[pg-sync] Restore local PostgreSQL from Windows export? [Y/n] ').strip()
        except (EOFError, KeyboardInterrupt):
            return False
        if answer.lower() == 'n':
            ColorPrint.plain('[pg-sync] Restore skipped.', flush=True)
            return False

        self._stop_local_pg()
        if not self._start_local_pg():
            ColorPrint.plain('[pg-sync] ERROR: Local PG did not start. Manual intervention needed.', flush=True)
            return False

        success = self._restore_from_dump(self.dump_path)
        self._write_sync_meta(success, dump_mtime, linux_mtime)
        return success

    # -----------------------------------------------------------------------
    # Main entry point
    # -----------------------------------------------------------------------
    def run(self) -> int:
        """
        Main entry point called from start.sh --startup.
        Returns 0 on success or when no sync is needed, 1 on fatal error.
        """
        self.detect()
        self._read_passwords()

        ColorPrint.plain(f'[pg-sync] Environment: {self.env}', flush=True)

        if self.env == PgEnv.WINDOWS:
            # Windows side: no sync needed (Windows is authoritative).
            return 0

        if self.env == PgEnv.LINUX_NATIVE:
            ColorPrint.plain('[pg-sync] No Windows disk found — no cross-system sync possible.', flush=True)
            return 0

        if not self.win_data_dir or not self.win_data_dir.is_dir():
            ColorPrint.plain(f'[pg-sync] Windows PG data dir not found at {self.win_data_dir} — skipping.', flush=True)
            return 0

        # Compare freshness
        win_newer, win_ts, linux_ts = self.compare_freshness()

        if not win_newer:
            ColorPrint.plain(
                f'[pg-sync] Local Linux PG is up to date '
                f'(Linux {self._ts_str(linux_ts)} ≥ Windows {self._ts_str(win_ts)}).',
                flush=True
            )
            return 0

        ColorPrint.plain(
            f'[pg-sync] Windows PG is NEWER: {self._ts_str(win_ts)} > {self._ts_str(linux_ts)}',
            flush=True
        )

        if self.env == PgEnv.WSL:
            if not self.win_pg_bin:
                ColorPrint.plain('[pg-sync] Windows PG binaries not found — cannot auto-sync.', flush=True)
                ColorPrint.plain(f'[pg-sync] Expected: {self.win_mount}/.dev_win10/PG/bin or .dev_win11/PG/bin', flush=True)
                return 0
            if not self.prompt_3x_confirm(win_ts, linux_ts):
                return 0
            ok = self._sync_wsl(win_ts, linux_ts)
            return 0 if ok else 1

        if self.env == PgEnv.LINUX_WIN_MOUNT:
            # Can't run .exe; try pre-exported dump file
            if self.dump_path and self.dump_path.exists():
                self._sync_linux_from_dump()
            else:
                ColorPrint.plain(
                    f'[pg-sync] Windows PG is newer but cannot auto-sync on native Linux.\n'
                    f'[pg-sync] On Windows, run start.ps1 which exports a dump to:\n'
                    f'[pg-sync]   {self.dump_path}\n'
                    f'[pg-sync] Then re-run start.sh to restore it here.',
                    flush=True
                )
            return 0

        return 0


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
def main() -> int:
    adapter = PgSyncAdapter()
    return adapter.run()


if __name__ == '__main__':
    sys.exit(main())
