# 技术说明：设计文档.md、FLOW_ARCHITECTURE_DIRECTORY.md、rosbot_history_parser.py

**目的**：说明此三处文件/文档的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `docs/设计文档.md`
- `docs/FLOW_ARCHITECTURE_DIRECTORY.md`
- `d3utils/rosbot_history_parser.py`（另有 `scripts/rosbot_history_parser.py` 为不同实现，结构较简）

---

## 一、docs/设计文档.md

### 1.1 职责与约定

- **用途**：Login Try 与 Battle.net 掉线重启的**详细设计**，与 DESIGN.md 合并使用（DESIGN 为总览与索引）。
- **约定**：流程**无 Python 线程**，仅 subprocess taskkill + explorer 重启；Battle.net 路径来自 `CONFIG["battlenet"]["battlenet_path"]`；窗口标题来自 `providor_index.BATTLE_NET_WINDOW_TITLES`；OCR 掉线关键词 `config.constants.BATTLE_NET_DISCONNECT_KEYWORDS`（默认 `("Retry", "重试")`），**任一**即判掉线；常量（LOGIN_TRY_SCREENSHOT_DIR、LOGIN_TRY_TRIGGER_DEFAULT 等）在 config.constants；handle_login_try 内不引入 threading/asyncio。

### 1.2 易被误解或改错的原因

1. **在 handle_login_try 内改用 threading 或 asyncio**：文档明确「无 Python 线程」，若改会违反设计。
2. **改常量未同步 config.constants 或文档**：LOGIN_TRY_*、BATTLE_NET_DISCONNECT_KEYWORDS 等须与文档 §2.4 一致。
3. **路径或窗口标题从别处读**：Battle.net 路径仅 CONFIG["battlenet"]["battlenet_path"]，窗口标题仅 BATTLE_NET_WINDOW_TITLES，从别处读会错。
4. **掉线判定改为全部匹配或增条件**：文档为「识别文本包含**任一**关键词即掉线」，若改为全部匹配或增条件会与 2.2 不符。
5. **未配置或未截到 Battle.net 窗口时未退化为全屏截图**：文档要求退化逻辑，删掉会异常时无回退。

### 1.3 正确做法

- 修改 Login Try / 掉线重启相关逻辑前先读本文档与 DESIGN.md；不改流程为「无 Python 线程」；常量与路径来源与文档一致；退化逻辑保留。

---

## 二、docs/FLOW_ARCHITECTURE_DIRECTORY.md

### 2.1 职责与约定

- **用途**：定义**仅两个 flow 库**（BN-only、Flow-master）、目录布局、单源真相与冗余定义消除。
- **约定**：BNStep/BNNode 仅存在于 `flow_bn_only_state`；rosbot_flow_battlenet **不得**定义 BNNode 或本地 BN 状态，仅通过 flow_bn_block_state 的 get/set；两流程**可同拍运行**（BN-only 先、再 flow-master），无互斥；tick entry 不 call third-party libs（Approach 3）；flow_master_driver 使用 extension_flow_state 的 phase，不重复定义 extension phase。

### 2.2 易被误解或改错的原因

1. **在 rosbot_flow_battlenet 内定义 BNNode 或 _current_node**：违反 §4 单源真相，BN 步骤与状态仅 flow_bn_only_state。
2. **两流程加互斥或颠倒顺序**：§7 明确 both can run same tick，order: BN-only first then flow-master。
3. **在 process_task 内直接调 provider 或 battlenet_manager**：违反「Tick entry does not call third-party libs」。
4. **改 flow_bn_only_state 与 rosbot_flow_battlenet 的职责分工**：state 持所有 BN 步骤与状态，battlenet 仅 tick_battlenet_ready_flow 与 reset_flow_master_bn_block，不得拥有 BN 状态。
5. **reset_battlenet_flow_state 与 reset_flow_master_bn_block 混用**：后者调 reset_bn_block_state(False)（Flow-master 的 BN 块），前者为 deprecated alias。

### 2.3 正确做法

- 改 BN 流程或状态前先读本文档 §2–§6；不在 battlenet 内定义 BN 步骤/状态；两流程同拍时保持顺序；tick entry 仅调 flow 库。

---

## 三、d3utils/rosbot_history_parser.py

### 3.1 职责与约定

- **用途**：按**前导 TAB + content_indent** 解析 RoS-BoT history.txt；Block 为 Session/Rift/Step；STEP_NAMES 固定元组；接受 "Success" 与 "Sucess" 拼写；**4-tab 重复行不建新块**；earned 按 content_indent 归属；session_accept 对 Rift keys 有特殊规则（indent 0 或 1 且非 Riftkeys）；entry_ts 用于时间窗过滤。
- **约定**：STEP_NAMES、_SUCCESS_DURATION_RE、_is_4tab_repeat、_content_indent、Block.get(key) 用 replace(" ","") 匹配；last_rift_block_with_earned 的 min_entry_ts 与 fallback 语义见 docstring。

### 3.2 易被误解或改错的原因

1. **修改 STEP_NAMES 或块起始判定**：会破坏与现有日志格式的兼容。
2. **4-tab 行误建新块**：文档与代码规定 4-tab 且内容重复当前 step 或 last_stripped 时不 push 新块。
3. **Success/Sucess 只接受其一**：正则已同时接受两种拼写，若只保留其一会解析失败。
4. **earned 归属规则改错**：Session 在 indent 0 且带 ts 时 content 在 0；session_accept 对 Rift keys 的 (i==0 or (i==1 and key 非 Riftkeys)) 若改会错归属。
5. **scripts/rosbot_history_parser.py 与 d3utils 版本混淆**：scripts 版为较简结构（Session/Rift，无 Step 名），两文件不可混用或误替换。

### 3.3 正确做法

- 修改解析逻辑前先读本模块 docstring 与块结构；不改 STEP_NAMES、4-tab 重复语义、Success/Sucess 正则；区分 d3utils 与 scripts 两版 parser。

---

## 四、与道歉文档的关系

若此前因未先通读上述三处约定（设计文档无线程与常量来源、FLOW_ARCHITECTURE 两流程与单源真相、rosbot_history_parser 块与 4-tab 语义）而在此三处反复改错或理解偏差，责任在 Cursor。本说明已写入 cursor_AI_道歉目录，供后续修改前查阅。
