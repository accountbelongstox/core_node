# -*- coding: utf-8 -*-
"""Run the pycore Colab notebook through the user's Chrome (mcp-chrome).

Public surface: start(), logs(), restart(). The notebook is the README launch
cell (clone, notebook_boot.py, pyservice.sh colab); Colab prompts raised by the
run (untrusted notebook, Drive connection, Google sign-in popup) are confirmed
automatically.
"""

import asyncio
import json
import time
from typing import Any, Dict, Optional

from pycore.pyctl.colab.colab_constants import (
    ACCEPT_DIALOG_SCRIPT,
    COLAB_NOTEBOOK_ID,
    COLAB_NOTEBOOK_URL,
    DEFAULT_LOG_TAIL_LINES,
    ERROR_NOTEBOOK_NOT_READY,
    ERROR_RUN_BUTTON_MISSING,
    ERROR_START_TIMEOUT,
    ERROR_STOP_TIMEOUT,
    GOOGLE_ACCOUNTS_URL_PART,
    NOTEBOOK_READY_TIMEOUT_SECONDS,
    OAUTH_STEP_SCRIPT,
    POLL_SECONDS,
    PYSERVICE_STAGE_MARKERS,
    START_SETTLE_SECONDS,
    START_TIMEOUT_SECONDS,
    STATE_IDLE,
    STATE_NOT_READY,
    STATE_RUNNING,
    STATE_SCRIPT,
    STOP_TIMEOUT_SECONDS,
    TOGGLE_RUN_SCRIPT,
)
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.chrome_mcp.chrome_mcp_bridge import chrome_bridge
from pycore.pyutils.chrome_mcp.colab_reader import colab_reader


def _as_dict(result: Any) -> Dict[str, Any]:
    return result if isinstance(result, dict) else json.loads(str(result))


class ColabPycoreRunner:
    def start(self) -> Dict[str, Any]:
        """Open the notebook and run the launch cell; no-op while it already runs."""
        return asyncio.run(self._start())

    def logs(self, tail: int = DEFAULT_LOG_TAIL_LINES, grep: Optional[str] = None) -> Dict[str, Any]:
        """Launch cell output (pyservice log) plus the cell state."""
        return asyncio.run(self._logs(tail, grep))

    def restart(self) -> Dict[str, Any]:
        """Interrupt the running launch cell (SIGINT to pyservice), then start it again."""
        return asyncio.run(self._restart())

    async def _notebook_tab(self) -> int:
        for tab in await chrome_bridge.tabs():
            if COLAB_NOTEBOOK_ID in str(tab.get("url") or ""):
                return int(tab["tabId"])
        ColorPrint.cyan(f"[Colab] Opening {COLAB_NOTEBOOK_URL}")
        return await chrome_bridge.open_tab(COLAB_NOTEBOOK_URL)

    async def _state(self, tab_id: int) -> Dict[str, Any]:
        state = _as_dict(await chrome_bridge.evaluate(tab_id, STATE_SCRIPT))
        if not state.get("ready"):
            state["state"] = STATE_NOT_READY
        else:
            state["state"] = STATE_RUNNING if state.get("running") else STATE_IDLE
        return state

    async def _ready_state(self, tab_id: int) -> Dict[str, Any]:
        deadline = time.monotonic() + NOTEBOOK_READY_TIMEOUT_SECONDS
        state = await self._state(tab_id)
        while (state["state"] == STATE_NOT_READY or not state.get("hasRunButton")) and time.monotonic() < deadline:
            await asyncio.sleep(POLL_SECONDS)
            state = await self._state(tab_id)
        if state["state"] == STATE_NOT_READY:
            raise RuntimeError(ERROR_NOTEBOOK_NOT_READY)
        if not state.get("hasRunButton"):
            raise RuntimeError(ERROR_RUN_BUTTON_MISSING)
        return state

    async def _confirm_prompts(self, tab_id: int) -> None:
        accepted = _as_dict(await chrome_bridge.evaluate(tab_id, ACCEPT_DIALOG_SCRIPT))
        if accepted.get("accepted"):
            ColorPrint.cyan(f"[Colab] Confirmed dialog: {accepted.get('text')}")
        for tab in await chrome_bridge.tabs():
            if GOOGLE_ACCOUNTS_URL_PART in str(tab.get("url") or ""):
                step = _as_dict(await chrome_bridge.evaluate(int(tab["tabId"]), OAUTH_STEP_SCRIPT))
                ColorPrint.cyan(f"[Colab] Google sign-in step: {step}")

    async def _start(self) -> Dict[str, Any]:
        tab_id = await self._notebook_tab()
        state = await self._ready_state(tab_id)
        started = state["state"] != STATE_RUNNING
        if started:
            await chrome_bridge.evaluate(tab_id, TOGGLE_RUN_SCRIPT)
            ColorPrint.cyan("[Colab] Launch cell started")
        else:
            ColorPrint.cyan("[Colab] Launch cell already running; finishing its setup prompts")
        deadline = time.monotonic() + START_TIMEOUT_SECONDS
        settled_since: Optional[float] = None
        booted = False
        while time.monotonic() < deadline:
            await self._confirm_prompts(tab_id)
            state = await self._state(tab_id)
            if state["state"] == STATE_RUNNING and not state.get("dialog") and not booted:
                output = await colab_reader.live_text(tab_id)
                booted = any(marker in output for marker in PYSERVICE_STAGE_MARKERS)
            state["booted"] = booted
            if state["state"] != STATE_RUNNING or state.get("dialog") or not booted:
                settled_since = None
            else:
                settled_since = settled_since or time.monotonic()
                if time.monotonic() - settled_since >= START_SETTLE_SECONDS:
                    ColorPrint.green("[Colab] pycore is running on Colab")
                    return {"tab_id": tab_id, "started": started, **state}
            await asyncio.sleep(POLL_SECONDS)
        raise RuntimeError(f"{ERROR_START_TIMEOUT}: {state}")

    async def _logs(self, tail: int, grep: Optional[str]) -> Dict[str, Any]:
        tab_id = await self._notebook_tab()
        state = await self._state(tab_id)
        output = await colab_reader.read(COLAB_NOTEBOOK_ID, "", grep, tail)
        return {**output, "state": state["state"], "connection": state.get("connection")}

    async def _restart(self) -> Dict[str, Any]:
        tab_id = await self._notebook_tab()
        state = await self._ready_state(tab_id)
        if state["state"] == STATE_RUNNING:
            await chrome_bridge.evaluate(tab_id, TOGGLE_RUN_SCRIPT)
            ColorPrint.cyan("[Colab] Interrupt sent to the launch cell")
            deadline = time.monotonic() + STOP_TIMEOUT_SECONDS
            while state["state"] == STATE_RUNNING and time.monotonic() < deadline:
                await asyncio.sleep(POLL_SECONDS)
                state = await self._state(tab_id)
            if state["state"] == STATE_RUNNING:
                raise RuntimeError(ERROR_STOP_TIMEOUT)
        return await self._start()


colab_pycore_runner = ColabPycoreRunner()

__all__ = ["ColabPycoreRunner", "colab_pycore_runner"]
