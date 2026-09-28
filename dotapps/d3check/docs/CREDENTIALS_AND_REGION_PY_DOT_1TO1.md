# Account save/load, encrypt-decrypt, UI, and region (区服): PY ↔ DOT 1:1

Reference: **PY** `pyapps/d3-check/share/asia_credentials.py`, `pycore/pyutils/security/password_cipher.py`, `pycore/pyutils/security/machine_id.py`, `d3utils/battlenet_status_provider.py`, `ui/panels/rosbot_extension_panel.py`, `ui/components/bottom_bar.py`. **DOT** `dotapps/d3check/Config/AsiaCredentialsService.cs`, `D3CheckCore/Security/PasswordCipher.cs`, `D3CheckCore/Security/MachineIdProvider.cs`, `Windows/CredentialsDialog.xaml(.cs)`, `Pages/RosbotPage.xaml(.cs)`, `Constants/ConfigKeys.cs`, `MainWindow.xaml.cs` (bottom bar / region).

---

## 1. Config keys and storage format

| Item | PY | DOT |
|------|----|-----|
| Asia credentials | `battlenet_asia_credentials` (object `{ "email", "password" }`) | `ConfigKeys.BattlenetAsiaCredentials` = `"battlenet_asia_credentials"`, same object |
| CN credentials | `battlenet_cn_credentials` (object `{ "email", "password" }`) | `ConfigKeys.BattlenetCnCredentials` = `"battlenet_cn_credentials"`, same object |
| Password in config | Stored encrypted (machine-bound) or plain; decrypt on read | Same: `PasswordCipher.EncryptPassword` on save; `PasswordCipher.DecryptPassword` / `IsLikelyCiphertext` on read |
| Region cache | `ros_settings.battlenet_region_cache` ("asia" \| "cn") | `ConfigKeys.RosSettingsBattlenetRegionCache` |

---

## 2. Encrypt / decrypt (machine-bound)

| Item | PY | DOT |
|------|----|-----|
| Key derivation | `get_machine_id()` → SHA256 → base64url (32 bytes) | `MachineIdProvider.GetMachineId()` → SHA256 (32 bytes) |
| Machine ID source | Windows: Registry `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid`; fallback wmic csproduct uuid | Same: Registry `MachineGuid`; fallback wmic |
| Cipher | Fernet (AES-128-CBC + HMAC-SHA256); payload = `VERIFY_PREFIX + plain` ("VX" + plain) | `PasswordCipher`: Fernet-compatible (same token format); `VerifyPrefix = "VX"` |
| Optional prefix | `CIPHER_STORAGE_PREFIX = "ENC:"`; strip before decrypt | `PasswordCipher.CipherStoragePrefix = "ENC:"`; strip before decrypt |
| Save | `encrypt_password(plain)` → store ciphertext in config | `PasswordCipher.EncryptPassword(password)` → store in config |
| Read | `is_likely_ciphertext(s)` → `decrypt_password(s)` else use as plain | `PasswordCipher.IsLikelyCiphertext` → `DecryptPassword` else plain |

**Python modules:** `pycore/pyutils/security/password_cipher.py`, `pycore/pyutils/security/machine_id.py`.  
**DOT (公共类库):** `dotcore/DotCore.Utils/Security/PasswordCipher.cs`, `dotcore/DotCore.Utils/Security/MachineIdProvider.cs` (namespace `DotCore.Utils.Security`).

---

## 3. Credentials API (get / save / load for UI)

| Item | PY | DOT |
|------|----|-----|
| Get credentials (for login) | `get_credentials(region)` → `(email, password)` or None; decrypts password | `AsiaCredentialsService.GetCredentials(region)` → `(email, password)?`; decrypts |
| Save credentials | `save_credentials(region, email, password)`; encrypts password, writes config | `AsiaCredentialsService.SaveCredentials(region, email, password)`; same |
| Load for dialog (per region) | `_load_credentials_into_vars(region, var_email, var_password)`; decrypt then set UI vars | `AsiaCredentialsService.LoadCredentialsForUi(region)` → `(email, password)`; dialog calls when region changes |
| Region constants | `REGION_ASIA = "asia"`, `REGION_CN = "cn"` | `AsiaCredentialsService.RegionAsia`, `AsiaCredentialsService.RegionCn` |

---

## 4. Credentials UI (dialog)

| Item | PY | DOT |
|------|----|-----|
| Entry point | "Set account/password" button in ROSBOT page → `schedule_battlenet_credentials_dialog()` → `_show_credentials_dialog(default_region)` | `BtnSetAccountPassword` in RosbotPage → `CredentialsDialog(AsiaCredentialsService.RegionAsia)` modal |
| Dialog content | Region dropdown (Asia/CN), Account (email) entry, Password entry; OK / Cancel | Same: ComboRegion (Asia/CN), TxtEmail, TxtPassword (PasswordBox), OK / Cancel |
| On region change | `_load_credentials_into_vars(selected_region, var_email, var_password)` | `LoadRegionIntoFields(CurrentRegion)` via `AsiaCredentialsService.LoadCredentialsForUi(region)` |
| On OK | `save_credentials(current_region, email, password)` then close | `AsiaCredentialsService.SaveCredentials(CurrentRegion, email, password)` then close |
| i18n keys | `credentials.title`, `credentials.region_type`, `credentials.region_asia`, `credentials.region_cn`, `credentials.account`, `credentials.password` | `I18nKeys.CredentialsTitle` etc. (`ui.credentials.*`) |

**Python:** `share/asia_credentials.py` (`_show_credentials_dialog`, `_load_credentials_into_vars`).  
**DOT:** `Windows/CredentialsDialog.xaml` + `CredentialsDialog.xaml.cs`, `Panels/RosbotPanel.xaml.cs` (BtnSetAccountPassword_Click).

---

## 5. Region (区服) resolution and cache

| Item | PY | DOT |
|------|----|-----|
| Resolve region (no UI) | `ensure_battlenet_region_from_config()`: 1) read Battle.net.config (Services.LastLoginRegion) → "cn" or "asia"; 2) else `ros_settings.battlenet_region_cache` | `RosbotPanel.EnsureBattlenetRegionBeforeStart()` / `BattlenetRegionDetection.DetectRegion()` then cache; same logic |
| Set in game data | `game_data.set_battlenet_region(config_region)` | `GameInterfaceData.Instance.SetBattlenetRegion(region)` |
| Write cache | `set_config_value_async("ros_settings.battlenet_region_cache", config_region)` when read from file | `D3CheckConfigService.Instance.SetValueAsync(ConfigKeys.RosSettingsBattlenetRegionCache, region)` |
| Use in login | Asia flow uses `get_asia_credentials()` / `get_credentials("asia")`; region from config/cache | Asia flow uses `AsiaCredentialsService.GetCredentials(AsiaCredentialsService.RegionAsia)`; region from EnsureBattlenetRegionBeforeStart |

**Python:** `d3utils/battlenet_status_provider.py` (`ensure_battlenet_region_from_config`), `share/game_interface_data.py` (battlenet_region).  
**DOT:** `Panels/RosbotPanel.xaml.cs` (EnsureBattlenetRegionBeforeStart), `D3CheckCore/Battlenet/BattlenetRegionDetection.cs`, `Core/GameInterfaceData.cs`.

---

## 6. Where credentials are used (login flow)

| Flow | PY | DOT |
|------|----|-----|
| Asia login fill+submit | `login_try_screenshot_controller`: `get_asia_credentials()` → `perform_asia_login_fill_and_submit(email, password)` | `BattlenetLoginCtl.RunLoginFlowIfNeeded(region)`, `RosbotFlowController`: `AsiaCredentialsService.GetCredentials(RegionAsia)` → `PerformAsiaLoginFillAndSubmit(email, password)` |

---

## Summary

- **Config:** PY and DOT use the same top-level keys `battlenet_asia_credentials` and `battlenet_cn_credentials` with object `{ "email", "password" }`; password stored encrypted (or plain) with same semantics.
- **Cipher:** Machine-bound Fernet; same machine ID (Windows Registry MachineGuid), same VERIFY_PREFIX ("VX"), same optional "ENC:" prefix; DOT implements Fernet-compatible encrypt/decrypt so tokens are interoperable with Python where applicable.
- **UI:** Modal dialog with region (Asia/CN), account, password; load per region on change, save on OK; entry from ROSBOT page "Set account/password" button.
- **Region:** Resolved from Battle.net config file then `ros_settings.battlenet_region_cache`; used for credentials namespace (asia/cn) and for path/scan logic (see BOTTOM_BAR_PY_DOT_1TO1.md).
