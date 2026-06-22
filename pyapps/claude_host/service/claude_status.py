#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Claude CLI Auth Status Checker

Check Claude CLI login status for each user.
Uses: claude auth status (returns account info, plan type, login state)

Multi-user isolation:
  - Windows: CLAUDE_CONFIG_DIR env var per user (no OS account needed)
  - Linux:   sudo -u <user> to run as that system user
"""

import asyncio
import json
import logging
import os
import tempfile
import time
import urllib.request

from pycore.pyfoundations.pybasecommon.commander import (
    command_exists,
    exec_silent,
    get_command_output,
)
from pyapps.claude_host.service.platform_compat import (
    IS_WINDOWS,
    find_claude_binary,
    get_claude_config_dir,
)

logger = logging.getLogger(__name__)

# Cache TTL in seconds (5 minutes)
_CACHE_TTL = 300


# Cached git bash path (resolved once per process)
_git_bash_path: str | None = None
_git_bash_resolved = False

# Extended search directories (checked first, before PATH)
_GIT_BASH_SEARCH_DIRS = [
    r"C:\Program Files\Git\bin\bash.exe",
    r"D:\Program Files\Git\bin\bash.exe",
    r"C:\Program Files (x86)\Git\bin\bash.exe",
    r"D:\applications\Git\bin\bash.exe",
    r"D:\.dev_win10\Git\bin\bash.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Programs\Git\bin\bash.exe"),
    os.path.expandvars(r"%USERPROFILE%\scoop\apps\git\current\bin\bash.exe"),
]


def _find_git_bash() -> str | None:
    """Find git bash.exe on Windows for CLAUDE_CODE_GIT_BASH_PATH.

    Search order:
      1. Extended known directories (fast file-exists check)
      2. Derive from git.exe in PATH (mingw64/bin -> ../bin)
      3. 'where bash.exe' fallback
      4. Auto-install Git if not found (winget or official installer)

    Result is cached for the process lifetime.
    """
    global _git_bash_path, _git_bash_resolved
    if _git_bash_resolved:
        return _git_bash_path

    # 1. Extended known directories (priority scan)
    for path in _GIT_BASH_SEARCH_DIRS:
        expanded = os.path.expandvars(path)
        if os.path.isfile(expanded):
            _git_bash_path = expanded
            _git_bash_resolved = True
            logger.info("Git bash found at known path: %s", expanded)
            return expanded

    # 2. Derive from git.exe in PATH
    if command_exists("git"):
        git_output = get_command_output("where git.exe")
        git_exe = git_output.strip().split("\n")[0].strip() if git_output.strip() else ""
        if git_exe and os.path.isfile(git_exe):
            git_exe = os.path.realpath(git_exe)
            git_dir = os.path.dirname(git_exe)
            search_roots = set()
            parts = git_dir.replace("\\", "/").lower().split("/")
            for i, p in enumerate(parts):
                if p in ("bin", "cmd", "mingw64"):
                    search_roots.add(os.sep.join(git_dir.replace("\\", os.sep).split(os.sep)[:i]))
            search_roots.add(os.path.dirname(git_dir))
            for root in search_roots:
                candidate = os.path.join(root, "bin", "bash.exe")
                if os.path.isfile(candidate):
                    _git_bash_path = candidate
                    _git_bash_resolved = True
                    logger.info("Git bash derived from git.exe: %s", candidate)
                    return candidate

    # 3. where bash.exe fallback
    where_result = exec_silent("where bash.exe")
    if where_result.success and where_result.stdout.strip():
        for line in where_result.stdout.strip().split("\n"):
            line = line.strip()
            if "git" in line.lower() and os.path.isfile(line):
                _git_bash_path = line
                _git_bash_resolved = True
                logger.info("Git bash found via where: %s", line)
                return line

    # 4. Git not found -- attempt auto-install
    logger.warning("Git bash not found. Attempting to install Git for Windows...")
    installed_path = _auto_install_git()
    if installed_path:
        _git_bash_path = installed_path
        _git_bash_resolved = True
        return installed_path

    # All methods exhausted
    logger.error("Git bash not found and auto-install failed. Claude CLI will not work.")
    _git_bash_resolved = True
    _git_bash_path = None
    return None


def _auto_install_git() -> str | None:
    """Auto-install Git for Windows. Returns bash.exe path on success.

    Strategy:
      1. winget (preferred, no download needed)
      2. Official Git installer via HTTPS download
    """
    # --- Method 1: winget ---
    if command_exists("winget"):
        logger.info("Installing Git via winget (Git.Git)...")
        result = exec_silent(
            "winget install --id Git.Git --source winget "
            "--silent --accept-source-agreements --accept-package-agreements"
        )
        if result.success:
            logger.info("Git installed via winget successfully")
            _refresh_path()
            for path in [
                r"C:\Program Files\Git\bin\bash.exe",
                r"D:\Program Files\Git\bin\bash.exe",
            ]:
                if os.path.isfile(path):
                    return path
            # Try to find git via PATH after refresh
            git_output = get_command_output("where git.exe")
            git_exe = git_output.strip().split("\n")[0].strip() if git_output.strip() else ""
            if git_exe and os.path.isfile(git_exe):
                root = os.path.dirname(os.path.dirname(os.path.realpath(git_exe)))
                candidate = os.path.join(root, "bin", "bash.exe")
                if os.path.isfile(candidate):
                    return candidate
        else:
            logger.warning("winget install failed: %s", result.stderr[:200])

    # --- Method 2: Official Git installer download ---
    logger.info("Attempting Git install via official installer...")
    download_url = "https://github.com/git-for-windows/git/releases/latest/download/Git-2.48.1-64-bit.exe"
    # Try to get latest redirect from GitHub API
    try:
        api_url = "https://api.github.com/repos/git-for-windows/git/releases/latest"
        req = urllib.request.Request(api_url, headers={"User-Agent": "webclaude-host"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            release = json.loads(resp.read())
            for asset in release.get("assets", []):
                name = asset.get("name", "")
                if "64-bit.exe" in name and "Git-" in name:
                    download_url = asset["browser_download_url"]
                    break
    except Exception:
        pass  # Use fallback URL

    try:
        tmp_dir = tempfile.mkdtemp()
        installer_path = os.path.join(tmp_dir, "git-installer.exe")
        logger.info("Downloading Git installer from %s ...", download_url)
        urllib.request.urlretrieve(download_url, installer_path)

        logger.info("Running Git installer (silent)...")
        result = exec_silent(
            f'"{installer_path}" /VERYSILENT /NORESTART /NOCANCEL /SP- /SUPPRESSMSGBOXES'
        )

        # Cleanup
        if os.path.isfile(installer_path):
            os.unlink(installer_path)
        if os.path.isdir(tmp_dir):
            os.rmdir(tmp_dir)

        if result.success:
            logger.info("Git installed via official installer")
            _refresh_path()
            if os.path.isfile(r"C:\Program Files\Git\bin\bash.exe"):
                return r"C:\Program Files\Git\bin\bash.exe"
    except Exception as e:
        logger.warning("Official Git installer failed: %s", e)

    return None


def _refresh_path():
    """Refresh process PATH from system environment (picks up new installs)."""
    output = get_command_output(
        'powershell -Command "'
        "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + "
        "[Environment]::GetEnvironmentVariable('Path','User')\""
    )
    if output.strip():
        os.environ["PATH"] = output.strip()


_status_cache: dict[str, tuple[float, dict]] = {}


async def check_claude_status(username: str) -> dict:
    """Check Claude auth status for a specific user.

    Returns:
        {
            "username": "alice",
            "logged_in": True/False,
            "account": "alice@example.com" or None,
            "plan": "pro" / "max" / "free" / None,
            "expires": "2026-..." or None,
            "error": None or "error message"
        }
    """
    claude_bin = find_claude_binary()
    env = os.environ.copy()

    if IS_WINDOWS:
        config_dir = get_claude_config_dir(username)
        env["CLAUDE_CONFIG_DIR"] = config_dir

        if "CLAUDE_CODE_GIT_BASH_PATH" not in env:
            git_bash = _find_git_bash()
            if git_bash:
                env["CLAUDE_CODE_GIT_BASH_PATH"] = git_bash

        if claude_bin.lower().endswith((".cmd", ".bat")):
            cmd = ["cmd", "/c", claude_bin, "auth", "status"]
        else:
            cmd = [claude_bin, "auth", "status"]
    else:
        current_user = os.environ.get("USER", "")
        if username != current_user:
            cmd = ["sudo", "-u", username, "--", claude_bin, "auth", "status"]
        else:
            cmd = [claude_bin, "auth", "status"]

    try:
        logger.debug("Running: %s (config_dir=%s)", " ".join(cmd),
                     env.get("CLAUDE_CONFIG_DIR", "default"))
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=15)

        result = {
            "username": username,
            "logged_in": proc.returncode == 0,
            "account": None,
            "plan": None,
            "expires": None,
            "error": None,
        }

        if proc.returncode == 0:
            output = stdout.decode("utf-8", errors="replace").strip()
            try:
                data = json.loads(output)
                result["logged_in"] = data.get("loggedIn", False)
                result["account"] = (
                    data.get("email")
                    or data.get("account")
                    or data.get("user")
                )
                result["plan"] = (
                    data.get("subscriptionType")
                    or data.get("plan")
                    or data.get("subscription")
                    or data.get("type")
                )
                result["auth_method"] = data.get("authMethod", "")
                result["api_provider"] = data.get("apiProvider", "")
                result["org_name"] = data.get("orgName", "")
                result["expires"] = (
                    data.get("expiry")
                    or data.get("expires_at")
                )
            except json.JSONDecodeError:
                _parse_auth_output(output, result)
        else:
            err = stderr.decode("utf-8", errors="replace").strip()
            result["error"] = err[:200] if err else "Not logged in"

        return result

    except asyncio.TimeoutError:
        return {
            "username": username, "logged_in": False,
            "account": None, "plan": None, "expires": None,
            "error": "timeout (15s)",
        }
    except FileNotFoundError:
        return {
            "username": username, "logged_in": False,
            "account": None, "plan": None, "expires": None,
            "error": f"claude binary not found: {claude_bin}",
        }
    except Exception as e:
        return {
            "username": username, "logged_in": False,
            "account": None, "plan": None, "expires": None,
            "error": str(e)[:200],
        }


def _parse_auth_output(output: str, result: dict):
    """Parse `claude auth status` output to extract account details.

    The CLI output format may vary across versions. We look for common
    key-value patterns like:
        Account: alice@example.com
        Plan: Pro
        Subscription: Max
        Expires: 2026-12-31
    """
    for line in output.split("\n"):
        line_stripped = line.strip()
        line_lower = line_stripped.lower()

        if any(kw in line_lower for kw in ("account", "email", "user")):
            parts = line_stripped.split(":", 1)
            if len(parts) == 2:
                val = parts[1].strip()
                if val and "@" in val:
                    result["account"] = val
                elif val and not result["account"]:
                    result["account"] = val

        if any(kw in line_lower for kw in ("plan", "subscription", "tier")):
            parts = line_stripped.split(":", 1)
            if len(parts) == 2:
                val = parts[1].strip().lower()
                if val:
                    result["plan"] = val

        if any(kw in line_lower for kw in ("expir", "valid until", "renew")):
            parts = line_stripped.split(":", 1)
            if len(parts) == 2:
                val = parts[1].strip()
                if val:
                    result["expires"] = val


async def check_claude_usage(username: str) -> dict:
    """Try to get Claude usage info for a user (best-effort).

    There is no official `claude` CLI command for usage data.
    We check for credentials to confirm a session exists, then return
    a hint directing admins to the web dashboard for actual usage.

    Returns:
        {
            "usage_available": bool,
            "reason": str or None,
            "note": str or None,
        }
    """
    config_dir = get_claude_config_dir(username)

    creds_file = os.path.join(config_dir, ".credentials.json")
    if not os.path.isfile(creds_file):
        return {
            "usage_available": False,
            "reason": "No credentials file",
        }

    return {
        "usage_available": False,
        "reason": "No CLI usage command",
        "note": "Check https://claude.ai/settings for usage data",
    }


async def check_claude_status_cached(username: str) -> dict:
    """Check Claude auth status with TTL-based caching.

    Results are cached for _CACHE_TTL seconds (default 5 min) to avoid
    spawning `claude auth status` too frequently.
    """
    now = time.monotonic()
    cached = _status_cache.get(username)
    if cached:
        ts, data = cached
        if now - ts < _CACHE_TTL:
            return data

    status = await check_claude_status(username)
    _status_cache[username] = (now, status)
    return status


async def check_all_users_status(usernames: list[str]) -> list[dict]:
    """Check Claude status for all users in parallel (with caching)."""
    tasks = [check_claude_status_cached(u) for u in usernames]
    return list(await asyncio.gather(*tasks))


def invalidate_cache(username: str | None = None):
    """Clear cached status for a user, or all users if None."""
    if username is None:
        _status_cache.clear()
    else:
        _status_cache.pop(username, None)
