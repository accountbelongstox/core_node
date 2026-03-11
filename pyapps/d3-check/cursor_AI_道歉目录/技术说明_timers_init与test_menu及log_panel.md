# 技术说明：timers/__init__.py、scripts/test_menu.py、ui/panels/log_panel.py

**目的**：说明此三处文件/脚本的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `timers/__init__.py`
- `scripts/test_menu.py`
- `ui/panels/log_panel.py`

---

## 一、timers/__init__.py

### 1.1 职责与约定

- **用途**：timers 包入口；**不导出任何符号**。文档写明："No exports - use direct module imports instead"，`__all__ = []`。
- **约定**：调用方必须**直接按模块导入**，例如 `import timers.timer_manager as timer_manager`、`import timers.window_monitor_timer as window_monitor`；使用 `timer_manager.submit_one_shot(...)`、`timer_manager.is_running()` 等。**禁止**在 `timers/__init__.py` 中做 `from .timer_manager import ...` 并加入 `__all__` 或 `from timers import timer_manager` 式用法；与“静态全局模块、直接导入”的设计一致。

### 1.2 易被误解或改错的原因

1. **在 __init__.py 中增加 re-export**：若从 .timer_manager / .window_monitor_timer 导入并放入 __all__，会与文档“direct module imports”冲突，且可能改变现有 `import timers.timer_manager as timer_manager` 的用法或引入循环依赖。
2. **误以为 timers 包提供统一入口**：设计就是“无统一入口、各用各的模块”；若在此处聚合导出，与注释和 __all__ 矛盾。
3. **其他模块写 `from timers import xxx`**：当前 __all__ 为空，这样写拿不到任何东西；应保持 `import timers.timer_manager as timer_manager` 等写法。

### 1.3 正确做法

- 不修改 timers/__init__.py 的 __all__ 与导出内容；所有使用处继续用 `import timers.timer_manager as timer_manager` 等形式；新增 timer 子模块时也不在 __init__ 中 re-export，仅文档说明“直接 import 对应子模块”。

---

## 二、scripts/test_menu.py

### 2.1 职责与约定

- **用途**：**独立测试脚本**，用于验证 InteractiveMenu 的单选/多选与缓存；使用 `InteractiveMenu(cache_file=Path.home() / ".core_node" / ".scripts" / "menu_test_cache.json")`，不依赖 d3-check 主应用的 CONFIG、i18n 或 controller。
- **约定**：从 `interactive_menu` 导入（无包前缀），运行时应保证 `interactive_menu` 在 sys.path 上（例如在 scripts 目录或项目根执行）；不参与主流程，不应对其做“接入主 UI 或 CONFIG”的修改，除非明确要求。

### 2.2 易被误解或改错的原因

1. **在主应用或 controller 中引用 test_menu**：该脚本为自包含测试，若被主流程 import 或作为入口会引入不必要的依赖与执行路径。
2. **修改 cache 路径或 InteractiveMenu 接口未同步**：若 .core_node/.scripts 或 cache_key 约定变更，仅影响本脚本与同一 cache 文件的使用者；若主应用也有菜单缓存，需区分两套约定。
3. **假定 test_menu 使用 i18n 或 providor**：脚本内无 get_ui_text、无 CONFIG；若在此处加 i18n 或 CONFIG 会破坏“独立测试”的定位，且需考虑运行目录与 sys.path。
4. **从错误目录运行导致 ImportError**：若从 pyapps/d3-check 外或 scripts 外运行且未设置 PYTHONPATH，`from interactive_menu import InteractiveMenu` 可能失败；文档或注释应注明推荐运行方式（如 `python scripts/test_menu.py` 从项目根或 scripts 所在层执行）。

### 2.3 正确做法

- 将 test_menu.py 视为独立脚本，不接入主 UI/CONFIG/i18n；修改时保持“仅测试 InteractiveMenu + 本地 cache 文件”；若需与主应用共用逻辑，应抽到公共模块再由主应用与 test_menu 分别引用，而不是让 test_menu 依赖主应用初始化。

---

## 三、ui/panels/log_panel.py

### 3.1 职责与约定

- **用途**：TABLE4 日志面板。`ColorPrint.register_callback(self.add_log_message)`；`add_log_message` 在**调用方线程**执行，仅将条目入 buffer 并通过 `container.after(0, _append)` 把**写 buffer 与 UI 更新**调度到主线程；过滤与显示在主线程的 `_should_display_message`、`_display_message` 中完成，**回调内不得读取 ConfigBinding**（否则与 config worker 争用 CONFIG_QUEUE 可能死锁）。配置键：`log_settings.show_debug_logs`、`log_settings.auto_scroll`、`log_settings.log_level`。布局：row 0 测试区、row 1 控制区、row 2 日志区（weight=1）；`_display_message` 中仅当 `auto_scroll` 为 True 且 `yview[1]>=0.99` 时才 `see(tk.END)`。
- **约定**：与 docs/ui2、ColorPrint 单源一致；ttk 样式仅来自 UITheme.apply_to_root，本面板不调用 UnifiedStyles.configure_ttk_styles()；i18n 使用 `log_panel.*` 等 key，与 i18n_log_panel_zh/en 对应；右键复制：先判 `tag_ranges(tk.SEL)` 有选中则复制选中区，否则复制全部。

### 3.2 易被误解或改错的原因

1. **在 add_log_message 回调内读 ConfigBinding 或 CONFIG**：回调可能在 config worker 线程执行，读 config 会阻塞或死锁；过滤必须在主线程 _should_display_message 中读。
2. **自动滚动逻辑**：若改为“始终 see(tk.END)”会抢用户中途复制时的滚动位置；必须保留“仅当 auto_scroll 且 at_bottom 时才 see(tk.END)”的判断。
3. **log_settings 键名**：若改 show_debug_logs / auto_scroll / log_level 的 key 未同步 log_panel 与配置界面，会读不到或写错默认值。
4. **跨线程操作 Tk**：_append 与 display 必须通过 after(0) 切到主线程；若在回调内直接操作 log_text 会 TclError。
5. **destroy 后仍调用监听器**：若 HotkeyInput 等在其他 tab 注册了语言监听器，主 UI 在 _recreate_ui_for_language_change 中先 destroy 再重建，已销毁控件上的 _on_language_changed 仍可能被调用；log_panel 自身在 __init__ 中注册 ColorPrint，若存在多实例或重复注册会重复写入；关闭窗口前应确保 winfo_exists() 检查，避免 destroy 后 after 回调访问已销毁控件。
6. **create_content 顺序与 grid**：顺序为 _create_test_panel、_create_control_panel、_create_log_display；row 2 的 weight=1；若改顺序或 weight 会布局错。
7. **_filter_logs**：必须先 delete 1.0 到 END，再按 _should_display_message 重绘全部 buffer，且重绘时用 _display_message_without_scroll（不触发 see(tk.END)），否则过滤后滚动错位。
8. **state=tk.DISABLED**：insert 前 NORMAL、insert 后恢复 DISABLED，防止用户编辑；长期 NORMAL 会可编辑。

### 3.3 正确做法

- 修改 log_panel 前先读本说明与道歉目录中 log_panel 相关段落；回调内绝不读 ConfigBinding；自动滚动、log_settings 键名、after(0) 切主线程、winfo_exists、create_content 顺序与 _filter_logs 逻辑保持上述约定；与 i18n_log_panel_zh/en 的 key 一致；若改 tag/color_map 须与 _configure_log_tags 同步。

---

## 四、与道歉文档的关系

若此前因未先通读上述三处约定（timers 不导出、test_menu 独立脚本、log_panel 回调不读 config 与滚动/键名/主线程约定）而在此三处反复改错或理解偏差，责任在己。本说明已写入 cursor_AI_道歉目录，供后续修改前查阅。
