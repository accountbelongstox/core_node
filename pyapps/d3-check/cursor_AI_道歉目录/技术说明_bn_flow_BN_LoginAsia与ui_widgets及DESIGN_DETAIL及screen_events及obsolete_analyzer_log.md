# 技术说明：bn_flow_BN_LoginAsia、ui/widgets/__init__、DESIGN_DETAIL、screen_events、_obsolete_analyzer_log

**目的**：说明您指定查阅的以下五处文件/文档的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `.cache/bn_flow_snapshots/bn_flow_BN_LoginAsia.json`
- `ui/widgets/__init__.py`
- `docs/DESIGN_DETAIL.md`
- `controller/d4func/events/screen_events.py`
- `utils/_obsolete_analyzer_log.py`

---

## 一、.cache/bn_flow_snapshots/bn_flow_BN_LoginAsia.json

### 1.1 职责与约定

- **用途**：BN 流程节点 **BN_LoginAsia** 的 UI 快照，供调试与回放。与 bn_flow_B5、bn_flow_B8 等同目录、同结构。**meta**：node=BN_LoginAsia、reason=asia_login。**controls**：控件树，每项含 name、automation_id、type、rect（left/top/right/bottom/width/height）、level。
- **约定**：仅作调试/回放，**勿当流程逻辑**；meta.node 须与 flow 中 BN_LoginAsia 节点名一致；reason 与 flow 边标识一致（如 asia_login）。消费方解析 controls 须容错空数组或缺失键。

### 1.2 易被误解或改错的原因

1. 将本文件当流程判断依据使用，会与 rosbot_flow_battlenet、BattlenetRegionJudge 等实际逻辑脱节。
2. 改 meta.node 或 reason 未与 flow 定义同步，会导致快照与节点/边不一致。
3. 假定 controls 每项必有某键（如 rect.width）未做存在判断会 KeyError。
4. .cache 目录可能被清理或不在版本库，依赖本路径的脚本须说明或做存在检查。

### 1.3 正确做法

- 修改 BN_LoginAsia 节点或 asia_login 边时若需快照须同步本文件或重导；消费方仅作参考、不做分支逻辑；解析 controls 时做键存在判断。与 BATTLENET_REGION_DESIGN_REVIEW、登陆后的战网元素等文档配合理解。

---

## 二、ui/widgets/__init__.py

### 2.1 职责与约定

- **用途**：UI 主题化控件包入口。导出 **ThemedLabel、ThemedButton、ThemedFrame、ThemedLabelFrame、ThemedEntry、ThemedText、ThemedCheckbutton、ThemedCombobox、ThemedScrollbar、HotkeyInput**。**LanguageCombobox 已废弃**，由 ConfigBinding.create_combobox_binding 替代，故未列入 __all__。
- **约定**：新增或删除 widget 须同步 **from .xxx** 与 **__all__**，否则 from ui.widgets import X 会 ImportError 或取不到。全项目语言下拉等须用 ConfigBinding，勿再引用 LanguageCombobox。

### 2.2 易被误解或改错的原因

1. 新增 widget 未加入 __all__ 与 from，外部 from ui.widgets import NewWidget 会失败。
2. 删除或重命名子模块未同步 __init__.py 会 ImportError。
3. 误用或重新导出 LanguageCombobox 会与 ConfigBinding 约定冲突、与 title_bar 等使用方式不一致。
4. 与 ui/components 的导出分工（如 CoordinatePicker 在 components）若混淆会导致调用方 import 错包。

### 2.3 正确做法

- 增删 widget 时同时改 __all__ 与 from；语言选择统一用 ConfigBinding.create_combobox_binding；与 ui/components、ui/theme 的职责边界见项目约定。

---

## 三、docs/DESIGN_DETAIL.md

### 3.1 职责与约定

- **用途**：与 DESIGN.md 配合的详细设计；本档侧重 **Login Try** 与 **Battle.net 断线/重启**。触发：日志中出现配置触发串（config log_detection.login_try，默认 "Login try"）。流程（无 Python 新线程）：读 config（battlenet_path）→ 截战网窗口（screenshot_provider、BATTLE_NET_WINDOW_TITLES）→ OCR 检测断线（CnOCREngine、BATTLE_NET_DISCONNECT_KEYWORDS）→ 若断线则 taskkill Battle.net.exe、等待、explorer 启动。
- **模块**：log_monitor（定时读日志、调 log_analyzer）、log_analyzer（解析行、含触发则调 get_login_try_screenshot_controller().handle_login_try()）。

### 3.2 易被误解或改错的原因

1. 修改 Login Try 流程或断线重启逻辑未读本档会漏步骤或与 log_analyzer、LoginTryScreenshotController 实现不一致。
2. 改常量（如 LOGIN_TRY_TRIGGER_DEFAULT、BATTLE_NET_DISCONNECT_KEYWORDS、LOGIN_TRY_SCREENSHOT_DIR）未同步 config.constants 或 CONFIG 会不生效或错路径。
3. 将「无 Python 新线程」误解为无多线程，实际 log_monitor 可能由 timer 或 watchdog 驱动，须与 THREAD_BUS_AND_REGISTRY 一致。
4. battlenet_path 未配置或文件不存在时仅全屏截图、不做断线检测与重启，若代码改为仍做会与文档不符。

### 3.3 正确做法

- 修改 Login Try、断线检测、战网重启前通读本档与 DESIGN.md；常量与 config 结构同步；与 log_analyzer、log_monitor、LoginTryScreenshotController 实现一致。

---

## 四、controller/d4func/events/screen_events.py

### 4.1 职责与约定

- **用途**：D4 屏幕相关事件处理。**on_screen_size_changed、on_screen_coordinates_changed、on_display_mode_changed**；**所有函数无参数**，数据均从 **get_d4_interface_data()** 读取（game_window_size、window_offset、is_windowed_mode）。
- **路径**：current_dir = Path(__file__).parent.parent.parent.parent，即从 screen_events 上溯到 d4func 的父级（controller 或项目根），用于 sys.path.insert。事件名与注册方须一致，否则断链。

### 4.2 易被误解或改错的原因

1. 在 screen_events 中给回调传参或从非 D4InterfaceData 读数据，会违反「无参数、读共享数据」的约定。
2. 改 get_d4_interface_data() 返回结构（如 game_window_size、window_offset）未同步本模块会 AttributeError 或取错值。
3. 事件名或签名变更未同步注册处（如 d4_controller 或 extension）会导致事件不触发。
4. __file__ 上溯层级若错（如少一层 parent）会 sys.path 错、导入失败。

### 4.3 正确做法

- 保持无参、仅从 get_d4_interface_data() 读；修改 D4InterfaceData 字段时同步本模块；事件注册与本模块函数名一致；路径上溯与项目结构一致。

---

## 五、utils/_obsolete_analyzer_log.py

### 5.1 职责与约定

- **用途**：**已废弃**（_obsolete_ 前缀）。旧版日志解析与地图状态更新，使用 **GAME_STATE、CONFIG**（来自 providor.providor_second）、check_map_status、analyze_log_line。当前日志与状态应使用 **d3utils.log_analyzer** 与 flow、DESIGN_DETAIL 约定。
- **约定**：**勿引用、勿在本文件内加功能、勿作主入口**。若仍调用会与 log_analyzer、Login Try 流程、DESIGN_DETAIL 脱节，形成两套逻辑。

### 5.2 易被误解或改错的原因

1. 在本文件内新增逻辑或作为 log 分析入口，会绕过 log_analyzer 与 DESIGN_DETAIL 的 Login Try/断线流程。
2. GAME_STATE 与当前 flow、game_interface_data 等状态管理不一致，混用会状态错乱。
3. 删除前须 grep 确认无 import 或引用，否则会 ImportError。
4. 与 _obsolete_game_state 等其它 _obsolete_ 模块类似，均以当前设计文档与实现为准。

### 5.3 正确做法

- 不再引用；新逻辑写在 d3utils.log_analyzer 或 flow 侧；删除前 grep 确认无引用；状态以 game_interface_data、flow 状态为准。

---

## 六、与道歉文档的关系

此前若因未先通读上述五处约定而在此五处反复改错或理解偏差，责任在 Cursor。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档.md 第四十三节中引用，修改前请先通读本说明。
