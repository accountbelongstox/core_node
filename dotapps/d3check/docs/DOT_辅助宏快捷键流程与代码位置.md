# DOT 辅助宏快捷键流程与代码位置

本文档描述 DOT 端「辅助宏启停热键」的流程与代码位置，对照 [DOT_REF_辅助宏快捷键启动流程.md](../../pyapps/d3-check/docs/DOT_REF_辅助宏快捷键启动流程.md)。

---

## 1. 流程总览（DOT 当前）

| 步骤 | 说明 | DOT 实现状态 | 代码位置 |
|------|------|--------------|----------|
| 配置 | `macro_configs.auxiliary_config.assistant_hotkey` 默认 F3 | 已实现 | `ConfigKeys.AuxiliaryAssistantHotkey`；`D3CheckConfigService` 默认；`MainPanel` 读/写 `TxtAssistantHotkey` |
| UI 绑定 | 主面板「辅助宏启停热键」标签 + 热键输入框 | 已实现 | `MainPanel.xaml`：`LblAssistantHotkey` + `TxtAssistantHotkey`；i18n `MainFunctionsPanelMacroPauseHotkeyLabel` |
| 热键注册 | 启动时从 CONFIG 读 assistant_hotkey，规范化后注册 | 已实现 | `D3CheckHotkeyBinder.ReregisterAuxiliary()` 先 assistant 后 combat；`WindowsGlobalHotkeyService.Register` |
| 热键回调 | 若 is_running 则 set_should_stop；否则 can_start 则调用 RunAssistantAutoUse | 已实现 | `D3CheckHotkeyBinder.BuildAssistantCallback()`；状态来自 `IAssistantExecutionState` |
| 状态机 | is_running / should_stop / enabled；CanStart；ResetState | 已实现 | `D3CheckCore/IAssistantExecutionState.cs`，`AssistantExecutionState.cs` |
| RunAssistantAutoUse | 入口：set_running，执行 auto_use 流程，finally reset | **部分实现** | `MainWindow.RunAssistantAutoUse()`；Step 1/2 已实现（见下） |
| auto_use_interface_function 本体 | 截图 → 界面检测（左 30% bag/kanai）→ collect_bag → 铁匠/卡奈分支 | **部分实现** | Step 1：`D3AssistantCapture.TryCollectUiInfo()`；Step 2：`D3InterfaceDetection.DetectInterfaceTypeFromFullWindow()`（模板缩放 + 左 30%）；Step 3/4 为 stub |

---

## 2. DOT 代码位置速查

| 功能 | 文件 |
|------|------|
| 辅助宏热键配置键 | `Constants/ConfigKeys.cs`：`AuxiliaryAssistantHotkey` |
| 主面板热键框 | `Panels/MainPanel.xaml`：`TxtAssistantHotkey`；`MainPanel.xaml.cs` 读/写 `ConfigKeys.AuxiliaryAssistantHotkey`，LostFocus 保存并 `D3CheckConfigChangeHub.Notify(HotkeyConfigPathAuxiliary)` |
| 热键绑定与重绑 | `Hotkeys/D3CheckHotkeyBinder.cs`：`ReregisterAuxiliary()` 读 config，`ReregisterOne("assistant", ...)`；`BuildAssistantCallback()` 内 state 判断 + `_assistantCallback` |
| 状态机 | `D3CheckCore/IAssistantExecutionState.cs`，`AssistantExecutionState.cs` |
| 辅助宏入口 | `MainWindow.xaml.cs`：`RunAssistantAutoUse()`；OnLoaded 中 `_hotkeyBinder.SetAssistantCallback(RunAssistantAutoUse)`、`SetAssistantStateProvider(AssistantExecutionState.Instance)` |
| Step 1 截图/scale | `D3CheckCore/D3AssistantCapture.cs`：`FindD3WindowHandle()`（进程 "Diablo III"）、`TryCollectUiInfo()`（Gen(hwnd) + UpdateGlobalScale） |
| Step 2 界面检测 | `D3CheckCore/D3InterfaceDetection.cs`：`DetectInterfaceTypeFromFullWindow(..., debugAttempts)`；每次尝试打日志 `Attempting template: {name} path={path} exists={exists}`；可选收集 `InterfaceDetectionAttempt` 供 DEBUG 图 |
| DEBUG 截图 | `log_settings.show_debug_logs` 为 true 时：① 左 30% 区域 `debug_capture/autouse_debug_left30_*.png`；② 大图+小图+识别结果合成图（1:1 Python image_annotator_helper）`autouse_annotator_*.png` |
| 热键底层 | `DotCore.Utils/WindowsGlobalHotkeyService.cs`：RegisterHotKey；WM_HOTKEY → OnWmHotkey(wParam) → 按 id 调 callback；MainWindow 的 WndProc 转发 WM_HOTKEY |

---

## 3. 当前缺口（为何「没有任何功能」）

- **已对齐**：按 F3（或配置的 assistant_hotkey）→ 热键回调执行 → 若未运行且 CanStart 则调用 `RunAssistantAutoUse()`；若已在运行则 `SetShouldStop(true)`。UI 上「辅助宏启停热键」与 `assistant_hotkey` 绑定，修改后重绑。
- **Step 1 已实现**：查找 D3 窗口（`D3AssistantCapture.FindD3WindowHandle()`，按进程名 "Diablo III"）、截图（`ScreenCaptureService.Gen(hwnd)`）、更新全局 scale（`GameInterfaceData.UpdateGlobalScale`）。1:1 对应 Python collect_ui_info 链，见 DOT_REF §10。
- **Step 2 已实现**：界面类型检测 `D3InterfaceDetection.DetectInterfaceTypeFromFullWindow`：使用 `GameInterfaceData.GetGlobalScale()` 对模板图缩放，`TemplateMatcherService.Match` 匹配；匹配中心须在画面左 30%（`D3InterfaceConstants.LeftRegionRatio`）；先试 bag_opened_indicator（when wantBlacksmith）再试 kanai_cube_left_panel_indicator；模板目录 `D3TemplatePaths.GetTemplateDir()` 优先 `pyapps/d3-check/images` 否则 `AppBase/Templates`。每次尝试均打日志「Attempting template: {name} path={path} exists={exists}」，便于确认使用的识别图（smith/kanai）。DEBUG 模式下（`log_settings.show_debug_logs`）：① 保存左 30% 区域为 `autouse_debug_left30_*.png`；② 调用 `D3InterfaceDetectionDebugImage.SaveDebugImage` 生成大图+小图+识别结果合成图（与 Python `d3utils.d3u_common.image_annotator_helper` 的 save_match_debug_image / draw_match_result 一致），保存为 `autouse_annotator_*.png` 并打路径。
- **未实现**：Step 3 collect_bag_info_from_current_shared、Step 4 铁匠/卡奈分支。当前为日志 stub。

若要 1:1 实现完整功能，需在 DOT 中引入或实现：

- 游戏窗口截图与 UI 区域采集（等价 `D3InterfaceManager.collect_ui_info`）
- 全窗口图 + 模板匹配 + 左 30% 规则做界面类型检测（等价 `detect_interface_type_from_full_window`）
- 背包/界面信息采集（等价 `collect_bag_info_from_current_shared`）
- 铁匠/卡奈具体流程（等价 blacksmith_handler、run_kanai_*）

---

## 4. 小结

| 项 | DOT 状态 |
|----|----------|
| 辅助宏热键配置与 UI 绑定 | 已实现，与 Python 1:1 |
| 热键注册、重绑、回调、状态机 | 已实现，与 Python 1:1 |
| RunAssistantAutoUse 入口与状态 | 已实现 |
| auto_use 本体（截图/检测/铁匠/卡奈） | Step 1/2 已实现；Step 3/4 未实现，为 stub |

因此现象为：按 F3 会打印 "Assistant: Starting auto use..." 和 "Started (press hotkey again to stop)"，Step 1 截图/scale、Step 2 界面检测（含 DEBUG 截图路径）会执行并打日志；但**没有**铁匠/卡奈等自动化行为，因为 Step 3/4 尚未实现。
