# -*- coding: utf-8 -*-
"""Timings and Colab DOM scripts of the Colab pycore runner."""

from pycore.pyfoundations.service_contract import value

COLAB_NOTEBOOK_URL = value("notebook_defaults.colab_notebook_url")
COLAB_NOTEBOOK_ID = value("notebook_defaults.colab_notebook_id")
GOOGLE_ACCOUNTS_URL_PART = "accounts.google.com"

POLL_SECONDS = 2.0
NOTEBOOK_READY_TIMEOUT_SECONDS = 90.0
START_TIMEOUT_SECONDS = 240.0
START_SETTLE_SECONDS = 20.0
STOP_TIMEOUT_SECONDS = 90.0
DEFAULT_LOG_TAIL_LINES = 200

STATE_IDLE = "idle"
STATE_RUNNING = "running"
STATE_NOT_READY = "not_ready"

ERROR_NOTEBOOK_NOT_READY = "colab_notebook_not_ready"
ERROR_START_TIMEOUT = "colab_start_timeout"
ERROR_STOP_TIMEOUT = "colab_stop_timeout"
ERROR_RUN_BUTTON_MISSING = "colab_run_button_missing"

# State of the launch cell (the first code cell) and any open Colab dialog.
STATE_SCRIPT = """
const ready = !!(window.colab && window.colab.global && window.colab.global.notebookModel);
const cell = document.querySelector('.cell.code');
const button = cell ? cell.querySelector('colab-run-button') : null;
const running = !!(cell && (cell.classList.contains('running') || cell.classList.contains('pending')
  || (button && (button.hasAttribute('running') || button.hasAttribute('pending')))));
const dialog = document.querySelector('mwc-dialog[open], md-dialog[open], colab-dialog[open]');
const connect = document.querySelector('colab-connect-button');
return JSON.stringify({
  ready,
  hasRunButton: !!button,
  running,
  dialog: dialog ? (dialog.innerText || '').trim().slice(0, 300) : '',
  connection: connect ? (connect.innerText || '').trim().slice(0, 80) : '',
});
"""

# Clicking the run button starts an idle cell and interrupts a running one.
TOGGLE_RUN_SCRIPT = """
const cell = document.querySelector('.cell.code');
const button = cell ? cell.querySelector('colab-run-button') : null;
if (!button) { return JSON.stringify({clicked: false}); }
cell.scrollIntoView({block: 'center'});
const inner = button.shadowRoot && button.shadowRoot.querySelector('#run-button, .cell-execution');
(inner || button).click();
return JSON.stringify({clicked: true});
"""

# Confirms Colab prompts raised by a run: "Run anyway", "Connect to Google Drive".
ACCEPT_DIALOG_SCRIPT = """
const dialog = document.querySelector('mwc-dialog[open], md-dialog[open], colab-dialog[open]');
if (!dialog) { return JSON.stringify({accepted: false}); }
const ok = dialog.querySelector('[dialogaction="ok"], [dialog-action="ok"], [value="ok"]');
if (!ok) { return JSON.stringify({accepted: false, text: (dialog.innerText || '').trim().slice(0, 300)}); }
ok.click();
return JSON.stringify({accepted: true, text: (dialog.innerText || '').trim().slice(0, 300)});
"""

# Google sign-in popup opened by drive.mount: pick the account, tick the
# requested scopes and press the primary (last) button of the step.
OAUTH_STEP_SCRIPT = """
const account = document.querySelector('[data-identifier]');
if (account) { account.click(); return JSON.stringify({step: 'account'}); }
document.querySelectorAll('input[type=checkbox]:not(:checked)').forEach((box) => box.click());
const buttons = [...document.querySelectorAll('button')].filter((item) => item.offsetParent !== null && !item.disabled);
const primary = buttons[buttons.length - 1];
if (!primary) { return JSON.stringify({step: 'none'}); }
primary.click();
return JSON.stringify({step: 'continue', label: (primary.innerText || '').trim().slice(0, 40)});
"""
