# 日志统计行数据还原显示为全 “--” 的可能性报告

**现象**：实际日志中有一行近似数据（如 Boting duration、Game #、Run、Keys、Shards、Eamed Xp、Performance 等），但当前解析输出全部为占位 “--”。  
**目录**：`docs/ui_6`（文档编号 6）。  
**涉及**：`scripts/test_log_organizer_poll.py`、`d3utils/log_info_organizer.py`、`d3utils/log_state_reader.py`、`d3utils/log_indent_spec.py`。  
**方法**：先看代码 → 看项目文档（LOG_INDENT_SPEC、LOG_ALL_STATES）→ 再结合 MCP/官方思路；仅写文档，暂不修改代码。可复制/移动代码、调架构与流程。

---

## 一、实际近似数据 vs 当前（有误）输出

**实际近似数据（日志中应有的一行或一段）**：
```text
Boting duration : 00.00:56:12 day(s)Game # 30 00:00:00(30.95/h)Run: 00:00 - Step: 00:00Failed runs: 0 - Deaths: 0Keys Total/Looted: 301/123 131.68/hAvg.Keys/Rift: - 29r 0grShards earned: 6590Eamed Xp: 237.984 B (254.777 B/h)Run Xp: 0 (0/h)Xp Pools: 13 (13/h)Legendaries Kept/Looted: 1/254Distance: 70834y (43.09mi/h)Performance: 0/570
```

**当前数据（有误）**：所有项均为占位：
```text
Botting duration: --  Game #: --  Run time (per h): --  Run - Step: --  Failed runs - Deaths: --  Keys Total/Looted: --  Avg.Keys/Rift: --  Shards earned: --  Earned Xp: --  Run Xp: --  Xp Pools: --  Legendaries Kept/Looted: --  Distance: --  Performance: --
```

说明：占位来自 `test_log_organizer_poll.py` 的 `_DEFAULT_PLACEHOLDER_LINES`，当 `organizer.poll_once_and_get_stats_lines()` 返回空列表时打印。

---

## 二、代码流程（先看代码）

### 2.1 test_log_organizer_poll.py（默认：仅统计）

- **L121-124**：`organizer = get_log_info_organizer(log_path)`，随后 **`organizer.seek_to_end()`**，将 `_last_position` 设为当前文件大小。  
- **L126-134**：循环内 `lines = list(organizer.poll_once_and_get_stats_lines())`；若 **`not lines`**，则打印 `_DEFAULT_PLACEHOLDER_LINES`（全 “--”）；否则打印解析出的行。  
- 结论：**只处理「自脚本启动后追加的新内容」**；启动时已存在的 stats 行不会被读到（seek_to_end 之后 read_new_lines 只读 position 之后的数据）。

### 2.2 log_info_organizer.py

- **read_new_lines()**（L91-107）：从 `_last_position` 读至文件末尾，更新 `_last_position`，返回 `(new_position, list of stripped lines)`。  
- **get_latest_stats_as_lines()**（L119-132）：调用 `read_new_lines()`，对**每一行**调用 `parse_stats_line(line)`，合并所有 `parse_stats_line` 的返回值。  
- **poll_once_and_get_stats_lines()**（L133-136）：直接调用 `get_latest_stats_as_lines()`。  
- **parse_stats_line(line)**（L55-71）：先 `_is_stats_line(line)`；若为 False 返回 `[]`；否则对 `line.strip()` 用一组正则逐条匹配，得到 `"Label: value"` 列表。  
- **_is_stats_line(line)**（L26-35）：要求 `len(line.strip()) >= 50`，且 **同时** 包含 “Performance:” 或 “Performance ” 以及 “Botting duration” 或 “Boting duration”。任一不满足则整行不视为 stats 行。  
- **_STATS_PATTERNS**（L37-52）：按顺序匹配 Botting duration、Game #、Run time (per h)、Run - Step、Failed runs - Deaths、Keys、Avg.Keys/Rift、Shards earned、**Earned Xp**、Run Xp、Xp Pools、Legendaries、Distance、Performance。注意 “Earned Xp” 为正则 `Earned\s+Xp`；实际日志若为 **“Eamed Xp”**（拼写错误）则不会匹配。

### 2.3 log_state_reader / log_indent_spec

- **LogStateReader**：按路径单例，`load()` 时用 `log_indent_spec.analyze_log_blocks()` 做整文件扫描，得到缩进状态、message_type、块层级等。**LogInfoOrganizer 并未使用 Reader 的 load/块/层级**，仅用 `read_new_lines()` 按位置读原始行。  
- **log_indent_spec**（LOG_INDENT_SPEC.md）：  
  - 新块 = 行首无 TAB 且无空格（`tabs=0, U+0020=0`）；续行 = 行首有空格（如 3 个 U+0020）。  
  - 顶格行带时间戳（INFO/WARN）；续行无时间戳（如堆栈 `   at ...`）。  
- 若 **stats 行在文件中被拆成多行**（例如第一行 “Boting duration : 00.00:56:12”，下一行 “Game # 30 ...”），则**没有单行同时含 “Boting duration” 和 “Performance:”**，`_is_stats_line` 对每一行都返回 False，整段都不会被识别为 stats。  
- 若 stats 行带**行首固定空格或 TAB**（“固定标记、无特性”）：当前实现先 `strip()` 再判断，内容上仍可识别；但若**字段之间用固定 TAB 分隔、且无冒号**等，现有正则是按 “Label: value” 或 “Label value” 写的，可能对 “Label\tvalue” 或固定列宽不匹配。

---

## 三、可能性归纳（结合代码的多种思路）

### 可能性 1（高）：只读尾部，未读已有内容

- **代码实际**：test 脚本先 `seek_to_end()`，再轮询 `poll_once_and_get_stats_lines()`；后者只读 `read_new_lines()`，即**自上次 _last_position 到文件末尾**。启动时 position 已在文件尾，之后若无新写入，读到的行数为 0，解析结果为空，必然打印全 “--”。  
- **是否与现象一致**：**是**。若用户期望“从整份日志中还原最近一条 stats”，当前架构**没有**“全文件或自某位置向前扫描取最后一条 stats”的路径。  
- **思路**：增加“全文件或从尾向前扫描、取最后一条完整 stats 行”的语义（例如 get_latest_stats_from_whole_file 或 read_from_tail_with_lookback），而不是仅 poll 新增内容。

### 可能性 2（高）：stats 行被拆成多行（层级/续行）

- **代码实际**：`parse_stats_line` 和 `_is_stats_line` 都针对**单行**；要求同一行内同时出现 “Boting duration” 与 “Performance:”。若日志里 stats 以多行形式出现（例如每行几个字段，或按固定 TAB/层级分行），则没有单行满足 _is_stats_line。  
- **LOG_INDENT_SPEC**：续行用行首空格（如 U+0020=3）标识；若 ROSBOT 输出 stats 时每行前有固定空格或 TAB，则同一逻辑“块”会被拆成多行，每行内容不完整。  
- **是否与现象一致**：**可能**。取决于实际日志是“一行塞满所有字段”还是“多行、固定格式分列”。  
- **思路**：  
  - 按 log_indent_spec 的块规则，将**同一块内多行拼接**后再做 _is_stats_line + parse_stats_line；或  
  - 先识别“块内是否包含 duration + Performance”，再在该块内做字段解析（可跨行）。

### 可能性 3（中）：拼写/格式与正则不一致

- **代码实际**：  
  - “Earned Xp” 正则为 `Earned\s+Xp`；实际日志为 **“Eamed Xp”** 时不会匹配，该字段缺失（其他字段仍可能匹配）。  
  - Shards 已兼容 “earned”/“eared”；duration 已兼容 “Boting”/“Botting”。  
- 若**整行**因编码、不可见字符或换行导致 “Performance:” 未出现在同一 strip() 后的字符串中，则 _is_stats_line 为 False，整行不解析。  
- **是否与现象一致**：**部分**。单 “Eamed” 只会导致 Earned Xp 一项为缺；若同时还有 1 或 2，则会出现“全 --”。  
- **思路**：对 “Eamed Xp” 等已知拼写变体增加别名正则；对整行做一次轻量归一化（如替换已知错别字、去掉零宽字符）再送入 _is_stats_line。

### 可能性 4（中）：固定 TAB/固定列宽、无冒号

- **用户提示**：“有些特殊标记 tab 没有特性而是固定的”。若日志用**固定 TAB 或固定列宽**分隔字段，且部分标签后无冒号（如 `Boting duration\t00.00:56:12`），则当前按 “duration\s*:\s*” 或 “Game #\s*\d+” 的正则可能匹配不到。  
- **代码实际**：所有模式都假设 “Label: value” 或 “Label value” 形式；未单独处理 “\t” 作为唯一分隔或固定宽度。  
- **思路**：  
  - 若为 TAB 分隔：可先按 `\t` 拆成列，再按列索引或列名映射到 Botting duration、Game #、…、Performance；  
  - 若为固定列宽：可先根据文档或样本定出每列起止位置，再切片取子串再解析。

### 可能性 5（低）：时间戳前缀导致长度或匹配异常

- **代码实际**：若 stats 行带 “YYYY-MM-DD HH:MM:SS,mmm INFO - ” 前缀，strip() 后整行仍含 “Boting duration” 和 “Performance:”，_is_stats_line 应为 True；正则用 re.search 在整行中搜索，前缀一般不影响。  
- 仅当**行过长被截断**或**编码错误**导致 “Performance:” 丢失时，才会整行不识别。  
- **思路**：确认实际日志中该行是否完整、编码是否一致；必要时对单行长度或编码做保护。

### 可能性 6（低）：LogStateReader 的块/层级未参与 stats 解析

- **代码实际**：LogInfoOrganizer 持有 LogStateReader，但 **get_latest_stats_as_lines / poll_once_and_get_stats_lines 未调用 Reader.load() 或 get_blocks_after 等**，仅用 Organizer 自身的 read_new_lines + parse_stats_line。即**缩进、层级、块结构目前未用于 stats 还原**。  
- **是否与现象一致**：若 stats 恰好落在“续行块”或需按块拼接才完整，则当前架构无法利用这些信息。  
- **思路**：在“多行一块”的方案中，使用 log_indent_spec / LogStateReader 的块划分，在块级别做 stats 检测与解析。

---

## 四、代码实际 vs 查找的是否是同一问题（对照表）

| 查找的问题 | 代码实际 | 是否同一问题 |
|------------|----------|--------------|
| 为何全部显示 “--” | 无 stats 行被识别时，test 脚本打印 _DEFAULT_PLACEHOLDER_LINES | **是**：输出全 “--” 即“解析结果为空” |
| 解析结果为何为空 | ① 只读尾部，启动后无新写入 ② 没有单行同时含 duration 与 Performance（多行拆分） ③ 整行格式/拼写与正则不符 | **是**：上述任一条都会导致 lines 为空 |
| 日志中的 tab/层级 | LOG_INDENT_SPEC：0 缩进=新条，正缩进=续行；log_state_reader 有块与层级，但 Organizer 未用 | **部分**：tab/层级影响“是否多行一块”；当前未用块做 stats 拼接 |
| 固定标记（无特性） | 正则以 “Label: value” / 空格为主，未专门处理“固定 TAB 分隔、无冒号” | **可能**：若日志确为固定 TAB/列宽，需单独分支 |

---

## 五、多种新思路（基于代码与文档，不限于当前结构）

1. **尾部 + 回看（tail + lookback）**  
   - 不只在 seek_to_end 后读“新增”；保留最近 N KB 或 M 行从尾向前扫描，直到找到一条满足 _is_stats_line 的行并解析，作为“当前显示”的 stats。这样即使本次 poll 没有新内容，也能显示文件中已有的最近一条 stats。

2. **按块拼接再解析**  
   - 使用 log_indent_spec 的规则：顶格为块头，后续同块续行归属该块。对每个块将多行拼接（或按行尾加空格/不换行）成一段，再对这段做 _is_stats_line + parse_stats_line。可处理“stats 跨多行、固定格式”的情况。

3. **兼容拼写与分隔符变体**  
   - 在 _STATS_PATTERNS 中为 “Earned Xp” 增加 “Eamed\s+Xp” 等别名；对 “Performance:” / “Performance ” 等已有多样性，可再确认实际日志中是否还有 “Performance\t” 等。若有固定 TAB，可增加“先按 \t 分列再按列名/位置映射”的路径。

4. **双模式：poll 新增 vs 全文件/尾段最近一条**  
   - 保留现有 poll_once_and_get_stats_lines（仅新内容）用于“实时更新”；新增“全文件或尾段扫描取最后一条 stats”的 API，供 test 脚本或 UI 在“无新数据时”显示最近一次有效 stats，避免一上来就全 “--”。

5. **用 LogStateReader 的块做“块级 stats”**  
   - 先 load() 或按需 get_blocks_after(0)，遍历块；对每个块将 head_sample + children 的 sample 拼成一段，再判断该段是否包含 duration + Performance，若是则对该段做字段解析。这样 stats 还原与“层级、续行”一致。

6. **固定 TAB / 固定列宽分支**  
   - 若样本中确认存在“TAB 分隔或固定列宽、无冒号”的 stats 行，可增加检测（例如行内 \t 数量或首列关键字），走“分列解析”分支，输出与现有 “Label: value” 一致的列表，便于复用现有展示逻辑。

---

## 六、架构与流程要点（供优化设计用）

### 6.1 当前数据流

1. test_log_organizer_poll.py：get_log_info_organizer(path) → seek_to_end() → 循环 poll_once_and_get_stats_lines()。  
2. poll_once_and_get_stats_lines() → get_latest_stats_as_lines() → read_new_lines() + 每行 parse_stats_line()。  
3. parse_stats_line()：_is_stats_line(line) 且逐条 _STATS_PATTERNS 匹配，返回 “Label: value” 列表。  
4. 无 stats 时返回 []，test 打印 _DEFAULT_PLACEHOLDER_LINES。

### 6.2 设计冲突点

- **“实时轮询新内容”** 与 **“从已有日志还原最近一条 stats”** 是两种需求；当前只实现了前者，且启动时 seek_to_end 导致“已有内容”永远不读。  
- **“单行 stats”** 与 **“多行/块内 stats”**：当前仅单行；若实际日志为多行或带固定 TAB/层级，需在解析前做拼接或分列。  
- **拼写与分隔符**：代码已部分兼容（Boting/earned/eared），但 “Eamed Xp” 与可能的固定 TAB 仍可能造成缺字段或整行不识别。

### 6.3 优化方向（仅设计，不改代码）

- 在 Organizer 或单独模块中增加“从文件尾或全文件取最后一条 stats”的接口，并在 test 脚本中在“本次 poll 为空”时调用该接口，用其结果显示而非直接打印全 “--”。  
- 引入“块”概念：用 log_indent_spec 的块规则或 LogStateReader 的块结构，对块内多行拼接后再解析，使层级/tab 参与数据还原。  
- 扩展正则与分隔符：支持 “Eamed Xp”；若存在固定 TAB/列宽格式，增加分列解析路径并统一输出为 “Label: value” 列表。  
- 在文档（如 LOG_INDENT_SPEC 或新 doc）中明确：stats 行在 ROSBOT 日志中的实际格式（单行/多行、是否带时间戳、是否 TAB/固定列、有无已知拼写变体），便于后续实现与测试对齐。

---

## 七、小结

- **全 “--” 的直接原因**：`poll_once_and_get_stats_lines()` 返回空列表，test 脚本用 _DEFAULT_PLACEHOLDER_LINES 占位。  
- **返回空的原因**（多种思路）：① **只读尾部**，启动后无新写入；② **stats 被拆成多行**，没有单行同时含 “Boting duration” 与 “Performance:”；③ 拼写（如 “Eamed Xp”）或固定 TAB/列宽导致整行不识别或字段缺失。  
- **tab/层级**：LOG_INDENT_SPEC 与 log_state_reader 已定义块与续行，但当前 stats 解析未使用块；若 stats 跨行或带固定缩进，需按块拼接或块级解析。  
- **优化方向**：增加“尾段/全文件取最后一条 stats”、按块拼接解析、兼容 Eamed/固定 TAB、并在文档中固定 stats 行格式说明。本文档仅分析与设计，暂不修改代码。
