#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Claude Host - File Manager

File and directory operations: mkdir, chown, chmod, copy, move, remove, symlink, etc.
"""

import os
from pathlib import Path

from pyapps.claude_host.model.data_types import CmdResult
from pyapps.claude_host.service.cmd_utils import IS_UNIX, is_root, run_async
from pyapps.claude_host.service.user_manager import UserManager

if IS_UNIX:
    import grp
    import pwd
else:
    grp = None
    pwd = None


class FileManager:
    """File and directory operations."""

    @staticmethod
    def exists(path: str) -> bool:
        return Path(path).exists()

    @staticmethod
    def is_dir(path: str) -> bool:
        return Path(path).is_dir()

    @staticmethod
    def is_file(path: str) -> bool:
        return Path(path).is_file()

    @staticmethod
    def mkdir(path: str, mode: int = 0o755, parents: bool = True) -> CmdResult:
        try:
            Path(path).mkdir(mode=mode, parents=parents, exist_ok=True)
            return CmdResult(0, path, "")
        except OSError as e:
            return CmdResult(-1, "", str(e))

    @staticmethod
    def chown(
        path: str,
        user: str | int | None = None,
        group: str | int | None = None,
        recursive: bool = False,
    ) -> CmdResult:
        if not IS_UNIX:
            return CmdResult(-1, "", "chown is not supported on Windows")
        try:
            uid = -1
            gid = -1
            if user is not None:
                uid = pwd.getpwnam(user).pw_uid if isinstance(user, str) else user
            if group is not None:
                gid = grp.getgrnam(group).gr_gid if isinstance(group, str) else group

            target = Path(path)
            if recursive and target.is_dir():
                for item in target.rglob("*"):
                    os.chown(str(item), uid, gid)
                os.chown(str(target), uid, gid)
            else:
                os.chown(str(target), uid, gid)
            return CmdResult(0, "", "")
        except (KeyError, OSError) as e:
            return CmdResult(-1, "", str(e))

    @staticmethod
    def chmod(path: str, mode: int, recursive: bool = False) -> CmdResult:
        try:
            target = Path(path)
            if recursive and target.is_dir():
                for item in target.rglob("*"):
                    item.chmod(mode)
                target.chmod(mode)
            else:
                target.chmod(mode)
            return CmdResult(0, "", "")
        except OSError as e:
            return CmdResult(-1, "", str(e))

    @staticmethod
    async def copy(src: str, dst: str, recursive: bool = False) -> CmdResult:
        cmd = ["cp"]
        if recursive:
            cmd.append("-r")
        cmd.extend([src, dst])
        return await run_async(*cmd)

    @staticmethod
    async def move(src: str, dst: str) -> CmdResult:
        return await run_async("mv", src, dst)

    @staticmethod
    async def remove(path: str, recursive: bool = False, force: bool = False) -> CmdResult:
        cmd = ["rm"]
        if recursive:
            cmd.append("-r")
        if force:
            cmd.append("-f")
        cmd.append(path)
        return await run_async(*cmd)

    @staticmethod
    async def disk_usage(path: str = "/") -> CmdResult:
        return await run_async("df", "-h", path)

    @staticmethod
    async def dir_size(path: str) -> CmdResult:
        return await run_async("du", "-sh", path)

    @staticmethod
    def symlink(src: str, dst: str) -> CmdResult:
        try:
            Path(dst).symlink_to(src)
            return CmdResult(0, "", "")
        except OSError as e:
            return CmdResult(-1, "", str(e))

    @staticmethod
    def read_text(path: str, encoding: str = "utf-8") -> str | None:
        try:
            return Path(path).read_text(encoding=encoding)
        except OSError:
            return None

    @staticmethod
    def write_text(path: str, content: str, mode: int | None = None) -> CmdResult:
        try:
            p = Path(path)
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content, encoding="utf-8")
            if mode is not None:
                p.chmod(mode)
            return CmdResult(0, "", "")
        except OSError as e:
            return CmdResult(-1, "", str(e))

    @staticmethod
    def ensure_user_dir(path: str, username: str, mode: int = 0o755) -> CmdResult:
        """Create a directory and chown it (and parent chain up to home) to the user."""
        result = FileManager.mkdir(path, mode=mode)
        if not result.ok:
            return result
        if not is_root():
            return result

        info = UserManager.get_info(username)
        if not info:
            return CmdResult(-1, "", f"User {username} not found")

        home = Path(info.home)
        target = Path(path).resolve()
        paths_to_chown = []
        p = target
        while p != home.parent and p != p.parent:
            paths_to_chown.append(p)
            p = p.parent

        for d in paths_to_chown:
            try:
                os.chown(str(d), info.uid, info.gid)
            except OSError:
                pass

        return CmdResult(0, "", "")
