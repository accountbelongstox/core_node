# DOT 战网账号/密码功能修复参考

**目的**：针对「战网账号与密码」在 DOT 端功能无效的现象，对照 Python 1:1 流程列出根因与修复项，供 DOT 端按项修复。

---

## 1. 现象与根因

### 1.1 可能表现

- 点击「设置账号密码」后填写并点 OK，流程（ROSBOT 启动 / 亚服登录）仍提示失败或无法自动填表。
- 或：未点击设置账号密码时，流程到亚服登录页直接失败，且 DOT 不弹出账号密码对话框。

### 1.2 根因对照（Python vs DOT）

| 项 | Python 行为 | DOT 当前 | 结论 |
|----|-------------|----------|------|
| **流程中缺少凭证时是否弹窗** | BN 流程需亚服登录时先 `get_asia_credentials()`；若为 `None` 则 `schedule_asia_credentials_dialog()` 并在本 tick 返回不推进，等用户关闭弹窗后下一 tick 再取凭证继续。 | B10a 前 `GetCredentials(RegionAsia)` 若为 null，直接传 null 给 `PerformAsiaLoginFillAndSubmit`，填表失败并 B5 退出；**从不从流程内弹出凭证对话框**。 | **缺 1:1：DOT 未在「缺凭证时调度弹窗并等待」**。 |
| 配置键 | `battlenet_asia_credentials` / `battlenet_cn_credentials` 顶层键，`get_config_value_safe` / `set_config_value_safe` 按键路径读写。 | `ConfigKeys.BattlenetAsiaCredentials` / `BattlenetCnCredentials` 同键名，`JsonKeyPathConfig` 按单段路径读写。 | 一致。 |
| 保存与退出刷盘 | `set_config_value_safe` 写内存后 `SAVE_QUEUE.put_nowait(None)`；退出时 save worker 写文件。 | `SetValueAsync` 写内存并 `QueueSave()`，`App_Exit` 调 `FlushPendingSave()`。 | 一致。 |
| 密码加解密 | `pycore.pyutils.security` 机器绑定加密；解密失败时 `get_credentials` 返回 None，流程可调度弹窗。 | `PasswordCipher` 机器绑定、Fernet 兼容；解密失败 `GetCredentials` 返回 null。跨机/重装后旧配置无法解密属预期。 | 一致。 |
| 对话框 UI | 主线程 `root.after(0, _show_credentials_dialog)`；`_asia_credentials_dialog_pending` 为 True 时 tick 跳过。 | 仅由 ROSBOT 面板按钮 `BtnSetAccountPassword_Click` 打开 `CredentialsDialog`，流程不调用。 | 缺「流程触发弹窗」逻辑。 |

**结论**：DOT 端「功能无效」的主要缺口是：**流程在需要亚服登录且凭证为空（或解密失败）时，没有像 Python 一样调度账号密码对话框并等待用户填写后再继续**；次要可能为解密失败（例如换了机器）或用户未先点「设置账号密码」即运行流程。

---

## 2. Python 端完整流程与代码位置（1:1 对照）

### 2.1 配置与常量

| 说明 | 文件与位置 |
|------|-------------|
| 配置键常量 | `share/asia_credentials.py`：`CONFIG_KEY_ASIA_CREDENTIALS = "battlenet_asia_credentials"`，`CONFIG_KEY_CN_CREDENTIALS = "battlenet_cn_credentials"` |
| 区域常量 | 同上：`REGION_ASIA = "asia"`，`REGION_CN = "cn"`；`_config_key_for_region(region)` 返回对应键 |
| 模板默认结构 | `providor/template_config.json`：顶层 `battlenet_asia_credentials`、`battlenet_cn_credentials` 对象 `{ "email", "password" }` |

### 2.2 凭证读写与弹窗

| 说明 | 文件与位置 |
|------|-------------|
| 读凭证（解密） | `share/asia_credentials.py`：`get_credentials(region)` → `get_config_value_safe(key, None)`，若为 dict 取 email/stored_password，`is_likely_ciphertext` 则 `decrypt_password`，否则明文；解密失败或空则返回 None |
| 写凭证（加密） | 同上：`save_credentials(region, email, password)` → `encrypt_password(password)`，`set_config_value_safe(key, {"email": email, "password": stored_password})` |
| 弹窗调度（主线程） | 同上：`schedule_battlenet_credentials_dialog(default_region)`；若 `_asia_credentials_dialog_pending` 已为 True 则直接 return；否则设为 True，`root.after(0, lambda: _show_credentials_dialog(default_region))`；`_show_credentials_dialog` 内 OK/Cancel/WM_DELETE 均 `_set_asia_credentials_dialog_pending(False)` 并 destroy |
| 弹窗 UI 与加载 | 同上：`_show_credentials_dialog`：区域下拉（i18n `credentials.region_type` / `region_asia` / `region_cn`）、账号、密码；`_load_credentials_into_vars(region, var_email, var_password)` 从 config 读并解密后填入控件；区域切换时重新 `_load_credentials_into_vars` |
| 对话框 pending 状态 | 同上：`is_asia_credentials_dialog_pending()`；tick 驱动在弹窗打开期间跳过 BN 块，避免重复弹窗 |

### 2.3 BN 流程中「缺凭证则弹窗并等待」

| 说明 | 文件与位置 |
|------|-------------|
| 亚服登录前检查凭证 | `d3utils/rosbot_flow_battlenet.py`：进入亚服登录逻辑时若 `is_asia_credentials_dialog_pending()` 为 True 则本 tick 直接 return（不推进）；否则 `creds = get_asia_credentials()`；若 `creds is None` 则 `schedule_asia_credentials_dialog()` 并 return，下一 tick 再执行时用户已可能填写并关闭弹窗，再取 `get_asia_credentials()` |
| 登录尝试控制器 | `controller/login_try_screenshot_controller.py`：同样 `is_asia_credentials_dialog_pending()` 为 True 则 return False；`creds = get_asia_credentials()`；若 None 则 `schedule_asia_credentials_dialog()` 并 return False |

### 2.4 面板按钮入口

| 说明 | 文件与位置 |
|------|-------------|
| 设置账号密码按钮 | `ui/panels/rosbot_extension_panel.py`：`_open_set_account_password` → `schedule_battlenet_credentials_dialog()`（默认亚服） |

### 2.5 Config 读写契约

| 说明 | 文件与位置 |
|------|-------------|
| 读 | `providor/providor_index.py`：`get_config_value_safe(key_path, default)` → CONFIG_QUEUE 投递 get，按 dot path 取 `_config_get_by_path(key_path, default)` |
| 写 | 同上：`set_config_value_safe(key_path, value)` 投递 set，`_config_set_by_path` 写 CONFIG；`save_config` 由 SAVE_QUEUE 触发，写 CONFIG_USER_PATH |

---

## 3. DOT 修复项（按 1:1 补齐）

### 3.1 必须修复：流程内在缺凭证时弹出对话框并等待（1:1 Python）

- **位置**：`Ctl/RosbotFlowController.cs`，B 块中进入 B10a（亚服登录填表）之前。
- **当前**：`var creds = AsiaCredentialsService.GetCredentials(AsiaCredentialsService.RegionAsia);` 若为 null 则 `PerformAsiaLoginFillAndSubmit(null, null)` 导致失败。
- **修复**：
  1. 若 `GetCredentials(RegionAsia)` 为 null（或 email/password 为空）：
     - 通过 **主线程** 调出 `CredentialsDialog`（与 Python 的 `schedule_battlenet_credentials_dialog` 等价：必须在 UI 线程 ShowDialog）。
     - 可选：维护一个「凭证对话框是否已打开」标志（1:1 Python `_asia_credentials_dialog_pending`），避免重复弹窗；在对话框关闭时清除。
  2. 弹窗关闭后，再次 `GetCredentials(RegionAsia)`；若仍为 null 则按当前逻辑 B5 退出并打日志（与 Python 一致：用户点取消或未填则本轮不继续）。
  3. 若不为 null，继续 `PerformAsiaLoginFillAndSubmit(email, password)`。
- **主线程调度**：DOT 无 `root.after(0, ...)`，需用 `IMainThreadDispatcher` 或 WPF `Dispatcher.Invoke` 在 UI 线程上 `ShowDialog()`，并在此处等待用户关闭对话框后再继续（例如用 `ShowDialog()` 的返回值或关闭事件，再在 flow 中重试取凭证）。若 flow 运行在非 UI 线程，需 `Invoke` 内执行 `ShowDialog()` 并阻塞直到关闭，再回到 flow 线程继续。

### 3.2 可选增强

- **解密失败提示**：当 `GetCredentials` 因解密失败返回 null 时，在弹窗或日志中提示「存储的密码无法解密，请在本机重新输入账号密码」。
- **FlushPendingSave 可靠性**：确认 `App_Exit` 中 `FlushPendingSave()` 一定执行（无提前进程终止），避免用户点 OK 后未正常退出导致未落盘。

### 3.3 已对齐、无需改动的部分

- 配置键名 `battlenet_asia_credentials` / `battlenet_cn_credentials` 与 Python 一致；`AsiaCredentialsService` 的 Get/Save/LoadCredentialsForUi 与 Python get/save/_load_credentials_into_vars 语义一致。
- `CredentialsDialog` 的 region 下拉、账号/密码、OK 保存到当前 region、Cancel 关闭，与 Python `_show_credentials_dialog` 一致。
- `PasswordCipher` 与 Python 机器绑定、Fernet 兼容；跨机不解密为预期行为。

---

## 4. 代码位置速查（DOT 端）

| 功能 | 文件 |
|------|------|
| 凭证服务 | `Config/AsiaCredentialsService.cs`（GetCredentials, SaveCredentials, LoadCredentialsForUi） |
| 凭证对话框 | `Windows/CredentialsDialog.xaml(.cs)`（区域、账号、密码、OK/Cancel） |
| 设置账号密码按钮 | `Panels/RosbotPanel.xaml.cs`：`BtnSetAccountPassword_Click` → `new CredentialsDialog(...).ShowDialog()` |
| B 块亚服登录填表 | `Ctl/RosbotFlowController.cs`：B9/B10a 处 `GetCredentials(RegionAsia)`、`PerformAsiaLoginFillAndSubmit` |
| 配置加载与退出刷盘 | `Config/D3CheckConfigService.cs`（Load, SetValueAsync, FlushPendingSave）；`App.xaml.cs`（App_Exit → FlushPendingSave） |
| 配置键常量 | `Constants/ConfigKeys.cs`（BattlenetAsiaCredentials, BattlenetCnCredentials） |

---

**总结**：DOT 端「战网账号与密码」功能无效的主要原因是**流程在需要亚服登录且凭证为空时没有像 Python 一样调度并等待账号密码对话框**。按 §3.1 在 B10a 前增加「缺凭证则主线程弹出 CredentialsDialog 并等待关闭后再取凭证继续」的逻辑，即可与 Python 1:1 对齐并修复该功能。
