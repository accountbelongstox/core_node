#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Center Server Registration Client

Registers this claude_host instance to webclaude_center_server via HTTP.
Sends periodic heartbeats to maintain online status.
"""

import asyncio
import json
import logging
import os
import platform
import socket
import string
from urllib.error import URLError
from urllib.request import Request, urlopen

from pycore.pyfoundations.pybasecommon.commander import (
    command_exists,
    get_command_output,
)

logger = logging.getLogger(__name__)


def _parse_wmic_value(output: str, key: str) -> str:
    """Extract a value from wmic /value output (Key=Value format)."""
    for line in output.splitlines():
        line = line.strip()
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip()
    return ""


class CenterRegistration:
    """Registers and maintains heartbeat with webclaude_center_server."""

    def __init__(self, center_url: str, host_token: str, host_id: str = "",
                 users_callback=None):
        self.center_url = center_url.rstrip('/')
        self.host_token = host_token
        self.host_id = host_id or f"host-{socket.gethostname().lower()}"
        self.heartbeat_interval = 60  # seconds
        self._running = False
        self._users_callback = users_callback

    def _get_system_info(self) -> dict:
        """Collect cross-platform system information.

        Includes: OS details, CPU load, memory, disk usage, uptime,
        logged-in user count, and admin/root privilege status.
        Uses native OS commands instead of psutil.
        """
        info = {
            "os": platform.system().lower(),
            "os_release": platform.release(),
            "os_version": platform.version(),
            "arch": platform.machine(),
            "hostname": socket.gethostname(),
            "python_version": platform.python_version(),
            "pid": os.getpid(),
            "cpu_count": os.cpu_count() or 1,
        }

        # -- Linux distro detection --
        if platform.system() == "Linux":
            os_release_path = "/etc/os-release"
            if os.path.isfile(os_release_path):
                with open(os_release_path) as f:
                    for line in f:
                        if line.startswith("PRETTY_NAME="):
                            info["distro"] = line.split("=", 1)[1].strip().strip('"')
                        elif line.startswith("ID="):
                            info["distro_id"] = line.split("=", 1)[1].strip().strip('"')

        # -- CPU load --
        if platform.system() != "Windows":
            # Linux/Mac: read /proc/loadavg or use os.getloadavg
            loadavg_path = "/proc/loadavg"
            if os.path.isfile(loadavg_path):
                with open(loadavg_path) as f:
                    parts = f.readline().split()
                    if len(parts) >= 3:
                        info["load_avg"] = [float(parts[0]), float(parts[1]), float(parts[2])]
            elif hasattr(os, "getloadavg"):
                info["load_avg"] = list(os.getloadavg())
            else:
                info["load_avg"] = None
        else:
            # Windows: use wmic for CPU load percent
            cpu_output = get_command_output(
                "wmic cpu get LoadPercentage /value"
            )
            load_pct = _parse_wmic_value(cpu_output, "LoadPercentage")
            if load_pct:
                info["cpu_percent"] = float(load_pct)
            info["load_avg"] = None

        # -- Memory info (native commands) --
        if platform.system() == "Windows":
            mem_output = get_command_output(
                "wmic OS get TotalVisibleMemorySize,FreePhysicalMemory /value"
            )
            total_kb_str = _parse_wmic_value(mem_output, "TotalVisibleMemorySize")
            free_kb_str = _parse_wmic_value(mem_output, "FreePhysicalMemory")
            total_mb = int(total_kb_str) // 1024 if total_kb_str else 0
            avail_mb = int(free_kb_str) // 1024 if free_kb_str else 0
            info["memory_total_mb"] = total_mb
            info["memory_avail_mb"] = avail_mb
            if total_mb > 0:
                info["memory_load_percent"] = round(
                    (total_mb - avail_mb) / total_mb * 100, 1
                )
        else:
            # Linux: read /proc/meminfo
            meminfo_path = "/proc/meminfo"
            if os.path.isfile(meminfo_path):
                meminfo = {}
                with open(meminfo_path) as f:
                    for line in f:
                        parts = line.split()
                        if parts[0] in ("MemTotal:", "MemAvailable:"):
                            meminfo[parts[0].rstrip(":")] = int(parts[1]) // 1024
                info["memory_total_mb"] = meminfo.get("MemTotal", 0)
                info["memory_avail_mb"] = meminfo.get("MemAvailable", 0)
                total = info["memory_total_mb"]
                avail = info["memory_avail_mb"]
                if total > 0:
                    info["memory_load_percent"] = round(
                        (total - avail) / total * 100, 1
                    )

        # -- Disk usage (native) --
        disks = []
        if platform.system() == "Windows":
            for letter in string.ascii_uppercase:
                drive = f"{letter}:\\"
                if not os.path.isdir(drive):
                    continue
                wmic_out = get_command_output(
                    f"wmic logicaldisk where \"caption='{letter}:'\" get size,freespace /value"
                )
                size_str = _parse_wmic_value(wmic_out, "Size")
                free_str = _parse_wmic_value(wmic_out, "FreeSpace")
                if not size_str:
                    continue
                total_b = int(size_str)
                free_b = int(free_str) if free_str else 0
                used_b = total_b - free_b
                if total_b > 0:
                    disks.append({
                        "mount": drive,
                        "total_gb": round(total_b / (1024 ** 3), 2),
                        "used_gb": round(used_b / (1024 ** 3), 2),
                        "free_gb": round(free_b / (1024 ** 3), 2),
                        "use_percent": round(used_b / total_b * 100, 1),
                    })
        else:
            # Linux: use df -B1
            df_output = get_command_output("df -B1 --output=target,size,used,avail /")
            lines = df_output.strip().split("\n")
            if len(lines) >= 2:
                # Skip header line
                for line in lines[1:]:
                    parts = line.split()
                    if len(parts) >= 4:
                        total_b = int(parts[1])
                        used_b = int(parts[2])
                        free_b = int(parts[3])
                        if total_b > 0:
                            disks.append({
                                "mount": parts[0],
                                "total_gb": round(total_b / (1024 ** 3), 2),
                                "used_gb": round(used_b / (1024 ** 3), 2),
                                "free_gb": round(free_b / (1024 ** 3), 2),
                                "use_percent": round(used_b / total_b * 100, 1),
                            })
        info["disks"] = disks

        # -- Uptime (native) --
        if platform.system() == "Windows":
            tick_output = get_command_output(
                'powershell -Command "(Get-Date) - (gcim Win32_OperatingSystem).LastBootUpTime | Select -ExpandProperty TotalSeconds"'
            )
            info["uptime_seconds"] = float(tick_output.strip()) if tick_output.strip() else 0.0
        else:
            uptime_path = "/proc/uptime"
            if os.path.isfile(uptime_path):
                with open(uptime_path) as f:
                    info["uptime_seconds"] = float(f.readline().split()[0])

        # -- Current logged-in user count (native) --
        if platform.system() == "Windows":
            query_output = get_command_output("query user")
            # Each logged-in user is a line after the header
            user_lines = [l for l in query_output.strip().split("\n")[1:] if l.strip()]
            info["logged_in_users"] = max(len(user_lines), 1)
        else:
            who_output = get_command_output("who")
            users = set()
            for line in who_output.strip().split("\n"):
                if line.strip():
                    users.add(line.split()[0])
            info["logged_in_users"] = max(len(users), 1)

        # -- Admin / root privilege --
        if platform.system() == "Windows":
            # 'net session' succeeds only when running as administrator
            net_output = get_command_output("net session 2>&1")
            info["is_admin"] = "Access is denied" not in net_output
        else:
            info["is_admin"] = os.geteuid() == 0

        return info

    def _get_capabilities(self) -> dict:
        """Report host capabilities."""
        claude_available = command_exists("claude")
        claude_path = get_command_output("where claude" if platform.system() == "Windows" else "which claude").strip()
        return {
            "claude_available": claude_available,
            "claude_path": claude_path.split("\n")[0].strip() if claude_path else "",
            "platforms": [platform.system().lower()],
        }

    def register(self) -> bool:
        """Register/heartbeat to center_server via HTTP POST."""
        url = f"{self.center_url}/api/registry/host"
        system_info = self._get_system_info()
        if self._users_callback:
            try:
                system_info["users"] = self._users_callback()
            except Exception:
                system_info["users"] = []
        reg_data = {
            "node_id": self.host_id,
            "name": f"host-{socket.gethostname()}",
            "host": self._get_local_ip(),
            "port": 0,
            "capabilities": self._get_capabilities(),
            "system_info": system_info,
        }
        payload = json.dumps(reg_data).encode("utf-8")

        req = Request(url, data=payload, method="POST")
        req.add_header("Content-Type", "application/json")
        req.add_header("Authorization", f"Bearer {self.host_token}")

        try:
            with urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
                logger.info(f"Registered to center_server: {data}")
                return True
        except (URLError, Exception) as e:
            logger.warning(f"Failed to register to center_server: {e}")
            return False

    def _get_local_ip(self) -> str:
        """Get local IP address."""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "127.0.0.1"

    async def start_heartbeat(self):
        """Async heartbeat loop."""
        self._running = True
        loop = asyncio.get_running_loop()
        try:
            await loop.run_in_executor(None, self.register)
        except Exception as e:
            logger.warning(f"Initial registration failed: {e}")

        while self._running:
            await asyncio.sleep(self.heartbeat_interval)
            if self._running:
                try:
                    await loop.run_in_executor(None, self.register)
                except Exception as e:
                    logger.warning(f"Heartbeat registration failed: {e}")

    def stop(self):
        """Stop heartbeat."""
        self._running = False
