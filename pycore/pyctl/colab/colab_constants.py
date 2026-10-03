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
ERROR_DELETE_RUNTIME_MISSING = "colab_delete_runtime_command_missing"

ACCELERATOR_UNKNOWN = "unknown"
# "[NOTEBOOK] [5/8] Accelerator: <GPU (CUDA)|TPU|none ... CPU only>" printed by notebook_boot.py.
ACCELERATOR_LINE_PATTERN = r"\[NOTEBOOK\] \[5/8\] Accelerator: (.*)"
ACCELERATOR_KINDS = (("GPU", "gpu"), ("TPU", "tpu"), ("CPU", "cpu"))

# Output lines that show pyservice took over from the kernel setup. Colab keeps
# only the newest output lines, so the early markers scroll out on long runs and
# the recurring prerequisite / runtime lines stand in for them.
PYSERVICE_STAGE_MARKERS = (
    "[NOTEBOOK] [8/8]",
    "Pycore Service - entry point",
    "[..] Prerequisite: ",
    "HTTP Request: ",
)

# Colab dialogs (md-dialog) keep their buttons in the light DOM: a visible
# [dialogaction="ok"] button marks an open prompt.
_OPEN_DIALOG_JS = """
const okButton = [...document.querySelectorAll('[dialogaction="ok"]')].find((item) => item.getClientRects().length > 0);
const dialog = okButton ? (okButton.closest('md-dialog, mwc-dialog, colab-dialog, [role=dialog]') || okButton.parentElement) : null;
const dialogText = dialog ? (dialog.innerText || dialog.textContent || '').trim().slice(0, 300) : '';
"""

# State of the launch cell (the first code cell) and any open Colab dialog.
STATE_SCRIPT = _OPEN_DIALOG_JS + """
const ready = !!(window.colab && window.colab.global && window.colab.global.notebookModel);
const cell = document.querySelector('.cell.code');
const button = cell ? cell.querySelector('colab-run-button') : null;
const running = !!(cell && (cell.classList.contains('running') || cell.classList.contains('pending')));
const connect = document.querySelector('colab-connect-button');
const notebookMetadata = ready ? (window.colab.global.notebookModel.metadata || {}) : {};
return JSON.stringify({
  ready,
  hasRunButton: !!button,
  running,
  requestedAccelerator: String(notebookMetadata.accelerator || ''),
  dialog: dialogText,
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

# Runtime menu command "Disconnect and delete runtime"; its confirmation is a dialog.
DELETE_RUNTIME_SCRIPT = """
const item = document.querySelector('[command="powerwash-current-vm"]');
if (!item) { return JSON.stringify({clicked: false}); }
item.click();
return JSON.stringify({clicked: true});
"""

# Confirms Colab prompts raised by a run: "Run anyway", "Connect without GPU",
# "Connect to Google Drive".
ACCEPT_DIALOG_SCRIPT = _OPEN_DIALOG_JS + """
if (!okButton) { return JSON.stringify({accepted: false}); }
okButton.click();
return JSON.stringify({accepted: true, text: dialogText});
"""

# Google sign-in popup opened by drive.mount: pick the account, tick the
# requested scopes and press the Continue/Allow button of the step.
OAUTH_STEP_SCRIPT = """
const account = document.querySelector('[data-identifier]');
if (account) { account.click(); return JSON.stringify({step: 'account'}); }
document.querySelectorAll('input[type=checkbox]:not(:checked)').forEach((box) => box.click());
const buttons = [...document.querySelectorAll('button, [role=button]')].filter((item) => item.offsetParent !== null && !item.disabled && (item.innerText || '').trim());
const primary = buttons.find((item) => /^(continue|allow)/i.test((item.innerText || '').trim())) || buttons[buttons.length - 1];
if (!primary) { return JSON.stringify({step: 'none'}); }
primary.click();
return JSON.stringify({step: 'continue', label: (primary.innerText || '').trim().slice(0, 40)});
"""
