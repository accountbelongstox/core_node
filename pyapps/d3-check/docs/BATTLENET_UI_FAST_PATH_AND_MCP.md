# Battle.net UI 快速路径与 MCP 可行性

## 1. 当前实现：单次遍历快速路径

- **get_dynamic_state()**：当区域已确认为亚服(asia)或国服(cn)时，走 **get_dynamic_state_fast**（内部 `_get_dynamic_state_one_walk`）：
  - 只做一次控件树遍历，每个控件仅读取 `AutomationId` 和 `Name`（不取 BoundingRectangle、ControlTypeName、IsEnabled 等），不构建完整 control 列表。
  - 按前置条件与区域区分：**登录 → D3 Tab → Play**；亚服与国服使用不同的 automation_id/name 集合（见 `providor.constants.common` / `d3`、`battlenet_region_judge`）。
  - 用标志位判定：login_asia/login_cn、disconnect、connecting、d3_asia/play_asia、d3_cn/play_cn，再解析为 `(on_login_screen, disconnected, normal_available, play_button_name, connecting, region_detected)`。
- **区域未知时**（首次或 region=None）：仍使用原逻辑 `_enumerate_controls_light()` + `BattlenetRegionJudge.get_dynamic_state_result()`，以便正确检测 asia/cn。

## 2. 直接尝试操作元素（不先全量枚举）

- 已有 **按条件直接操作** 的入口：
  - **click_d3_tab()** / **click_play()**：内部用 `_enumerate_controls()` 一次，再按 automation_id/name 精确查找并点击（D3 与 D4 用 exact_match 区分）。
  - **try_close_popup()**：枚举后只找“弹窗关闭”按钮并点击，不点主窗口关闭。
- 流程上 **先判状态再操作**：如 BN flow 中先 `get_dynamic_state()`（现已在 region 已知时走单次遍历），再根据 on_login / normal_available 等决定是否调用 click_d3_tab、click_play、登录步骤等，符合“Play 需先 D3 Tab、D3 Tab 需先登录”的前置关系。
- 若未来要做“不枚举、直接按 id 找控件并点击”，可复用现有 **\_find_raw_control_by_automation_id** / **\_find_raw_control_matching**：它们已是按树遍历到第一个匹配即返回，不建完整列表；再配合 **operate_button** 等即可“直接尝试操作”，但当前流程仍依赖一次状态判定（至少一次轻量遍历）以区分登录/主界面/掉线。

## 3. MCP 扫描与可行性

- **当前项目内**：未接入任何可对“战网窗口 UI”做实时扫描的 MCP 服务；现有 MCP 多为代码库/文档/数据库等，无 Windows UI Automation 或 Win32 窗口树枚举能力。
- **若要通过 MCP 做战网 UI 扫描**，需要单独实现并接入一个 MCP 服务，例如：
  - 封装 **uiautomation**（或 Win32 `EnumChildWindows`/UI Automation API），对外提供“按 hwnd 枚举控件”“按 automation_id/name 查找”等工具；
  - 或封装“截图 + OCR/模板匹配”的 MCP，用于非 UIA 的辅助判断。
- **结论**：在未新增上述 MCP 服务前，无法“通过 MCP 扫描”替代当前 UIA 枚举；加速仍依赖本仓库内的单次遍历快速路径与按区域/前置条件的直接操作逻辑。后续若接入战网 UI 专用 MCP，可在该 MCP 中实现“按条件查找并返回控件或状态”，再由本仓库调用，以进一步减少本地枚举或实现“仅 MCP 扫描 + 直接操作”。

## 4. 亚服与国服 UI 差异（前置与操作顺序）

| 步骤       | 亚服(asia) | 国服(cn) |
|------------|------------|----------|
| 登录前     | 登录界面 (login-wrapper 等) | 同意条款 + 网易登录 (legalAcceptance, ntes) |
| 主界面     | D3 Tab (game-nav-btn-D3 等) + Play (play-btn 等) | D3 Tab (game-nav-btn-D3CN 等) + Play (开始游戏 等) |
| 操作顺序   | 先登录 → 再点 D3 Tab → 再点 Play | 同左 |

快速路径与现有 BN flow 均遵循上述顺序；get_dynamic_state 的解析逻辑与 `BattlenetRegionJudge` 一致，仅改为单次遍历 + 标志位解析以提升速度。
