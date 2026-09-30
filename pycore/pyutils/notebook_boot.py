# -*- coding: utf-8 -*-
"""
Notebook launcher for pyservice on hosted notebook platforms (Colab, Kaggle).

Run AS A FILE from a notebook cell (stdlib only, never imports pycore):

    %run <repo>/pycore/pyutils/notebook_boot.py [colab|kaggle] [pyservice.sh args...]

A notebook shell cell has no terminal, so the secret password cannot be
prompted by pyservice.sh itself. This launcher resolves it in the kernel
(env var -> Colab/Kaggle Secrets -> getpass), mounts Google Drive on Colab (the
persist root of notebook_runtime.sh), and runs `pyservice.sh <platform>` with
the password in the child environment only, streaming its output to the cell.
Interrupting the cell stops the service gracefully.
"""

import getpass
import os
import signal
import subprocess
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(os.path.dirname(_HERE))
_PYSERVICE_SH = os.path.join(_REPO_ROOT, "pyservice.sh")
_PLATFORMS = ("colab", "kaggle")
_PASSWORD_ENV = "CORE_NODE_SECRET_PASSWORD"
_COLAB_DRIVE_MOUNT = "/content/drive"
_NO_DRIVE_FLAG = "--no-drive"
_STOP_TIMEOUT_SECONDS = 60
_TAG = "[NOTEBOOK]"


def _detect_platform():
    # Kaggle images are built on the Colab runtime image: check Kaggle first.
    if os.environ.get("KAGGLE_KERNEL_RUN_TYPE") or os.path.isdir("/kaggle/input"):
        return "kaggle"
    if os.environ.get("COLAB_RELEASE_TAG") or os.environ.get("COLAB_BACKEND_VERSION"):
        return "colab"
    return ""


def _mount_colab_drive():
    if os.path.ismount(_COLAB_DRIVE_MOUNT):
        return
    try:
        from google.colab import drive
        drive.mount(_COLAB_DRIVE_MOUNT)
    except Exception as error:
        print(f"{_TAG} Google Drive mount failed ({error}); caches will not persist", flush=True)


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
    password = os.environ.get(_PASSWORD_ENV, "") or _platform_secret(platform)
    if password:
        return password
    try:
        return getpass.getpass(f"{_TAG} Secret password for .secret_keys (empty skips): ")
    except Exception:
        # Headless runs (Kaggle "Save & Run All") have no input frontend.
        print(f"{_TAG} No input frontend; add the {_PASSWORD_ENV} notebook secret", flush=True)
        return ""


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
    platform = args.pop(0) if args and args[0] in _PLATFORMS else _detect_platform()
    if not platform:
        print(f"{_TAG} Unknown notebook platform; pass one of: {', '.join(_PLATFORMS)}", flush=True)
        return 2
    mount_drive = _NO_DRIVE_FLAG not in args
    args = [arg for arg in args if arg != _NO_DRIVE_FLAG]
    if platform == "colab" and mount_drive:
        _mount_colab_drive()

    env = dict(os.environ)
    password = _resolve_password(platform)
    if password:
        env[_PASSWORD_ENV] = password
    password = ""

    command = ["bash", _PYSERVICE_SH, platform, *args]
    print(f"{_TAG} {' '.join(command)}", flush=True)
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
