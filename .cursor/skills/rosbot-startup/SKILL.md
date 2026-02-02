---
name: rosbot-startup
description: 实现或修改「启动ROSBOT」流程时须满足的要求；涉及 ensure_battlenet_started_and_login_check、_start_rosbot、run_after_rosbot_start、d3_start_game_and_teleport_waiter 等。详见 pyapps/d3-check/docs/ROSBOT_FLOW.md。
---

# 启动 ROSBOT 后的要求（要求文档）

在实现或编辑「启动 ROSBOT」相关代码时，必须满足以下要求。源文档：`pyapps/d3-check/docs/ROSBOT_FLOW.md`。

## When to Use

- 编辑或实现「启动ROSBOT」按钮后的完整流程（`ui/panels/rosbot_extension_panel._start_rosbot`、`_toggle_rosbot`）。
- 编辑或实现 `ensure_battlenet_started_and_login_check()` 及其内部步骤（战网 → Play → 轮询 D3 → resize → 开始游戏等待 → 游戏工具等待 → k ROSBOT → start → run_after_rosbot_start）。
- 编辑 `d3utils/d3_start_game_and_teleport_waiter.py`（开始游戏、游戏工具、M+三连点、掉线检测与从中间继续）。
- 编辑 `d3utils/rosbot_ui_automation.py`（等 ROSBOT 窗口、点主档案、点 Start botting!）。
- 编辑 `d3utils/rosbot_manager.py`、`d3utils/rosbot_task_processor.py` 与启动顺序编排。
- 修改与「开始游戏」/「游戏工具」超时、战网重启重试、ROSBOT 启动时机相关的逻辑。

## Instructions（必须遵守的要求）

### 1. 启动顺序规则

- **顺序不可乱**：战网启动并登陆 → 暗黑3启动 → ROSBOT 启动。
- 在「启动 ROSBOT」面板执行 Step 1～4（更新 UI、启用 rosbot_task、`start_rosbot_task()`、打日志）**之前**，必须先执行 **`ensure_battlenet_started_and_login_check()`**。

### 2. 第一步内：点击 Play 之后

- 点击战网 **Play** 之后：**先 sleep(5)**，等 D3 稳定。
- **轮询 D3 窗口** 最多 10 秒：`WindowFinder.find_windows_by_titles(DIABLO_III_WINDOW_TITLES, use_cache=True)`。
- **一旦找到 D3 窗口**，按顺序执行：
  1. `get_game_interface_data().set_d3_status(True)`
  2. **resize D3 窗口** 到标准 **1300×800**（`resize_window_by_titles_to_client_size`）
  3. **D3 内「开始游戏」等待**：`wait_for_and_click_start_game()`，每 2 秒对 D3 截图、SIFT 匹配 `d3_start_game_button`，最多 `D3_START_GAME_MAX_ATTEMPTS` 次（默认 10×2s），找到则点击并 wait 2 秒
  4. **游戏工具等待**：每 2 秒截图直到出现 `d3_game_tool`（最多 `D3_GAME_TOOL_MAX_ATTEMPTS` 次，默认 10×2s），然后对 D3 窗口 **发送 M 键**，再按 1300×800 基准比例在 **`D3_GAME_TOOL_CLICK_STANDARD`**（如 (602, 94) 或 (602, 113)，以 `providor.app_constants` 为准）点击
  5. 若 ③ 或 ④ **超时未找到**：调用 **`_restart_battlenet_and_retry_from_step1(bn_path)`**（重启战网、等 5s），然后 **continue 外层重试**（最多 `max_outer_retries` 轮）；**不得**在未完成「开始游戏」+「游戏工具」流程前启动 ROSBOT
  6. 若 **成功**：`get_rosbot_manager().kill_if_running()`
  7. **sleep(1)**
  8. 若配置 **`ros_settings.auto_start_rosbot`** 为真，则 **`get_rosbot_manager().start()`**
  9. **`start_rosbot_task()`**
  10. **`run_after_rosbot_start()`**：等 ROSBOT 窗口、DEBUG 打印可操作元素、点「主档案」、点「Start botting!」

### 3. 状态与掉线检测

- **状态1（完整流程）**：战网 → 点小图 → 点 Play → sleep(5) → 轮询 D3 → resize → `wait_for_and_click_start_game`（及游戏工具、M+三连点）→ k ROSBOT → start → `start_rosbot_task()` → `run_after_rosbot_start()`。
- **状态2、3（掉线检测）**：D3 已运行时先 `detect_d3_already_running_state()` 一次截图；有「开始游戏」或已有 game_tool 视为没掉线。没掉线则**回到状态1的流程、从中间处继续**（如从「点开始游戏→等 game_tool→M+三连点」或从「已在游戏中→M+悬赏检测+三连点」）。检测不到或继续失败则视为掉线，kill D3 后走战网流程。

### 4. ROSBOT UI 自动化调用时机

- **`run_after_rosbot_start()`** 必须在 **D3 开始游戏并传送地图** 成功之后、**`get_rosbot_manager().start()`** 与 **`start_rosbot_task()`** 之后调用。
- 内容：等 ROSBOT 窗口出现（`ROSBOT_WINDOW_TITLES`）→ 激活窗口 → DEBUG 打印可操作元素 → 点击「主档案」Tab → 点击「Start botting!」。异常仅打 Yellow 日志。

### 5. 常量与配置

- 时间、次数、坐标等字面常量放在 **`providor.app_constants`**（如 `D3_START_GAME_MAX_ATTEMPTS`、`D3_GAME_TOOL_MAX_ATTEMPTS`、`D3_GAME_TOOL_CLICK_STANDARD`）；不要在各模块内硬编码。

### 6. 流程简图（供对照）

```
[用户点击「启动ROSBOT」] → _toggle_rosbot → _start_rosbot
  → ensure_battlenet_started_and_login_check() 为先
  → sleep(5) → 轮询 D3 最多 10 秒
  → 找到 D3 → set_d3_status(True) → resize → 开始游戏等待 → 游戏工具 → M+点击
  → kill_if_running() → sleep(1) → [若 auto_start_rosbot] start() → start_rosbot_task() → run_after_rosbot_start()
  → set_task_status('rosbot_task', ENABLED) → RosbotTaskProcessor.start_rosbot() → UI 更新
```

实现或修改上述任一步骤时，以本要求文档与 `docs/ROSBOT_FLOW.md` 为准，保持顺序与条件一致。
