# -*- coding: utf-8 -*-
"""Run the pycore Colab notebook through the user's Chrome (mcp-chrome).

Public surface: start(), logs(), restart(), regpu(). The notebook is the README launch
cell (clone, notebook_boot.py, pyservice.sh colab); Colab prompts raised by the
run (untrusted notebook, Drive connection, Google sign-in popup) are confirmed
automatically.
"""

import asyncio
import json
import re
import time
from typing import Any, Dict, Optional, Set

from pycore.pyctl.colab.colab_constants import (
    ACCELERATOR_KINDS,
    ACCELERATOR_LINE_PATTERN,
    ACCELERATOR_UNKNOWN,
    ACCEPT_DIALOG_SCRIPT,
    COLAB_NOTEBOOK_ID,
    COLAB_NOTEBOOK_URL,
    DEFAULT_LOG_TAIL_LINES,
    DELETE_RUNTIME_SCRIPT,
    ERROR_DELETE_RUNTIME_MISSING,
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
    STATE_UNRESPONSIVE,
    STATE_SCRIPT,
    STOP_TIMEOUT_SECONDS,
    TAB_PROBE_SCRIPT,
    TOGGLE_RUN_SCRIPT,
)
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.chrome_mcp.chrome_mcp_bridge import chrome_bridge
from pycore.pyutils.chrome_mcp.colab_reader import colab_reader


def _as_dict(result: Any) -> Dict[str, Any]:
    return result if isinstance(result, dict) else json.loads(str(result))


def _accelerator(output: str) -> str:
    """gpu | tpu | cpu from the kernel-setup Accelerator line of the run, else unknown."""
    found = re.findall(ACCELERATOR_LINE_PATTERN, output)
    detail = found[-1].upper() if found else ""
    return next((kind for marker, kind in ACCELERATOR_KINDS if detail.startswith(marker)), ACCELERATOR_UNKNOWN)


def _fresh_output(output: str, baseline: str) -> str:
    """The part of the cell output written after ``baseline`` (the previous run's
    output, still shown until the new run replaces or extends it)."""
    if not baseline:
        return output
    return output[len(baseline):] if output.startswith(baseline) else output


class ColabPycoreRunner:
    def __init__(self) -> None:
        self._hung_tabs: Set[int] = set()

    def start(self) -> Dict[str, Any]:
        """Open the notebook and run the launch cell; no-op while it already runs."""
        return asyncio.run(self._start())

    def logs(self, tail: int = DEFAULT_LOG_TAIL_LINES, grep: Optional[str] = None) -> Dict[str, Any]:
        """Launch cell output (pyservice log) plus the cell state."""
        return asyncio.run(self._logs(tail, grep))

    def restart(self) -> Dict[str, Any]:
        """Interrupt the running launch cell (SIGINT to pyservice), then start it again."""
        return asyncio.run(self._restart())

    def regpu(self) -> Dict[str, Any]:
        """Disconnect and delete the runtime, then start the launch cell: the notebook
        asks Colab for a GPU runtime again and falls back to CPU when none is granted."""
        return asyncio.run(self._regpu())

    async def _notebook_tab(self) -> int:
        """The notebook tab whose page still answers; a hung tab (a flooded output pane
        freezes the page script) is skipped when another tab on the notebook is usable."""
        candidates = [
            int(tab["tabId"]) for tab in await chrome_bridge.tabs()
            if COLAB_NOTEBOOK_ID in str(tab.get("url") or "")
        ]
        candidates.sort(key=lambda tab_id: tab_id in self._hung_tabs)
        for tab_id in candidates:
            try:
                await chrome_bridge.evaluate(tab_id, TAB_PROBE_SCRIPT)
                self._hung_tabs.discard(tab_id)
                return tab_id
            except RuntimeError as error:
                self._hung_tabs.add(tab_id)
                ColorPrint.yellow(f"[Colab] tab {tab_id} does not answer ({error})")
        if candidates:
            return candidates[0]
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
        baseline = await colab_reader.live_text(tab_id) if started else ""
        if started:
            await chrome_bridge.evaluate(tab_id, TOGGLE_RUN_SCRIPT)
            ColorPrint.cyan("[Colab] Launch cell started")
        else:
            ColorPrint.cyan("[Colab] Launch cell already running; finishing its setup prompts")
        deadline = time.monotonic() + START_TIMEOUT_SECONDS
        settled_since: Optional[float] = None
        booted = False
        accelerator = ACCELERATOR_UNKNOWN
        while time.monotonic() < deadline:
            await self._confirm_prompts(tab_id)
            state = await self._state(tab_id)
            if state["state"] == STATE_RUNNING and not state.get("dialog") and not booted:
                output = _fresh_output(await colab_reader.live_text(tab_id), baseline)
                booted = any(marker in output for marker in PYSERVICE_STAGE_MARKERS)
                accelerator = _accelerator(output)
            state["booted"] = booted
            state["accelerator"] = accelerator
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
        try:
            state = await self._state(tab_id)
        except RuntimeError as error:
            ColorPrint.yellow(f"[Colab] notebook page unresponsive ({error}); reading the output frames only")
            state = {"state": STATE_UNRESPONSIVE}
        output = await colab_reader.read(COLAB_NOTEBOOK_ID, "", grep, tail)
        return {
            **output,
            "state": state["state"],
            "connection": state.get("connection"),
            "requestedAccelerator": state.get("requestedAccelerator"),
        }

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

    async def _regpu(self) -> Dict[str, Any]:
        tab_id = await self._notebook_tab()
        await self._ready_state(tab_id)
        clicked = _as_dict(await chrome_bridge.evaluate(tab_id, DELETE_RUNTIME_SCRIPT))
        if not clicked.get("clicked"):
            raise RuntimeError(ERROR_DELETE_RUNTIME_MISSING)
        ColorPrint.cyan("[Colab] Disconnect and delete runtime requested")
        deadline = time.monotonic() + STOP_TIMEOUT_SECONDS
        state = await self._state(tab_id)
        while state["state"] == STATE_RUNNING and time.monotonic() < deadline:
            await self._confirm_prompts(tab_id)
            await asyncio.sleep(POLL_SECONDS)
            state = await self._state(tab_id)
        if state["state"] == STATE_RUNNING:
            raise RuntimeError(ERROR_STOP_TIMEOUT)
        return await self._start()


colab_pycore_runner = ColabPycoreRunner()

__all__ = ["ColabPycoreRunner", "colab_pycore_runner"]
