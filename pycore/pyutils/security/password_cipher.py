# -*- coding: utf-8 -*-
"""
Machine-bound password encryption/decryption with verification prefix.

Encrypts plaintext (e.g. password) with a key derived from machine_id so
ciphertext can only be decrypted on the same machine. Prepends two
verification characters; after decrypt, if they match then decryption
succeeded and the rest is the original plaintext (strip before use).
On decrypt failure returns None and prints a hint for the caller.
"""
import base64
import hashlib
import re
from typing import Optional

from pycore.pyutils.security.machine_id import get_machine_id

VERIFY_PREFIX = "VX"

_DECRYPT_FAIL_HINT = (
    "[PasswordCipher] Decrypt failed (wrong machine or invalid/corrupt ciphertext). "
    "Returning empty; caller should prompt user to re-enter password."
)


def _fernet_key_from_machine_id() -> bytes:
    """Derive a Fernet-compatible 32-byte key from machine id, then base64url encode."""
    mid = get_machine_id()
    raw_key = hashlib.sha256(mid.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(raw_key)


def _get_fernet():
    from pycore.pyfoundations.third_party import get_third_package_cryptography
    get_third_package_cryptography()
    from cryptography.fernet import Fernet
    return Fernet


def encrypt_password(plain: str) -> Optional[str]:
    """
    Encrypt plaintext with machine-bound key; prepend VERIFY_PREFIX.
    Returns base64-encoded ciphertext, or None on failure.
    """
    if plain is None:
        return None
    try:
        Fernet = _get_fernet()
        key = _fernet_key_from_machine_id()
        f = Fernet(key)
        payload = (VERIFY_PREFIX + plain).encode("utf-8")
        token = f.encrypt(payload)
        return token.decode("ascii")
    except Exception:
        return None


def decrypt_password(cipher_b64: str) -> Optional[str]:
    """
    Decrypt ciphertext (base64) with machine-bound key. If the first two
    characters equal VERIFY_PREFIX, return the rest (actual password, verification
    chars already stripped); otherwise return None and print hint so caller can
    prompt user to re-enter password.
    """
    if not cipher_b64 or not isinstance(cipher_b64, str):
        return None
    cipher_b64 = cipher_b64.strip()
    if cipher_b64.startswith(CIPHER_STORAGE_PREFIX):
        cipher_b64 = cipher_b64[len(CIPHER_STORAGE_PREFIX):].strip()
    if not cipher_b64:
        return None
    try:
        Fernet = _get_fernet()
        key = _fernet_key_from_machine_id()
        f = Fernet(key)
        token = cipher_b64.encode("ascii")
        payload_bytes = f.decrypt(token)
        payload = payload_bytes.decode("utf-8")
        if payload[:2] != VERIFY_PREFIX:
            try:
                from pycore.pyfoundations.color_print import ColorPrint
                ColorPrint.yellow(_DECRYPT_FAIL_HINT)
            except Exception:
                print(_DECRYPT_FAIL_HINT)
            return None
        return payload[2:]
    except Exception:
        try:
            from pycore.pyfoundations.color_print import ColorPrint
            ColorPrint.yellow(_DECRYPT_FAIL_HINT)
        except Exception:
            print(_DECRYPT_FAIL_HINT)
        return None


# Fernet token: version(1) + timestamp(8) + iv(16) + ciphertext + hmac(32) => min 57 bytes => min base64 len 76
_FERNET_MIN_DECODED_BYTES = 57
_FERNET_MIN_B64_LEN = 76

# Optional storage prefix: if present, rest is always treated as ciphertext (rest still must pass schemes 1-9)
CIPHER_STORAGE_PREFIX = "ENC:"


def _scheme1_length_floor(s: str) -> bool:
    """1. Length: Fernet minimum token base64 length is 76. Plaintext rarely that long as single token."""
    return len(s) >= _FERNET_MIN_B64_LEN


def _scheme2_strict_base64url_alphabet(s: str) -> bool:
    """2. Only base64url chars; padding only trailing 0/1/2 '='. No space, no other special chars."""
    if not re.match(r"^[A-Za-z0-9_-]+=*$", s):
        return False
    content = s.rstrip("=")
    pad_count = len(s) - len(content)
    return pad_count <= 2 and "=" not in content


def _scheme3_padding_length_valid(s: str) -> bool:
    """3. Base64 length rule: (len - padding) % 4 == 0."""
    content = s.rstrip("=")
    pad = len(s) - len(content)
    return (len(content) + pad) % 4 == 0 and pad in (0, 1, 2)


def _b64_decode_safe(s: str):
    """Decode base64url with correct padding; return None on error."""
    pad = (4 - len(s) % 4) % 4
    try:
        return base64.urlsafe_b64decode(s + "=" * pad)
    except Exception:
        return None


def _scheme4_base64_decodable(s: str) -> bool:
    """4. Must decode as valid base64url without error."""
    return _b64_decode_safe(s) is not None


def _scheme5_decoded_min_length(s: str) -> bool:
    """5. Decoded byte length >= Fernet minimum (57)."""
    raw = _b64_decode_safe(s)
    return raw is not None and len(raw) >= _FERNET_MIN_DECODED_BYTES


def _scheme6_fernet_version_byte(s: str) -> bool:
    """6. Decoded first byte is Fernet version 0x80. Strongest signal: plaintext never decodes to 0x80."""
    raw = _b64_decode_safe(s)
    return raw is not None and len(raw) >= 1 and raw[0] == 0x80


def _scheme7_reject_plaintext_signals(s: str) -> bool:
    """7. Reject if contains space/tab/newline or '=' not only at end (plaintext may have = elsewhere)."""
    if re.search(r"[\s]", s):
        return False
    content = s.rstrip("=")
    return "=" not in content


def _scheme8_single_line_no_control_chars(s: str) -> bool:
    """8. Single line, no control characters (plaintext may have \\n, \\r)."""
    return "\n" not in s and "\r" not in s and not any(ord(c) < 32 and c not in "\t" for c in s)


def _scheme9_ascii_only(s: str) -> bool:
    """9. Ciphertext is ASCII (base64). Plaintext may be Unicode."""
    try:
        s.encode("ascii")
        return True
    except UnicodeEncodeError:
        return False


def _scheme10_explicit_prefix(s: str) -> bool:
    """10. If stored with ENC: prefix, rest is ciphertext; then run other schemes on rest."""
    return s.startswith(CIPHER_STORAGE_PREFIX)


def is_likely_ciphertext(s: str) -> bool:
    """
    Ten schemes to avoid confusing ciphertext with plaintext. Only treat as ciphertext when:
    - either value has explicit ENC: prefix (scheme 10), then rest must pass schemes 1-9; or
    - all of schemes 1-9 pass (length, alphabet, padding, decode, Fernet structure, no plaintext signals).
    """
    if not s or not isinstance(s, str):
        return False
    s = s.strip()
    if not s:
        return False
    rest = s[len(CIPHER_STORAGE_PREFIX):] if s.startswith(CIPHER_STORAGE_PREFIX) else s
    if s.startswith(CIPHER_STORAGE_PREFIX):
        if not rest:
            return False
        s = rest.strip()
        if not s:
            return False
    if not _scheme9_ascii_only(s):
        return False
    if not _scheme8_single_line_no_control_chars(s):
        return False
    if not _scheme7_reject_plaintext_signals(s):
        return False
    if not _scheme2_strict_base64url_alphabet(s):
        return False
    if not _scheme3_padding_length_valid(s):
        return False
    if not _scheme1_length_floor(s):
        return False
    if not _scheme4_base64_decodable(s):
        return False
    if not _scheme5_decoded_min_length(s):
        return False
    if not _scheme6_fernet_version_byte(s):
        return False
    return True


__all__ = [
    "VERIFY_PREFIX",
    "CIPHER_STORAGE_PREFIX",
    "encrypt_password",
    "decrypt_password",
    "is_likely_ciphertext",
]
