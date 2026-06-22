#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Claude Host - Systemd Service Manager

Start, stop, restart, enable, disable services. Create unit files. Read logs.
"""

from pathlib import Path

from pyapps.claude_host.model.data_types import CmdResult, ServiceStatus
from pyapps.claude_host.service.cmd_utils import run_async, require_root


class ServiceManager:
    """Systemctl service management."""

    @staticmethod
    async def status(service: str) -> ServiceStatus:
        result = await run_async(
            "systemctl", "show", service,
            "--property=ActiveState,SubState,Description,MainPID,UnitFileState",
            "--no-pager",
        )
        props = {}
        for line in result.stdout.splitlines():
            if "=" in line:
                k, v = line.split("=", 1)
                props[k] = v
        pid = int(props.get("MainPID", "0"))
        return ServiceStatus(
            name=service,
            active=props.get("ActiveState", "unknown"),
            enabled=props.get("UnitFileState", "") == "enabled",
            description=props.get("Description", ""),
            pid=pid if pid > 0 else None,
        )

    @staticmethod
    async def start(service: str) -> CmdResult:
        require_root("start service")
        return await run_async("systemctl", "start", service)

    @staticmethod
    async def stop(service: str) -> CmdResult:
        require_root("stop service")
        return await run_async("systemctl", "stop", service)

    @staticmethod
    async def restart(service: str) -> CmdResult:
        require_root("restart service")
        return await run_async("systemctl", "restart", service)

    @staticmethod
    async def reload(service: str) -> CmdResult:
        require_root("reload service")
        return await run_async("systemctl", "reload", service)

    @staticmethod
    async def enable(service: str, now: bool = False) -> CmdResult:
        require_root("enable service")
        cmd = ["systemctl", "enable"]
        if now:
            cmd.append("--now")
        cmd.append(service)
        return await run_async(*cmd)

    @staticmethod
    async def disable(service: str, now: bool = False) -> CmdResult:
        require_root("disable service")
        cmd = ["systemctl", "disable"]
        if now:
            cmd.append("--now")
        cmd.append(service)
        return await run_async(*cmd)

    @staticmethod
    async def daemon_reload() -> CmdResult:
        require_root("daemon-reload")
        return await run_async("systemctl", "daemon-reload")

    @staticmethod
    async def list_units(pattern: str = "", state: str = "") -> list[ServiceStatus]:
        cmd = ["systemctl", "list-units", "--type=service", "--no-pager", "--no-legend"]
        if pattern:
            cmd.append(pattern)
        if state:
            cmd.extend(["--state", state])
        result = await run_async(*cmd)
        if not result.ok:
            return []
        services = []
        for line in result.stdout.splitlines():
            parts = line.split(None, 4)
            if len(parts) >= 4:
                services.append(ServiceStatus(
                    name=parts[0].removesuffix(".service"),
                    active=parts[2],
                    enabled=False,
                    description=parts[4] if len(parts) > 4 else "",
                ))
        return services

    @staticmethod
    async def logs(service: str, lines: int = 50, since: str = "") -> CmdResult:
        cmd = ["journalctl", "-u", service, f"-n{lines}", "--no-pager"]
        if since:
            cmd.extend(["--since", since])
        return await run_async(*cmd, timeout=15)

    @staticmethod
    async def create_unit(
        name: str,
        exec_start: str,
        description: str = "",
        user: str = "",
        working_dir: str = "",
        env_vars: dict[str, str] | None = None,
        restart: str = "on-failure",
        after: str = "network.target",
    ) -> CmdResult:
        require_root("create service unit")
        unit = f"""[Unit]
Description={description or name}
After={after}

[Service]
Type=simple
ExecStart={exec_start}
Restart={restart}
RestartSec=5
"""
        if user:
            unit += f"User={user}\n"
        if working_dir:
            unit += f"WorkingDirectory={working_dir}\n"
        if env_vars:
            for k, v in env_vars.items():
                unit += f"Environment={k}={v}\n"
        unit += "\n[Install]\nWantedBy=multi-user.target\n"

        unit_path = f"/etc/systemd/system/{name}.service"
        try:
            Path(unit_path).write_text(unit)
            await ServiceManager.daemon_reload()
            return CmdResult(0, unit_path, "")
        except OSError as e:
            return CmdResult(-1, "", str(e))
