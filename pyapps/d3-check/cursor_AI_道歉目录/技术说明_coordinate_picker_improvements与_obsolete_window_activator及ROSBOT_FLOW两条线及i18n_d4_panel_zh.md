# 技术说明：coordinate_picker_improvements、_obsolete_window_activator、ROSBOT_FLOW_两条线_十种可能、i18n_d4_panel_zh

**目的**：说明此四处文档/代码/文案的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `.prompts/coordinate_picker_improvements.md`
- `utils/_obsolete_window_activator.py`
- `docs/ROSBOT_FLOW_两条线_十种可能.md`
- `providor/i18n/i18n_d4_panel_zh.json`

---

## 一、.prompts/coordinate_picker_improvements.md

### 1.1 职责与约定

- **用途**：**需求/改进说明文档**，记录坐标拾取窗口的已实现改进（2025-10-22）：窗口标题带截图尺寸、移除「开始拾取/停止拾取/撤销」三按钮、窗口默认始终处于拾取模式、拾取计数与主 UI 历史记录同步（通过 **pick_history_ref** 引用）。对应实现文件：**ui/components/coordinate_picker_window.py**、**ui/panels/coordinate_calibration_panel.py**。主 UI 创建弹窗时须传 `pick_history_ref=self.pick_history`；CoordinatePicker 的 `_update_count()` 优先用 `pick_history_ref` 长度，无则回退本地 `len(self.picks)`。
- **约定**：修改 coordinate_picker 相关逻辑前应先看本文档与上述两处代码，避免把已移除的按钮或拾取模式开关重新加回、或改掉 pick_history_ref 的传参与 _update_count 逻辑。

### 1.2 易被误解或改错的原因

1. **误以为仍需「开始/停止/撤销」**：文档已明确三按钮已移除、窗口始终拾取模式；若按旧逻辑加回按钮或 pick_mode 开关，与当前设计冲突。
2. **忽略 pick_history_ref**：主 UI 未传 pick_history_ref 时，拾取窗口只显示本地 picks 数，与「历史总数」设计不符；或修改 coordinate_picker_window 时删除/改名 pick_history_ref 导致主 UI 传参报错或计数不同步。
3. **窗口标题格式**：标题为 `{i18n title} - {width}x{height}`；若改为只显示 i18n 或改格式未同步文档，用户看不到尺寸信息。
4. **文档与代码不同步**：改进文档指向具体行号（如 46–49、216–220）；若 coordinate_picker_window 或 coordinate_calibration_panel 重构后行号变化，文档未更新会导致按文档定位错位置。

### 1.3 正确做法

- 改 coordinate_picker 前先读本文档与 coordinate_picker_window、coordinate_calibration_panel；保持「无三按钮、始终拾取、pick_history_ref 引用、标题带尺寸」的约定；行号变更时更新文档中的引用。

---

## 二、utils/_obsolete_window_activator.py

### 2.1 职责与约定

- **用途**：**已废弃模块**（文件名前缀 _obsolete_）。WindowActivator 类提供按标题/部分标题/hwnd 激活窗口、获取当前活动窗口信息、枚举可见窗口，依赖 win32gui/win32con、ColorPrint。保留仅供历史参考，**不应被新代码或现有流程引用**。
- **约定**：不在此文件内增加新功能；不将本模块作为「窗口激活」的推荐实现；若需窗口激活逻辑，应使用项目内当前约定方案（如 d3utils 或 ui 层已有实现），勿从本文件复制或 import。

### 2.2 易被误解或改错的原因

1. **误当作可用工具**：未注意 _obsolete_ 前缀而在此模块上继续开发或在新流程中 import，会引入已弃用依赖与行为，与项目当前设计脱节。
2. **删除或重命名未通知**：若项目决定彻底移除废弃代码，应确认无引用后再删；若仅重命名文件未同步文档/道歉目录，后续可能误以为还有「WindowActivator」可用。
3. **与现有窗口逻辑混淆**：项目可能已有其他窗口激活/前置逻辑（如战网、D3/D4 窗口）；把本文件逻辑与那些混为一谈会导致重复实现或行为冲突。

### 2.3 正确做法

- 视本文件为只读参考，不新增依赖、不在新代码中 import；窗口激活需求以项目现有约定实现为准；删除前确认无引用并更新相关说明。

---

## 三、docs/ROSBOT_FLOW_两条线_十种可能.md

### 3.1 职责与约定

- **用途**：**流程歧义说明文档**，针对「两条线」的十种可能含义做枚举，避免改流程图时理解错。涉及 C4 识图未匹配/游戏掉线 → F1d 识别到掉线 → F1c 结束 D3 等；十种包括：F1c 两条入边、C/F 两 subgraph 内各一条、两个并列掉线节点、C4 两条路径、同对节点两条边、两个步骤（判定+执行）、视觉两段、两种线型、两来源进汇总节点、图例两条说明。文档要求「你说是哪一种（或哪几种），我按那个改图」。
- **约定**：修改 ROSBOT 流程相关图或文档时，若涉及「两条线」「掉线→结束 D3」等表述，应先对照本文档确定所指是十种中的哪一种，再改图/代码，避免按错误理解改 Mermaid 或流程代码。

### 3.2 易被误解或改错的原因

1. **自选一种未与需求方确认**：文档明确要「你指认是哪一种」；若自行假定为某一种（如仅当两条入边）而改图，可能与用户所指不一致，导致反复修改。
2. **流程代码与图不一致**：若只改文档/图未改 tick 或 BNNode/Extension 等代码（或反之），会出现「图是一条线、代码是两条逻辑」或相反，造成 1:1 核对混乱。
3. **节点/边命名与文档不符**：如 F1d、F1c、C4、C10 等节点名与 rosbot_flow 代码或其它流程文档不一致时，本文档的「第一条线/第二条线」描述会对应错。
4. **十种理解混用**：把多种解释混在一起改（如既改线型又改节点），未在文档或图例中固定「两条线」的唯一定义，后续维护难以一致。

### 3.3 正确做法

- 涉及「两条线」或掉线→结束 D3 的改动时，先明确对应十种中的哪一种（或组合），再改图与代码并保持 1:1；图例或说明中写明「两条线」的采用含义；节点/边命名与 rosbot_flow 等代码一致。

---

## 四、providor/i18n/i18n_d4_panel_zh.json

### 4.1 职责与约定

- **用途**：D4 面板中文文案。结构：**ui.d4_panel**（title、sub_tabs.exp_farming、exp_farming.*、debug_window.*、game_status.* 等）；根下另有 **team_health**（local_map、non_local_map、same_map 等）。代码通过 i18n_manager/get_ui_text 按 key 读取（如 "ui.d4_panel.title"、"ui.d4_panel.exp_farming.start_button"）；若 i18n 加载方式为按文件合并命名空间，需确认 team_health 的 key 前缀（如 "team_health.local_map" 或 "ui.team_health.*"）与代码一致。
- **约定**：key 与代码中 get_ui_text 的字符串一致；与 i18n_d4_panel_en.json 的 key 结构对齐以便对照；不得随意改 key 名或层级导致代码取不到或取错。

### 4.2 易被误解或改错的原因

1. **key 与代码不一致**：代码写 get_ui_text("ui.d4_panel.game_status.xxx") 而 JSON 写成 game_status.xxx 少一层、或拼写错误，会显示 key 或缺译。
2. **中英文 key 不同步**：若 i18n_d4_panel_en 与 zh 的 key 集合或层级不同，切换语言时缺项或 fallback 到错误 key。
3. **team_health 位置**：当前 team_health 与 ui 并列于根；若 i18n_manager 约定所有 UI 文案在 "ui." 下，则 team_health 可能需迁入 ui.team_health 或单独命名空间，否则代码侧可能用 "ui.team_health.xxx" 取不到。
4. **嵌套与类型**：JSON 中值为字符串；若误写为数组或对象且代码按字符串使用，会报错或显示异常。

### 4.3 正确做法

- 增删改 key 时同步代码中的 get_ui_text 与英文 zh/en 文件；确认 i18n_manager 对命名空间与文件合并规则后，再决定 team_health 是否放在 ui 下；保持值为字符串类型。

---

## 五、与道歉文档的关系

若此前因上述任一点（如未读 coordinate_picker_improvements 就改拾取逻辑、误用 _obsolete_window_activator、未按「两条线」十种含义确认就改流程图、i18n_d4_panel_zh 的 key 或 team_health 结构与代码不一致）导致反复改错或理解偏差，可视为未先通读约定所致。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档.md 中增加对本文的引用。
