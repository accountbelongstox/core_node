#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Standalone fstab helper: parse and modify /etc/fstab with a single entry per device (no duplicates).
Uses only stdlib; run with system python3 (no pycore or extra deps). Tolerant of comments, blanks, malformed lines.
"""

from __future__ import annotations

import os
import re
import shutil
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Union


FSTAB_DEFAULT_PATH = "/etc/fstab"


@dataclass
class FstabEntry:
    """One fstab line: device_spec, mount_point, fstype, options, dump, passno."""
    device_spec: str
    mount_point: str
    fstype: str
    options: str
    dump: int = 0
    passno: int = 2

    def to_line(self) -> str:
        return f"{self.device_spec} {self.mount_point} {self.fstype} {self.options} {self.dump} {self.passno}\n"

    @property
    def uuid(self) -> Optional[str]:
        m = re.match(r"UUID=(\S+)", self.device_spec, re.IGNORECASE)
        return m.group(1) if m else None

    @property
    def label(self) -> Optional[str]:
        m = re.match(r"LABEL=(\S+)", self.device_spec, re.IGNORECASE)
        return m.group(1) if m else None


def _parse_fstab_line(line: str) -> Optional[FstabEntry]:
    """Parse a non-empty, non-comment line into FstabEntry or None if malformed."""
    line = line.rstrip("\n")
    parts = line.split(None, 5)
    if len(parts) < 6:
        return None
    device_spec, mount_point, fstype, options = parts[0], parts[1], parts[2], parts[3]
    try:
        dump = int(parts[4])
        passno = int(parts[5])
    except ValueError:
        return None
    if not device_spec or not mount_point or not fstype:
        return None
    return FstabEntry(
        device_spec=device_spec,
        mount_point=mount_point,
        fstype=fstype,
        options=options,
        dump=dump,
        passno=passno,
    )


def _device_spec_matches(
    entry: FstabEntry,
    uuid: Optional[str] = None,
    label: Optional[str] = None,
    device: Optional[str] = None,
) -> bool:
    """Return True if entry matches any of the given identifiers (case-insensitive where sensible)."""
    if uuid is not None:
        e_uuid = entry.uuid
        if e_uuid is not None and e_uuid.upper() == uuid.upper():
            return True
    if label is not None:
        e_label = entry.label
        if e_label is not None and e_label == label:
            return True
    if device is not None:
        norm = os.path.normpath(entry.device_spec)
        dev_norm = os.path.normpath(device)
        if norm == dev_norm or entry.device_spec == device:
            return True
    return False


class FstabError(Exception):
    """Base for fstab operations (permission, read-only, missing file)."""
    pass


class FstabHelper:
    """
    Read and modify fstab with one entry per device (UUID/LABEL/device path).
    Backup before write; atomic write when possible. Tolerates comments, blanks, malformed lines.
    """

    def __init__(self, path: Union[str, Path] = FSTAB_DEFAULT_PATH):
        self.path = Path(path)

    def _read_lines(self) -> List[str]:
        """Read all lines; raise FstabError if file missing or not readable."""
        try:
            with open(self.path, "r", encoding="utf-8", errors="replace") as f:
                return f.readlines()
        except FileNotFoundError:
            raise FstabError(f"fstab not found: {self.path}")
        except PermissionError as e:
            raise FstabError(f"cannot read fstab (permission denied): {self.path}") from e
        except OSError as e:
            raise FstabError(f"cannot read fstab: {e}") from e

    def read_entries(self) -> List[FstabEntry]:
        """Return all parsed fstab entries (comments and malformed lines skipped)."""
        entries: List[FstabEntry] = []
        for line in self._read_lines():
            s = line.strip()
            if not s or s.startswith("#"):
                continue
            entry = _parse_fstab_line(line)
            if entry is not None:
                entries.append(entry)
        return entries

    def read_entries_with_structure(
        self,
    ) -> List[Union[FstabEntry, str]]:
        """
        Return list of either FstabEntry or raw line (str) to preserve order and comments.
        Used when rewriting file.
        """
        result: List[Union[FstabEntry, str]] = []
        for line in self._read_lines():
            s = line.strip()
            if not s or s.startswith("#"):
                result.append(line if line.endswith("\n") else line + "\n")
                continue
            entry = _parse_fstab_line(line)
            if entry is not None:
                result.append(entry)
            else:
                result.append(line if line.endswith("\n") else line + "\n")
        return result

    def backup(self, dest_dir: Optional[Union[str, Path]] = None) -> Path:
        """
        Copy fstab to a backup file (e.g. /etc/fstab.backup.<timestamp>).
        dest_dir defaults to same dir as fstab. Returns path to backup.
        """
        parent = dest_dir if dest_dir is not None else self.path.parent
        parent = Path(parent)
        ts = time.strftime("%Y%m%d_%H%M%S", time.gmtime())
        backup_path = parent / f"{self.path.name}.backup.{ts}"
        try:
            shutil.copy2(self.path, backup_path)
        except PermissionError as e:
            raise FstabError(f"cannot backup fstab (permission denied): {self.path}") from e
        except OSError as e:
            raise FstabError(f"cannot backup fstab: {e}") from e
        return backup_path

    def _write_content(self, content: str, atomic: bool = True) -> None:
        """Write content to self.path. Prefer atomic (temp + replace) when possible."""
        if atomic:
            try:
                fd = tempfile.NamedTemporaryFile(
                    mode="w",
                    encoding="utf-8",
                    dir=str(self.path.parent),
                    delete=False,
                    suffix=".fstab.tmp",
                )
                tmp_path = Path(fd.name)
                try:
                    fd.write(content)
                    fd.close()
                    os.chmod(tmp_path, 0o644)
                    os.replace(tmp_path, self.path)
                except Exception:
                    if tmp_path.exists():
                        try:
                            tmp_path.unlink()
                        except OSError:
                            pass
                    raise
            except PermissionError as e:
                raise FstabError(f"cannot write fstab (permission denied): {self.path}") from e
            except OSError as e:
                raise FstabError(f"cannot write fstab: {e}") from e
        else:
            try:
                with open(self.path, "w", encoding="utf-8", newline="\n") as f:
                    f.write(content)
            except PermissionError as e:
                raise FstabError(f"cannot write fstab (permission denied): {self.path}") from e
            except OSError as e:
                raise FstabError(f"cannot write fstab: {e}") from e

    def ensure_single_entry(
        self,
        mount_point: str,
        fstype: str,
        options: str = "defaults",
        dump: int = 0,
        passno: int = 2,
        uuid: Optional[str] = None,
        label: Optional[str] = None,
        device: Optional[str] = None,
        backup_before: bool = True,
        atomic: bool = True,
    ) -> bool:
        """
        Ensure exactly one fstab entry for the given device. Removes all lines matching
        uuid/label/device, then appends one line. At least one of uuid, label, device must be set.
        """
        if not any((uuid, label, device)):
            raise ValueError("at least one of uuid, label, device must be provided")
        device_spec: str
        if uuid is not None:
            device_spec = f"UUID={uuid}"
        elif label is not None:
            device_spec = f"LABEL={label}"
        else:
            device_spec = os.path.normpath(device) if device else ""

        if backup_before:
            self.backup()

        structured = self.read_entries_with_structure()
        new_entries: List[Union[FstabEntry, str]] = []
        for item in structured:
            if isinstance(item, str):
                new_entries.append(item)
                continue
            if _device_spec_matches(item, uuid=uuid, label=label, device=device):
                continue
            new_entries.append(item)

        new_entry = FstabEntry(
            device_spec=device_spec,
            mount_point=mount_point,
            fstype=fstype,
            options=options,
            dump=dump,
            passno=passno,
        )
        new_entries.append(new_entry)

        lines_out: List[str] = []
        for e in new_entries:
            if isinstance(e, FstabEntry):
                lines_out.append(e.to_line())
            else:
                lines_out.append(e)
        self._write_content("".join(lines_out), atomic=atomic)
        return True

    def remove_entries_by_spec(
        self,
        uuid: Optional[str] = None,
        label: Optional[str] = None,
        device: Optional[str] = None,
        backup_before: bool = True,
        atomic: bool = True,
    ) -> int:
        """Remove all entries matching the given uuid/label/device. Returns count removed."""
        if not any((uuid, label, device)):
            raise ValueError("at least one of uuid, label, device must be provided")
        if backup_before:
            self.backup()
        structured = self.read_entries_with_structure()
        kept: List[Union[FstabEntry, str]] = []
        removed = 0
        for item in structured:
            if isinstance(item, str):
                kept.append(item)
                continue
            if _device_spec_matches(item, uuid=uuid, label=label, device=device):
                removed += 1
                continue
            kept.append(item)
        lines_out = [
            (e.to_line() if isinstance(e, FstabEntry) else e) for e in kept
        ]
        self._write_content("".join(lines_out), atomic=atomic)
        return removed

    def add_entry(
        self,
        device_spec: str,
        mount_point: str,
        fstype: str,
        options: str = "defaults",
        dump: int = 0,
        passno: int = 2,
        backup_before: bool = True,
        atomic: bool = True,
    ) -> None:
        """Append one fstab entry. Does not deduplicate; use ensure_single_entry for that."""
        if backup_before:
            self.backup()
        content = self._read_lines()
        entry = FstabEntry(
            device_spec=device_spec,
            mount_point=mount_point,
            fstype=fstype,
            options=options,
            dump=dump,
            passno=passno,
        )
        content.append(entry.to_line())
        self._write_content("".join(content), atomic=atomic)


def _main() -> None:
    """CLI: ensure_single_entry uuid mount_point fstype options [fstab_path]"""
    if len(sys.argv) < 5:
        print("Usage: fstab_helper.py <uuid> <mount_point> <fstype> <options> [fstab_path]", file=sys.stderr)
        sys.exit(2)
    uuid_arg = sys.argv[1]
    mount_point = sys.argv[2]
    fstype = sys.argv[3]
    options = sys.argv[4]
    path = sys.argv[5] if len(sys.argv) > 5 else FSTAB_DEFAULT_PATH
    try:
        h = FstabHelper(path)
        h.ensure_single_entry(
            mount_point=mount_point,
            fstype=fstype,
            options=options,
            uuid=uuid_arg,
            backup_before=True,
        )
    except (FstabError, ValueError) as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    _main()
