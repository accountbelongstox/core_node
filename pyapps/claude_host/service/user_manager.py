#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Claude Host - User Manager

System user CRUD: create, delete, modify, password, groups, SSH keys, sudoers.
"""

import getpass
import logging
import os
import re
from pathlib import Path

from pyapps.claude_host.model.data_types import CmdResult, UserInfo
from pyapps.claude_host.service.cmd_utils import (
    IS_UNIX,
    run_async,
    require_root,
)
from pyapps.claude_host.service.platform_compat import (
    IS_WINDOWS,
    ensure_claude_user_config,
    get_claude_config_dir,
)

if not IS_WINDOWS:
    import grp
    import pwd
else:
    grp = None
    pwd = None

log = logging.getLogger("claude_host.user")

USERNAME_RE = re.compile(r"^[a-z_][a-z0-9_-]{0,31}$")


class UserManager:
    """System user management (useradd / userdel / usermod / passwd / groups)."""

    @staticmethod
    def validate_username(username: str) -> bool:
        return bool(USERNAME_RE.match(username))

    @staticmethod
    def exists(username: str) -> bool:
        if not IS_UNIX:
            # Windows: the current OS user always "exists"; additionally,
            # any user with an existing CLAUDE_CONFIG_DIR is considered provisioned.
            if username.lower() == getpass.getuser().lower():
                return True
            config_dir = get_claude_config_dir(username)
            return os.path.isdir(config_dir)
        try:
            pwd.getpwnam(username)
            return True
        except KeyError:
            return False

    @staticmethod
    def get_info(username: str) -> UserInfo | None:
        if not IS_UNIX:
            # Windows: current OS user gets real home; virtual users get
            # their CLAUDE_CONFIG_DIR as "home" for status-reporting purposes.
            if username.lower() == getpass.getuser().lower():
                home = str(Path.home())
            else:
                config_dir = get_claude_config_dir(username)
                if not os.path.isdir(config_dir):
                    return None
                home = config_dir
            return UserInfo(
                username=username, uid=0, gid=0, home=home,
                shell=os.environ.get("COMSPEC", "cmd.exe"),
                gecos="", groups=[],
            )
        try:
            pw = pwd.getpwnam(username)
        except KeyError:
            return None

        groups = []
        try:
            gids = os.getgrouplist(username, pw.pw_gid)
            for gid in gids:
                try:
                    groups.append(grp.getgrgid(gid).gr_name)
                except KeyError:
                    groups.append(str(gid))
        except Exception:
            pass

        return UserInfo(
            username=pw.pw_name, uid=pw.pw_uid, gid=pw.pw_gid,
            home=pw.pw_dir, shell=pw.pw_shell, gecos=pw.pw_gecos,
            groups=groups,
        )

    @staticmethod
    def list_users(min_uid: int = 1000, max_uid: int = 60000) -> list[UserInfo]:
        if not IS_UNIX:
            # Windows: list the current OS user plus any virtual users whose
            # config directories exist under ~/.claude-users/
            users = []
            current_info = UserManager.get_info(getpass.getuser())
            if current_info:
                users.append(current_info)
            claude_users_root = os.path.join(os.path.expanduser("~"), ".claude-users")
            if os.path.isdir(claude_users_root):
                for name in sorted(os.listdir(claude_users_root)):
                    if name.lower() == getpass.getuser().lower():
                        continue  # already included
                    full = os.path.join(claude_users_root, name)
                    if os.path.isdir(full):
                        users.append(UserInfo(
                            username=name, uid=0, gid=0, home=full,
                            shell=os.environ.get("COMSPEC", "cmd.exe"),
                            gecos="", groups=[],
                        ))
            return users
        users = []
        for pw in pwd.getpwall():
            if min_uid <= pw.pw_uid <= max_uid:
                users.append(UserInfo(
                    username=pw.pw_name, uid=pw.pw_uid, gid=pw.pw_gid,
                    home=pw.pw_dir, shell=pw.pw_shell, gecos=pw.pw_gecos,
                ))
        return users

    @staticmethod
    async def create(
        username: str,
        shell: str = "/bin/bash",
        create_home: bool = True,
        groups: list[str] | None = None,
        system_user: bool = False,
    ) -> CmdResult:
        """
        Create a user for Claude Host.

        - Linux:  creates a real system user via ``useradd`` (requires root).
        - Windows: creates a virtual user by provisioning a per-user
                   ``CLAUDE_CONFIG_DIR`` under ``~/.claude-users/<username>``.
                   No OS-level account is created; isolation relies on the
                   ``CLAUDE_CONFIG_DIR`` environment variable at subprocess launch.
        """
        if not UserManager.validate_username(username):
            return CmdResult(-1, "", f"Invalid username: {username}")
        if UserManager.exists(username):
            return CmdResult(0, "", f"User {username} already exists")

        if IS_WINDOWS:
            # Windows: provision config directory (no OS-level user)
            try:
                config_dir = ensure_claude_user_config(username)
                log.info(f"Created Windows virtual user: {username} -> {config_dir}")
                return CmdResult(0, config_dir, f"Windows user config created: {config_dir}")
            except OSError as e:
                return CmdResult(-1, "", f"Failed to create config dir: {e}")

        # Linux: create a real system user
        require_root("create user")
        cmd = ["useradd"]
        if create_home:
            cmd.append("-m")
        if shell:
            cmd.extend(["-s", shell])
        if system_user:
            cmd.append("-r")
        if groups:
            cmd.extend(["-G", ",".join(groups)])
        cmd.append(username)

        result = await run_async(*cmd)
        if result.ok:
            log.info(f"Created user: {username}")
        return result

    @staticmethod
    async def delete(username: str, remove_home: bool = False) -> CmdResult:
        if not UserManager.exists(username):
            return CmdResult(0, "", f"User {username} does not exist")
        require_root("delete user")
        cmd = ["userdel"]
        if remove_home:
            cmd.append("-r")
        cmd.append(username)
        result = await run_async(*cmd)
        if result.ok:
            log.info(f"Deleted user: {username}")
        return result

    @staticmethod
    async def modify(
        username: str,
        shell: str | None = None,
        home: str | None = None,
        groups: list[str] | None = None,
        append_groups: bool = True,
        lock: bool | None = None,
    ) -> CmdResult:
        require_root("modify user")
        cmd = ["usermod"]
        if shell:
            cmd.extend(["-s", shell])
        if home:
            cmd.extend(["-d", home, "-m"])
        if groups:
            if append_groups:
                cmd.append("-a")
            cmd.extend(["-G", ",".join(groups)])
        if lock is True:
            cmd.append("-L")
        elif lock is False:
            cmd.append("-U")
        cmd.append(username)
        return await run_async(*cmd)

    @staticmethod
    async def set_password(username: str, password: str) -> CmdResult:
        require_root("set password")
        return await run_async(
            "chpasswd",
            stdin_data=f"{username}:{password}\n".encode(),
        )

    @staticmethod
    async def add_to_group(username: str, group: str) -> CmdResult:
        require_root("add to group")
        return await run_async("usermod", "-a", "-G", group, username)

    @staticmethod
    async def ensure_sudoer(username: str, nopasswd: bool = True) -> CmdResult:
        require_root("manage sudoers")
        rule = f"{username} ALL=(ALL) NOPASSWD:ALL" if nopasswd else f"{username} ALL=(ALL) ALL"
        sudoer_file = Path(f"/etc/sudoers.d/{username}")
        try:
            sudoer_file.write_text(rule + "\n")
            sudoer_file.chmod(0o440)
            return CmdResult(0, "", f"Sudoer file created: {sudoer_file}")
        except OSError as e:
            return CmdResult(-1, "", str(e))

    @staticmethod
    async def setup_ssh_key(username: str, public_key: str) -> CmdResult:
        info = UserManager.get_info(username)
        if not info:
            return CmdResult(-1, "", f"User {username} not found")

        ssh_dir = Path(info.home) / ".ssh"
        auth_keys = ssh_dir / "authorized_keys"
        try:
            ssh_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
            existing = auth_keys.read_text() if auth_keys.exists() else ""
            if public_key.strip() not in existing:
                with auth_keys.open("a") as f:
                    f.write(public_key.strip() + "\n")
            auth_keys.chmod(0o600)
            if IS_UNIX:
                os.chown(str(ssh_dir), info.uid, info.gid)
                os.chown(str(auth_keys), info.uid, info.gid)
            return CmdResult(0, "", "SSH key configured")
        except OSError as e:
            return CmdResult(-1, "", str(e))
