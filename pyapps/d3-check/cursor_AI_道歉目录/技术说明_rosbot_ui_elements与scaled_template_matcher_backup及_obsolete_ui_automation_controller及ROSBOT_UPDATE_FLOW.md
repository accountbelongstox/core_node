# 技术说明：rosbot_ui_elements.json、scaled_template_matcher_backup、_obsolete_ui_automation_controller、ROSBOT_UPDATE_FLOW

**目的**：说明此四处文件/备份/文档的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `docs/rosbot_ui_elements.json`
- `docs/backup/scaled_template_matcher_backup_20260201.py`
- `utils/_obsolete_ui_automation_controller.py`
- `docs/ROSBOT_UPDATE_FLOW.md`

---

## 一、docs/rosbot_ui_elements.json

### 1.1 职责与约定

- **用途**：**ROSBOT 窗口 UI 分析产出**的 JSON 示例或快照。结构：**timestamp**、**program_name**（如 "rosbot"）、**window_info**（hwnd、title、left/top/width/height、is_active 等）、**controls** 数组（id、parent_id、type、name、automation_id、class_name、rect、level 等）、**files**（screenshot、annotated_screenshot 的绝对路径）。示例中 title 为 "The Vault"、controls 含 ButtonControl（OK）、ImageControl、TextControl、TitleBarControl 等，为某次分析时的快照。
- **约定**：消费方可能依赖 timestamp、window_info、controls 的 id/parent_id/type/name/automation_id/rect；files 中路径为绝对路径、可能含用户名或 .core_node/.d3check 等，跨机或不同环境会不同；若分析工具产出格式变更（如增删字段、改 controls 结构），消费脚本须同步；本文件为 docs 下示例或历史快照，非运行时唯一数据源。

### 1.2 易被误解或改错的原因

1. **误当配置或模板**：若将本文件当「ROSBOT 控件配置」改 name/automation_id 期望影响运行逻辑，实际为分析结果快照，运行逻辑不读此文件除非明确约定。
2. **files 路径为绝对路径**：screenshot、annotated_screenshot 含 C:\Users\... 或 .core_node\.d3check\...，若脚本假定路径可移植会跨机失败。
3. **controls 结构与分析工具版本**：若 UI 分析工具升级改 controls 项结构（如 rect 改为 bounds），消费方未同步会 KeyError 或解析错。
4. **window_info 与当前窗口**：快照为某时刻某窗口，hwnd/title/rect 会变，若代码假定与当前 ROSBOT 窗口一致会误用。

### 1.3 正确做法

- 明确本文件为分析产出示例或快照；消费时若依赖结构先确认产出方与版本；路径作参考时注意绝对路径不可移植；修改 JSON 结构时同步所有读取方。

---

## 二、docs/backup/scaled_template_matcher_backup_20260201.py

### 2.1 职责与约定

- **用途**：**备份文件**（backup 目录、文件名含日期 20260201），为 ScaledTemplateMatcher 的某一历史版本。依赖：current_dir = __file__ 所在目录（即 **docs/backup**），project_root = dirname(current_dir) = **docs**，sys.path.insert(0, project_root)；providor_index（D3_TEMPLATE_CONFIGS、get_template_path、get_global_scale 等）、share.game_interface_data.get_global_scale、pycore ImageMatcher。**若直接运行或从本文件复制代码**，project_root 为 docs 而非 pyapps/d3-check，会导致 import 失败或导入错误模块。
- **约定**：备份仅作历史参考，不参与主流程；若从此文件恢复或对比逻辑，须将 project_root 改为项目根（如 pyapps/d3-check）或从正确入口运行；主实现以 d3utils 或当前 scaled_template_matcher 所在模块为准。

### 2.2 易被误解或改错的原因

1. **误当主实现使用**：若从 backup 复制类或方法到主代码而未修正 project_root 或 import 路径，会从 docs 找模块导致 ImportError。
2. **project_root = docs**：__file__ 在 docs/backup 下，dirname 两次后为 docs，与主项目根 pyapps/d3-check 不一致，任何依赖 project_root 的路径或 import 会错。
3. **与当前 ScaledTemplateMatcher 差异**：备份为某日快照，当前 d3utils 或 providor 中的实现可能已改接口或依赖，直接复用备份逻辑可能缺少新参数或与新 API 不兼容。
4. **备份目录清理**：若删除 docs/backup 或本文件，仅失去该日备份，不影响运行；但若有人误把本文件当唯一实现引用会断链。

### 2.3 正确做法

- 视本文件为只读备份；恢复或对比时以主项目根为基准修正路径；不从此文件直接运行或作为主入口；主逻辑以当前代码库中 ScaledTemplateMatcher 为准。

---

## 三、utils/_obsolete_ui_automation_controller.py

### 3.1 职责与约定

- **用途**：**已废弃模块**（_obsolete_ 前缀）。UIAutomationController 用 **uiautomation**、**win32gui/win32con**、**providor.providor_second.CONFIG/load_config** 做 RoS-BoT other exe 的 UI 自动化（tab_item_names、profile_combobox_text、sequence_combobox_names 等）。current_dir = utils 的父目录（项目根），sys.path.insert(0, current_dir)。_safe_get_control_info 等用裸 except 吞异常。**不应被新代码或现有流程引用**；当前 ROSBOT/战网 UI 操作应以 share、d3utils 或流程层约定为准。
- **约定**：不在此文件扩展；不将本模块作为 UI 自动化的推荐实现；若需 RoS-BoT 配置或 UI 操作，应使用项目内当前约定方案；删除前确认无引用。

### 3.2 易被误解或改错的原因

1. **误当可用工具**：未注意 _obsolete_ 前缀而在此模块上开发或 import，会引入 providor_second、uiautomation、CONFIG 键（ros_settings.tab_item_names 等）与当前设计可能不一致。
2. **providor_second 依赖**：若 CONFIG 或 load_config 迁移到 providor_index 或别处，本文件会 ImportError；与 PROJECT_STANDARDS 等规范可能冲突。
3. **裸 except**：_safe_get_control_info 内多处 except: pass，属性获取失败静默填默认值，易掩盖 UI 变化或调试困难。
4. **与 ROSBOT_UPDATE_FLOW、E 块无关**：本文件为旧 UI 自动化控制器，与 ROSBOT 更新流程（zip、解压、CONFIG.ros_directory）无直接实现关系，误引用会混用废弃逻辑。

### 3.3 正确做法

- 视本文件为只读历史参考；不新增依赖、不在新代码中 import；UI 自动化需求以项目现有约定为准；删除前全局搜索并确认无引用。

---

## 四、docs/ROSBOT_UPDATE_FLOW.md

### 4.1 职责与约定

- **用途**：**ROSBOT 更新流程说明**。前置条件：战网区服已探测为**亚服**或**国服**，否则跳过（不查 zip、不弹窗）。流程：检查 game_interface_data.get_battlenet_region() 非 asia/cn 则跳过；在**下载目录**找 zip（>20M、文件名匹配区服）；**是否更新**须弹窗「是否更新ROSBOT？」（除非勾选自动使用最新 ROS）；创建目录（GameTools 下 英文区服_版本号 如 Asia_36.0129）、解压、递归找 RoS-BoT.exe、将 exe 所在目录重命名并移动到 GameTools\{区服}_版本号\RosBot\；复制 RoS-BoT.ini、更新 CONFIG.ros_settings.ros_directory。与 E 块关系：点击「启动 ROSBOT」后、do_login_check 内执行；E3a～E3f 见 ROSBOT_FLOW_MERMAID E 子图。
- **约定**：实现更新逻辑的代码须与本文档一致（区服检查、zip 条件、弹窗、目录命名 ROSBOT_FINAL_DIR_NAME、CONFIG 键）；常量 ROSBOT_GAMETOOLS_BASE 等与文档路径一致；E 块流程图与本文档描述同步；若文档与代码不一致须同步其一。

### 4.2 易被误解或改错的原因

1. **未检查区服即查 zip**：若代码在未探测到 asia/cn 时仍查 zip 或弹窗，违反「未探测到区服则跳过」。
2. **不弹窗直接更新**：若未勾选「自动使用最新 ROS」却直接更新，违反「必须弹出对话框」；若实现漏弹窗会误更新。
3. **目录命名或路径错**：若创建目录不用「英文区服_版本号」或最终 exe 路径不是 ...\RosBot\RoS-BoT.exe，与文档不符会导致 CONFIG 或启动路径错。
4. **CONFIG 键名**：ros_settings.ros_directory 须指向新目录（如 ...\Asia_36.0129\RosBot），若键名或层级错会写错配置。
5. **与 E 块图不同步**：若 E3a～E3f 实现顺序或条件与 ROSBOT_FLOW_MERMAID 或本文档不一致，会流程断链或重复。

### 4.3 正确做法

- 实现 ROSBOT 更新前先读本文档；区服非 asia/cn 则跳过；弹窗与自动使用最新 ROS 配置一致；目录命名与路径与文档一致；CONFIG 键与文档一致；E 块代码与流程图同步更新。

---

## 五、与道歉文档的关系

若此前因未先通读上述四处约定（如 rosbot_ui_elements 为分析快照非配置、backup 的 project_root 为 docs、_obsolete_ui_automation_controller 勿用、ROSBOT_UPDATE_FLOW 的区服/弹窗/目录/CONFIG）而在此四处反复改错或理解偏差，责任在己。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档中增加对本文的引用。
