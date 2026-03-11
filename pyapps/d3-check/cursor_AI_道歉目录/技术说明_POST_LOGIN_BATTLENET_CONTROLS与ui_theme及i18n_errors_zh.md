# 技术说明：POST_LOGIN_BATTLENET_CONTROLS、ui/theme/__init__、i18n_errors_zh

**目的**：说明这三处文档/代码的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `docs/POST_LOGIN_BATTLENET_CONTROLS.md`
- `ui/theme/__init__.py`
- `providor/i18n/i18n_errors_zh.json`

---

## 一、docs/POST_LOGIN_BATTLENET_CONTROLS.md

### 1.1 职责与约定

- **用途**：**战网登陆后**主界面控件的**英文版**参考文档，与 `docs/登陆后的战网元素-控件说明.md` 内容对应（同一数据源与逻辑）。数据来源：调试按钮导出并复制到 `docs/登陆后的战网元素.json`（UI Automation，Chromium 战网）。表格列出 BattlenetOperation 已用控件：D3 game tab（game-nav-btn-D3CN）、Start game button area（play-btn-main / play-btn）；逻辑：name 含 "Playing Now"/"Play"/"开始游戏" 且 is_enabled=false 或 name 含 "Playing Now" 视为 in-game。To implement：Agreement checkbox、confirm login、on login screen、already logged in。
- **约定**：与 BattlenetOperation、providor/constants/d3.py 的 automation_id/name 一致；与 登陆后的战网元素.json 及中文控件说明同步；「To implement」为未实现项，代码勿假定已存在。

### 1.2 易被误解或改错的原因

1. **中英文文档不同步**：若只改中文说明未改 POST_LOGIN_BATTLENET_CONTROLS.md（或反之），两处 automation_id、逻辑描述不一致，会导致按英文文档实现的代码与按中文实现的逻辑分叉。
2. **与代码 automation_id 不一致**：若 BattlenetOperation 或 constants 使用 game-nav-btn-D3、play-btn 等与文档表不同（顺序、拼写、多/少一项），战网点击会失败或点错。
3. **把 To implement 当已实现**：若流程中调用「同意条款」「确认登录」「是否在登录页」等接口而文档仍标 To implement，可能接口不存在或返回值未约定，导致报错或误判。
4. **JSON 路径与文档不符**：文档写「copied to docs/登陆后的战网元素.json」；若实现从 battlenet_ui_elements_*.json 或其它路径读，需在文档或代码中统一说明。

### 1.3 正确做法

- 修改战网控件 id/name 或逻辑时同步更新本文档与 登陆后的战网元素-控件说明.md、BattlenetOperation、constants；实现 To implement 项后在两篇文档中改为已用并注明接口；JSON 路径与代码读取路径一致。

---

## 二、ui/theme/__init__.py

### 2.1 职责与约定

- **用途**：UI 主题包入口，**仅导出 UITheme**（from .theme import UITheme；__all__ = ['UITheme']）。主题定义（颜色、字体、尺寸）在 **ui/theme/theme.py** 的 UITheme 类中；本文件不包含具体颜色/字体，只做单一 re-export。调用方应使用 `from ui.theme import UITheme` 或 `from ..theme import UITheme`，再通过 UITheme.get_color()、UITheme.get_font()、UITheme.get_size()、UITheme.apply_to_root() 等使用。
- **约定**：所有 UI 组件统一从 theme 取色/字体/尺寸；不在组件内硬编码颜色或字体键名，除非与 UITheme 中定义的键一致；新增颜色/字体/尺寸时在 theme.py 中增加，不在 __init__.py 中增加其它导出。

### 2.2 易被误解或改错的原因

1. **在 __init__ 中增加或删除导出**：若在 __init__.py 中增加其它 from .theme import XXX 或改为 __all__ = ['UITheme', 'Other']，与「仅主题定义、单一 UITheme 导出」约定不符；若删除 UITheme 导出，所有 `from ..theme import UITheme` 的组件会 ImportError。
2. **直接从 theme.theme 导入**：部分代码使用 `from ui.theme.theme import UITheme` 或 `from .theme.theme import UITheme`；若将来 theme.py 重命名或拆成多文件，直接导入 theme 子模块的会断；推荐统一用 `from ui.theme import UITheme` 以便只依赖包入口。
3. **在组件内写死颜色/字体键**：若在组件中写 get_color('my_custom_key') 而 theme.py 中无此键，运行时报错或回退到默认；新增键应在 theme.py 中定义。
4. **UITheme 与 theme.py 不同步**：若把 UITheme 类移到其它模块但 __init__.py 仍 from .theme import UITheme，需保证 .theme 指向新位置；否则 __init__ 与实际定义不一致。

### 2.3 正确做法

- __init__.py 保持只导出 UITheme；调用方统一 `from ui.theme import UITheme`（或相对路径 ..theme）；新增颜色/字体/尺寸在 theme.py 的 UITheme 中定义；不在此包 __init__ 中做多 re-export 或聚合。

---

## 三、providor/i18n/i18n_errors_zh.json

### 3.1 职责与约定

- **用途**：**错误类**文案的**中文**翻译，供 i18n 管理器按 key 取文本。当前结构为 **ui.error_messages.***（如 ui.error_messages.bag_offset_failed = "更新背包偏移值配置失败"）。与 i18n_errors_en.json 等对应 key 结构一致；代码中显示错误提示时须使用相同 key（如 get_ui_text 或 i18n 提供的错误文案接口）。
- **约定**：key 路径与代码中调用一致；新增错误文案时在 zh/en 等语言文件中同步增加相同 key；勿只改中文未改英文（或反之）导致某语言缺译或显示 key。

### 3.2 易被误解或改错的原因

1. **key 路径与代码不一致**：若代码用 ui.errors.bag_offset_failed 而 JSON 为 ui.error_messages.bag_offset_failed，会取不到、显示 key 或回退到默认。
2. **新增/删除 key 未同步代码**：在 JSON 中新增 key 但代码未改用该 key 显示、或代码改用新 key 但 JSON 未添加，会缺译或显示 key。
3. **多语言文件结构不一致**：若 i18n_errors_en.json 为 ui.error_messages.* 而 i18n_errors_zh.json 改为 ui.error.*，i18n 加载或 fallback 会错乱。
4. **与 i18n_config 或其它 error 配置重复**：若 i18n_config.json 中也定义 error_messages 结构，需明确以哪处为准（通常以 i18n_errors_zh/en.json 为翻译源）；两处 key 不一致会导致取错文案。

### 3.3 正确做法

- 错误文案 key 与代码中 get_ui_text / 错误提示调用完全一致；增删 key 时同步改代码与所有语言 JSON；保持 ui.error_messages.* 结构与 i18n_errors_en.json 一致；与 i18n 加载逻辑（i18n_config、语言选择）约定一致。

---

## 四、与道歉文档的关系

若此前因上述任一点（如 POST_LOGIN 与中文控件说明或 BattlenetOperation 不同步、ui/theme/__init__ 多导出或直接导入 theme.theme 导致后续重构断链、i18n_errors_zh key 与代码或 en 结构不一致）导致反复改错或理解偏差，可视为未先通读约定所致。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档.md 中增加对本文的引用。
