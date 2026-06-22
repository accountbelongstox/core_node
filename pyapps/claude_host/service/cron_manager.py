#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Claude Host - Cron Manager

Crontab listing, adding, and removing jobs.
"""

from pyapps.claude_host.model.data_types import CmdResult
from pyapps.claude_host.service.cmd_utils import run_async


class CronManager:
    """Crontab management."""

    @staticmethod
    async def list_jobs(username: str | None = None) -> CmdResult:
        cmd = ["crontab", "-l"]
        if username:
            cmd = ["crontab", "-l", "-u", username]
        return await run_async(*cmd)

    @staticmethod
    async def add_job(
        schedule: str,
        command: str,
        username: str | None = None,
        comment: str = "",
    ) -> CmdResult:
        existing = await CronManager.list_jobs(username)
        lines = existing.stdout.splitlines() if existing.ok else []

        for line in lines:
            if command in line:
                return CmdResult(0, "", "Job already exists")

        if comment:
            lines.append(f"# {comment}")
        lines.append(f"{schedule} {command}")
        content = "\n".join(lines) + "\n"

        cmd = ["crontab", "-"]
        if username:
            cmd = ["crontab", "-u", username, "-"]
        return await run_async(*cmd, stdin_data=content.encode())

    @staticmethod
    async def remove_job(pattern: str, username: str | None = None) -> CmdResult:
        existing = await CronManager.list_jobs(username)
        if not existing.ok:
            return existing

        lines = [l for l in existing.stdout.splitlines() if pattern not in l]
        content = "\n".join(lines) + "\n" if lines else ""

        cmd = ["crontab", "-"]
        if username:
            cmd = ["crontab", "-u", username, "-"]
        return await run_async(*cmd, stdin_data=content.encode())
