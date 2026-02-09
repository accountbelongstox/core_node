# -*- coding: utf-8 -*-
"""
Battle.net login credentials (Asia / CN): read from config by region; dialog with region dropdown, account/password per region.
Password is stored encrypted (machine-bound); decrypt on read. Namespace: battlenet_asia_credentials, battlenet_cn_credentials.
"""
import tkinter as tk
from tkinter import ttk
from typing import Optional, Tuple

from providor.constants.common import ASIA_LOGIN_DEBUG_INPUT
from providor.providor_index import get_config_value_safe, set_config_value_safe
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.security import (
    decrypt_password,
    encrypt_password,
    is_likely_ciphertext,
)
from ui.utils.app_root import get_app_root

CONFIG_KEY_ASIA_CREDENTIALS = "battlenet_asia_credentials"
CONFIG_KEY_CN_CREDENTIALS = "battlenet_cn_credentials"

REGION_ASIA = "asia"
REGION_CN = "cn"

# Display label -> region key
REGION_LABELS = (("亚服", REGION_ASIA), ("国服", REGION_CN))


def _config_key_for_region(region: str) -> str:
    if region == REGION_CN:
        return CONFIG_KEY_CN_CREDENTIALS
    return CONFIG_KEY_ASIA_CREDENTIALS


def _label_for_region(region: str) -> str:
    for label, r in REGION_LABELS:
        if r == region:
            return label
    return "亚服"

# When True: dialog was scheduled or is open; tick driver skips until dialog closes (OK/Cancel).
_asia_credentials_dialog_pending = False


def is_asia_credentials_dialog_pending() -> bool:
    """True when Asia credentials dialog was scheduled or is open; caller should skip tick until closed."""
    return _asia_credentials_dialog_pending


def _set_asia_credentials_dialog_pending(value: bool) -> None:
    global _asia_credentials_dialog_pending
    _asia_credentials_dialog_pending = value


def get_credentials(region: str) -> Optional[Tuple[str, str]]:
    """
    Return (email, password) for the given region (REGION_ASIA / REGION_CN). Password decrypted; None on failure.
    """
    key = _config_key_for_region(region)
    raw = get_config_value_safe(key, None)
    if not isinstance(raw, dict):
        return None
    email = (raw.get("email") or "").strip()
    stored_password = (raw.get("password") or "").strip()
    if not email or not stored_password:
        return None
    decrypt_called = False
    if is_likely_ciphertext(stored_password):
        password = decrypt_password(stored_password)
        decrypt_called = True
        if password is None:
            ColorPrint.yellow(
                "[Credentials] Stored password decrypt failed (region=%s). Password dialog will be shown."
                % region
            )
            return None
    else:
        password = stored_password
    if ASIA_LOGIN_DEBUG_INPUT and (stored_password or password):
        _debug_log_password(stored_password, password, decrypt_called)
    return (email, password)


def get_asia_credentials() -> Optional[Tuple[str, str]]:
    """Return (email, password) for Asia; None if missing or decrypt failed. Backward compat."""
    return get_credentials(REGION_ASIA)


def _debug_log_password(
    ciphertext: str, plain: str, decrypt_called: bool
) -> None:
    """Debug: 密文(preview)、解密后(masked)、实际要输入(masked)、是否调用 pycore 加解密."""
    # 密文：前 24 字符 + ...
    if ciphertext and decrypt_called:
        c_preview = (ciphertext[:24] + "...") if len(ciphertext) > 24 else ciphertext
    else:
        c_preview = "N/A (明文存储)"
    # 解密后 / 实际要输入：*** len=N，不输出明文
    n = len(plain) if plain else 0
    p_masked = ("*** len=%d" % n) if n else "empty"
    ColorPrint.gray(
        "[AsiaCredentials] 密文 ciphertext (preview)= %s"
        % c_preview
    )
    ColorPrint.gray(
        "[AsiaCredentials] 解密后 decrypted= %s | 实际要输入 actual_to_input= %s"
        % (p_masked, p_masked)
    )
    if decrypt_called:
        ColorPrint.gray(
            "[AsiaCredentials] 加密/解密: 本次读取已调用 pycore.pyutils.security.decrypt_password"
        )
    else:
        ColorPrint.gray(
            "[AsiaCredentials] 加密/解密: 本次读取未调用解密 (明文存储)"
        )


def save_credentials(region: str, email: str, password: str) -> None:
    """保存时：取输入框明文，加密后自动替换写入密文到配置。"""
    cipher = encrypt_password(password)
    stored_password = cipher if cipher is not None else password
    key = _config_key_for_region(region)
    set_config_value_safe(key, {"email": email, "password": stored_password})


def save_asia_credentials(email: str, password: str) -> None:
    """Save Asia credentials. Backward compat."""
    save_credentials(REGION_ASIA, email, password)


def _load_credentials_into_vars(region: str, var_email: tk.StringVar, var_password: tk.StringVar) -> None:
    """已有值时：先解密再显示到输入框，供用户修改。密文 → decrypt → 明文填入 UI。"""
    key = _config_key_for_region(region)
    raw = get_config_value_safe(key, None)
    email = ""
    password = ""
    if isinstance(raw, dict):
        email = (raw.get("email") or "").strip()
        raw_pwd = (raw.get("password") or "").strip()
        if raw_pwd and is_likely_ciphertext(raw_pwd):
            password = decrypt_password(raw_pwd) or ""
            if not password:
                ColorPrint.yellow(
                    "[Credentials] Could not decrypt stored password (region=%s). Re-enter."
                    % region
                )
        else:
            password = raw_pwd
    var_email.set(email)
    var_password.set(password)


def _show_credentials_dialog(default_region: str = REGION_ASIA) -> None:
    """Show modal dialog: region dropdown (亚服/国服), account, password. Save to selected region on OK."""
    try:
        root = get_app_root()
        if not root:
            return
    except Exception:
        return

    top = tk.Toplevel(root)
    top.title("Battle.net 账号密码")
    top.resizable(True, False)
    top.transient(root)
    top.grab_set()

    f = ttk.Frame(top, padding=12)
    f.grid(row=0, column=0, sticky="nsew")
    top.columnconfigure(0, weight=1)
    top.rowconfigure(0, weight=1)
    f.columnconfigure(0, weight=1)

    labels = [lb for lb, _ in REGION_LABELS]
    default_label = _label_for_region(default_region)
    var_region = tk.StringVar(value=default_label)

    ttk.Label(f, text="类型 (命名空间):").grid(row=0, column=0, sticky="w", pady=(0, 4))
    combo_region = ttk.Combobox(f, textvariable=var_region, values=labels, state="readonly", width=12)
    combo_region.grid(row=1, column=0, sticky="w", pady=(0, 10))
    combo_region.current(0 if default_region == REGION_ASIA else 1)

    var_email = tk.StringVar()
    var_password = tk.StringVar()
    _load_credentials_into_vars(default_region, var_email, var_password)

    def on_region_change(*_args) -> None:
        sel = var_region.get()
        r = REGION_CN if sel == "国服" else REGION_ASIA
        _load_credentials_into_vars(r, var_email, var_password)

    var_region.trace_add("write", on_region_change)

    ttk.Label(f, text="账号 (邮箱/手机):").grid(row=2, column=0, sticky="w", pady=(0, 4))
    entry_email = ttk.Entry(f, textvariable=var_email, width=36)
    entry_email.grid(row=3, column=0, sticky="ew", pady=(0, 10))

    ttk.Label(f, text="密码:").grid(row=4, column=0, sticky="w", pady=(0, 4))
    entry_password = ttk.Entry(f, textvariable=var_password, width=36)
    entry_password.grid(row=5, column=0, sticky="ew", pady=(0, 12))

    def _current_region() -> str:
        return REGION_CN if var_region.get() == "国服" else REGION_ASIA

    def on_ok() -> None:
        email_val = (var_email.get() or "").strip()
        password_val = (var_password.get() or "").strip()
        if email_val and password_val:
            save_credentials(_current_region(), email_val, password_val)
        _set_asia_credentials_dialog_pending(False)
        top.grab_release()
        top.destroy()

    def on_cancel() -> None:
        _set_asia_credentials_dialog_pending(False)
        top.grab_release()
        top.destroy()

    btn_f = ttk.Frame(f)
    btn_f.grid(row=6, column=0, sticky="ew", pady=(0, 0))
    btn_f.columnconfigure(0, weight=1)
    ttk.Button(btn_f, text="OK", command=on_ok).grid(row=0, column=0, padx=(0, 6))
    ttk.Button(btn_f, text="Cancel", command=on_cancel).grid(row=0, column=1)

    entry_email.focus_set()
    top.protocol("WM_DELETE_WINDOW", on_cancel)
    top.update_idletasks()
    w = top.winfo_reqwidth()
    h = top.winfo_reqheight()
    sw = top.winfo_screenwidth()
    sh = top.winfo_screenheight()
    x = max(0, (sw - w) // 2)
    y = max(0, (sh - h) // 2)
    top.geometry("+%d+%d" % (x, y))
    top.wait_window()


def _show_asia_credentials_dialog() -> None:
    """Show credentials dialog with default region Asia (same dialog as 设置账号密码)."""
    _show_credentials_dialog(default_region=REGION_ASIA)


def schedule_asia_credentials_dialog() -> None:
    """
    Schedule the credentials dialog (default 亚服) on the main thread. Used when BN flow needs credentials.
    """
    schedule_battlenet_credentials_dialog(default_region=REGION_ASIA)


def schedule_battlenet_credentials_dialog(default_region: str = REGION_ASIA) -> None:
    """
    Schedule the Battle.net 账号密码 dialog on the main (UI) thread. default_region: REGION_ASIA or REGION_CN.
    Same dialog as flow-triggered; dropdown 亚服/国服, account/password saved per region.
    """
    if _asia_credentials_dialog_pending:
        return
    _set_asia_credentials_dialog_pending(True)
    try:
        root = get_app_root()
        if root:
            root.after(0, lambda: _show_credentials_dialog(default_region=default_region))
        else:
            _set_asia_credentials_dialog_pending(False)
    except Exception:
        _set_asia_credentials_dialog_pending(False)
