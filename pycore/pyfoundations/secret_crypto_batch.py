"""Python entry point for scripts/encryption_tools/secret_crypto.js.

secret_crypto.js decrypts/encrypts/verifies ANY number of encrypted secret
files (single disguised files, bundles, or a directory of either) in ONE
process with ONE password; key derivation runs in parallel on the libuv
thread pool and a wrong password never writes anything. This module is the
single place that shells out to it from pycore, so every caller (secret
decryption, secret encryption, the shared client-key regeneration flow) goes
through one parsed result shape instead of re-parsing the tool's stdout.

The password reaches the tool through secret_password_runner.js's stdin; it
is never part of any process command line (scripts/encryption_tools).
"""

from pathlib import Path
from typing import Dict, List, Optional

from pycore.pyfoundations.pybasecommon.commander import exec_silent
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

_PASSWORD_RUNNER = Path(__file__).resolve().parents[2] / "scripts" / "encryption_tools" / "secret_password_runner.js"
_SECRET_CRYPTO_JS = Path(__file__).resolve().parents[2] / "scripts" / "encryption_tools" / "secret_crypto.js"
_SECRET_KEYS_DIR = Path(__file__).resolve().parents[2] / ".secret_keys"
_ENCRYPTED_DIR = _SECRET_KEYS_DIR / "already_encrypted"
# Tracked list of secrets encrypted with a password other than the main one;
# mirrors SECRET_MISMATCH_LIST in scripts/shells/linux/common/secret_tool_common.sh.
_MISMATCH_LIST = _SECRET_KEYS_DIR / "password_mismatch.list"
_MISMATCH_HEADER = "# Secrets encrypted with a different password; dd re-encrypts them with the main password"
_ENCRYPTED_EXT = ".js"
_PASSWORD_STDIN_ARG = "--password-stdin"
_FORCE_FLAG = "--force"
_RESULT_TAG = "SECRET_CRYPTO"
_DEFAULT_TIMEOUT_SECONDS = 600

# Per-file statuses secret_crypto.js prints; see the header of secret_crypto.js.
STATUS_DECRYPTED = "decrypted"
STATUS_SKIPPED_EXISTS = "skipped_exists"
STATUS_WRONG_PASSWORD = "wrong_password"
STATUS_INVALID_FILE = "invalid_file"
STATUS_ENCRYPTED = "encrypted"
STATUS_VERIFIED = "verified"
STATUS_ERROR = "error"


class SecretCryptoBatchResult:
    """Parsed result of one secret_crypto.js run.

    ``by_status`` maps each status string (see the STATUS_* constants) to the
    list of file/entry names reported under it. ``errors`` maps a name to its
    error detail when the tool reported one. ``ok`` is False only when the
    process itself failed to run (bad args, missing node, ...) and produced no
    parseable per-file lines at all; per-file failures (wrong password,
    invalid file, ...) still leave ``ok`` True and show up in ``by_status``.
    """

    def __init__(self, by_status: Dict[str, List[str]], errors: Dict[str, str], ok: bool, run_error: str):
        self.by_status = by_status
        self.errors = errors
        self.ok = ok
        self.run_error = run_error

    def names(self, status: str) -> List[str]:
        return list(self.by_status.get(status, []))

    @property
    def decrypted(self) -> List[str]:
        return self.names(STATUS_DECRYPTED)

    @property
    def skipped_exists(self) -> List[str]:
        return self.names(STATUS_SKIPPED_EXISTS)

    @property
    def wrong_password(self) -> List[str]:
        return self.names(STATUS_WRONG_PASSWORD)

    @property
    def invalid_file(self) -> List[str]:
        return self.names(STATUS_INVALID_FILE)

    @property
    def encrypted(self) -> List[str]:
        return self.names(STATUS_ENCRYPTED)

    @property
    def verified(self) -> List[str]:
        return self.names(STATUS_VERIFIED)

    @property
    def error(self) -> List[str]:
        return self.names(STATUS_ERROR)


def _parse_secret_crypto_output(stdout: str, return_code: int, stderr: str) -> SecretCryptoBatchResult:
    by_status: Dict[str, List[str]] = {}
    errors: Dict[str, str] = {}
    for line in (stdout or "").splitlines():
        parts = line.split("\t")
        if len(parts) < 3 or parts[0] != _RESULT_TAG:
            continue
        status, name = parts[1], parts[2]
        by_status.setdefault(status, []).append(name)
        if len(parts) > 3:
            errors[name] = parts[3]
    ok = bool(by_status) or return_code == 0
    run_error = "" if ok else (stderr or stdout or f"secret_crypto.js exited {return_code}").strip()
    return SecretCryptoBatchResult(by_status=by_status, errors=errors, ok=ok, run_error=run_error)


def run_secret_crypto(
    command: str,
    password: str,
    sources: List[str],
    out_dir: Optional[str] = None,
    force: bool = False,
    timeout: int = _DEFAULT_TIMEOUT_SECONDS,
    node_bin: str = "node",
) -> SecretCryptoBatchResult:
    """Run secret_crypto.js once for every source. ``command`` is decrypt,
    encrypt or verify. ``sources`` are encrypted .js files/dirs (decrypt,
    verify) or raw files (encrypt). ``out_dir`` is required for decrypt and
    encrypt, omitted for verify. The password is passed on stdin, never argv.
    """
    args = [node_bin, str(_PASSWORD_RUNNER), str(_SECRET_CRYPTO_JS), command, _PASSWORD_STDIN_ARG]
    if out_dir is not None:
        args.append(str(out_dir))
    if force:
        args.append(_FORCE_FLAG)
    args.extend(str(source) for source in sources)

    result = exec_silent(args, input=password, timeout=timeout)
    return _parse_secret_crypto_output(result.stdout, result.return_code, result.stderr)


def mismatched_secret_names() -> List[str]:
    """Listed second-password secrets whose encrypted copy still exists."""
    if not _MISMATCH_LIST.is_file():
        return []
    try:
        lines = _MISMATCH_LIST.read_text(encoding="utf-8-sig").splitlines()
    except OSError as exc:
        ColorPrint.yellow(f"[SecretCrypto] read {_MISMATCH_LIST} failed: {exc}")
        return []
    names = (line.strip() for line in lines)
    return [name for name in names
            if name and not name.startswith("#") and (_ENCRYPTED_DIR / f"{name}{_ENCRYPTED_EXT}").is_file()]


def record_password_split(result: SecretCryptoBatchResult) -> List[str]:
    """After a decrypt: when one password opened some secrets but not others, the
    rejected ones use a second password; add them to the tracked list."""
    if not result.decrypted or not result.wrong_password:
        return []
    names = sorted(set(mismatched_secret_names()) | set(result.wrong_password))
    _MISMATCH_LIST.write_text("\n".join([_MISMATCH_HEADER, *names]) + "\n", encoding="utf-8")
    return list(result.wrong_password)


def reference_secret_file(excluded: Optional[List[str]] = None) -> Optional[Path]:
    """An encrypted secret carrying the main password (never a listed mismatched
    or an excluded one), used to check a password before encrypting with it."""
    skipped = set(excluded or []) | set(mismatched_secret_names())
    for candidate in sorted(_ENCRYPTED_DIR.glob(f"*{_ENCRYPTED_EXT}")):
        if candidate.stem not in skipped:
            return candidate
    return None


def password_is_main(password: str, excluded: Optional[List[str]] = None) -> bool:
    """True when ``password`` opens the reference secret (or none exists yet)."""
    reference = reference_secret_file(excluded)
    if reference is None:
        return True
    return bool(run_secret_crypto("verify", password, [str(reference)]).verified)


__all__ = [
    "SecretCryptoBatchResult",
    "run_secret_crypto",
    "mismatched_secret_names",
    "record_password_split",
    "reference_secret_file",
    "password_is_main",
    "STATUS_DECRYPTED",
    "STATUS_SKIPPED_EXISTS",
    "STATUS_WRONG_PASSWORD",
    "STATUS_INVALID_FILE",
    "STATUS_ENCRYPTED",
    "STATUS_VERIFIED",
    "STATUS_ERROR",
]
