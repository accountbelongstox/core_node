# 日志统计数据还原显示为“--”的可能性报告（文档编号 6）

**现象**：实际日志中有完整统计行（Boting duration、Game #、Keys、Shards、Earned Xp、Performance 等），但当前展示为“当前数据（有误）：Botting duration: -- Game #: -- …”全部占位。  
**范围**：`scripts/test_log_organizer_poll.py`、`d3utils/log_info_organizer.py`、`d3utils/log_state_reader.py`、`d3utils/log_indent_spec.py` 及文档 LOG_INDENT_SPEC、LOG_ALL_STATES。  
**依据**：先看代码 → 看项目文档 → MCP 查 Python 官方文档；本报告仅创建文档，暂不修改代码。  
**目录**：`docs/ui_6`（不存在则创建）。

---

## 一、代码与数据流梳理

### 1.1 test_log_organizer_poll.py（默认 stats 轮询）

| 步骤 | 代码位置 | 行为 |
|------|----------|------|
| 1 | L121–123 | `organizer = get_log_info_organizer(log_path)`，随后 **`organizer.seek_to_end()`** |
| 2 | L123 | `seek_to_end()` 将 `_last_position` 设为**当前文件大小（EOF）** |
| 3 | L126 | 循环内 `organizer.poll_once_and_get_stats_lines()` → 实际调用 `get_latest_stats_as_lines()` |
| 4 | log_info_organizer L122–132 | `get_latest_stats_as_lines()` 内部调用 **`read_new_lines()`**，从 `_last_position` 起读，读完再更新 `_last_position` |
| 5 | L99–106 | `read_new_lines()`：`f.seek(self._last_position)`，`raw = f.read()`。因已 **seek_to_end**，首次及后续轮询时 `_last_position` 均在文件末尾，**读到的 raw 为空**（或仅后续追加的少量字节） |
| 6 | L126–131 | `lines` 为空 → `parse_stats_line` 从未被调用 → `result` 为空 → 返回 `[]` |
| 7 | test 脚本 L127–131 | `if not lines` → 打印 **`_DEFAULT_PLACEHOLDER_LINES`**，即全部 "Botting duration: --", "Game #: --", … |

**结论（代码）**：  
- **根本原因**：默认“仅统计行”模式下，脚本**先 seek_to_end，再只解析“自 last_position 起的新行”**。启动后 last_position 已在 EOF，没有“新行”可解析，故始终得到空列表，只能显示占位 "--"。  
- 与“日志里是否有 tab、层级、特殊标记”无直接矛盾：即使用户提供的统计行格式、缩进完全正确，**只要只读“新追加内容”且起点在 EOF，就永远解析不到已有统计行**。

### 1.2 LogInfoOrganizer 的语义

- **read_new_lines()**：从 `_last_position` 读到当前文件末尾，更新 `_last_position`，返回 (new_position, stripped_lines)。  
- **get_latest_stats_as_lines()**：仅对**本轮 read_new_lines() 得到的行**逐行 `parse_stats_line()`，合并结果；**不**扫描整个文件，也**不**提供“从文件任意位置或全文查找最近一条统计行”的 API。  
- **seek_to_end()**：仅把 `_last_position` 设为文件大小，不读内容。  
- 因此：当前设计是**纯 tail 模式**——“只关心上次位置之后新写的内容”。若调用方先 seek_to_end 再 poll，则“已有内容”永远不会被纳入解析。

### 1.3 实际日志行格式与正则（用户样本）

用户给出的近似一行（无行首时间戳）：

```text
Boting duration : 00.00:56:12 day(s)Game # 30 00:00:00(30.95/h)Run: 00:00 - Step: 00:00Failed runs: 0 - Deaths: 0Keys Total/Looted: 301/123 131.68/hAvg.Keys/Rift: - 29r 0grShards earned: 6590Eamed Xp: 237.984 B (254.777 B/h)Run Xp: 0 (0/h)Xp Pools: 13 (13/h)Legendaries Kept/Looted: 1/254Distance: 70834y (43.09mi/h)Performance: 0/570
```

- **_is_stats_line**：需同时包含 "Performance:"（或 "Performance "）与 "Botting duration" 或 "Boting duration"，且长度 ≥ 50。该行满足，会被识别为 stats 行。  
- **Earned Xp**：当前正则为 `Earned\s+Xp`；用户行为 **"Eamed Xp"**（拼写变异），**不会**被该模式匹配，该字段会缺失或需单独兼容。  
- **Shards**：`ear(?:ned|ed)` 已兼容 earned/eared；若出现 "Eamed" 仅影响 Xp 字段。  
- 其他字段（Boting duration、Game #、Run、Keys、Legendaries、Distance、Performance 等）按现有 `_STATS_PATTERNS` 可匹配。  
- **Tab/层级**：该行若在文件中无行首 TAB/空格，则为顶格行（tabs=0, U+0020=0）；若有 3 个空格则为续行（tabs=0, U+0020=3）。`log_info_organizer` 不区分缩进，只按“行”解析；**影响展示为 "--" 的是“从未读到该行”（seek_to_end + 只读新行），而不是缩进**。

---

## 二、项目文档要点（tab、层级、固定标记）

### 2.1 LOG_INDENT_SPEC.md

- **TAB**：行首 TAB 数表示块层级；当前样本中未使用行首 TAB（均为 0）。  
- **空格**：0 个空格 = 新日志条（常带时间戳）；正空格 = 续行（如堆栈 `   at ...`）。  
- **状态键**：如 `tabs=0, U+0020=0`（顶格）、`tabs=0, U+0020=3`（3 空格续行）。  
- **分块**：新块 = 顶格；续行归属上一条。  
- **含义**：统计行可能是“顶格一行”或“某块的续行”；无论哪种，只要被 `read_new_lines()` 读到，就会进入 `parse_stats_line`。当前问题在于**没有读到**，而非分块错误。

### 2.2 LOG_ALL_STATES.md

- 状态 = 缩进组件 + 信息类型（info_xxx, warn_xxx, cont_xxx 等）。  
- LogStateReader / analyze_log_blocks 按“块”统计状态；LogInfoOrganizer **未使用** message_type 或 state，仅用 `_is_stats_line(line)` 和 `_STATS_PATTERNS` 做行级解析。  
- “特殊标记 tab 没有特性而是固定的”：可理解为某些行（如固定格式的统计行）在规范里没有单独列成一种 message_type，仅靠内容特征识别；当前实现正是如此（Botting duration + Performance 等），与“显示 --”无冲突。

### 2.3 log_state_reader / log_indent_spec 与 organizer 的关系

- **LogStateReader**：通过 `log_indent_spec.analyze_log_blocks` 做全文扫描，提供状态、层级、块关系；**不**负责“取最新一条统计行”。  
- **LogInfoOrganizer**：持有一个 LogStateReader（get_reader()），但 **get_latest_stats_as_lines() 只依赖 read_new_lines() + parse_stats_line()**，未调用 reader 的 load()、get_blocks_after 等。  
- 因此：**tab/层级/块结构**在“状态分析”侧有用，在“当前 stats 展示流水线”里未参与；展示为 "--" 的根因仍是**只解析 tail、且 tail 起点被设在 EOF**。

---

## 三、MCP 官方文档要点（Python）

- **re.search / group**：对单行做多次 `re.search(pattern, s)` 可得到各字段；若某模式不匹配（如 "Eamed" 对 "Earned"），该次 search 返回 None，对应字段缺失（cpython regex howto / re.rst）。  
- **文件位置**：`f.seek(offset, whence)`、`f.tell()`；whence=2 表示从末尾。`seek_to_end` 等价于 seek(0, 2)，之后 `read()` 只能读到**之后写入**的内容（python_3_10 inputoutput）。  
- **结论**：当前“先 seek 到末尾再只读新内容”的用法与 Python 语义一致；要“还原已有日志中的统计数据”，必须**在某一时刻把“已存在的内容”纳入读取范围**（例如从 0 读、或从末尾倒读一定字节/行）。

---

## 四、可能性归纳（按优先级）

### 可能性 1（高）：seek_to_end + 仅解析“新行”导致从未解析到任何统计行

- **表现**：所有统计项均为 "--"。  
- **依据**：test_log_organizer_poll.py 默认分支先 `seek_to_end()`，再循环 `poll_once_and_get_stats_lines()`；后者只处理 read_new_lines() 返回的行，而 read_new_lines() 从 last_position（EOF）起读，得到空或极少量新追加行，通常不包含完整 stats 行。  
- **与“数据还原”是否同一问题**：**是**。要“从日志还原并显示当前统计”，必须至少解析到**一条**完整统计行；当前流程在启动后从未把该行纳入读取窗口。

### 可能性 2（高）：缺少“取文件中最新一条统计行”的 API

- **表现**：调用方希望“显示当前/最近一次统计”，但现有 API 只有“自上次位置起的新行中的统计”，没有“全文或尾部扫描取最后一条 stats 行”。  
- **依据**：get_latest_stats_as_lines() 的语义是“本轮新行中的 stats”，不是“文件中最新 stats”；配合 seek_to_end 即等价于“只关心未来追加”，与“还原已有数据”的目标不符。  
- **与“数据还原”是否同一问题**：**是**。架构上缺少“按文件内容取最新统计”的入口。

### 可能性 3（中）：统计行在文件中为“续行”（带行首空格），仍可被按行解析

- **表现**：若统计行带 3 个空格等缩进，规范上属于某块的续行；但只要该行作为一整行被 read_new_lines() 读到，parse_stats_line 仍会处理。  
- **依据**：log_info_organizer 不按 indent 过滤；_is_stats_line 只看内容与长度。当前问题不是“续行被误过滤”，而是“没有读到任何行”。  
- **与“数据还原”是否同一问题**：**部分**。若未来改为“按块读”且只读顶格行，则可能漏掉续行形式的统计行；当前实现无此逻辑。

### 可能性 4（中）：日志格式变体（如 Eamed）导致单字段缺失

- **表现**：某次能读到统计行时，“Earned Xp” 仍显示为 "--" 或缺失。  
- **依据**：用户样本为 "Eamed Xp"；当前模式为 `Earned\s+Xp`，不匹配 "Eamed"。  
- **与“数据还原”是否同一问题**：**次要**。在“先能读到行”的前提下才会暴露；可作为正则健壮性改进（如兼容 Eamed）。

### 可能性 5（低）：路径/单例/编码导致读不到文件或读错文件

- **表现**：若 log_path 与真实日志不一致，或单例导致多入口 last_position 混乱，可能读不到预期内容。  
- **依据**：get_default_log_path() 与 providor LOGS_FILE_PATH 的约定、get_log_info_organizer(log_path) 单例及 _last_position 的更新路径在文档/道歉目录中有说明。  
- **与“数据还原”是否同一问题**：**可能**。在确认“确实在读目标文件且 position 语义正确”后，仍以可能性 1、2 为主。

---

## 五、代码实际与“数据还原显示 --”是否同一问题（对照）

| 现象/查找点 | 代码实际 | 文档/MCP 依据 | 是否同一问题 |
|-------------|----------|----------------|--------------|
| 展示全为 "--" | 默认分支 seek_to_end 后，仅解析“自 last_position 起的新行”；last_position=EOF → 无新行 → 返回 [] → 打印占位 | Python seek/read 语义；organizer 注释“仅新读内容参与解析” | **是** |
| 日志里明明有完整统计行 | 该行从未进入 read_new_lines() 的读取范围（因为从 EOF 开始读） | LOG_INDENT_SPEC 分块与 organizer 无直接耦合；organizer 按行不按块 | **是** |
| tab/层级/固定标记 | 当前 stats 解析不依赖 indent 或 message_type；固定格式靠 _is_stats_line + _STATS_PATTERNS | LOG_ALL_STATES、LOG_INDENT_SPEC 描述的是状态与块结构，非 stats 展示路径 | **是**（理解一致：标记与层级不改变“没读到行”的根因） |
| Eamed Xp 等变体 | "Earned\s+Xp" 不匹配 "Eamed Xp"，该字段会缺失 | re.search 不匹配则无 group；仅影响单字段 | **是**（次要，属健壮性） |

---

## 六、多种思路与架构优化方向（仅设计）

### 思路 1：首次不 seek_to_end，从 0 读并取“最后一条统计行”

- 启动时 **不** 调用 seek_to_end；第一次 poll 时 read_new_lines() 从 0 读到 EOF，得到全部行，从中找出所有 _is_stats_line 的行，**取最后一条** 解析为 get_latest_stats_as_lines() 的返回值（或新增 get_last_stats_line_from_buffer）。随后将 _last_position 设为 EOF，后续轮询仅 tail。  
- 优点：不增加新 API，仅改调用顺序与首轮语义。  
- 注意：大文件时首轮会读全文件，可加 max_lines 或“只读最后 N KB”（见思路 3）。

### 思路 2：新增“从文件取最新一条统计行”的 API

- 在 LogInfoOrganizer 或 log_info_organizer 模块增加例如 **get_last_stats_line_in_file()**：从文件末尾向前读一块（或逐块从后往前），或全文扫描一次，找到最后一条 _is_stats_line 的行，parse_stats_line 后返回。  
- 调用方：默认 stats 模式先调一次 get_last_stats_line_in_file() 显示当前值，再 seek_to_end，再按现有 poll 只追新行。  
- 优点：语义清晰，“当前值”与“增量 tail”分离；符合“数据还原”需求。

### 思路 3：按“块”或“时间”利用 log_indent_spec / LogStateReader

- 使用 get_blocks_after(0) 或 analyze_log_blocks 得到“按时间或块顺序”的段落，在**每个块**内查找是否包含 _is_stats_line 的行，取**时间或顺序上最后一块**中的统计行作为“当前统计”。  
- 优点：与 LOG_INDENT_SPEC、tab/层级一致，可区分顶格与续行；适合“按块还原”的扩展需求。  
- 成本：依赖 LogStateReader.load() 或 log_indent_spec 的块扫描，需明确与 organizer 的 last_position 谁主导“进度”。

### 思路 4：正则兼容拼写/格式变体

- 对 "Earned Xp" 增加 "Eamed" 等变体（如 `Eam(?:ed|ned)\s+Xp`）；对其他已知变体（如 Shards 已兼容 earned/eared）做类似扩展。  
- 不解决“读不到行”的问题，但能减少“读到了却某字段为 --”的情况。

### 思路 5：test 脚本提供“仅还原当前一次”模式

- 例如 `--once` 或 `--current`：不 seek_to_end，从 0 读全文件（或最后 N 行），解析出最后一条 stats，打印后退出。  
- 与思路 1/2 配合，便于验证“数据还原”是否正确，且不改变默认 long-running poll 行为。

### 思路 6：明确“tail 模式”与“当前值模式”的语义分离

- **Tail 模式**：seek_to_end + 只解析新追加行，用于“实时追新”。  
- **当前值模式**：至少一次“从文件内容中取最新一条统计”（从 0 读或从尾倒读），用于“启动时还原/展示当前状态”。  
- 在文档和 API 命名上区分两者，避免“想还原却用了纯 tail”的误用。

---

## 七、小结与建议

- **“当前数据（有误）全为 --”** 在代码上对应为：**默认 stats 轮询先 seek_to_end，再只解析自 last_position 起的新行，导致从未解析到文件中已有的统计行**，只能打印占位。  
- **Tab、层级、固定标记**：规范与实现均未在 stats 解析路径上依赖它们；问题核心是**读取范围**与**API 语义**（只 tail vs 需要“最新一条”），不是缩进或 message_type 误判。  
- **多种思路**：首轮不 seek 并取最后一条（思路 1）、新增“从文件取最新统计”API（思路 2）、结合 log_indent_spec 按块取最后统计（思路 3）、正则兼容 Eamed 等（思路 4）、脚本提供 --once/--current（思路 5）、在架构上区分 tail 与“当前值”语义（思路 6）。  
- 建议优先在**不修改代码**的前提下，用本报告与上述思路做评审；若实施，建议先做思路 1 或 2，再视需要补 3/4/5/6。  
- 本报告仅作可能性分析与架构设计，**暂不修改代码**。
