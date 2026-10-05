# -*- coding: utf-8 -*-
"""Network router (NAT gateway) status and control for pycore-manager.

State is read from the files the gateway already writes (router.conf, the /run applied/lease files, sysfs, systemd);
every change and the detailed report are delegated to the existing CLI (113_natgateway.sh on Linux,
Step73_InstallNetworkRouter.ps1 on Windows), which stays the single owner of the gateway logic.
"""

import ipaddress
import os
import re
import shlex
import socket
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.core_node_dirs import get_core_node_data_dir, read_global_var
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.commander import run_args
from pycore.pyfoundations.pygvar import IS_LINUX, IS_WINDOWS
from pycore.pyfoundations.system_service_state import (
    STATE_ABSENT,
    SUDO_COMMAND,
    SUDO_NON_INTERACTIVE_FLAG,
    is_elevated,
    sudo_available,
    systemd_available,
    systemd_unit_enabled,
    systemd_unit_state,
    windows_service_state,
)
from pycore.pyfoundations.third_party.api import get_third_package_psutil
from pycore.pyutils.network_router import network_router_constants as consts

ANSI_PATTERN = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
KEY_VALUE_PATTERN = re.compile(r'^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$')


def _failure(code: str, detail: str = "") -> Dict[str, Any]:
    return {"success": False, "error_code": code, "detail": detail}


def _read_text(path: Path) -> str:
    # Run-state files can vanish between the listing and the read (the gateway rewrites them).
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        ColorPrint.gray(f"[NetworkRouter] cannot read {path}: {exc}")
        return ""


def _parse_key_values(text: str, keys: Tuple[str, ...]) -> Dict[str, str]:
    values: Dict[str, str] = {}
    for line in text.splitlines():
        matched = KEY_VALUE_PATTERN.match(line)
        if matched and matched.group(1) in keys:
            values[matched.group(1)] = matched.group(2).strip('"')
    return values


def _clean_output(text: str, limit: int) -> str:
    return ANSI_PATTERN.sub("", text).strip()[-limit:]


def _platform() -> str:
    if IS_LINUX:
        return consts.PLATFORM_LINUX
    if IS_WINDOWS:
        return consts.PLATFORM_WINDOWS
    return consts.PLATFORM_OTHER


class NetworkRouterService:
    """Reports and controls the network router of this machine."""

    def status(self, include_report: bool = False) -> Dict[str, Any]:
        platform = _platform()
        installed = self._installed(platform)
        unsupported = self._unsupported_code(platform)
        snapshot: Dict[str, Any] = {
            "success": True,
            "platform": platform,
            "supported": unsupported == "",
            "unsupported_code": unsupported,
            "install_flag": (read_global_var(consts.INSTALL_FLAG_KEY) or "").lower() == consts.INSTALL_FLAG_ENABLED,
            "installed": installed,
            "install_command": self._install_command(platform),
            "service": self._service(platform, consts.SERVICE_NAME),
            "diag_service": self._service(platform, consts.DIAG_SERVICE_NAME) if platform == consts.PLATFORM_LINUX else None,
            "config_file": str(self._config_file()),
            "config": self._config(),
            "forwarding": None,
            "dhcp_running": None,
            "links": [],
            "interfaces": [],
            "leases": [],
        }
        if platform == consts.PLATFORM_LINUX:
            links = self._links()
            snapshot.update(
                forwarding=_read_text(consts.IP_FORWARD_FILE).strip() == consts.IP_FORWARD_ENABLED,
                dhcp_running=any(link["dhcp_running"] for link in links),
                links=links,
                interfaces=self._interfaces(links),
                leases=self._leases(),
            )
        if include_report and installed and unsupported == "":
            snapshot.update(self._report())
        return snapshot

    def logs(self) -> Dict[str, Any]:
        platform = _platform()
        if not self._installed(platform):
            return _failure(consts.ERROR_NOT_INSTALLED)
        result = self._run_cli(platform, consts.CLI_LOGS, privileged=platform == consts.PLATFORM_LINUX)
        if isinstance(result, dict):
            return result
        return {"success": True, "lines": _clean_output(result.combined, consts.REPORT_TAIL_CHARS).splitlines()}

    def control(self, action: str) -> Dict[str, Any]:
        platform = _platform()
        if action not in consts.ACTIONS:
            return _failure(consts.ERROR_ACTION_INVALID)
        if not self._installed(platform):
            return _failure(consts.ERROR_NOT_INSTALLED)
        result = self._run_cli(platform, action, privileged=True)
        if isinstance(result, dict):
            return result
        output = _clean_output(result.combined, consts.ACTION_DETAIL_TAIL_CHARS)
        if not result.success:
            return _failure(consts.ERROR_COMMAND_FAILED, output)
        return {"success": True, "action": action, "output": output, "state": self.status()}

    def _installed(self, platform: str) -> bool:
        if platform == consts.PLATFORM_LINUX:
            return consts.SERVICE_UNIT_FILE.is_file()
        if platform == consts.PLATFORM_WINDOWS:
            return windows_service_state(consts.SERVICE_NAME) != STATE_ABSENT
        return False

    def _unsupported_code(self, platform: str) -> str:
        if platform == consts.PLATFORM_LINUX:
            return "" if systemd_available() else consts.UNSUPPORTED_NO_SYSTEMD
        return "" if platform == consts.PLATFORM_WINDOWS else consts.UNSUPPORTED_PLATFORM

    def _service(self, platform: str, name: str) -> Dict[str, Any]:
        if platform == consts.PLATFORM_LINUX and systemd_available():
            return {"name": name, "state": systemd_unit_state(name), "enabled": systemd_unit_enabled(name)}
        if platform == consts.PLATFORM_WINDOWS:
            return {"name": name, "state": windows_service_state(name), "enabled": None}
        return {"name": name, "state": STATE_ABSENT, "enabled": None}

    def _config_file(self) -> Path:
        return get_core_node_data_dir() / consts.CONFIG_DIR_NAME / consts.CONFIG_FILE_NAME

    def _config(self) -> Optional[Dict[str, str]]:
        path = self._config_file()
        if not path.is_file():
            return None
        return _parse_key_values(_read_text(path), consts.CONFIG_KEYS)

    def _links(self) -> List[Dict[str, Any]]:
        links: List[Dict[str, Any]] = []
        for path in sorted(consts.RUN_DIR.glob(f"{consts.APPLIED_FILE_PREFIX}*")):
            bridge = path.name[len(consts.APPLIED_FILE_PREFIX):]
            applied = _parse_key_values(_read_text(path), consts.APPLIED_KEYS)
            members_dir = consts.SYS_NET_DIR / bridge / consts.SYS_BRIDGE_MEMBERS_DIR
            links.append({
                "bridge": bridge,
                "uplink": applied.get("WAN", ""),
                "address": applied.get("ADDRESS", ""),
                "relay": sorted(member.name for member in members_dir.iterdir()) if members_dir.is_dir() else [],
                "state": consts.LINK_STATE_HOLD if applied.get("LOST") else consts.LINK_STATE_ACTIVE,
                "host_uplink": applied.get("ISOLATED") != consts.APPLIED_YES,
                "dhcp_running": self._dhcp_running(bridge),
            })
        return links

    def _dhcp_running(self, bridge: str) -> bool:
        pid_file = consts.RUN_DIR / f"{consts.LEASES_FILE_PREFIX}{bridge}{consts.PID_FILE_SUFFIX}"
        pid = _read_text(pid_file).strip() if pid_file.is_file() else ""
        return pid.isdigit() and (consts.PROC_DIR / pid).is_dir()

    def _leases(self) -> List[Dict[str, str]]:
        leases: List[Dict[str, str]] = []
        for path in sorted(consts.RUN_DIR.glob(f"{consts.LEASES_FILE_PREFIX}*{consts.LEASES_FILE_SUFFIX}")):
            bridge = path.name[len(consts.LEASES_FILE_PREFIX):-len(consts.LEASES_FILE_SUFFIX)]
            for line in _read_text(path).splitlines():
                fields = line.split()
                if len(fields) >= consts.LEASE_FIELDS:
                    leases.append({"bridge": bridge, "expires": fields[0], "mac": fields[1], "ip": fields[2], "host": fields[3]})
        return leases

    def _interfaces(self, links: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        roles: Dict[str, Tuple[str, str]] = {}
        for link in links:
            if link["uplink"]:
                roles[link["uplink"]] = (consts.ROLE_UPLINK, link["bridge"])
            for member in link["relay"]:
                roles[member] = (consts.ROLE_RELAY, link["bridge"])
        psutil = get_third_package_psutil()
        addresses = psutil.net_if_addrs() if psutil else {}
        interfaces: List[Dict[str, Any]] = []
        for entry in sorted(consts.SYS_NET_DIR.iterdir()):
            device = entry / consts.SYS_DEVICE_LINK
            if not device.exists():
                continue
            role, bridge = roles.get(entry.name, (consts.ROLE_NONE, ""))
            interfaces.append({
                "name": entry.name,
                "kind": consts.KIND_USB if consts.SYS_USB_PATH_MARKER in os.path.realpath(device) else consts.KIND_ONBOARD,
                "media": consts.MEDIA_WIFI if (entry / consts.SYS_WIRELESS_DIR).is_dir() else consts.MEDIA_WIRED,
                "link_up": _read_text(entry / consts.SYS_CARRIER_FILE).strip() == "1",
                "ipv4": self._ipv4(addresses.get(entry.name, [])),
                "role": role,
                "bridge": bridge,
            })
        return interfaces

    def _ipv4(self, addresses) -> List[str]:
        return [
            f"{address.address}/{ipaddress.IPv4Network(f'0.0.0.0/{address.netmask}').prefixlen}"
            for address in addresses
            if address.family == socket.AF_INET and address.netmask
        ]

    def _report(self) -> Dict[str, Any]:
        platform = _platform()
        result = self._run_cli(platform, consts.CLI_STATUS, privileged=False)
        if isinstance(result, dict):
            return {"report": "", "report_error_code": result["error_code"]}
        return {"report": _clean_output(result.combined, consts.REPORT_TAIL_CHARS), "report_error_code": ""}

    def _install_command(self, platform: str) -> str:
        if platform == consts.PLATFORM_LINUX:
            return shlex.join([SUDO_COMMAND, consts.BASH_COMMAND, str(consts.LINUX_SCRIPT), consts.CLI_INSTALL])
        if platform == consts.PLATFORM_WINDOWS:
            return subprocess.list2cmdline([consts.POWERSHELL_COMMAND, *consts.POWERSHELL_ARGS, str(consts.WINDOWS_SCRIPT), consts.CLI_INSTALL])
        return ""

    def _cli_argv(self, platform: str, command: str, privileged: bool):
        """The argv that runs one CLI command, or a failure dict."""
        prefix: List[str] = []
        if platform == consts.PLATFORM_LINUX:
            script = consts.LINUX_SCRIPT
            launcher = [consts.BASH_COMMAND]
            if privileged and not is_elevated():
                if not sudo_available([*launcher, str(script), command]):
                    return _failure(consts.ERROR_PRIVILEGE_REQUIRED)
                prefix = [SUDO_COMMAND, SUDO_NON_INTERACTIVE_FLAG]
        elif platform == consts.PLATFORM_WINDOWS:
            script = consts.WINDOWS_SCRIPT
            launcher = [consts.POWERSHELL_COMMAND, *consts.POWERSHELL_ARGS]
            if privileged and not is_elevated():
                return _failure(consts.ERROR_ELEVATION_REQUIRED)
        else:
            return _failure(consts.ERROR_UNSUPPORTED)
        if not script.is_file():
            return _failure(consts.ERROR_SCRIPT_MISSING, str(script))
        return [*prefix, *launcher, str(script), command]

    def _run_cli(self, platform: str, command: str, privileged: bool):
        """CommandResult of one CLI command, or a failure dict."""
        argv = self._cli_argv(platform, command, privileged)
        if isinstance(argv, dict):
            return argv
        timeout = consts.CLI_ACTION_TIMEOUT_SEC if privileged else consts.CLI_QUERY_TIMEOUT_SEC
        return run_args(argv, input_text="", timeout=timeout)


network_router = NetworkRouterService()
