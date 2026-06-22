# 战网国服/亚服 操作类与检测库 设计合理性审查

## 1. 整体架构

| 模块 | 职责 | 位置 |
|------|------|------|
| **BattlenetOperation** | 统一入口：启停/窗口/枚举控件、点击 D3/Play、国服登录流程、状态判断 | `d3utils/battlenet_operation.py` |
| **BattlenetAsiaOps** | 亚服专属：邮箱步、密码步（填 accountName/password + 点 Continue/Submit） | `d3utils/battlenet_asia_ops.py` |
| **BattlenetRegionJudge** | 单一真相源：当前是亚服/国服登录、主界面、掉线、连接中、检测到的 region | `d3utils/battlenet_region_judge.py` |
| **BattleNetManager** | 进程与窗口：路径、启动/关闭/重启、找窗、激活 | `d3utils/battlenet_manager.py` |
| **rosbot_flow_battlenet** | 流程编排：BN_Entry→…→BN_Confirmed，在适当时机调用上述能力 | `d3utils/rosbot_flow_battlenet.py` |

结论：**职责划分清晰**。Operation 做“能做什么”，Judge 做“当前是什么”，AsiaOps 做“亚服怎么做”，Manager 做“进程/窗口”，Flow 做“何时做”。无重复实现、无循环依赖。

---

## 2. 检测库（BattlenetRegionJudge）合理性

### 2.1 数据源与优先级

- **控件列表**：由 `BattlenetOperation._enumerate_controls()` 实时枚举，每次判断都基于当前 UI 树，无缓存，**合理**。
- **preferred_region**：来自 `ros_settings.battlenet_region_cache`（asia/cn），用于 `get_dynamic_state(preferred_region)`。先尝试 preferred，再 fallback 另一区，**符合“同一台机子通常固定区服”的假设**。

### 2.2 亚服 / 国服 判定逻辑

| 判定 | 依据 | 评价 |
|------|------|------|
| **亚服登录** | `LOGIN_WINDOW_AUTOMATION_ID_MARKERS_ASIA`（含 login-wrapper 等，不含 ntes）+ 邮箱步/密码步（accountName/password + submit） | 与国服（legalAcceptance + ntes）区分明确；先 automation_id 再 name，**合理**。 |
| **国服登录** | `LOGIN_WINDOW_AUTOMATION_ID_MARKERS`（含 legalAcceptance、ntes）+ `LOGIN_SCREEN_UI_KEYWORDS_STRICT` | 国服特有“同意条款 + 网易登录”，与亚服不重叠，**合理**。 |
| **主界面（已登录）** | 有 D3 标签 + Play 按钮，且**无**对应登录 markers | 用“无登录 UI”排除误判，**合理**。 |
| **掉线** | `BATTLE_NET_DISCONNECT_KEYWORDS`（Retry/重试） | 单一语义，**合理**。 |
| **连接中** | `BATTLE_NET_CONNECTING_KEYWORDS` | **合理**。 |

### 2.3 潜在问题与建议

1. **LOGIN_WINDOW_AUTOMATION_ID_MARKERS 与 ASIA 重叠**  
   - 国服含 `legalAcceptance`、`ntes`；亚服含 `legalAcceptance`、`connectAccounts`，不含 `ntes`。  
   - 若某亚服版本也出现 `legalAcceptance`，仅靠 markers 可能偏国服；但亚服还依赖“有 accountName/无 password”或“有 password+submit”的步骤判定，实际会走 `is_asia_email_step` / `is_asia_password_step`，**当前设计可接受**。若未来亚服 UI 与国服更相似，可考虑在 Judge 里显式“有 ntes → 必为国服”。

2. **Asia 特征从 JSON 加载**  
   - `_load_asia_features_from_docs_json()` 从 `docs/登陆后的战网元素.json` 抽 D3 tab / Play 的 automation_id 与 name，缺失时回退到 `app_constants` 的 `*_ASIA`。  
   - 优点：可随导出的 UI 更新而更新；缺点：与“国服 D3/Play 写死在 constants”不一致。若希望对称，可考虑国服也从同一或另一 JSON 加载；**非必须**，当前亚服动态、国服常量的分工是可接受的。

3. **detected_region 与 get_dynamic_state_result 一致**  
   - `get_dynamic_state_result()` 的第六元为 `region_detected`（asia/cn），与 `detected_region()` 同源（均来自 `_try_asia_result` / `_try_cn_result`），**无二义性**。

---

## 3. 操作类（BattlenetOperation / BattlenetAsiaOps）合理性

### 3.1 统一入口与委托

- 所有“当前是什么”的判断（含亚服邮箱/密码步）统一通过 `build_judge_from_controls(controls)`，Operation 只负责枚举控件、点击、国服流程。  
- 亚服具体动作委托给 `BattlenetAsiaOps`（接收 `BattlenetOperation` 引用），由 Operation 暴露 `_enumerate_controls`、`_find_raw_control_by_automation_id`、`click_control` 等，**无重复枚举、无反向依赖**，**合理**。

### 3.2 国服流程

- `perform_cn_login_flow()`：先勾选同意（`_ensure_agree_checkbox_checked`），再点网易登录（`_click_netease_login_button`），然后由流程侧轮询 OAuth（B11）。  
- 勾选逻辑：优先 TogglePattern，其次 GetCurrentPropertyValue(30096)，再 fallback 单次点击，**避免误双点取消勾选**，**合理**。

### 3.3 亚服流程（BattlenetAsiaOps）

- **邮箱步**：`accountName` + SetValue，再点 Continue（submit/Continue 名称关键词）。  
- **密码步**：`password` + SetValue，再点 submit（Log in）。  
- 每步前都 `is_on_asia_*_step(controls)`，避免在错误界面操作；**合理**。  
- 唯一可改进点：`perform_asia_password_step` 在未传 password 时仍会点 submit，用于“只点登录按钮”的场景，当前 flow 始终传 password，**保持现状即可**。

### 3.4 点击与控件查找策略

- **D3 标签 / Play 按钮**：先亚服（docs JSON 或 constants 的 Asia 列表），再国服 constants；先 automation_id，再 name。  
- 与 Judge 的“先 try_asia 再 try_cn”一致，**与检测库设计一致**。

### 3.5 其他状态与快照

- `is_login_failed_screen()`：要求同时存在“主要关键词”（Continue Offline/继续离线）和“次要关键词”（Cancel/取消），并排除 browser-wait 界面，**减少误判**。  
- `is_on_browser_login_wait_screen()`：仅用主文案（“使用浏览器完成登录”），**合理**。  
- `save_ui_elements_snapshot()`：按节点名写入 `bn_flow_*.json`，供调试与 login-failed 特征加载，**合理**。

---

## 4. 常量配置（app_constants）合理性

- **国服 / 亚服 分离**：CN 与 Asia 的 D3 tab、Play、登录界面关键词分组成对常量，**清晰**。  
- **LOGIN_WINDOW_AUTOMATION_ID_MARKERS**：国服多 `ntes`，亚服无 `ntes`，用于区分登录 UI 类型，**合理**。  
- 亚服登录：`accountName`、`password`、`submit` 及各类 name keywords 覆盖中英繁，**足够当前使用**。

---

## 5. 流程（rosbot_flow_battlenet）与各模块衔接

- **B4 (BN_First)**：先判 login_failed、browser_wait，再判 `is_on_login_screen() or is_on_asia_login_screen()`；任一为真则退出战网重走 B1→…→B7→B9→B10/BN_LoginAsia，**与 Judge 的“登录 vs 主界面”一致**。  
- **B13 (BN_Poll)**：`get_dynamic_state(_get_bn_preferred_region())` 得到 on_login / disconnected / normal_available 等；若 on_login 再细分 `is_on_asia_login_screen()` → BN_LoginAsia，否则 B10（国服），**与检测库、操作类分工一致**。  
- **BN_LoginAsia**：取 `get_asia_credentials()` → 若在邮箱步执行 `perform_asia_email_step(email)`，若在密码步执行 `perform_asia_password_step(password)`，然后转到 BN_UI 继续轮询，**逻辑正确**。

---

## 6. 总结表

| 维度 | 结论 | 说明 |
|------|------|------|
| 职责划分 | 合理 | Operation / Judge / AsiaOps / Manager / Flow 各司其职，无重叠实现。 |
| 检测库单一真相源 | 合理 | 所有“是亚服/国服/登录/主界面/掉线”均经 BattlenetRegionJudge。 |
| 国服 vs 亚服 区分 | 合理 | automation_id（含 ntes 等）与步骤语义（邮箱/密码/同意+网易）双重保障。 |
| 操作类委托与复用 | 合理 | 亚服动作集中在 AsiaOps，共用 Operation 的枚举与点击。 |
| 常量与可维护性 | 合理 | 亚服 D3/Play 可来自 JSON，国服为常量；可按需考虑国服也走配置。 |
| 流程与模块衔接 | 合理 | 流程只做编排，状态与动作均委托给 Judge 与 Operation/AsiaOps。 |

**总体结论：战网国服/亚服操作类与检测库的设计是合理的，可以保持现有结构；若后续亚服/国服 UI 变化，只需在 app_constants 或 docs JSON 中更新关键词与 automation_id，不必改架构。**
