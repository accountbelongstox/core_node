#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Claude Host - Process Manager

Process listing, searching, killing, and waiting.
"""

import asyncio
import os
import signal

from pyapps.claude_host.model.data_types import CmdResult, ProcessInfo
from pyapps.claude_host.service.cmd_utils import run_async


class ProcessManager:
    """Process inspection and control."""

    @staticmethod
    async def list_all(user: str | None = None) -> list[ProcessInfo]:
        cmd = ["ps", "aux", "--no-headers"]
        if user:
            cmd = ["ps", "-u", user, "-o", "pid,ppid,user,%cpu,%mem,stat,args", "--no-headers"]
        result = await run_async(*cmd)
        if not result.ok:
            return []

        procs = []
        for line in result.stdout.splitlines():
            parts = line.split(None, 6 if user else 10)
            if len(parts) < 6:
                continue
            try:
                if user:
                    procs.append(ProcessInfo(
                        pid=int(parts[0]), ppid=int(parts[1]), user=parts[2],
                        cpu=float(parts[3]), mem=float(parts[4]),
                        state=parts[5], command=parts[6] if len(parts) > 6 else "",
                    ))
                else:
                    procs.append(ProcessInfo(
                        pid=int(parts[1]), ppid=0, user=parts[0],
                        cpu=float(parts[2]), mem=float(parts[3]),
                        state=parts[7] if len(parts) > 7 else "",
                        command=parts[10] if len(parts) > 10 else "",
                    ))
            except (ValueError, IndexError):
                continue
        return procs

    @staticmethod
    async def find_by_name(name: str) -> list[ProcessInfo]:
        result = await run_async("pgrep", "-a", name)
        if not result.ok:
            return []
        procs = []
        for line in result.stdout.splitlines():
            parts = line.split(None, 1)
            if len(parts) >= 2:
                procs.append(ProcessInfo(
                    pid=int(parts[0]), ppid=0, user="",
                    cpu=0, mem=0, command=parts[1],
                ))
        return procs

    @staticmethod
    def kill(pid: int, sig: int = signal.SIGTERM) -> CmdResult:
        try:
            os.kill(pid, sig)
            return CmdResult(0, "", "")
        except ProcessLookupError:
            return CmdResult(-1, "", f"No such process: {pid}")
        except PermissionError:
            return CmdResult(-1, "", f"Permission denied: {pid}")

    @staticmethod
    def kill_group(pgid: int, sig: int = signal.SIGTERM) -> CmdResult:
        try:
            os.killpg(pgid, sig)
            return CmdResult(0, "", "")
        except (ProcessLookupError, PermissionError, OSError) as e:
            return CmdResult(-1, "", str(e))

    @staticmethod
    async def kill_user_processes(username: str, sig: int = signal.SIGTERM) -> CmdResult:
        return await run_async("pkill", f"-{sig}", "-u", username)

    @staticmethod
    async def wait_pid(pid: int, timeout: float = 10) -> bool:
        end = asyncio.get_event_loop().time() + timeout
        while asyncio.get_event_loop().time() < end:
            try:
                os.kill(pid, 0)
            except ProcessLookupError:
                return True
            except PermissionError:
                return False
            await asyncio.sleep(0.2)
        return False
