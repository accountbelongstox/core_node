# 日志数据还原后界面显示全为「--」——可能性报告（文档编号 6）

**目录**：`docs/ui_6`（文档编号 6）。  
**范围**：`scripts/test_log_organizer_poll.py`、`d3utils/log_info_organizer.py`、`d3utils/log_state_reader.py`、`d3utils/log_indent_spec.py` 及 `docs/LOG_INDENT_SPEC.md`、`docs/LOG_ALL_STATES.md`。  
**方法**：先看代码 → 看文档 → 再调用 MCP 查官方文档；可复制/移动代码、调整构架与流程。**本文仅创建文档，暂不修改代码。**

---

## 一、现象与数据对照

| 类型 | 内容 |
|------|------|
| **实际近似数据**（期望） | 单行长文本，含：`Boting duration : 00.00:56:12 day(s)`、`Game # 30`、`00:00:00(30.95/h)`、`Run: 00:00 - Step: 00:00`、`Failed runs: 0 - Deaths: 0`、`Keys Total/Looted: 301/123`、`Shards earned: 6590`、`Eamed Xp: 237.984 B (...)`、`Performance: 0/570` 等。 |
| **当前数据（有误）** | 各字段均显示占位：`Botting duration: --`、`Game #: --`、`Run time (per h): --`、…、`Performance: --`。 |

即：**对日志进行数据还原后，界面/脚本输出全部为占位符「--」，未解析出任何真实数值。**

---

## 二、代码实际：构架与流程（先看代码）

### 2.1 调用链与职责

| 组件 | 文件 | 职责 |
|------|------|------|
| 测试脚本 | `scripts/test_log_organizer_poll.py` | 获取 `LogInfoOrganizer`，**先 seek_to_end()**，再每 1 秒调用 `poll_once_and_get_stats_lines()`；若返回空则打印 `_DEFAULT_PLACEHOLDER_LINES`（即全部 "Label: --"）。 |
| 组织器 | `d3utils/log_info_organizer.py` | 持 `_last_position`；`read_new_lines()` 从 `_last_position` 读到当前 EOF 并**更新** `_last_position`；`get_latest_stats_as_lines()` 调用 `read_new_lines()`，对每行调 `parse_stats_line()`，仅当 `_is_stats_line(line)` 为真才解析；返回 `"Label: value"` 列表。 |
| 状态读器 | `d3utils/log_state_reader.py` | 按路径单例；`load()` 调用 `log_indent_spec.analyze_log_blocks()` 做全量扫描，得到 indent/message_type/block 层级。**当前 organizer 仅用 get_reader()，未用 reader 做按位置读或按块读。** |
| 缩进规范 | `d3utils/log_indent_spec.py`、`docs/LOG_INDENT_SPEC.md` | 行首 TAB/空格定义「新条」与「续行」；0 缩进 = 新日志条，正缩进 = 上一条的续行；状态键如 `tabs=0, U+0020=0`、`tabs=0, U+0020=3`。**log_info_organizer 不依赖 indent，只对 strip() 后的整行做正则。** |

### 2.2 关键代码位置与行为

| 位置 | 行为 |
|------|------|
| `test_log_organizer_poll.py` L122-124 | `organizer = get_log_info_organizer(log_path)`；**`organizer.seek_to_end()`**；然后循环 `poll_once_and_get_stats_lines()`。 |
| `test_log_organizer_poll.py` L127-132 | `lines = organizer.poll_once_and_get_stats_lines()`；**若 `not lines`**，则打印 `_DEFAULT_PLACEHOLDER_LINES`（全部 "--"）。 |
| `log_info_organizer.py` L91-106 | `read_new_lines()`：从 `_last_position` seek 并 read 到 EOF，`_last_position = f.tell()`；返回 (新位置, 非空 stripped 行列表)。即**只读「自上次位置起新增」的内容**。 |
| `log_info_organizer.py` L109-117 | `seek_to_end()`：`_last_position = os.path.getsize(self._log_path)`，即**将位置设为文件末尾**。 |
| `log_info_organizer.py` L119-130 | `get_latest_stats_as_lines()`：调用 `read_new_lines()`，对每行 `parse_stats_line(line)`，extend 到 result。**不读历史，只读新增。** |
| `log_info_organizer.py` L26-36 | `_is_stats_line(line)`：要求 strip 后长度 ≥ 50、含 "Performance:" 或 "Performance "、含 "Botting duration" 或 "Boting duration"。 |
| `log_info_organizer.py` L39-53 | `_STATS_PATTERNS`：按顺序正则匹配 Botting duration、Game #、Run time、Run - Step、Failed runs - Deaths、Keys、Avg.Keys/Rift、Shards earned、**Earned Xp**、Run Xp、Xp Pools、Legendaries、Distance、Performance。注意：**仅 "Earned Xp"**，实际日志若为 **"Eamed Xp"**（拼写变体）则该项不匹配。 |

### 2.3 日志中的 tab/层级与「固定」格式（文档与代码对照）

- **LOG_INDENT_SPEC**：行首无 TAB、无空格 = 新条（`tabs=0, U+0020=0`）；行首 3 空格等 = 续行。stats 行若为**单行**（无论顶格还是续行），strip 后内容一致，organizer 只关心内容是否同时含 "Performance:" 与 "Boting duration"/"Boting duration"。
- **LOG_ALL_STATES / log_indent_spec**：message_type 有 `info_msg_Botting`、`info_msg_Vendor_loop` 等；**无专门「stats 汇总行」类型**，长 stats 行会落入 `msg_info_other` 或未列出的模式。organizer **未使用** message_type 或层级筛选，仅用整行字符串做 _is_stats_line + 正则。
- 用户描述：「有些特殊标记 tab 没有特性而是固定的」——即 stats 这类行可能**无单独缩进规则**、格式固定为一段长文本。若该长文本是**一条顶格或一条续行**，当前实现应能识别；若被**拆成多行**（例如每行一个 Label: value），则单行可能不同时含 "Performance:" 与 "Botting duration"，导致 _is_stats_line 为假。

---

## 三、可能性归纳（代码实际 → 原因）

| 可能性 | 描述 | 依据（代码/文档） |
|--------|------|-------------------|
| **1. 只读尾部新增，历史 stats 未参与解析** | 测试脚本先 `seek_to_end()`，organizer 的 `_last_position` 在文件末尾；之后 `poll_once_and_get_stats_lines()` 仅通过 `read_new_lines()` 读取「自 _last_position 起新增」的字节。若 stats 行在启动前就已写入文件，则永远不会被读到，`lines` 为空，脚本打印全部 "--"。 | L122-124 seek_to_end；L91-106 read_new_lines 仅读 last_position→EOF；L127-132 空则占位。 |
| **2. 首轮或长时间无新写入** | 即使不 seek_to_end，若首次从 0 开始读，第一次 get_latest_stats_as_lines 会读全文件并推进 _last_position 到 EOF；若文件中**没有**一行同时含 "Botting duration"/"Boting duration" 与 "Performance:"，则 result 仍为空。若脚本设计为 seek_to_end 后只等「新来的」stats 行，则在没有新日志写入的时段内，每轮都 0 行 → 一直 "--"。 | 同上；且 get_latest_stats_as_lines 仅解析「新读到的行」。 |
| **3. 正则与真实格式不一致** | 实际日志为 "Eamed Xp" 时，当前模式为 `Earned\s+Xp:`，该项不匹配；其他字段仍可匹配。若整行因**长度不足**（如被截断）、**缺少 "Performance:" 或 "Botting duration"**（如被写成其他词或拆到多行），则 _is_stats_line 为 False，整行不解析 → 0 条 → 全 "--"。 | L26-36 _is_stats_line；L47 Earned Xp 仅一种拼写。 |
| **4. stats 行以多行/续行形式出现** | 若 ROSBOT 将 stats 输出为多行（例如每行一个 "Label: value"），且无一行同时包含 "Botting duration" 与 "Performance:"，则 _is_stats_line 对所有行为假，parse_stats_line 始终返回 []，合并后为空。 | _is_stats_line 要求两标记**同在一行**。 |
| **5. 编码/换行/strip 导致内容异常** | 若文件编码或换行导致 strip 后整行被拆或乱码，可能长度不足或关键字缺失；或 stats 行内含特殊空白（如 U+00A0），正则 `\s` 仍可匹配，影响较小，但若行被截断则同 3/4。 | read 使用 errors="ignore"；splitlines 后 strip。 |
| **6. Organizer 与 Reader 职责分离，未用「按块/按时间」读** | LogStateReader 提供 load()、get_blocks_after(time) 等，按 indent/块/时间读；organizer 仅用 **position 增量读**，未用 reader 的块或时间接口。若需求是「还原最近一次 stats」（可能在文件中部或尾部），当前架构只会在**该 stats 行恰好出现在某次 read_new_lines 的增量里**时解析到。 | log_state_reader.py 与 log_info_organizer.py 的接口对比。 |

---

## 四、代码实际与「查找问题」是否同一问题

| 查找问题 | 代码实际 | 是否同一问题 |
|----------|----------|--------------|
| 数据还原后界面/输出全为 "--" | 测试脚本 seek_to_end 后只解析「新增」行；若无新增或新增中无 stats 行，则 result 为空，打印占位符。且 organizer 无「从文件内查找最近一条 stats 行」的路径。 | **是**：现象「全为 --」与「只读尾部 + 无新 stats 行或格式不匹配」直接对应。 |
| 日志 tab、层级、固定标记 | organizer 不按 tab/层级过滤；stats 行若为固定单行格式，strip 后即可匹配；若为多行或关键字缺失则匹配失败。log_indent_spec 的层级/块未参与 stats 解析。 | **部分**：tab/层级未用于筛选 stats；「固定标记」体现为 _is_stats_line 的两处关键字，多行/变体会导致不同结果。 |

---

## 五、多种思路与优化方向（不修改代码，仅设计）

### 思路 A：首次或周期「全量/尾部扫描」最近一条 stats 行

- **问题**：当前仅解析「自 _last_position 起新增」的行，历史 stats 永不参与。
- **方向**：增加「获取最近一条 stats」的语义：例如首次调用或当 poll 返回空时，从**当前文件末尾向前**扫描若干块/行，或从 _last_position 向前读一段（或全文件），找到**最后一条**通过 _is_stats_line 的行，对其 parse_stats_line 并返回；或提供 `get_last_stats_from_tail(max_chars)`，用 reader 或 organizer 内部从 EOF 往回读，直到匹配到一条 stats 行。
- **与 tab/层级**：若 stats 固定为单行（顶格或续行），无需按层级过滤；若将来 stats 跨多行且首行有固定 indent，可在扫描时用 log_indent_spec.get_line_indent_state 判断「新块」再决定是否拼接多行。

### 思路 B：不 seek_to_end()，首次全读并取最后一条 stats

- **问题**：测试脚本主动 seek_to_end()，导致之后永远只读新增。
- **方向**：脚本或调用方在**首次** poll 前不 seek_to_end()，让第一次 get_latest_stats_as_lines 从 0 读到 EOF，得到所有行，从中解析所有 stats 行，取**最后一条**作为当前展示；后续再按「仅新行」增量更新。需在 organizer 或上层明确「首次全量 / 后续增量」的语义，避免重复全量读。

### 思路 C：正则与拼写/格式兼容

- **问题**：实际日志有 "Eamed Xp"，当前只认 "Earned Xp"。
- **方向**：在 _STATS_PATTERNS 中为 Xp 相关项增加拼写变体（如 Eamed/Earned）；并对「Botting duration」与「Performance:」的判定适当放宽（例如允许 Performance 后无冒号或多空格），减少因格式微差导致整行被拒。

### 思路 D：多行 stats 块识别（固定标记 + 层级）

- **问题**：若 ROSBOT 将 stats 输出为多行（每行一个字段），当前单行判定会失败。
- **方向**：用 log_indent_spec 的层级：若某行是「续行」（如 tabs=0, U+0020=3），且上一行是顶格 stats 首行（如含 "Botting duration"），则将本块多行拼接成一行再交给 parse_stats_line；或定义「stats 块」= 首行含 Botting duration、后续若干行为续行，合并后再解析。需在 LOG_INDENT_SPEC 或新文档中约定 stats 块的结构（是否固定为单行、是否允许续行）。

### 思路 E：Organizer 与 Reader 协同「按块/按时间」还原

- **问题**：Reader 有 get_blocks_after(time)、load() 的块结构，organizer 未用。
- **方向**：若需「某时间点之后的 stats」或「最近 N 个块内的 stats」，可由 organizer 调用 reader.get_blocks_after() 或基于 load() 的 state 信息，在指定块或时间范围内筛选可能含 stats 的行（例如 message_type 为 msg_info_other 且内容含 "Performance:"），再交给 parse_stats_line。这样数据还原与「日志块/时间」一致，便于与 LOG_INDENT_SPEC、LOG_ALL_STATES 对齐。

### 思路 F：占位符策略与「无数据」语义

- **问题**：当前「无解析结果」即全部 "--"，无法区分「尚未读到」与「文件中本无 stats」。
- **方向**：区分：从未有过 stats（例如从未 poll 到过）vs 本轮无新 stats。例如首次调用前不做 seek_to_end，先做一次「全文件或尾部扫描」取最后一条 stats；若得到则展示，若得不到再展示 "--"。或提供「最后已知 stats」缓存，仅当解析到新 stats 时更新，无新数据时继续显示上次结果而非强制 "--"。

---

## 六、构架与流程优化建议（仅设计）

1. **明确「数据还原」的输入与输出**  
   - 输入：日志路径、可选「从某时间/位置起」或「仅尾部」或「全文件最后一次」。  
   - 输出：一条「当前 stats」（14 个 Label: value）或明确无数据。  
   - 当前 organizer 只提供「自上次位置起新增行中的 stats」，无「最近一条」语义，建议在 organizer 或上层增加「get_last_stats_in_file()」或「first_run_full_scan_then_tail()」的入口。

2. **Reader 与 Organizer 职责边界**  
   - Reader：按块/时间/indent 扫描与分类（已有）。  
   - Organizer：按**位置**增量读 + stats 解析（已有）；可扩展为在「无新行有 stats」时，委托 Reader 或内部从尾部/块内取最后一条 stats，避免仅依赖增量。

3. **日志格式约定文档化**  
   - 在 LOG_INDENT_SPEC 或单独文档中写明：stats 汇总行为**单行**还是**多行块**、是否带时间戳前缀、是否可能出现 Eamed/Earned 等变体；便于 _is_stats_line 与 _STATS_PATTERNS 与真实日志一致。

4. **测试脚本与默认行为**  
   - 若脚本目的是「模拟实时 tail + 展示最新 stats」，seek_to_end 合理，但需在**首轮**先做一次「从 0 读或从尾部回溯」取最后一条 stats，再进入每秒只读新增的循环，避免启动即全 "--"。  
   - 若脚本目的是「打开即展示文件内已有最新 stats」，则不应 seek_to_end，而应首次全读或尾部扫描，取最后一条 stats 后再决定是否切到增量模式。

---

## 七、小结

- **现象**：日志数据还原后，界面/脚本输出全部为 "Label: --"。  
- **直接原因（代码实际）**：测试脚本先 `seek_to_end()`，organizer 只解析「自上次位置起新增」行；若 stats 行已在文件中但无新写入，则读不到任何 stats 行，返回空列表，脚本打印占位符。正则与格式（如 "Eamed Xp"）仅影响单字段或整行是否被识别，在「完全无行被识别」时以位置/读取范围为主因。  
- **与 tab/层级**：当前 organizer 不按 tab 或层级过滤；stats 若为固定单行，strip 后即可匹配；若为多行或关键字不全则需多行/块级识别或格式放宽。  
- **优化方向**：增加「最近一条 stats」的获取路径（尾部回溯或首次全读）、区分首次全量/后续增量、正则兼容拼写与格式、可选多行 stats 块与 Reader 协同；并将 stats 格式与读取语义文档化。  
- **文档与 MCP**：先看代码（test_log_organizer_poll、log_info_organizer、read_new_lines、seek_to_end、_is_stats_line、_STATS_PATTERNS），再看项目文档（LOG_INDENT_SPEC、LOG_ALL_STATES），再根据需要查阅 Python 标准库（file seek/tell、re）；本报告据此整理可能性与多种思路，**暂不修改代码**。
