# -*- coding: utf-8 -*-
"""Launcher start: offer to open the newest terminal backup as one HTML page in the browser, then to restore each terminal's conversation into the matching terminal (delivered by pycore once its AI agent runs)."""

from datetime import datetime

from pycore.pyctl.terminal.terminal_backup_page import terminal_backup_page
from pycore.pyctl.terminal.terminal_backup_store import kilobytes, terminal_backup_store
from pycore.pyctl.terminal.terminal_restore_request import terminal_restore_requests
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.timed_input import ask_yes_no_timed
from pycore.pyutils.launcher.config_manager import (
    DEFAULT_SERVICES_PROMPT_TIMEOUT_SEC,
    SERVICES_PROMPT_TIMEOUT_KEY,
)
from pycore.pyutils.launcher.launcher_text import launcher_text

DATE_DISPLAY_FORMAT = '%Y-%m-%d %H:%M:%S'


class RestoreI18nKeys:
    FOUND = 'launcher.main.restore_found'
    PROMPT = 'launcher.main.restore_prompt'
    OPENING = 'launcher.main.restore_opening'
    OPEN_FAILED = 'launcher.main.restore_open_failed'
    SKIPPED = 'launcher.main.restore_skipped'
    CONVERSATION_PROMPT = 'launcher.main.restore_conversation_prompt'
    CONVERSATION_QUEUED = 'launcher.main.restore_conversation_queued'
    CONVERSATION_FAILED = 'launcher.main.restore_conversation_failed'


def _display_date(manifest: dict, folder_name: str) -> str:
    try:
        return datetime.fromisoformat(str(manifest.get('created_at'))).strftime(DATE_DISPLAY_FORMAT)
    except ValueError:
        return folder_name


def offer_terminal_backup_restore(config_manager, interactive: bool) -> None:
    """Interactive launcher runs only; headless runs never prompt and never open."""
    if not interactive:
        return
    latest = terminal_backup_store.latest()
    if latest is None or not latest['terminals']:
        return
    manifest = latest['manifest']
    terminals = latest['terminals']
    timeout_sec = config_manager.get_services_config().get(
        SERVICES_PROMPT_TIMEOUT_KEY, DEFAULT_SERVICES_PROMPT_TIMEOUT_SEC)
    ColorPrint.cyan(launcher_text.get(
        RestoreI18nKeys.FOUND,
        date=_display_date(manifest, latest['path'].name),
        count=len(terminals),
        kb=kilobytes(int(manifest.get('total_bytes') or 0)),
        archive_kb=kilobytes(terminal_backup_store.archive_stats()['blob_bytes']),
        path=latest['path']))
    _offer_page(latest, timeout_sec)
    _offer_conversation(latest, timeout_sec)


def _offer_page(latest: dict, timeout_sec: float) -> None:
    prompt = launcher_text.get(RestoreI18nKeys.PROMPT, seconds=timeout_sec)
    if not ask_yes_no_timed(prompt, timeout_sec, default_yes=True, interactive=True):
        ColorPrint.gray(launcher_text.get(RestoreI18nKeys.SKIPPED))
        return
    ColorPrint.plain(launcher_text.get(RestoreI18nKeys.OPENING, count=len(latest['terminals'])))
    opened = terminal_backup_page.open(latest['id'])
    if not opened['success']:
        ColorPrint.yellow(launcher_text.get(RestoreI18nKeys.OPEN_FAILED, path=opened.get('path') or latest['path']))


def _offer_conversation(latest: dict, timeout_sec: float) -> None:
    prompt = launcher_text.get(RestoreI18nKeys.CONVERSATION_PROMPT, seconds=timeout_sec)
    if not ask_yes_no_timed(prompt, timeout_sec, default_yes=False, interactive=True):
        ColorPrint.gray(launcher_text.get(RestoreI18nKeys.SKIPPED))
        return
    numbers = [int(entry['number']) for entry in latest['terminals']]
    if terminal_restore_requests.request(latest['id'], numbers):
        ColorPrint.cyan(launcher_text.get(RestoreI18nKeys.CONVERSATION_QUEUED, count=len(numbers)))
    else:
        ColorPrint.yellow(launcher_text.get(RestoreI18nKeys.CONVERSATION_FAILED))
