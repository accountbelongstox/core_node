#!/usr/bin/env python3
"""Stable Android signing for in-place updates (contract: app_downloads.auto_update).

Every APK (debug and release) is signed with ONE project keystore so an installed app can be updated in
place from any machine. The keystore (PKCS12) and its password live in the secret store as
CORE_NODE_ANDROID_KEYSTORE_B64 / CORE_NODE_ANDROID_KEYSTORE_PASSWORD (.secret_keys/.secret_ignore, never
committed); it is materialised under artifacts/signing/ (git-ignored) for Gradle. First use seeds it from
this machine's ~/.android/debug.keystore key (so phones already running a locally built APK keep updating
in place), re-wrapped with a random password; without a debug keystore a new key is generated.
Explicit CORE_NODE_ANDROID_SIGNING_* environment variables always win.
"""
from __future__ import annotations

import base64
import os
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

CORE_NODE_ROOT = Path(__file__).resolve().parents[4]
if str(CORE_NODE_ROOT) not in sys.path:
    sys.path.insert(0, str(CORE_NODE_ROOT))

from pycore.pyfoundations.secret_manager import get_secret_key, set_secret_key  # noqa: E402

SECRET_KEYSTORE = "CORE_NODE_ANDROID_KEYSTORE_B64"
SECRET_PASSWORD = "CORE_NODE_ANDROID_KEYSTORE_PASSWORD"
KEY_ALIAS = "core_node_android"
ENV_STORE_FILE = "CORE_NODE_ANDROID_SIGNING_STORE_FILE"
ENV_STORE_PASSWORD = "CORE_NODE_ANDROID_SIGNING_STORE_PASSWORD"
ENV_KEY_ALIAS = "CORE_NODE_ANDROID_SIGNING_KEY_ALIAS"
ENV_KEY_PASSWORD = "CORE_NODE_ANDROID_SIGNING_KEY_PASSWORD"
SIGNING_ENV_NAMES = (ENV_STORE_FILE, ENV_STORE_PASSWORD, ENV_KEY_ALIAS, ENV_KEY_PASSWORD)
SIGNING_DIR = Path("artifacts") / "signing"
STORE_FILE_NAME = "core_node_android.p12"
DEBUG_KEYSTORE = Path.home() / ".android" / "debug.keystore"
DEBUG_ALIAS = "androiddebugkey"
DEBUG_PASSWORD = "android"
KEY_VALIDITY_DAYS = "36500"
KEY_DISTINGUISHED_NAME = "CN=core_node android, O=core_node"
PASSWORD_BYTES = 24
TOOL_TIMEOUT_SECONDS = 120
SOURCE_ENV = "environment"
SOURCE_PROJECT = "project keystore"
SHA_PATTERN = re.compile(r"(?:SHA-?256)[^:\n]*:\s*([0-9A-Fa-f:]{64,95})")
SIGNER_PATTERN = re.compile(r"certificate SHA-256 digest:\s*([0-9A-Fa-f]{64})")
TOOL_ENV_STORE = "CN_KS_STORE_PASSWORD"
TOOL_ENV_KEY = "CN_KS_KEY_PASSWORD"
TOOL_ENV_SRC_STORE = "CN_KS_SRC_STORE_PASSWORD"
TOOL_ENV_SRC_KEY = "CN_KS_SRC_KEY_PASSWORD"


@dataclass
class SigningInfo:
    source: str
    env: dict[str, str]
    store_file: Path
    cert_sha256: str


def log(message: str) -> None:
    print(f"[signing] {message}", flush=True)


def executable(name: str) -> str | None:
    return shutil.which(name + (".exe" if os.name == "nt" else "")) or shutil.which(name)


def java_tool(name: str) -> str | None:
    found = executable(name)
    if found:
        return found
    java_home = os.environ.get("JAVA_HOME")
    if java_home:
        candidate = Path(java_home) / "bin" / (name + (".exe" if os.name == "nt" else ""))
        if candidate.is_file():
            return str(candidate)
    return None


def run_tool(command: list[str], secrets_env: dict[str, str]) -> subprocess.CompletedProcess:
    environment = os.environ.copy()
    environment.update(secrets_env)
    return subprocess.run(command, env=environment, capture_output=True, text=True, timeout=TOOL_TIMEOUT_SECONDS, check=False)


def normalize_sha(value: str) -> str:
    return value.replace(":", "").strip().lower()


def keystore_cert_sha256(store_file: Path, alias: str, store_password: str) -> str:
    keytool = java_tool("keytool")
    if not keytool:
        return ""
    result = run_tool([keytool, "-list", "-v", "-keystore", str(store_file), "-alias", alias,
                       "-storepass:env", TOOL_ENV_STORE], {TOOL_ENV_STORE: store_password})
    match = SHA_PATTERN.search(result.stdout or "") if result.returncode == 0 else None
    return normalize_sha(match.group(1)) if match else ""


def seed_keystore(target: Path, password: str) -> str:
    keytool = java_tool("keytool")
    if not keytool:
        raise RuntimeError("keytool is missing (install a JDK) - cannot create the project Android keystore")
    secrets_env = {TOOL_ENV_STORE: password, TOOL_ENV_KEY: password,
                   TOOL_ENV_SRC_STORE: DEBUG_PASSWORD, TOOL_ENV_SRC_KEY: DEBUG_PASSWORD}
    if DEBUG_KEYSTORE.is_file():
        result = run_tool([keytool, "-importkeystore", "-noprompt",
                           "-srckeystore", str(DEBUG_KEYSTORE), "-srcstoretype", "PKCS12", "-srcalias", DEBUG_ALIAS,
                           "-srcstorepass:env", TOOL_ENV_SRC_STORE, "-srckeypass:env", TOOL_ENV_SRC_KEY,
                           "-destkeystore", str(target), "-deststoretype", "PKCS12", "-destalias", KEY_ALIAS,
                           "-deststorepass:env", TOOL_ENV_STORE, "-destkeypass:env", TOOL_ENV_KEY], secrets_env)
        if result.returncode == 0:
            return f"seeded from {DEBUG_KEYSTORE}"
        target.unlink(missing_ok=True)
        log("could not import the machine debug keystore; generating a new key")
    result = run_tool([keytool, "-genkeypair", "-noprompt", "-keystore", str(target), "-storetype", "PKCS12",
                       "-alias", KEY_ALIAS, "-keyalg", "RSA", "-keysize", "2048", "-validity", KEY_VALIDITY_DAYS,
                       "-dname", KEY_DISTINGUISHED_NAME,
                       "-storepass:env", TOOL_ENV_STORE, "-keypass:env", TOOL_ENV_KEY], secrets_env)
    if result.returncode != 0:
        raise RuntimeError("keytool could not generate the project Android keystore")
    return "newly generated"


def create_project_secrets() -> None:
    password = secrets.token_urlsafe(PASSWORD_BYTES)
    with tempfile.TemporaryDirectory() as folder:
        target = Path(folder) / STORE_FILE_NAME
        origin = seed_keystore(target, password)
        encoded = base64.b64encode(target.read_bytes()).decode("ascii")
    if not (set_secret_key(SECRET_PASSWORD, password) and set_secret_key(SECRET_KEYSTORE, encoded)):
        raise RuntimeError("could not store the Android keystore secrets in .secret_keys/.secret_ignore")
    log(f"created the project Android keystore ({origin}); stored as {SECRET_KEYSTORE} / {SECRET_PASSWORD} "
        "(local secret store; sync it to other machines through the encrypted secret batch)")


def materialise(root: Path, encoded: str) -> Path:
    directory = root / SIGNING_DIR
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / STORE_FILE_NAME
    data = base64.b64decode(encoded)
    if not target.is_file() or target.read_bytes() != data:
        temp = target.with_name(f".{target.name}.{os.getpid()}.tmp")
        temp.write_bytes(data)
        os.replace(temp, target)
    return target


def ensure_signing(root: Path) -> SigningInfo:
    """Signing environment for Gradle: explicit environment first, else the project keystore (created once)."""
    if all(os.environ.get(name) for name in SIGNING_ENV_NAMES):
        store_file = Path(os.environ[ENV_STORE_FILE])
        sha = keystore_cert_sha256(store_file, os.environ[ENV_KEY_ALIAS], os.environ[ENV_STORE_PASSWORD])
        return SigningInfo(SOURCE_ENV, {}, store_file, sha)
    encoded = get_secret_key(SECRET_KEYSTORE)
    password = get_secret_key(SECRET_PASSWORD)
    if not encoded or not password:
        create_project_secrets()
        encoded = get_secret_key(SECRET_KEYSTORE)
        password = get_secret_key(SECRET_PASSWORD)
    store_file = materialise(root, encoded)
    env = {ENV_STORE_FILE: str(store_file), ENV_STORE_PASSWORD: password,
           ENV_KEY_ALIAS: KEY_ALIAS, ENV_KEY_PASSWORD: password}
    return SigningInfo(SOURCE_PROJECT, env, store_file, keystore_cert_sha256(store_file, KEY_ALIAS, password))


def sdk_roots() -> list[Path]:
    roots = [Path(os.environ[name]) for name in ("ANDROID_HOME", "ANDROID_SDK_ROOT") if os.environ.get(name)]
    roots += [Path.home() / "Android" / "Sdk", Path.home() / "AppData" / "Local" / "Android" / "Sdk"]
    return [root for root in roots if root.is_dir()]


def find_apksigner() -> list[str] | None:
    on_path = executable("apksigner")
    if on_path:
        return [on_path]
    script_name = "apksigner.bat" if os.name == "nt" else "apksigner"
    for sdk in sdk_roots():
        builds = sorted((sdk / "build-tools").glob("*"), key=lambda path: path.name, reverse=True)
        for build in builds:
            if (build / script_name).is_file():
                return [str(build / script_name)]
    return None


def apk_signer_sha256(apk: Path, fallback: str = "") -> str:
    """SHA-256 of the APK's signing certificate (apksigner); the keystore certificate when apksigner is absent."""
    tool = find_apksigner()
    if tool:
        result = subprocess.run(tool + ["verify", "--print-certs", str(apk)], capture_output=True, text=True,
                                timeout=TOOL_TIMEOUT_SECONDS, check=False)
        match = SIGNER_PATTERN.search(result.stdout or "")
        if result.returncode == 0 and match:
            return match.group(1).lower()
    return fallback


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    info = ensure_signing(root)
    log(f"signing source: {info.source}; certificate SHA-256: {info.cert_sha256 or 'unknown'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
