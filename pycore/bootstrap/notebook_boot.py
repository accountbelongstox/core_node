# -*- coding: utf-8 -*-
"""
Notebook launcher for pyservice on hosted notebook platforms (Colab, Kaggle).

Run AS A FILE from a notebook cell (stdlib only, never imports pycore):

    %run <repo>/pycore/bootstrap/notebook_boot.py [colab|kaggle] [pyservice.sh args...]

A notebook shell cell has no terminal, so the secret password cannot be
prompted by pyservice.sh itself. This launcher resolves it in the kernel
(env var -> Colab/Kaggle Secrets -> getpass), mounts Google Drive on Colab (the
persist root of notebook_runtime.sh), and runs `pyservice.sh <platform>` with
the password in the child environment only, streaming its output to the cell.
Interrupting the cell stops the service gracefully.
"""

import getpass
import glob
import os
import platform as platform_info
import shutil
import signal
import subprocess
import sys
import urllib.request

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(os.path.dirname(_HERE))
_PYSERVICE_SH = os.path.join(_REPO_ROOT, "pyservice.sh")
_PLATFORMS = ("colab", "kaggle")
_PASSWORD_ENV = "CORE_NODE_SECRET_PASSWORD"
_COLAB_DRIVE_MOUNT = "/content/drive"
_NO_DRIVE_FLAG = "--no-drive"
_STOP_TIMEOUT_SECONDS = 60
_PROBE_URL = "https://pypi.org/simple/"
_PROBE_TIMEOUT_SECONDS = 10
_COMMAND_TIMEOUT_SECONDS = 15
_SETUP_STEPS = 7
_TAG = "[NOTEBOOK]"
# Handed to pyservice.sh: the kernel-side detection result and accelerator.
_DETECTED_ENV = "NOTEBOOK_PLATFORM_DETECTED"
_ACCELERATOR_ENV = "NOTEBOOK_ACCELERATOR"
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
        return f"FAILED ({error}); caches and the Relay identity will not persist"


def _drive_state(platform, mount_drive):
    if platform != "colab":
        return "not used on this platform"
    if not mount_drive:
        return f"skipped ({_NO_DRIVE_FLAG})"
    return _mount_colab_drive()


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


def _resolve_password(platform):
    """Return (password, source description); the password is never printed."""
    password = os.environ.get(_PASSWORD_ENV, "")
    if password:
        return password, f"environment variable {_PASSWORD_ENV}"
    password = _platform_secret(platform)
    if password:
        return password, f"{platform} notebook secret {_PASSWORD_ENV}"
    try:
        password = getpass.getpass(f"{_TAG} Secret password for .secret_keys (empty skips): ")
    except Exception:
        # Headless runs (Kaggle "Save & Run All") have no input frontend.
        return "", f"none (no input frontend; add the {_PASSWORD_ENV} notebook secret)"
    if password:
        return password, "typed"
    return "", f"none (skipped; add the {_PASSWORD_ENV} notebook secret to decrypt keys)"


def _stop(process):
    if process.poll() is not None:
        return
    process.send_signal(signal.SIGINT)
    try:
        process.wait(timeout=_STOP_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        process.terminate()
        process.wait()


def main(argv):
    args = list(argv)
    detected = _detect_platform()
    platform = args.pop(0) if args and args[0] in _PLATFORMS else detected
    if not platform:
        print(f"{_TAG} Unknown notebook platform; pass one of: {', '.join(_PLATFORMS)}", flush=True)
        return 2
    mount_drive = _NO_DRIVE_FLAG not in args
    args = [arg for arg in args if arg != _NO_DRIVE_FLAG]

    print(f"{_TAG} ===== Setup flow =====", flush=True)
    detection = "detected" if detected == platform else f"requested; detected: {detected or 'none'}"
    _step(1, "Platform", f"{platform} ({detection}; run type: {os.environ.get('KAGGLE_KERNEL_RUN_TYPE') or 'interactive'})")
    _step(2, "Repository", f"{_REPO_ROOT} @ {_repository_revision()}")
    _step(3, "Python", f"{platform_info.python_version()} ({sys.executable})")
    _step(4, "Internet", _internet_state(platform))
    accelerator, accelerator_detail = _accelerator_state()
    _step(5, "Accelerator", accelerator_detail)
    _step(6, "Google Drive", _drive_state(platform, mount_drive))

    env = dict(os.environ)
    if detected == platform:
        env[_DETECTED_ENV] = platform
    env[_ACCELERATOR_ENV] = accelerator
    password, password_source = _resolve_password(platform)
    if password:
        env[_PASSWORD_ENV] = password
    password = ""
    _step(7, "Secret password", password_source)

    command = ["bash", _PYSERVICE_SH, platform, *args]
    print(f"{_TAG} ===== Launch: {' '.join(command)} =====", flush=True)
    process = subprocess.Popen(
        command,
        cwd=_REPO_ROOT,
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        errors="replace",
        bufsize=1,
    )
    env.pop(_PASSWORD_ENV, None)
    try:
        for line in process.stdout:
            print(line, end="", flush=True)
        return process.wait()
    except KeyboardInterrupt:
        print(f"\n{_TAG} Stopping pyservice...", flush=True)
        _stop(process)
        return process.returncode


if __name__ == "__main__":
    _exit_code = main(sys.argv[1:])
    if _exit_code:
        print(f"{_TAG} pyservice exited with code {_exit_code}", flush=True)
