# -*- coding: utf-8 -*-
"""
Kernel-side setup of pyservice on hosted notebook platforms (Colab, Kaggle).

pyservice.sh is the entry; this script prepares what only the notebook kernel can
do, in the same cell right before it (stdlib only, never imports pycore):

    %run <repo>/pycore/bootstrap/notebook_boot.py [colab|kaggle] [--no-drive]
    !bash <repo>/pyservice.sh colab|kaggle [pyservice.sh args...]

A notebook shell command has no terminal and cannot mount Google Drive or read
notebook secrets. This script mounts Drive on Colab (the persist root of
notebook_runtime.sh), checks the decrypted-secret backup on Drive (offering a
re-decrypt for a few seconds when it is complete), resolves the secret password
(env var -> Colab/Kaggle Secrets -> getpass, only when a decrypt is needed) and
hands its results to pyservice.sh through the kernel environment; the password
goes through a one-shot 0600 file that pyservice.sh reads and removes.
"""

import getpass
import glob
import json
import os
import platform as platform_info
import shutil
import subprocess
import sys
import tempfile
import urllib.request

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(os.path.dirname(_HERE))
_PYSERVICE_SH = os.path.join(_REPO_ROOT, "pyservice.sh")
_PLATFORMS = ("colab", "kaggle")
_PASSWORD_ENV = "CORE_NODE_SECRET_PASSWORD"
_COLAB_DRIVE_MOUNT = "/content/drive"
_NO_DRIVE_FLAG = "--no-drive"
_PROBE_URL = "https://pypi.org/simple/"
_PROBE_TIMEOUT_SECONDS = 10
_COMMAND_TIMEOUT_SECONDS = 15
_SETUP_STEPS = 8
_TAG = "[NOTEBOOK]"
# Handed to pyservice.sh (read by scripts/shells/linux/common/notebook_runtime.sh).
_DETECTED_ENV = "NOTEBOOK_PLATFORM_DETECTED"
_ACCELERATOR_ENV = "NOTEBOOK_ACCELERATOR"
_PREPARED_ENV = "NOTEBOOK_KERNEL_PREPARED"
_REDECRYPT_ENV = "NOTEBOOK_SECRET_REDECRYPT"
_HANDOFF_ENV = "NOTEBOOK_SECRET_HANDOFF_FILE"
_HANDOFF_DIR = "/dev/shm"
_HANDOFF_PREFIX = "core_node_secret_"
# Mirror the persist root and secret layout of notebook_runtime.sh.
_PERSIST_ENV = "NOTEBOOK_PERSIST_DIR"
_COLAB_DRIVE_DIR = "/content/drive/MyDrive"
_PERSIST_NAME = "core_node_notebook"
_SECRET_BACKUP_NAME = "secrets"
_SECRET_DIR = os.path.join(_REPO_ROOT, ".secret_keys")
_ENCRYPTED_DIR = os.path.join(_SECRET_DIR, "already_encrypted")
_RAW_DIR = os.path.join(_SECRET_DIR, ".secret_ignore")
_MISMATCH_LIST = os.path.join(_SECRET_DIR, "password_mismatch.list")
_ENCRYPTED_SUFFIX = ".js"
_REDECRYPT_PROMPT_SECONDS = 5
_REDECRYPT_BUTTON = "Re-decrypt all secrets"
_REDECRYPT_COUNTDOWN = "skipped in {seconds}s: the decrypted copies are used"
_REDECRYPT_JS = """
new Promise((resolve) => {
  const box = document.createElement('div');
  const button = document.createElement('button');
  const label = document.createElement('span');
  let left = __SECONDS__;
  const render = () => { label.textContent = ' ' + __COUNTDOWN__.replace('{seconds}', left); };
  const finish = (value) => { clearInterval(timer); box.remove(); resolve(value); };
  const timer = setInterval(() => { left -= 1; if (left <= 0) { finish(false); } else { render(); } }, 1000);
  button.textContent = __BUTTON__;
  button.onclick = () => finish(true);
  render();
  box.append(button, label);
  document.body.appendChild(box);
})
"""
# TPU VM signals (Cloud TPU runtime env vars; accel/vfio device nodes).
_TPU_ENV_VARS = ("TPU_ACCELERATOR_TYPE", "TPU_NAME", "COLAB_TPU_ADDR", "TPU_WORKER_ID")
_TPU_DEVICE_GLOBS = ("/dev/accel[0-9]*", "/dev/vfio/[0-9]*")
_INTERNET_HINTS = {
    "kaggle": "turn on notebook Settings > Internet (phone-verified account); the session restarts",
    "colab": "Runtime > Disconnect and delete runtime, then run again",
}


def _detect_platform():
    # Kaggle images are built on the Colab runtime image: check Kaggle first, by
    # its kernel env var only (Colab also creates /kaggle/input for datasets).
    if os.environ.get("KAGGLE_KERNEL_RUN_TYPE"):
        return "kaggle"
    # Colab runtimes do not always export COLAB_* variables; the kernel-side
    # google.colab package is the definitive signal.
    try:
        import google.colab  # noqa: F401
        return "colab"
    except ImportError:
        pass
    if os.environ.get("COLAB_RELEASE_TAG") or os.environ.get("COLAB_BACKEND_VERSION"):
        return "colab"
    return ""


def _step(index, title, detail):
    print(f"{_TAG} [{index}/{_SETUP_STEPS}] {title}: {detail}", flush=True)


def _command_output(command):
    try:
        result = subprocess.run(
            command, capture_output=True, text=True, timeout=_COMMAND_TIMEOUT_SECONDS
        )
    except (OSError, subprocess.TimeoutExpired):
        return ""
    return result.stdout.strip() if result.returncode == 0 else ""


def _repository_revision():
    return _command_output(["git", "-C", _REPO_ROOT, "log", "-1", "--format=%h %cd", "--date=short"]) or "unknown"


def _internet_state(platform):
    try:
        request = urllib.request.Request(_PROBE_URL, method="HEAD")
        urllib.request.urlopen(request, timeout=_PROBE_TIMEOUT_SECONDS).close()
        return "ok"
    except Exception as error:
        return f"FAILED ({error}); {_INTERNET_HINTS.get(platform, '')}"


def _tpu_type():
    for name in _TPU_ENV_VARS:
        value = os.environ.get(name, "").strip()
        if value:
            return value
    if any(glob.glob(pattern) for pattern in _TPU_DEVICE_GLOBS):
        return "TPU"
    return ""


def _accelerator_state():
    """Return (kind, description); kind is gpu, tpu or cpu."""
    gpus = _command_output(["nvidia-smi", "-L"]) if shutil.which("nvidia-smi") else ""
    if gpus:
        return "gpu", f"GPU (CUDA): {gpus.replace(chr(10), '; ')}"
    tpu = _tpu_type()
    if tpu:
        return "tpu", (
            f"TPU ({tpu}) detected; pycore has no TPU/XLA backend, so inference runs on the "
            "host CPU. Select a GPU runtime for accelerated inference"
        )
    return "cpu", "none (CPU only; select a GPU runtime for accelerated inference)"


def _mount_colab_drive():
    if os.path.ismount(_COLAB_DRIVE_MOUNT):
        return "already mounted"
    try:
        from google.colab import drive
        drive.mount(_COLAB_DRIVE_MOUNT)
        return "mounted"
    except Exception as error:
        return f"FAILED ({error}); caches, secrets and the Relay identity will not persist"


def _drive_state(platform, mount_drive):
    if platform != "colab":
        return "not used on this platform"
    if not mount_drive:
        return f"skipped ({_NO_DRIVE_FLAG})"
    return _mount_colab_drive()


def _secret_backup_dir(platform):
    """Drive backup of the decrypted secrets (notebook_secret_backup_dir), else ''."""
    persist = os.environ.get(_PERSIST_ENV, "")
    if not persist and platform == "colab" and os.path.isdir(_COLAB_DRIVE_DIR):
        persist = os.path.join(_COLAB_DRIVE_DIR, _PERSIST_NAME)
    if not persist.startswith(_COLAB_DRIVE_DIR + "/"):
        return ""
    return os.path.join(persist, _SECRET_BACKUP_NAME)


def _mismatched_names():
    try:
        with open(_MISMATCH_LIST, encoding="utf-8") as handle:
            lines = [line.strip() for line in handle]
    except OSError:
        return set()
    return {line for line in lines if line and not line.startswith("#")}


def _encrypted_names():
    """Secrets the main password opens (notebook_encrypted_secrets)."""
    try:
        files = os.listdir(_ENCRYPTED_DIR)
    except OSError:
        return []
    mismatched = _mismatched_names()
    names = (name[: -len(_ENCRYPTED_SUFFIX)] for name in files if name.endswith(_ENCRYPTED_SUFFIX))
    return sorted(name for name in names if name not in mismatched)


def _non_empty(path):
    return os.path.isfile(path) and os.path.getsize(path) > 0


def _ask_redecrypt(platform):
    """True when the user clicks within the countdown; Colab only, else the default (no)."""
    if platform != "colab":
        return False
    try:
        from google.colab import output
        script = (
            _REDECRYPT_JS.replace("__SECONDS__", str(_REDECRYPT_PROMPT_SECONDS))
            .replace("__COUNTDOWN__", json.dumps(_REDECRYPT_COUNTDOWN))
            .replace("__BUTTON__", json.dumps(_REDECRYPT_BUTTON))
        )
        return bool(output.eval_js(script, timeout_sec=_REDECRYPT_PROMPT_SECONDS * 6))
    except Exception:
        return False


def _secret_plan(platform):
    """Return (redecrypt, password needed, description)."""
    names = _encrypted_names()
    if not names:
        return False, False, "no encrypted secrets in the repository"
    backup = _secret_backup_dir(platform)
    in_backup = [name for name in names if backup and _non_empty(os.path.join(backup, name))]
    available = [
        name for name in names
        if name in in_backup or _non_empty(os.path.join(_RAW_DIR, name))
    ]
    source = f"Drive backup {backup} ({len(in_backup)}/{len(names)})" if backup else "no Drive backup"
    missing = len(names) - len(available)
    if missing:
        return False, True, f"{len(available)}/{len(names)} decrypted copies ({source}); {missing} missing, pyservice.sh decrypts them"
    print(
        f"{_TAG} All {len(names)} secrets have decrypted copies ({source}). "
        f"Re-decrypt them? Default no in {_REDECRYPT_PROMPT_SECONDS}s",
        flush=True,
    )
    if _ask_redecrypt(platform):
        return True, True, f"re-decrypt all {len(names)} secrets (requested)"
    return False, False, f"all {len(names)} decrypted copies used ({source}); no re-decrypt"


def _platform_secret(platform):
    try:
        if platform == "colab":
            from google.colab import userdata
            return userdata.get(_PASSWORD_ENV) or ""
        if platform == "kaggle":
            from kaggle_secrets import UserSecretsClient
            return UserSecretsClient().get_secret(_PASSWORD_ENV) or ""
    except Exception:
        return ""
    return ""


def _resolve_password(platform, needed):
    """Return (password, source description); the password is never printed."""
    password = os.environ.get(_PASSWORD_ENV, "")
    if password:
        return password, f"environment variable {_PASSWORD_ENV}"
    password = _platform_secret(platform)
    if password:
        return password, f"{platform} notebook secret {_PASSWORD_ENV}"
    if not needed:
        return "", "not needed (every secret has a decrypted copy)"
    try:
        password = getpass.getpass(f"{_TAG} Secret password for .secret_keys (empty skips): ")
    except Exception:
        # Headless runs (Kaggle "Save & Run All") have no input frontend.
        return "", f"none (no input frontend; add the {_PASSWORD_ENV} notebook secret)"
    if password:
        return password, "typed"
    return "", f"none (skipped; add the {_PASSWORD_ENV} notebook secret to decrypt keys)"


def _hand_off_password(password):
    """Write the password to a one-shot 0600 file for pyservice.sh; export its path."""
    previous = os.environ.pop(_HANDOFF_ENV, "")
    if previous and os.path.isfile(previous):
        os.remove(previous)
    if not password:
        return
    handoff_dir = _HANDOFF_DIR if os.path.isdir(_HANDOFF_DIR) else None
    descriptor, path = tempfile.mkstemp(prefix=_HANDOFF_PREFIX, dir=handoff_dir)
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        handle.write(password)
    os.environ[_HANDOFF_ENV] = path


def main(argv):
    args = list(argv)
    detected = _detect_platform()
    platform = args.pop(0) if args and args[0] in _PLATFORMS else detected
    if not platform:
        print(f"{_TAG} Unknown notebook platform; pass one of: {', '.join(_PLATFORMS)}", flush=True)
        return 2
    mount_drive = _NO_DRIVE_FLAG not in args
    args = [arg for arg in args if arg != _NO_DRIVE_FLAG]
    if args:
        print(f"{_TAG} Ignored {' '.join(args)}: pass pyservice options to bash {_PYSERVICE_SH} {platform}", flush=True)

    print(f"{_TAG} ===== Kernel setup =====", flush=True)
    detection = "detected" if detected == platform else f"requested; detected: {detected or 'none'}"
    _step(1, "Platform", f"{platform} ({detection}; run type: {os.environ.get('KAGGLE_KERNEL_RUN_TYPE') or 'interactive'})")
    _step(2, "Repository", f"{_REPO_ROOT} @ {_repository_revision()}")
    _step(3, "Python", f"{platform_info.python_version()} ({sys.executable})")
    _step(4, "Internet", _internet_state(platform))
    accelerator, accelerator_detail = _accelerator_state()
    _step(5, "Accelerator", accelerator_detail)
    _step(6, "Google Drive", _drive_state(platform, mount_drive))
    redecrypt, password_needed, secret_detail = _secret_plan(platform)
    _step(7, "Secrets", secret_detail)
    password, password_source = _resolve_password(platform, password_needed)
    _hand_off_password(password)
    password = ""
    _step(8, "Secret password", password_source)

    if detected == platform:
        os.environ[_DETECTED_ENV] = platform
    else:
        os.environ.pop(_DETECTED_ENV, None)
    os.environ[_ACCELERATOR_ENV] = accelerator
    os.environ[_REDECRYPT_ENV] = "1" if redecrypt else "0"
    os.environ[_PREPARED_ENV] = "1"
    print(f"{_TAG} ===== Ready: bash {_PYSERVICE_SH} {platform} =====", flush=True)
    return 0


if __name__ == "__main__":
    _exit_code = main(sys.argv[1:])
    if _exit_code:
        print(f"{_TAG} Kernel setup exited with code {_exit_code}", flush=True)
