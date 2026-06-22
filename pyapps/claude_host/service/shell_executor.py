#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Claude Host - Shell Executor

Run commands as specific users, execute shell scripts, inspect environment.
"""

import os

from pycore.pyfoundations.pybasecommon.commander import (
    command_exists,
    get_command_output,
)
from pyapps.claude_host.model.data_types import CmdResult
from pyapps.claude_host.service.cmd_utils import run_async


class ShellExecutor:
    """Execute commands as specific users."""

    @staticmethod
    async def run_as_user(
        username: str,
        command: str | list[str],
        cwd: str | None = None,
        env: dict[str, str] | None = None,
        timeout: float = 30,
    ) -> CmdResult:
        if isinstance(command, str):
            cmd = ["sudo", "-u", username, "bash", "-c", command]
        else:
            cmd = ["sudo", "-u", username, "--"] + command

        full_env = {**os.environ, "TERM": "dumb"}
        if env:
            full_env.update(env)
        return await run_async(*cmd, timeout=timeout, env=full_env, cwd=cwd)

    @staticmethod
    async def run_shell(
        script: str,
        cwd: str | None = None,
        timeout: float = 30,
    ) -> CmdResult:
        return await run_async("bash", "-c", script, timeout=timeout, cwd=cwd)

    @staticmethod
    def which(command: str) -> str | None:
        """Find full path for a command using native where/which."""
        if not command_exists(command):
            return None
        locate_cmd = f"where {command}" if os.name == "nt" else f"which {command}"
        output = get_command_output(locate_cmd)
        first_line = output.strip().split("\n")[0].strip() if output.strip() else ""
        return first_line if first_line else None

    @staticmethod
    async def env_for_user(username: str) -> dict[str, str]:
        result = await run_async("sudo", "-u", username, "env")
        if not result.ok:
            return {}
        env = {}
        for line in result.stdout.splitlines():
            if "=" in line:
                k, v = line.split("=", 1)
                env[k] = v
        return env
