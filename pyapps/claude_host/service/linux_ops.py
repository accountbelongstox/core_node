#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Claude Host - LinuxOps Aggregator

Unified entry point that composes all service managers into a single facade.

Usage:
    ops = LinuxOps()
    await ops.user.create("alice")
    ops.file.mkdir("/home/alice/project")
    info = await ops.system.collect()
    await ops.pkg.install("curl", "wget")
    await ops.service.restart("nginx")
    await ops.shell.run_as_user("alice", "whoami")
"""

import logging
import os

from pyapps.claude_host.service.cmd_utils import is_root
from pyapps.claude_host.service.user_manager import UserManager
from pyapps.claude_host.service.file_manager import FileManager
from pyapps.claude_host.service.process_manager import ProcessManager
from pyapps.claude_host.service.package_manager import PackageManager
from pyapps.claude_host.service.system_info import SystemInfoCollector
from pyapps.claude_host.service.service_manager import ServiceManager
from pyapps.claude_host.service.network_manager import NetworkManager
from pyapps.claude_host.service.shell_executor import ShellExecutor
from pyapps.claude_host.service.cron_manager import CronManager

log = logging.getLogger("claude_host.ops")


class LinuxOps:
    """
    Unified Linux operations facade.

    Aggregates all sub-managers for user, file, process, package,
    system info, systemd, network, shell, and cron operations.
    """

    def __init__(self):
        self.user = UserManager()
        self.file = FileManager()
        self.process = ProcessManager()
        self.pkg = PackageManager()
        self.system = SystemInfoCollector()
        self.service = ServiceManager()
        self.network = NetworkManager()
        self.shell = ShellExecutor()
        self.cron = CronManager()

    async def ensure_user_env(
        self,
        username: str,
        project_dir: str | None = None,
        groups: list[str] | None = None,
    ) -> tuple[bool, str]:
        """
        One-stop setup: ensure user exists, belongs to groups, and project dir is ready.

        Returns: (success, message)
        """
        if not self.user.exists(username):
            if not self.user.validate_username(username):
                return False, f"Invalid username: {username}"
            result = await self.user.create(username, groups=groups)
            if not result.ok:
                return False, f"Failed to create user: {result.stderr}"
            log.info(f"Created user: {username}")
        elif groups:
            await self.user.modify(username, groups=groups, append_groups=True)

        if project_dir:
            result = self.file.ensure_user_dir(project_dir, username)
            if not result.ok:
                return False, f"Failed to create project dir: {result.stderr}"

        return True, "User environment ready"

    @staticmethod
    def is_root() -> bool:
        return is_root()

    @staticmethod
    def current_user() -> str:
        return os.environ.get("USER", "root")
