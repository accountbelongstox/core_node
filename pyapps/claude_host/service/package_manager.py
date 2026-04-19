#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Claude Host - Package Manager

APT package management for Debian/Ubuntu: install, remove, upgrade, search.
"""

import os

from pyapps.claude_host.model.data_types import CmdResult
from pyapps.claude_host.service.cmd_utils import run_async, require_root

_APT_ENV = {**os.environ, "DEBIAN_FRONTEND": "noninteractive"}


class PackageManager:
    """APT package management."""

    @staticmethod
    async def update() -> CmdResult:
        require_root("apt update")
        return await run_async("apt-get", "update", "-qq", timeout=120, env=_APT_ENV)

    @staticmethod
    async def install(*packages: str, no_recommends: bool = True) -> CmdResult:
        require_root("apt install")
        cmd = ["apt-get", "install", "-y", "-qq"]
        if no_recommends:
            cmd.append("--no-install-recommends")
        cmd.extend(packages)
        return await run_async(*cmd, timeout=300, env=_APT_ENV)

    @staticmethod
    async def remove(*packages: str, purge: bool = False) -> CmdResult:
        require_root("apt remove")
        cmd = ["apt-get", "purge" if purge else "remove", "-y", "-qq"]
        cmd.extend(packages)
        return await run_async(*cmd, timeout=120, env=_APT_ENV)

    @staticmethod
    async def upgrade(dist_upgrade: bool = False) -> CmdResult:
        require_root("apt upgrade")
        action = "dist-upgrade" if dist_upgrade else "upgrade"
        return await run_async("apt-get", action, "-y", "-qq", timeout=600, env=_APT_ENV)

    @staticmethod
    async def autoremove() -> CmdResult:
        require_root("apt autoremove")
        return await run_async("apt-get", "autoremove", "-y", "-qq", env=_APT_ENV)

    @staticmethod
    async def is_installed(package: str) -> bool:
        result = await run_async("dpkg", "-s", package)
        return result.ok and "Status: install ok installed" in result.stdout

    @staticmethod
    async def list_installed(pattern: str = "") -> list[str]:
        result = await run_async("dpkg", "--get-selections")
        if not result.ok:
            return []
        packages = []
        for line in result.stdout.splitlines():
            parts = line.split()
            if len(parts) >= 2 and parts[1] == "install":
                name = parts[0].split(":")[0]
                if not pattern or pattern in name:
                    packages.append(name)
        return packages

    @staticmethod
    async def search(keyword: str) -> CmdResult:
        return await run_async("apt-cache", "search", keyword)

    @staticmethod
    async def show(package: str) -> CmdResult:
        return await run_async("apt-cache", "show", package)

    @staticmethod
    async def add_repository(repo: str, key_url: str | None = None) -> CmdResult:
        require_root("add repository")
        if key_url:
            key_result = await run_async(
                "bash", "-c",
                f"curl -fsSL {key_url} | gpg --dearmor -o /etc/apt/keyrings/custom-{hash(repo) & 0xFFFF:04x}.gpg",
                timeout=30,
            )
            if not key_result.ok:
                return key_result
        return await run_async("add-apt-repository", "-y", repo)
