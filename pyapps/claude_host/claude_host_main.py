#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Claude Host Agent - Main Entry Point

Multi-user host backend for the WebClaude Group project, running as a core_node pyapp.
Connects to the gateway (webclaude_go-gateway) via reverse WebSocket tunnel,
receives user commands, and executes Claude CLI processes.

Note: webclaude_center_server (formerly top-router) is the management server.
webclaude_go-gateway is the relay hub this host connects to.

Usage:
    python scripts/pycore/pymain.py app=claude_host

Architecture:
    WebClaude Website (Frontend)
        -> webclaude_center_server (Management API)
        -> webclaude_go-gateway (Relay Gateway)
            -> claude_host (this pyapp, Host Agent)
                -> Claude CLI (subprocess per user)

Environment Variables:
    CENTRAL_SERVER_URL   Gateway WebSocket address (required, alias: GATEWAY_URL)
    CENTER_SERVER_URL    Center server HTTP URL for host registration (optional)
    HOST_TOKEN           Host authentication token (required)
    HOST_ID              Host identifier (auto-generated if omitted)
    CLAUDE_USERS         Comma-separated list of system users (default: current user)
    CLAUDE_PROJECT_DIR   Default project directory
    HEARTBEAT_INTERVAL   Heartbeat interval in seconds (default: 30)
    AUTO_CREATE_USERS    Whether to auto-create missing system users (default: true)

Dependencies: pip install websockets
"""

import asyncio
import logging
import os
import signal

from pyapps.claude_host.claude_host_config import (
    AUTO_CREATE_USERS,
    CLAUDE_BIN,
    CLAUDE_USERS,
    CURRENT_USER,
    DEFAULT_PROJECT_DIR,
    CENTRAL_SERVER_URL,
    CENTER_SERVER_URL,
    HOST_ID,
)
from pyapps.claude_host.controller.host_agent import HostAgent
from pyapps.claude_host.service.linux_ops import LinuxOps

log = logging.getLogger("claude_host")


def _print_banner(ops: LinuxOps):
    """Print startup banner with system and configuration info."""
    distro, dver = ops.system.distro()
    uid = os.getuid() if hasattr(os, "getuid") else -1
    log.info("=" * 56)
    log.info("  Claude Code Host Agent (multi-user)")
    log.info(f"  Gateway:     {CENTRAL_SERVER_URL or '(not set)'}")
    log.info(f"  Center:      {CENTER_SERVER_URL or '(not set)'}")
    log.info(f"  Host ID:     {HOST_ID or '(auto)'}")
    log.info(f"  Claude:      {CLAUDE_BIN}")
    log.info(f"  Users:       {', '.join(CLAUDE_USERS)}")
    log.info(f"  Auto-create: {AUTO_CREATE_USERS}")
    log.info(f"  Project:     {DEFAULT_PROJECT_DIR}")
    log.info(f"  Running as:  {CURRENT_USER} (uid={uid})")
    log.info(f"  OS:          {distro} {dver}")
    log.info(f"  Kernel:      {ops.system.kernel()}")
    log.info(f"  LinuxOps:    loaded (user/file/process/pkg/service/network/shell/cron)")
    log.info("=" * 56)


async def _async_main():
    """Async entry: create LinuxOps and HostAgent, connect with signal handling."""
    if not CENTRAL_SERVER_URL:
        log.error(
            "CENTRAL_SERVER_URL (or GATEWAY_URL) is required. "
            "Example: ws://server.example.com:18200/host"
        )
        return

    ops = LinuxOps()
    _print_banner(ops)

    agent = HostAgent(ops)

    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()

    def on_signal():
        log.info("Shutdown signal received")
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, on_signal)
        except (NotImplementedError, RuntimeError):
            pass

    connect_task = asyncio.create_task(agent.connect())
    await stop_event.wait()
    await agent.shutdown()
    connect_task.cancel()


def start():
    """Entry point called by core_node app_launcher."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
    )
    asyncio.run(_async_main())


def main():
    """Alias for start(), for compatibility."""
    start()


if __name__ == "__main__":
    start()
