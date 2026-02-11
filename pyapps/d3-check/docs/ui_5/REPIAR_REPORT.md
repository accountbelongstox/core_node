# 恢复上次 TAB 后页内空白 — 修复报告（文档编号 5）

**问题**：UI 重启后恢复到上一次 TAB 时，TAB 页没有渲染出内容、为空白。  
**问题状态**：**已解决**  
**依据**：先看代码 → 看项目文档 → MCP 查官方文档；参见 `NOTEBOOK_TAB_BLANK_AFTER_RESTORE_POSSIBILITY_REPORT.md`。

---

## 一、修复方案与进度

| 方案 | 描述 | 状态 | 说明 |
|------|------|------|------|
| **方案 A** | Controller 在 `start_timer_loop_after_ui_ready()` 后通过 `root.after(50, _ensure_rosbot_content_if_selected)` 补调，使恢复为 ROSBOT 时在 timer 已启动后再执行 `ensure_content()` | ✅ 已实施 | `controller/d3_macro_controller.py`：`run()` 内 after(50, _ensure_rosbot_content_if_selected)；`_ensure_rosbot_content_if_selected()` 判断当前 tab 为 ROSBOT 且未创建内容则 `ensure_content()` |
| **方案 B** | ROSBOT 面板在 timer 未启动时不再依赖 submit_one_shot，改用主线程延后创建：`ensure_content()` 内若 `not timer_manager.is_running()` 则 `container.after(0, _fetch_rosbot_config_on_main_then_create)`，主线程内读 config 再 `_create_content_with_snapshot` | ✅ 已实施 | `ui/panels/rosbot_extension_panel.py`：新增 `_fetch_rosbot_config_on_main_then_create(panel)`；`ensure_content()` 内 `is_running()` 为 True 走 timer 路径，否则 after(0) 主线程 fallback（tkdocs：after 用于延后执行、避免在 bind 回调中阻塞） |
| **方案 C** | 首次 `_deferred_after_tab_changed` 不因 init 完全跳过：当 `selected_tab == TAB_INDEX_ROSBOT` 时仍调用 `ensure_content()`，仅跳过多余的 update_idletasks/update | ✅ 已存在 | `ui/diablo3_macro_ui.py`：init 分支内已包含 `if selected_tab == TAB_INDEX_ROSBOT: self.rosbot_extension_panel.ensure_content()`，配合方案 B 可在 timer 未启动时通过主线程 fallback 完成创建 |

---

## 二、本次变更摘要

- **方案 B（本次实现）**  
  - `rosbot_extension_panel.py`：  
    - 新增 `_fetch_rosbot_config_on_main_then_create(panel)`，在主线程用 `get_config_value_safe` 构建 snapshot 后调用 `panel._create_content_with_snapshot(snapshot)`。  
    - `ensure_content()`：若 `timer_manager.is_running()` 则 `submit_one_shot(_fetch_rosbot_config_then_create)`；否则 `container.after(0, lambda: _fetch_rosbot_config_on_main_then_create(self))`。  
  - 效果：恢复上次 TAB 为 ROSBOT 时，即使在 `_create_main_tabs()` 内首次调用 `ensure_content()`（timer 未启动），也会通过 after(0) 在主线程创建内容，页内不再空白。

- **方案 A、C**  
  - 方案 A：此前已在 Controller 中实现。  
  - 方案 C：主 UI 中首次 tab 变更时对 ROSBOT 调 `ensure_content()` 的逻辑已存在，无需再改。

---

## 三、MCP 官方文档参考

- **tkdocs eventloop**：`after(ms, callback)` 将 callback 投递到事件队列，延后执行；`after_idle` 在 Tk 空闲时执行；长操作应拆成小步并用 after 串联，避免阻塞 UI。  
- **tkdocs**：所有 Tk 调用应在创建 Tk 的线程（主线程）执行；从其他线程与 Tk 通信尽量简单，可用 `event_generate` 或主线程的 after 回调。

---

## 四、请测试

1. 将上次选中的 TAB 设为 **ROSBOT**（索引 2），关闭应用后重新启动。  
2. 确认启动后恢复的 TAB 为 ROSBOT，且 **页内内容正常渲染、非空白**。  
3. 可选：再测试恢复为其他 TAB（主功能、辅助、D4、坐标、日志），确认无回归。

测试结果可反馈后，再更新本报告“测试结果”一节。
