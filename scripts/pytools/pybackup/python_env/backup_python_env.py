#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###
"""
Python Environment Backup Manager (runtime + models + user data)
================================================================

PURPOSE
    Snapshot everything needed to re-create this machine's pycore Python
    environment WITHOUT re-running the (slow, multi-GB, network-heavy)
    installers. A restore from such a snapshot brings back the interpreter,
    every pip package and every downloaded AI model in one copy operation.

WHAT IS BACKED UP (the three source roots)
    1. python_runtime  - the ACTUAL Python install directory, i.e. the parent
                          folder of the running interpreter (Path(sys.executable)
                          .parent, e.g. "D:\\.dev_win10\\python311"). This holds
                          python.exe / python3, the standard library and every
                          installed site-packages distribution (faster-whisper,
                          edge-tts, sherpa-onnx, torch + CUDA libs, ...).
                          Override with --python-dir.
    2. user_data       - the per-user data root "~/.core_node". This tree contains
                          the user data AND the pycore-managed models that live
                          under "~/.core_node/cache" (e.g. cache/tts/sherpa,
                          cache/tts/gptsovits, cache/stt/vosk, cache/ocr) alongside
                          .global_vars, installer_scripts, ai_state, etc.
                          Override with --user-data-dir.
    3. hf_model_cache  - the HuggingFace cache (faster-whisper, transformers and
                          sentence-transformers models). This is SEPARATE from
                          ~/.core_node: by default it is "~/.cache/huggingface"
                          and it is typically the LARGEST source (many GB).
                          Resolved from $HF_HOME / $HUGGINGFACE_HUB_CACHE when set,
                          else ~/.cache/huggingface. Override with --hf-cache,
                          skip with --no-hf-cache.
    4. whisper_cache   - the openai-whisper model cache, "~/.cache/whisper" (or
                          $XDG_CACHE_HOME/whisper). Override with --whisper-cache,
                          skip with --no-whisper-cache.

    (Backing up these roots therefore covers: the interpreter, all pip packages,
    ALL TTS/STT/OCR/whisper/HuggingFace models and all per-user state. Any source
    that does not exist on this machine is skipped automatically.)

BACKUP / RESTORE PROTOCOL
    * Default backup directory ("--backup-root"):
        the parent folder of the core_node project (the same sibling folder the
        Backup Management menu's "Open backup directory" opens). Each backup is
        named with a timestamp: "python_env_bak_<YYYYmmdd_HHMMSS>".
    * Compression ("--compress yes|no|ask", default "ask" -> prompt "Y/n",
      default Yes):
        - compressed  -> a single archive  "<root>/python_env_bak_<ts>.tar.gz"
        - uncompressed-> a plain directory "<root>/python_env_bak_<ts>/"
                         with one sub-folder per source root.
      Either form is a valid, self-describing backup.
    * Every backup embeds a manifest "backup_metadata.json" recording the
      source roots, their ORIGINAL absolute paths, sizes, platform and Python
      version. Restore reads this manifest to know where each root must be put
      back, so a backup is portable and self-contained.
    * Restore ("--action restore") accepts EITHER:
        - a compressed archive (.tar.gz / .tgz / .tar), OR
        - an uncompressed backup directory.
      With no "--source", restore scans the backup root, lists the available
      "python_env_bak_*" entries (newest first) and lets you pick one by number
      or type an arbitrary path. Restore always asks for confirmation (unless
      "--auto-confirm") and warns before overwriting an existing target.

COMMAND LINE
    --action {backup,list,restore}   operation (required)
    --backup-root DIR                where backups live / are searched
                                     (default: parent folder of core_node)
    --compress {yes,no,ask}          backup compression (default: ask -> Y/n)
    --source PATH                    restore source (archive file or directory)
    --python-dir DIR                 override the Python install directory
    --user-data-dir DIR             override the ~/.core_node user-data root
    --hf-cache DIR                   override the HuggingFace model cache
    --no-hf-cache                    do not back up the HuggingFace model cache
    --whisper-cache DIR              override the whisper model cache
    --no-whisper-cache               do not back up the whisper model cache
    --auto-confirm                   do not prompt for confirmation

DEPENDENCIES
    Python standard library only (no pip packages), so it can run with the very
    interpreter it is backing up.
"""

import os
import sys
import json
import time
import shutil
import tarfile
import argparse
import datetime
from pathlib import Path
from typing import List, Dict, Optional


# --------------------------------------------------------------------------- #
# Lightweight terminal colors (no external dependency)
# --------------------------------------------------------------------------- #
class C:
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    GRAY = '\033[90m'
    RESET = '\033[0m'


def _say(message: str, color: str = '') -> None:
    print(f"{color}{message}{C.RESET}", flush=True)


def info(m: str) -> None:
    _say(m, C.BLUE)


def ok(m: str) -> None:
    _say(m, C.GREEN)


def warn(m: str) -> None:
    _say(m, C.YELLOW)


def err(m: str) -> None:
    _say(m, C.RED)


# --------------------------------------------------------------------------- #
# Backup manager
# --------------------------------------------------------------------------- #
class PythonEnvBackup:
    """Backup / restore the Python runtime, models and per-user data."""

    BACKUP_PREFIX = "python_env_bak"
    METADATA_NAME = "backup_metadata.json"
    # Regenerable noise excluded to save space (models and packages are kept).
    EXCLUDE_DIR_NAMES = {"__pycache__", ".pytest_cache", ".mypy_cache"}
    EXCLUDE_FILE_SUFFIXES = (".pyc", ".pyo", ".log", ".tmp")

    def __init__(self, backup_root: Optional[str] = None,
                 python_dir: Optional[str] = None,
                 user_data_dir: Optional[str] = None,
                 hf_cache: Optional[str] = None,
                 whisper_cache: Optional[str] = None,
                 include_hf_cache: bool = True,
                 include_whisper_cache: bool = True,
                 auto_confirm: bool = False) -> None:
        # Project layout: this file is scripts/pytools/pybackup/python_env/<this>.
        self.script_dir = Path(__file__).resolve().parent
        self.core_node_dir = self.script_dir.parent.parent.parent.parent

        # The actual Python install directory = folder holding the interpreter.
        self.python_dir = (Path(python_dir).resolve() if python_dir
                           else Path(sys.executable).resolve().parent)

        # ~/.core_node holds the user data and the pycore-managed models.
        if user_data_dir:
            self.user_data_dir = Path(user_data_dir).resolve()
        else:
            username = os.environ.get('USERNAME', os.environ.get('USER', 'default'))
            self.user_data_dir = Path('D:/programing/Users') / username / '.core_node'

        # Default backup root = sibling folder of the core_node project.
        self.backup_root = (Path(backup_root).resolve() if backup_root
                            else self.core_node_dir.parent)

        self.auto_confirm = auto_confirm

        # Logical source roots that make up a full snapshot.
        self.sources: List[Dict[str, str]] = [
            {"name": "python_runtime", "path": str(self.python_dir)},
            {"name": "user_data", "path": str(self.user_data_dir)},
        ]

        # HuggingFace model cache (faster-whisper / transformers) lives OUTSIDE
        # ~/.core_node, so it must be backed up separately or models would be
        # lost. Honor HF_HOME / HUGGINGFACE_HUB_CACHE when the user redirected it.
        if include_hf_cache:
            if hf_cache:
                hf_path = Path(hf_cache).resolve()
            elif os.environ.get("HF_HOME"):
                hf_path = Path(os.environ["HF_HOME"]).resolve()
            elif os.environ.get("HUGGINGFACE_HUB_CACHE"):
                hf_path = Path(os.environ["HUGGINGFACE_HUB_CACHE"]).resolve()
            else:
                try:
                    from pycore.pyfoundations.system_paths import get_xdg_cache_home
                    hf_path = get_xdg_cache_home() / "huggingface"
                except Exception:
                    if sys.platform == "win32":
                        hf_path = Path(r"D:\www\cache\huggingface")
                    else:
                        hf_path = Path.home() / ".cache" / "huggingface"
            self.sources.append({"name": "hf_model_cache", "path": str(hf_path)})

        # openai-whisper model cache (D:\www\cache\whisper on Windows or $XDG_CACHE_HOME/whisper).
        if include_whisper_cache:
            if whisper_cache:
                wh_path = Path(whisper_cache).resolve()
            elif os.environ.get("WHISPER_CACHE_DIR"):
                wh_path = Path(os.environ["WHISPER_CACHE_DIR"]).resolve()
            elif os.environ.get("XDG_CACHE_HOME"):
                wh_path = Path(os.environ["XDG_CACHE_HOME"]).resolve() / "whisper"
            else:
                try:
                    from pycore.pyfoundations.system_paths import get_xdg_cache_home
                    wh_path = get_xdg_cache_home() / "whisper"
                except Exception:
                    if sys.platform == "win32":
                        wh_path = Path(r"D:\www\cache\whisper")
                    else:
                        wh_path = Path.home() / ".cache" / "whisper"
            self.sources.append({"name": "whisper_model_cache", "path": str(wh_path)})

    # -- shared helpers ----------------------------------------------------- #
    def _confirm(self, prompt: str, default_yes: bool = True) -> bool:
        if self.auto_confirm:
            return True
        suffix = " (Y/n): " if default_yes else " (y/N): "
        answer = input(prompt + suffix).strip().lower()
        if answer == "":
            return default_yes
        return answer in ("y", "yes")

    def _is_excluded(self, path: str) -> bool:
        base = os.path.basename(path.rstrip("/\\"))
        if base in self.EXCLUDE_DIR_NAMES:
            return True
        return base.endswith(self.EXCLUDE_FILE_SUFFIXES)

    @staticmethod
    def _human(size: int) -> str:
        value = float(size)
        for unit in ("B", "KB", "MB", "GB", "TB"):
            if value < 1024.0:
                return f"{value:.1f} {unit}"
            value /= 1024.0
        return f"{value:.1f} PB"

    def _dir_size(self, path: Path) -> int:
        total = 0
        for root, dirs, files in os.walk(path):
            dirs[:] = [d for d in dirs if d not in self.EXCLUDE_DIR_NAMES]
            for f in files:
                fp = os.path.join(root, f)
                try:
                    total += os.path.getsize(fp)
                except OSError:
                    pass
        return total

    def _validate_sources(self) -> List[Dict[str, str]]:
        present = []
        for src in self.sources:
            if os.path.isdir(src["path"]):
                present.append(src)
            else:
                warn(f"  [skip] source missing: {src['name']} -> {src['path']}")
        return present

    # -- backup ------------------------------------------------------------- #
    def backup(self, compress_mode: str = "ask") -> int:
        print("\n" + "=" * 70)
        info(" Python Environment Backup (runtime + models + user data)")
        print("=" * 70)

        sources = self._validate_sources()
        if not sources:
            err(" No source roots are present; nothing to back up.")
            return 1

        for src in sources:
            size = self._dir_size(Path(src["path"]))
            info(f"  {src['name']:<14} {src['path']}  ({self._human(size)})")
        info(f"  backup root    {self.backup_root}")

        # Decide compression.
        if compress_mode == "yes":
            compress = True
        elif compress_mode == "no":
            compress = False
        else:
            compress = self._confirm(
                "\n Compress the backup into a single .tar.gz archive?",
                default_yes=True)

        if not self._confirm("\n Proceed with backup?", default_yes=True):
            warn(" Backup cancelled by user.")
            return 0

        os.makedirs(self.backup_root, exist_ok=True)
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"{self.BACKUP_PREFIX}_{timestamp}"

        metadata = {
            "type": "python_env",
            "created": datetime.datetime.now().isoformat(timespec="seconds"),
            "platform": sys.platform,
            "python_version": sys.version.split()[0],
            "compressed": compress,
            "sources": [{"name": s["name"], "original_path": s["path"]}
                        for s in sources],
        }

        start = time.time()
        if compress:
            archive = self.backup_root / f"{backup_name}.tar.gz"
            ok_done = self._write_archive(archive, sources, metadata)
            target = archive
        else:
            out_dir = self.backup_root / backup_name
            ok_done = self._write_directory(out_dir, sources, metadata)
            target = out_dir

        if not ok_done:
            return 1

        elapsed = int(time.time() - start)
        print("\n" + "=" * 70)
        ok(f" Backup completed in {elapsed}s")
        ok(f" Location: {target}")
        print("=" * 70)
        return 0

    def _tar_filter(self, tarinfo: "tarfile.TarInfo"):
        if self._is_excluded(tarinfo.name):
            return None
        return tarinfo

    def _write_archive(self, archive: Path, sources: List[Dict[str, str]],
                       metadata: Dict) -> bool:
        info(f"\n Writing archive: {archive}")
        try:
            with tarfile.open(archive, "w:gz") as tar:
                # Manifest first so it is quick to read back.
                meta_bytes = json.dumps(metadata, indent=2).encode("utf-8")
                meta_info = tarfile.TarInfo(self.METADATA_NAME)
                meta_info.size = len(meta_bytes)
                import io
                tar.addfile(meta_info, io.BytesIO(meta_bytes))
                for src in sources:
                    info(f"   + {src['name']} ...")
                    tar.add(src["path"], arcname=src["name"],
                            filter=self._tar_filter)
            return True
        except Exception as exc:  # noqa: BLE001 - report and fail cleanly
            err(f" Archive creation failed: {exc}")
            if archive.exists():
                try:
                    archive.unlink()
                except OSError:
                    pass
            return False

    def _copy_ignore(self, directory: str, names: List[str]) -> List[str]:
        ignored = []
        for name in names:
            if name in self.EXCLUDE_DIR_NAMES or name.endswith(self.EXCLUDE_FILE_SUFFIXES):
                ignored.append(name)
        return ignored

    def _write_directory(self, out_dir: Path, sources: List[Dict[str, str]],
                         metadata: Dict) -> bool:
        info(f"\n Writing backup directory: {out_dir}")
        try:
            os.makedirs(out_dir, exist_ok=True)
            with open(out_dir / self.METADATA_NAME, "w", encoding="utf-8") as fh:
                json.dump(metadata, fh, indent=2)
            for src in sources:
                info(f"   + {src['name']} ...")
                shutil.copytree(src["path"], out_dir / src["name"],
                                ignore=self._copy_ignore, dirs_exist_ok=True,
                                symlinks=True)
            return True
        except Exception as exc:  # noqa: BLE001
            err(f" Directory backup failed: {exc}")
            return False

    # -- list --------------------------------------------------------------- #
    def _discover(self) -> List[Path]:
        if not self.backup_root.is_dir():
            return []
        found = []
        for entry in self.backup_root.iterdir():
            name = entry.name
            if not name.startswith(self.BACKUP_PREFIX):
                continue
            if entry.is_dir() or name.endswith((".tar.gz", ".tgz", ".tar")):
                found.append(entry)
        found.sort(key=lambda p: p.name, reverse=True)
        return found

    def list_backups(self) -> int:
        print("\n" + "=" * 70)
        info(f" Python environment backups in: {self.backup_root}")
        print("=" * 70)
        backups = self._discover()
        if not backups:
            warn(" No backups found.")
            return 0
        for idx, entry in enumerate(backups, start=1):
            kind = "archive" if entry.is_file() else "directory"
            try:
                size = (os.path.getsize(entry) if entry.is_file()
                        else self._dir_size(entry))
                size_text = self._human(size)
            except OSError:
                size_text = "?"
            print(f"  {idx:>2}. [{kind:<9}] {entry.name}  ({size_text})")
        print("=" * 70)
        return 0

    # -- restore ------------------------------------------------------------ #
    def restore(self, source: Optional[str] = None) -> int:
        print("\n" + "=" * 70)
        info(" Python Environment Restore")
        print("=" * 70)

        selected = self._select_restore_source(source)
        if selected is None:
            warn(" Restore cancelled.")
            return 0

        if selected.is_file():
            return self._restore_from_archive(selected)
        return self._restore_from_directory(selected)

    def _select_restore_source(self, source: Optional[str]) -> Optional[Path]:
        if source:
            path = Path(source).expanduser()
            if not path.exists():
                err(f" Source not found: {path}")
                return None
            return path

        backups = self._discover()
        if not backups:
            warn(f" No backups found in {self.backup_root}.")
            manual = input(" Enter a backup path (archive or directory), "
                           "or leave empty to cancel: ").strip()
            if not manual:
                return None
            path = Path(manual).expanduser()
            return path if path.exists() else None

        self.list_backups()
        choice = input("\n Select a backup number, or type a custom path "
                       "(empty to cancel): ").strip()
        if not choice:
            return None
        if choice.isdigit():
            index = int(choice) - 1
            if 0 <= index < len(backups):
                return backups[index]
            err(" Invalid selection.")
            return None
        path = Path(choice).expanduser()
        if not path.exists():
            err(f" Path not found: {path}")
            return None
        return path

    def _read_manifest_from_dir(self, directory: Path) -> Optional[Dict]:
        meta = directory / self.METADATA_NAME
        if not meta.is_file():
            return None
        try:
            with open(meta, "r", encoding="utf-8") as fh:
                return json.load(fh)
        except (OSError, ValueError):
            return None

    def _restore_roots(self, staging: Path, manifest: Optional[Dict]) -> int:
        # Map logical source name -> original absolute path.
        targets: Dict[str, str] = {}
        if manifest:
            for src in manifest.get("sources", []):
                targets[src["name"]] = src["original_path"]
        # Fall back to the defaults for any name missing from the manifest.
        for src in self.sources:
            targets.setdefault(src["name"], src["path"])

        restored = 0
        for name, original in targets.items():
            staged = staging / name
            if not staged.exists():
                warn(f"  [skip] '{name}' not present in this backup.")
                continue
            dest = Path(original)
            info(f"\n  {name}: -> {dest}")
            if dest.exists():
                if not self._confirm(
                        f"  Target exists and will be OVERWRITTEN: {dest}. Continue?",
                        default_yes=False):
                    warn("  [skip] kept existing target.")
                    continue
            try:
                os.makedirs(dest.parent, exist_ok=True)
                # Merge staged tree into the destination.
                shutil.copytree(staged, dest, dirs_exist_ok=True, symlinks=True)
                restored += 1
                ok(f"  restored '{name}'.")
            except Exception as exc:  # noqa: BLE001
                err(f"  failed to restore '{name}': {exc}")

        if restored:
            ok(f"\n Restore finished: {restored} root(s) restored.")
        else:
            warn("\n Nothing was restored.")
        return 0 if restored else 1

    def _restore_from_directory(self, directory: Path) -> int:
        manifest = self._read_manifest_from_dir(directory)
        if not self._confirm(
                f"\n Restore from directory '{directory}'?", default_yes=False):
            return 0
        return self._restore_roots(directory, manifest)

    def _restore_from_archive(self, archive: Path) -> int:
        if not tarfile.is_tarfile(archive):
            err(f" Not a valid tar archive: {archive}")
            return 1
        if not self._confirm(
                f"\n Restore from archive '{archive}'?", default_yes=False):
            return 0
        staging = archive.parent / f".restore_staging_{int(time.time())}"
        info(f" Extracting to staging: {staging}")
        try:
            os.makedirs(staging, exist_ok=True)
            with tarfile.open(archive, "r:*") as tar:
                try:
                    tar.extractall(staging, filter='data')  # safe extraction (Py 3.12+); future-proofs Py 3.14
                except TypeError:
                    tar.extractall(staging)                 # older Python without the filter= argument
            manifest = self._read_manifest_from_dir(staging)
            return self._restore_roots(staging, manifest)
        except Exception as exc:  # noqa: BLE001
            err(f" Extraction failed: {exc}")
            return 1
        finally:
            shutil.rmtree(staging, ignore_errors=True)


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def main() -> int:
    parser = argparse.ArgumentParser(
        description="Backup / restore the Python runtime, models and user data.")
    parser.add_argument("--action", required=True,
                        choices=["backup", "list", "restore"])
    parser.add_argument("--backup-root", default=None,
                        help="Where backups live (default: parent of core_node).")
    parser.add_argument("--compress", default="ask",
                        choices=["yes", "no", "ask"],
                        help="Compress the backup (default: ask -> Y/n).")
    parser.add_argument("--source", default=None,
                        help="Restore source: a .tar.gz archive or a directory.")
    parser.add_argument("--python-dir", default=None,
                        help="Override the Python install directory.")
    parser.add_argument("--user-data-dir", default=None,
                        help="Override the ~/.core_node user-data root.")
    parser.add_argument("--hf-cache", default=None,
                        help="Override the HuggingFace model cache directory.")
    parser.add_argument("--no-hf-cache", action="store_true",
                        help="Do not back up the HuggingFace model cache.")
    parser.add_argument("--whisper-cache", default=None,
                        help="Override the whisper model cache directory.")
    parser.add_argument("--no-whisper-cache", action="store_true",
                        help="Do not back up the whisper model cache.")
    parser.add_argument("--auto-confirm", action="store_true",
                        help="Skip confirmation prompts.")
    args = parser.parse_args()

    manager = PythonEnvBackup(
        backup_root=args.backup_root,
        python_dir=args.python_dir,
        user_data_dir=args.user_data_dir,
        hf_cache=args.hf_cache,
        whisper_cache=args.whisper_cache,
        include_hf_cache=not args.no_hf_cache,
        include_whisper_cache=not args.no_whisper_cache,
        auto_confirm=args.auto_confirm,
    )

    try:
        if args.action == "backup":
            return manager.backup(compress_mode=args.compress)
        if args.action == "list":
            return manager.list_backups()
        if args.action == "restore":
            return manager.restore(source=args.source)
    except KeyboardInterrupt:
        warn("\n Interrupted by user.")
        return 130
    return 1


if __name__ == "__main__":
    sys.exit(main())
