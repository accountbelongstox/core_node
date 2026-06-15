#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Claude Host - Claude Runner

Manages a single Claude CLI subprocess lifecycle.
Each runner is bound to one request_id and one system user, fully isolated.
Parses stream-json output from the Claude CLI.
"""

import asyncio
import json
import logging
import os
import signal
from pathlib import Path

from pyapps.claude_host.claude_host_config import (
    ALLOWED_PATH_PREFIXES,
    CLAUDE_BIN,
    CURRENT_USER,
)
from pyapps.claude_host.service.claude_status import _find_git_bash
from pyapps.claude_host.service.linux_ops import LinuxOps
from pyapps.claude_host.service.platform_compat import (
    IS_WINDOWS,
    ensure_claude_user_config,
)

log = logging.getLogger("claude_host.runner")


class ClaudeRunner:
    """
    Manage a single 'claude -p' subprocess.

    Each runner corresponds to one request_id and is fully isolated.
    Supports execution as a specific system user via sudo.
    """

    def __init__(self, request_id: str, on_event, prompt: str, ops: LinuxOps, **kwargs):
        self.request_id = request_id
        self.on_event = on_event
        self.prompt = prompt
        self.ops = ops
        self.username: str = kwargs.get("username", "") or CURRENT_USER
        self.session_id: str = kwargs.get("session_id", "")
        self.model: str = kwargs.get("model", "")
        self.effort: str = kwargs.get("effort", "")
        self.allowed_tools: str = kwargs.get("allowed_tools", "")
        self.project_dir: str = kwargs.get("project_dir", "")
        self.process: asyncio.subprocess.Process | None = None
        self._stopped = False
        self._extra_env: dict[str, str] = {}  # populated by _build_cmd on Windows

    # ── Project directory validation ─────────────────────────

    def _validate_project_dir(self) -> str:
        """
        Validate that the project directory falls within allowed prefixes.

        - Linux:  projects live under /home/{username}/ (strict per-user isolation).
        - Windows: broader whitelist — user home, Documents, Projects, D:\\ etc.
                   (no OS-level user switching; isolation is via CLAUDE_CONFIG_DIR).
        """
        resolved = Path(self.project_dir).resolve()
        for prefix in ALLOWED_PATH_PREFIXES:
            if prefix and resolved.is_relative_to(Path(prefix).resolve()):
                return str(resolved)
        raise ValueError("Project directory not in allowed paths")

    # ── Command building ─────────────────────────────────────

    def _build_cmd(self) -> list[str]:
        """
        Build the Claude CLI command list.

        Multi-user isolation (per Claude Code official documentation):
        - Linux:  ``sudo -u <username> -- claude ...``
                  Each system user's ``~/.claude`` directory provides natural isolation.
        - Windows: Set ``CLAUDE_CONFIG_DIR`` to a per-user directory under
                   ``~/.claude-users/<username>``.  No OS-level user switch is needed;
                   the environment variable tells Claude CLI where to store sessions
                   and credentials.
        """
        # On Windows, .cmd/.bat files must be invoked via cmd /c
        bin_path = CLAUDE_BIN
        if IS_WINDOWS and bin_path.lower().endswith((".cmd", ".bat")):
            claude_cmd = ["cmd", "/c", bin_path, "-p", self.prompt,
                          "--output-format", "stream-json",
                          "--verbose", "--include-partial-messages"]
        else:
            claude_cmd = [bin_path, "-p", self.prompt,
                          "--output-format", "stream-json",
                          "--verbose", "--include-partial-messages"]
        if self.session_id:
            claude_cmd.extend(["--resume", self.session_id])
        if self.model:
            claude_cmd.extend(["--model", self.model])
        if self.effort:
            claude_cmd.extend(["--effort", self.effort])
        if self.allowed_tools:
            claude_cmd.extend(["--allowedTools", self.allowed_tools])

        if self.username and self.username != CURRENT_USER:
            if IS_WINDOWS:
                # Windows: isolate via CLAUDE_CONFIG_DIR, no sudo
                config_dir = ensure_claude_user_config(self.username)
                self._extra_env["CLAUDE_CONFIG_DIR"] = config_dir
                log.info(
                    f"Windows multi-user: user={self.username} "
                    f"CLAUDE_CONFIG_DIR={config_dir}"
                )
                return claude_cmd
            else:
                # Linux: switch to the target system user via sudo
                return ["sudo", "-u", self.username, "--"] + claude_cmd

        return claude_cmd

    # ── Main execution loop ──────────────────────────────────

    async def run(self):
        try:
            project_dir = self._validate_project_dir()
        except ValueError as e:
            await self.on_event(self.request_id, {
                "type": "error", "message": str(e),
            })
            return

        result = self.ops.file.ensure_user_dir(project_dir, self.username)
        if not result.ok:
            await self.on_event(self.request_id, {
                "type": "error", "message": f"Project dir error: {result.stderr}",
            })
            return

        cmd = self._build_cmd()

        await self.on_event(self.request_id, {
            "type": "status", "status": "starting",
            "prompt": self.prompt[:200],
            "username": self.username,
            "project_dir": project_dir,
        })

        try:
            # Merge base environment with any per-user overrides (e.g. CLAUDE_CONFIG_DIR)
            run_env = {**os.environ, "TERM": "dumb", **self._extra_env}
            # Windows: ensure CLAUDE_CODE_GIT_BASH_PATH is set
            if IS_WINDOWS and "CLAUDE_CODE_GIT_BASH_PATH" not in run_env:
                git_bash = _find_git_bash()
                if git_bash:
                    run_env["CLAUDE_CODE_GIT_BASH_PATH"] = git_bash

            popen_kw: dict = {
                "stdout": asyncio.subprocess.PIPE,
                "stderr": asyncio.subprocess.PIPE,
                "cwd": project_dir,
                "env": run_env,
            }
            if os.name != "nt" and hasattr(os, "setsid"):
                popen_kw["preexec_fn"] = os.setsid
            self.process = await asyncio.create_subprocess_exec(*cmd, **popen_kw)

            await self.on_event(self.request_id, {
                "type": "status", "status": "running", "pid": self.process.pid,
            })

            await self._read_stdout()
            await self._read_stderr()
            await self.process.wait()

            await self.on_event(self.request_id, {
                "type": "status", "status": "finished",
                "exit_code": self.process.returncode,
                "session_id": self.session_id or "",
            })

        except Exception as e:
            log.exception(f"Runner {self.request_id[:8]} error")
            await self.on_event(self.request_id, {
                "type": "error",
                "message": f"Internal error: {type(e).__name__}",
            })
        finally:
            self.process = None

    async def _read_stdout(self):
        """Read and parse stream-json lines from stdout."""
        while not self._stopped:
            try:
                line = await asyncio.wait_for(
                    self.process.stdout.readline(), timeout=300,
                )
            except asyncio.TimeoutError:
                log.warning(f"Runner {self.request_id[:8]}: stdout timeout")
                break
            if not line:
                break

            text = line.decode("utf-8", errors="replace").strip()
            if not text:
                continue

            try:
                obj = json.loads(text)
            except json.JSONDecodeError:
                await self.on_event(self.request_id, {"type": "raw", "text": text})
                continue

            sid = obj.get("session_id")
            if sid:
                self.session_id = sid

            event = self._parse_event(obj)
            if event:
                await self.on_event(self.request_id, event)

    async def _read_stderr(self):
        """Capture any remaining stderr output."""
        if self._stopped or not self.process.stderr:
            return
        try:
            stderr_data = await asyncio.wait_for(self.process.stderr.read(), timeout=5)
            if stderr_data:
                stderr_text = stderr_data.decode("utf-8", errors="replace").strip()
                if stderr_text:
                    await self.on_event(self.request_id, {
                        "type": "stderr", "text": stderr_text[:1000],
                    })
        except asyncio.TimeoutError:
            pass

    # ── Process termination ──────────────────────────────────

    async def stop(self):
        self._stopped = True
        proc = self.process
        if not proc or proc.returncode is not None:
            return

        try:
            if os.name == "nt":
                proc.terminate()
            else:
                pgid = os.getpgid(proc.pid)
                os.killpg(pgid, signal.SIGTERM)
        except (ProcessLookupError, PermissionError, OSError):
            return

        try:
            await asyncio.wait_for(proc.wait(), timeout=5)
        except asyncio.TimeoutError:
            try:
                if os.name == "nt":
                    proc.kill()
                else:
                    os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            except (ProcessLookupError, PermissionError, OSError):
                pass

        await self.on_event(self.request_id, {
            "type": "status", "status": "stopped",
            "session_id": self.session_id or "",
        })

    # ── Stream-JSON event parsing ────────────────────────────

    def _parse_event(self, obj: dict) -> dict | None:
        etype = obj.get("type", "")

        if etype == "system":
            return {
                "type": "system",
                "session_id": obj.get("session_id", ""),
                "model": obj.get("model", ""),
                "tools": obj.get("tools", []),
                "cwd": obj.get("cwd", ""),
                "version": obj.get("claude_code_version", ""),
                "permission_mode": obj.get("permissionMode", ""),
                "fast_mode": obj.get("fast_mode_state", ""),
            }

        if etype == "stream_event":
            return self._parse_stream_event(obj.get("event", {}))

        if etype == "assistant":
            content = obj.get("message", {}).get("content", [])
            blocks = []
            for b in content:
                bt = b.get("type", "")
                if bt == "text":
                    blocks.append({"type": "text", "text": b.get("text", "")})
                elif bt == "thinking":
                    blocks.append({"type": "thinking", "text": b.get("thinking", "")})
            return {
                "type": "assistant",
                "blocks": blocks,
                "session_id": obj.get("session_id", ""),
            }

        if etype == "result":
            mu = obj.get("modelUsage", {})
            fm = next(iter(mu.values()), {}) if mu else {}
            return {
                "type": "result",
                "text": obj.get("result", ""),
                "session_id": obj.get("session_id", ""),
                "cost_usd": obj.get("total_cost_usd", 0),
                "duration_ms": obj.get("duration_ms", 0),
                "duration_api_ms": obj.get("duration_api_ms", 0),
                "num_turns": obj.get("num_turns", 0),
                "stop_reason": obj.get("stop_reason", ""),
                "usage": obj.get("usage", {}),
                "model_usage": {
                    "input_tokens": fm.get("inputTokens", 0),
                    "output_tokens": fm.get("outputTokens", 0),
                    "cache_read": fm.get("cacheReadInputTokens", 0),
                    "cache_create": fm.get("cacheCreationInputTokens", 0),
                    "cost_usd": fm.get("costUSD", 0),
                    "context_window": fm.get("contextWindow", 0),
                    "max_output": fm.get("maxOutputTokens", 0),
                    "web_search": fm.get("webSearchRequests", 0),
                },
                "service_tier": obj.get("usage", {}).get("service_tier", ""),
            }

        if etype == "rate_limit_event":
            info = obj.get("rate_limit_info", {})
            return {
                "type": "rate_limit",
                "status": info.get("status", ""),
                "resets_at": info.get("resetsAt", 0),
                "rate_limit_type": info.get("rateLimitType", ""),
                "overage_status": info.get("overageStatus", ""),
                "is_using_overage": info.get("isUsingOverage", False),
            }

        return {"type": etype, "raw": obj}

    def _parse_stream_event(self, ev: dict) -> dict | None:
        t = ev.get("type", "")

        if t == "content_block_start":
            cb = ev.get("content_block", {})
            return {
                "type": "block_start",
                "block_type": cb.get("type", ""),
                "index": ev.get("index", 0),
            }

        if t == "content_block_delta":
            d = ev.get("delta", {})
            return {
                "type": "delta",
                "delta_type": d.get("type", ""),
                "text": d.get("text", "") or d.get("thinking", ""),
                "index": ev.get("index", 0),
            }

        if t == "content_block_stop":
            return {"type": "block_stop", "index": ev.get("index", 0)}

        if t == "message_start":
            u = ev.get("message", {}).get("usage", {})
            return {
                "type": "usage", "phase": "start",
                "input_tokens": u.get("input_tokens", 0),
                "output_tokens": u.get("output_tokens", 0),
                "cache_read": u.get("cache_read_input_tokens", 0),
                "cache_create": u.get("cache_creation_input_tokens", 0),
            }

        if t == "message_delta":
            u = ev.get("usage", {})
            return {
                "type": "usage", "phase": "end",
                "input_tokens": u.get("input_tokens", 0),
                "output_tokens": u.get("output_tokens", 0),
                "cache_read": u.get("cache_read_input_tokens", 0),
                "cache_create": u.get("cache_creation_input_tokens", 0),
                "stop_reason": ev.get("delta", {}).get("stop_reason", ""),
            }

        if t == "message_stop":
            return {"type": "message_stop"}

        return None
