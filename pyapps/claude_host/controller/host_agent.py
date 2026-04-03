#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Claude Host - Host Agent

Gateway connection agent (multi-user). Connects to webclaude_go-gateway
via reverse WebSocket tunnel, dispatches commands to ClaudeRunner instances,
and sends heartbeats with system/user status.

Note: webclaude_center_server (formerly top-router) is the management server.
webclaude_go-gateway is the relay hub this agent connects to.
"""

import asyncio
import json
import logging
import socket

import websockets
from websockets.asyncio.client import connect as ws_connect

from pyapps.claude_host.claude_host_config import (
    AUTO_CREATE_USERS,
    CLAUDE_BIN,
    CLAUDE_USERS,
    CENTRAL_SERVER_URL,
    CENTER_SERVER_URL,
    HEARTBEAT_INTERVAL,
    HOST_ID,
    HOST_TOKEN,
    credentials_json_path,
    default_project_dir_for_user,
)
from pyapps.claude_host.controller.claude_runner import ClaudeRunner
from pyapps.claude_host.service.center_registration import CenterRegistration
from pyapps.claude_host.service.claude_status import (
    check_all_users_status,
    check_claude_usage,
    invalidate_cache,
)
from pyapps.claude_host.service.host_config import save_config
from pyapps.claude_host.service.linux_ops import LinuxOps
from pyapps.claude_host.service.platform_compat import IS_WINDOWS

log = logging.getLogger("claude_host.agent")


class HostAgent:
    """
    Central-server-connected host agent that manages multiple concurrent Claude sessions.

    Responsibilities:
    - Maintain WebSocket connection to the central server (with auto-reconnect)
    - Dispatch 'run_claude' commands to isolated ClaudeRunner instances
    - Track per-user busy/idle state (one active claude process per user)
    - Send periodic heartbeats with system metrics and user status
    - Handle user lifecycle: selection, auto-creation, listing
    """

    def __init__(self, ops: LinuxOps):
        self.ops = ops
        self.ws = None
        self.runners: dict[str, ClaudeRunner] = {}
        self.user_busy: dict[str, str] = {}
        self.known_users: set[str] = set(CLAUDE_USERS)
        self._shutdown = False
        self._reconnect_delay = 1
        self._center_hb_task: asyncio.Task | None = None
        self._claude_status_task: asyncio.Task | None = None
        self._claude_status_cache: dict[str, dict] = {}  # username -> status dict

        # Center server registration (optional)
        self.center_reg = None
        if CENTER_SERVER_URL:
            self.center_reg = CenterRegistration(
                center_url=CENTER_SERVER_URL,
                host_token=HOST_TOKEN,
                host_id=HOST_ID,
                users_callback=self._get_user_status,
            )

    # ── Gateway URL construction ─────────────────────────────

    def _build_server_url(self) -> str:
        url = CENTRAL_SERVER_URL
        if not url:
            raise ValueError("CENTRAL_SERVER_URL (or GATEWAY_URL) is required")
        sep = "&" if "?" in url else "?"
        params = []
        if HOST_TOKEN and "token=" not in url:
            params.append(f"token={HOST_TOKEN}")
        host_id = HOST_ID
        if "host_id=" not in url:
            params.append(f"host_id={host_id}")
        if params:
            url += sep + "&".join(params)
        return url

    # ── Envelope helper ──────────────────────────────────────

    def _wrap_envelope(self, msg_type: str, payload: dict) -> str:
        """Wrap message in gateway-compatible envelope format.

        The gateway parses every incoming message as:
            { "type": "<msg_type>", "data": { ... } }
        and then extracts *payload* from the ``data`` field.
        """
        return json.dumps({
            "type": msg_type,
            "data": payload,
        }, ensure_ascii=False)

    # ── User status reporting ────────────────────────────────

    def _get_user_status(self) -> list[dict]:
        """Synchronous user status (used by center_registration callback)."""
        result = []
        for username in sorted(self.known_users):
            busy_req = self.user_busy.get(username)
            user_info = self.ops.user.get_info(username)
            info = {
                "username": username,
                "busy": busy_req is not None,
                "current_request_id": busy_req,
                "home_exists": user_info is not None and self.ops.file.exists(user_info.home),
                "has_credentials": self.ops.file.is_file(
                    credentials_json_path(username)
                ),
            }
            # Merge cached Claude status if available
            cached = self._claude_status_cache.get(username)
            if cached:
                info["claude_logged_in"] = cached.get("logged_in", False)
                info["claude_account"] = cached.get("account") or cached.get("email") or ""
                info["claude_plan"] = cached.get("plan") or cached.get("subscriptionType") or ""
                info["claude_auth_method"] = cached.get("auth_method", "")
                info["claude_api_provider"] = cached.get("api_provider", "")
                info["claude_org_name"] = cached.get("org_name", "")
                info["claude_error"] = cached.get("error", "")
                if "claude_usage" in cached:
                    info["claude_usage"] = cached["claude_usage"]
            result.append(info)
        return result

    async def _collect_system_info(self) -> dict:
        """Return heartbeat payload (without envelope wrapper)."""
        mem = self.ops.system.memory()
        load = self.ops.system.load_avg()
        return {
            "host_id": HOST_ID,
            "hostname": self.ops.system.hostname(),
            "load": list(load),
            "memory": {"total": mem.total, "available": mem.available},
            "users": self._get_user_status(),
            "active_count": len(self.runners),
            "claude_bin": CLAUDE_BIN,
        }

    async def _refresh_claude_status_loop(self):
        """Periodically refresh Claude auth status for all known users.

        Runs every 5 minutes. The results are cached in
        ``_claude_status_cache`` and merged into user status reports.
        """
        while not self._shutdown:
            try:
                usernames = sorted(self.known_users)
                if usernames:
                    statuses = await check_all_users_status(usernames)
                    # Also collect usage info (best-effort)
                    usage_tasks = [check_claude_usage(u) for u in usernames]
                    usage_results = await asyncio.gather(*usage_tasks, return_exceptions=True)
                    usage_map = {}
                    for uname, uresult in zip(usernames, usage_results):
                        if isinstance(uresult, dict):
                            usage_map[uname] = uresult
                    for s in statuses:
                        uname = s["username"]
                        s["claude_usage"] = usage_map.get(uname, {
                            "usage_available": False,
                            "reason": "Collection failed",
                        })
                        self._claude_status_cache[uname] = s
                    log.debug(
                        "Claude status refreshed for %d user(s)", len(statuses)
                    )
            except Exception as e:
                log.warning("Claude status refresh error: %s", e)
            await asyncio.sleep(300)  # 5 minutes

    # ── WebSocket messaging ──────────────────────────────────

    async def _send_event(self, request_id: str, event: dict):
        if not self.ws:
            return
        payload = {"request_id": request_id, "event": event}
        try:
            await self.ws.send(self._wrap_envelope("stream", payload))
        except websockets.ConnectionClosed:
            log.warning(f"Cannot send event for {request_id[:8]}: disconnected")

    async def _send_response(self, request_id: str, data: dict):
        if not self.ws:
            return
        payload = {"request_id": request_id, "data": data}
        try:
            await self.ws.send(self._wrap_envelope("response", payload))
        except websockets.ConnectionClosed:
            pass

    # ── Heartbeat loop ───────────────────────────────────────

    async def _heartbeat_loop(self):
        while not self._shutdown:
            try:
                info = await self._collect_system_info()
                if self.ws:
                    await self.ws.send(self._wrap_envelope("heartbeat", info))
            except websockets.ConnectionClosed:
                break
            except Exception as e:
                log.warning(f"Heartbeat error: {e}")
            await asyncio.sleep(HEARTBEAT_INTERVAL)

    # ── User selection and provisioning ──────────────────────

    def _select_user(self, preferred: str = "") -> str | None:
        if preferred and preferred in self.known_users:
            if preferred not in self.user_busy:
                return preferred
            log.warning(f"User {preferred} is busy")
            return None

        if preferred and self.ops.user.validate_username(preferred):
            if preferred not in self.user_busy:
                return preferred
            log.warning(f"User {preferred} is busy")
            return None

        for u in sorted(self.known_users):
            if u not in self.user_busy:
                return u
        return None

    async def _ensure_user_ready(self, username: str) -> tuple[bool, str]:
        """
        Ensure a user is ready to run Claude.

        - Linux:  check/create a real system user via useradd.
        - Windows: check/create a virtual user (CLAUDE_CONFIG_DIR directory).
                   Both paths register the user into ``known_users``.
        """
        if self.ops.user.exists(username):
            self.known_users.add(username)
            return True, "User ready"

        if not AUTO_CREATE_USERS:
            return False, f"User {username} does not exist and auto-creation is disabled"

        if not self.ops.user.validate_username(username):
            return False, f"Invalid username format: {username}"

        result = await self.ops.user.create(username)
        if result.ok:
            self.known_users.add(username)
            platform_label = "Windows virtual" if IS_WINDOWS else "Linux system"
            log.info(f"Created {platform_label} user: {username}")
            return True, f"User {username} created"
        else:
            return False, f"Failed to create user: {result.stderr}"

    # ── Command dispatch ─────────────────────────────────────

    async def _handle_command(self, msg: dict):
        action = msg.get("action", "")
        req_id = msg.get("request_id", "")

        if action == "run_claude":
            await self._handle_run_claude(msg, req_id)
        elif action == "stop_claude":
            runner = self.runners.get(req_id)
            if runner:
                log.info(f"Stopping runner {req_id[:8]}")
                await runner.stop()
        elif action == "create_user":
            await self._handle_create_user(msg, req_id)
        elif action == "list_users":
            await self._send_response(req_id, {"users": self._get_user_status()})
        elif action == "refresh_status":
            # Invalidate cache and re-check Claude auth status immediately
            invalidate_cache()
            statuses = await check_all_users_status(list(self.known_users))
            for s in statuses:
                self._claude_status_cache[s["username"]] = s
            await self._send_response(req_id, {
                "success": True,
                "users": statuses,
            })
        elif action == "set_bridge":
            data = msg.get("data", {})
            bridge_config = {
                "bridge_enabled": data.get("enabled", False),
                "bridge_gateway_id": data.get("gateway_id", ""),
                "bridge_gateway_url": data.get("gateway_url", ""),
            }
            save_config(bridge_config)
            log.info("Bridge config updated: enabled=%s gateway=%s",
                     bridge_config["bridge_enabled"],
                     bridge_config["bridge_gateway_id"])
            await self._send_response(req_id, {
                "success": True,
                "bridge": bridge_config,
            })
        else:
            log.warning(f"Unknown command: {action}")

    async def _handle_run_claude(self, msg: dict, req_id: str):
        if req_id in self.runners:
            await self._send_event(req_id, {
                "type": "error", "message": "Request already running",
            })
            return

        preferred_user = msg.get("username", "")
        username = self._select_user(preferred_user)
        if not username:
            await self._send_event(req_id, {
                "type": "error",
                "message": f"No available user"
                    + (f" (requested: {preferred_user})" if preferred_user else ""),
            })
            return

        ok, user_msg = await self._ensure_user_ready(username)
        if not ok:
            await self._send_event(req_id, {"type": "error", "message": user_msg})
            return

        project_dir = msg.get("project_dir", "")
        if not project_dir:
            project_dir = default_project_dir_for_user(username)

        runner = ClaudeRunner(
            request_id=req_id,
            on_event=self._send_event,
            prompt=msg.get("prompt", ""),
            ops=self.ops,
            username=username,
            session_id=msg.get("session_id", ""),
            model=msg.get("model", ""),
            effort=msg.get("effort", ""),
            allowed_tools=msg.get("allowed_tools", ""),
            project_dir=project_dir,
        )
        self.runners[req_id] = runner
        self.user_busy[username] = req_id

        async def run_and_cleanup():
            try:
                await runner.run()
            finally:
                self.runners.pop(req_id, None)
                if self.user_busy.get(username) == req_id:
                    del self.user_busy[username]

        asyncio.create_task(run_and_cleanup())
        log.info(
            f"Started runner {req_id[:8]} as {username} "
            f"dir={project_dir} "
            f"(active: {len(self.runners)}/{len(self.known_users)})"
        )

    async def _handle_create_user(self, msg: dict, req_id: str):
        """
        Handle ``create_user`` command.

        - Linux:  calls ``useradd`` to create a real system user.
        - Windows: creates a ``CLAUDE_CONFIG_DIR`` directory for the user
                   (no OS account needed; isolation via environment variable).
        Both cases register the user into ``known_users`` on success.
        """
        username = msg.get("username", "")
        result = await self.ops.user.create(username)
        if result.ok:
            self.known_users.add(username)
        user_info = self.ops.user.get_info(username) if result.ok else None
        await self._send_response(req_id, {
            "success": result.ok,
            "username": username,
            "home_dir": user_info.home if user_info else "",
            "message": result.stderr if not result.ok else f"User {username} ready",
        })

    # ── Main connection loop ─────────────────────────────────

    async def connect(self):
        url = self._build_server_url()
        log_url = url.split("?")[0]

        # Start center server registration heartbeat (if configured)
        if self.center_reg:
            self._center_hb_task = asyncio.create_task(self.center_reg.start_heartbeat())

        # Start periodic Claude auth status refresh (every 5 min)
        self._claude_status_task = asyncio.create_task(
            self._refresh_claude_status_loop()
        )

        while not self._shutdown:
            try:
                log.info(f"Connecting to central server: {log_url} ...")
                async with ws_connect(
                    url,
                    ping_interval=30,
                    ping_timeout=10,
                    close_timeout=5,
                ) as ws:
                    self.ws = ws
                    self._reconnect_delay = 1
                    log.info("Connected to central server")

                    # Register this host with the gateway
                    register_msg = self._wrap_envelope("host_register", {
                        "host_id": HOST_ID,
                        "hostname": socket.gethostname(),
                        "token": HOST_TOKEN,
                    })
                    await ws.send(register_msg)
                    log.info("Sent host_register to gateway")

                    hb_task = asyncio.create_task(self._heartbeat_loop())
                    try:
                        async for raw in ws:
                            try:
                                msg = json.loads(raw)
                            except json.JSONDecodeError:
                                continue

                            t = msg.get("type", "")
                            if t == "command":
                                await self._handle_command(msg)
                            elif t == "connected":
                                log.info(f"Registered as host: {msg.get('host_id')}")
                            elif t == "ack":
                                pass
                    finally:
                        hb_task.cancel()
                        self.ws = None

            except (
                websockets.ConnectionClosed,
                ConnectionRefusedError,
                OSError,
                asyncio.TimeoutError,
            ) as e:
                log.warning(f"Connection lost: {type(e).__name__}: {e}")

            if self._shutdown:
                break

            log.info(f"Reconnecting in {self._reconnect_delay}s ...")
            await asyncio.sleep(self._reconnect_delay)
            self._reconnect_delay = min(self._reconnect_delay * 2, 60)

    # ── Graceful shutdown ────────────────────────────────────

    async def shutdown(self):
        self._shutdown = True
        log.info(f"Shutting down, stopping {len(self.runners)} runner(s) ...")

        if self.center_reg:
            self.center_reg.stop()
        if self._center_hb_task:
            self._center_hb_task.cancel()
            try:
                await self._center_hb_task
            except asyncio.CancelledError:
                pass
        if self._claude_status_task:
            self._claude_status_task.cancel()
            try:
                await self._claude_status_task
            except asyncio.CancelledError:
                pass

        tasks = [r.stop() for r in self.runners.values()]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        if self.ws:
            try:
                await self.ws.close()
            except (websockets.ConnectionClosed, OSError):
                pass

        log.info("Host agent stopped")
