# 技术说明：system_tray、left_pixels_sample、hotkey_input、i18n_common_zh

**目的**：说明此四处文件/数据的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `ui/components/system_tray.py`
- `athtest/left_pixels_sample.json`
- `ui/widgets/hotkey_input.py`
- `providor/i18n/i18n_common_zh.json`

---

## 一、ui/components/system_tray.py

### 1.1 职责与约定

- **用途**：系统托盘组件，Windows 10/11。**图标与 run() 在托盘线程内创建并执行**，以便 Windows 消息循环与拥有图标的线程一致（图标可见性要求）。继承 threading.Thread，daemon=True，name="TrayRunner"。run() 内：pythoncom.CoInitialize()（若可用）、_create_icon_image()、i18n_manager.get_ui_text("system_tray.show_software" 等)、pystray.Menu/MenuItem、pystray.Icon("D3Check", ...)、icon.run()。菜单项回调 _show_window、_maximize_window、_restart_application、_exit_application 优先使用 runtime 的 trigger_window_show/trigger_window_maximize/trigger_app_restart/trigger_app_exit，否则 fallback 到 parent_ui.root。
- **约定**：set_show_callback/set_exit_callback 为 **no-op**（托盘通过 event center 的 trigger_window_show/trigger_app_exit 通信，不接外部 callback）。update_tooltip 设置 icon.title；show_notification 调用 icon.notify(message, title)。TRAY_AVAILABLE 取决于 pystray、PIL Image/ImageDraw 是否可用。stop() 时 icon.stop()、sleep(0.15)、清空 tray_icon。

### 1.2 易被误解或改错的原因

1. **在主线程创建 Icon 或调用 icon.run()**：文档明确 Icon 须在托盘线程内创建与 run，否则 Windows 上图标可能不显示或消息循环错线程。
2. **在 set_show_callback/set_exit_callback 内实现逻辑**：两方法为 no-op，若在此写回调逻辑不会被执行；应通过 event center 的 trigger_* 与主线程通信。
3. **未在 run() 内调用 pythoncom.CoInitialize()**：在 Windows 上 pystray/COM 可能需先初始化，否则托盘或通知异常。
4. **修改 _create_icon_image 的尺寸或绘图逻辑**：当前 64x64 RGBA、椭圆与矩形固定坐标，若改尺寸未同步 pystray 可能显示异常。

### 1.3 正确做法

- 不在此线程外创建或 run Icon；不依赖 set_show_callback/set_exit_callback 做逻辑；新增菜单项或文案时同步 i18n 键与 i18n_common_zh（如 system_tray.*、main_window.title）。

---

## 二、athtest/left_pixels_sample.json

### 2.1 职责与约定

- **用途**：**athtest 左侧像素采样结果**的示例 JSON。结构：success、file_path（绝对路径）、image_info（original_size、processed_size width/height、channels、format、mode）、regions（region、region_info：coordinates x1/y1/x2/y2、width、height、total_pixels；processing_info：deduplicated、unique_colors、color_tolerance、sampling_strategy、requested_sample_size、actual_sample_size）、hex_pixels 数组（{color, x, y}）、color_frequency（unique_colors、most_frequent 含 rgb/hex/count/percentage）。本例 region 为 "left"，processed_size 146x11，hex_pixels 为去重后采样点。
- **约定**：消费方可能依赖 success、file_path、regions.region、region_info.coordinates、hex_pixels、color_frequency；file_path 为绝对路径；若采样策略或去重逻辑变更，hex_pixels 长度与 actual_sample_size 会变；新增 region 或改 processing_info 字段须与生成脚本及消费方同步。

### 2.2 易被误解或改错的原因

1. **误当配置或模板改 coordinates/hex_pixels**：本文件为某次采样产出，改 JSON 不影响下次采样结果，除非消费方直接读此文件且不重新生成。
2. **假定 file_path 可移植**：路径为绝对路径（如 D:\programing\...），跨机或移动项目会失效。
3. **假定 hex_pixels 长度等于 requested_sample_size**：示例中 requested_sample_size 1000、actual_sample_size 370（去重后），若代码假定长度 1000 会越界或逻辑错。
4. **改 regions 结构未同步消费方**：若增加或删除 region_info 内字段，解析方可能 KeyError 或取错值。

### 2.3 正确做法

- 视本文件为 athtest 采样产出示例；消费时用 actual_sample_size 或 len(hex_pixels)；路径作参考时注意不可移植；修改产出结构时同步生成脚本与所有读取方。

---

## 三、ui/widgets/hotkey_input.py

### 3.1 职责与约定

- **用途**：热键输入控件，继承 tk.Entry。**KEY_NAME_I18N_MAP** 将 tk 键名（Control_L、Shift_L、space、Return 等）映射到 i18n 键（ctrl、shift、space、enter 等），显示时用 i18n_manager.get_ui_text("hotkey_input.keys." + i18n_key)。占位符用 get_ui_text("hotkey_input.placeholder")。**state='readonly'**，仅通过按键捕获输入；Escape/Delete 清空热键；修饰键顺序为 ctrl、shift、alt、win。_apply_high_contrast_styling 内注册 i18n_manager.add_language_change_listener(self._on_language_changed)。_on_language_changed 中若 current_value 为 "Press hotkey..." 或空则 _set_placeholder()，**"Press hotkey..." 为英文占位符硬编码**，与 i18n_common_zh 的「按下热键...」不一致，语言切换后可能判断不准确。
- **约定**：新增修饰键或特殊键须同时更新 KEY_NAME_I18N_MAP 与 i18n 的 hotkey_input.keys.*；placeholder 与 key 名由 i18n_common_zh（或当前语言）提供；比较占位符时应用 get_ui_text("hotkey_input.placeholder") 或存储当前 placeholder 再比较，避免硬编码 "Press hotkey..."。

### 3.2 易被误解或改错的原因

1. **在 KEY_NAME_I18N_MAP 增键未在 i18n 增 hotkey_input.keys.xxx**：会 fallback 到 key 或 ui_key，显示非预期。
2. **改 state 为 normal**：控件设计为 readonly 仅接受按键捕获，若改为可编辑会破坏热键捕获语义。
3. **_on_language_changed 仅判 "Press hotkey..."**：当前语言为中文时 placeholder 为「按下热键...」，硬编码 "Press hotkey..." 会导致语言切换后占位符恢复逻辑不触发或误触发。
4. **修饰键顺序与 KEY_NAME_I18N_MAP 或 modifier_order 不一致**：显示顺序会乱；hotkey_parts 顺序须与 modifier_order 一致。

### 3.3 正确做法

- 增键时同步 KEY_NAME_I18N_MAP 与 i18n；占位符判断用 get_ui_text("hotkey_input.placeholder") 或与当前 placeholder 比较；保持 state='readonly' 与修饰键顺序约定。

---

## 四、providor/i18n/i18n_common_zh.json

### 4.1 职责与约定

- **用途**：中文 UI 文案。顶层 **ui**（buttons、messages、options、skills、image_display、**hotkey_input**：placeholder、keys.ctrl/shift/alt/win/space/enter/…）、**gui_menu**（open_web、restart、exit）。i18n_manager.get_ui_text(key) 会补前缀 "ui."，故 get_ui_text("hotkey_input.placeholder") 解析为 ui.hotkey_input.placeholder，对应本文件 ui.hotkey_input.placeholder。
- **约定**：新增 UI 文案须在对应语言 JSON 中加键，键路径与 get_ui_text 参数一致（不含 "ui." 前缀时自动补）；hotkey_input.keys.* 与 hotkey_input.py 的 KEY_NAME_I18N_MAP 的 i18n_key 对应；改键名或层级须同步所有 get_ui_text 调用处；gui_menu 与 ui 平级，若 get_ui_text 未补 "gui_menu." 则需传 "gui_menu.xxx"。

### 4.2 易被误解或改错的原因

1. **在 JSON 中改 hotkey_input.keys 的 key 名未同步 hotkey_input.py 的 KEY_NAME_I18N_MAP**：KEY_NAME_I18N_MAP 值为 i18n_key（如 'ctrl'），get_ui_text("hotkey_input.keys.ctrl") 依赖本文件存在 ui.hotkey_input.keys.ctrl，若 JSON 改为 ctrl_key 会取不到。
2. **新增面板或控件文案只改一处语言文件**：若项目有多语言（如 en、zh），只改 i18n_common_zh 会导致其他语言 fallback 到 key。
3. **误将 hotkey_input 放在 gui_menu 下或改顶层结构**：get_ui_text("hotkey_input.placeholder") 期望 ui.hotkey_input.placeholder，若结构改会取不到。
4. **删除或重命名 keys 下某项**：hotkey_input 中 KEY_NAME_I18N_MAP 引用该项会 fallback，显示为 key 本身。

### 4.3 正确做法

- 增删改文案时同步所有语言文件与 get_ui_text 调用；hotkey_input 相关与 KEY_NAME_I18N_MAP 的 i18n_key 一一对应；保持 ui 与 gui_menu 顶层结构供 get_ui_text 解析。

---

## 五、与道歉文档的关系

若此前因未先通读上述四处约定（system_tray 图标在托盘线程创建与 run、set_show/set_exit 为 no-op；left_pixels_sample 为采样产出、actual_sample_size 与路径不可移植；hotkey_input 的 KEY_NAME_I18N_MAP 与 i18n 一致、占位符勿硬编码英文；i18n_common_zh 结构与 get_ui_text 键路径一致）而在此四处反复改错或理解偏差，责任在己。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档中增加对本文的引用。
