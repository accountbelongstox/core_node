# 日志统计行数据还原显示为 "--" — 可能性报告（文档编号 6）

**现象**：实际近似数据为一条完整统计行（Botting duration、Game #、Run、Keys、Shards、Earned Xp、Performance 等均有值），但当前显示为全部占位 "Botting duration: -- Game #: -- … Performance: --"。  
**范围**：`scripts/test_log_organizer_poll.py`、`d3utils/log_info_organizer.py`，及 `log_state_reader` / `log_indent_spec`（含 docs/LOG_INDENT_SPEC.md）。先看代码 → 再看项目文档 → 再结合官方思路；**本文档仅做可能性报告与架构建议，暂不修改代码**。  
**目录**：`docs/ui_6`（文档编号 6）。

---

## 一、实际近似数据与当前输出的格式对照

### 1.1 用户提供的“实际近似数据”（单行样本）

单行、字段紧密相连，无换行：

```
Boting duration : 00.00:56:12 day(s)Game # 30 00:00:00(30.95/h)Run: 00:00 - Step: 00:00Failed runs: 0 - Deaths: 0Keys Total/Looted: 301/123 131.68/hAvg.Keys/Rift: - 29r 0grShards earned: 6590Eamed Xp: 237.984 B (254.777 B/h)Run Xp: 0 (0/h)Xp Pools: 13 (13/h)Legendaries Kept/Looted: 1/254Distance: 70834y (43.09mi/h)Performance: 0/570
```

要点：

- **拼写**：`Boting`（非 Botting）、**`Eamed Xp`**（非 Earned Xp）。
- **分隔**：字段间无换行，部分处无空格（如 `day(s)Game #`、`6590Eamed`），可能含 **TAB**（用户要求注意“日志中使用的 tab、层级”）。
- **固定标记**：部分标签为固定前缀（如 `Game #`、`Performance:`），无额外“特性”，仅作定位用。

### 1.2 当前输出（有误）

每项为 "Label: --"：

- Botting duration: --  
- Game #: --  
- Run time (per h): --  
- …  
- Performance: --

与 `test_log_organizer_poll.py` 中 `_DEFAULT_PLACEHOLDER_LINES` 一致，说明**解析结果为空或未使用**，最终回退到占位列表。

---

## 二、代码现状（流程与关键点）

### 2.1 test_log_organizer_poll.py

| 位置 | 行为 |
|------|------|
| L121-124 | 使用 `get_log_info_organizer(log_path)`，**随即 `organizer.seek_to_end()`**，然后进入循环。 |
| L126-134 | 每 1 秒调用 `organizer.poll_once_and_get_stats_lines()`；若返回空列表，则打印 `_DEFAULT_PLACEHOLDER_LINES`（全部 "--"）；否则打印解析出的 "Label: value" 行。 |

**结论**：`seek_to_end()` 把 `_last_position` 设为当前文件末尾，之后 `read_new_lines()` 只读**自该位置之后追加的内容**。若启动后日志没有新写入，则每次读到的 `lines` 为空 → `parse_stats_line` 从未被调用 → 结果恒为空 → 恒显示占位 "--"。这是**“当前数据（有误）”在轮询脚本场景下的首要原因**。

### 2.2 log_info_organizer.py

| 位置 | 行为 |
|------|------|
| L91-108 | `read_new_lines()`：从 `_last_position` 读至当前文件末尾，更新 `_last_position`，返回 (position, 非空 stripped 行列表)。 |
| L119-132 | `get_latest_stats_as_lines()`：调用 `read_new_lines()`，对**每一行**执行 `parse_stats_line(line)`，合并所有 "Label: value" 列表返回。 |
| L26-35 | `_is_stats_line(line)`：要求行中同时出现 "Performance:" 或 "Performance " 以及 "Botting duration" 或 "Boting duration"，且 strip 后长度 ≥ 50。 |
| L38-53 | `_STATS_PATTERNS`：一组 `(regex, label)`，按顺序 `re.search`，匹配到的 groups 拼成 value，得到 "Label: value"。 |
| L46-47 | **Earned Xp** 仅匹配 `Earned\s+Xp:`，不匹配 **Eamed Xp**（日志拼写）。 |

**结论**：  
- 若从未读到包含统计内容的行（例如因 seek_to_end 只读“新行”），则解析结果自然为空。  
- 若读到了统计行，但其中含 **Eamed** 等变体，则对应字段的正则会失败，该字段不会出现在结果中；其他字段仍可能解析成功。只有**整行不被判为 stats 行**或**所有模式都不匹配**时，才会得到空列表。

### 2.3 与 log_state_reader / log_indent_spec 的关系

| 模块 | 职责 | 与统计行解析的关系 |
|------|------|----------------------|
| **log_state_reader** | 按路径单例，`load()` 时用 `log_indent_spec.analyze_log_blocks()` 扫描整文件，得到块结构、层级、message_type 等；提供 `get_blocks_after(after_time)` 等。 | **当前未参与**统计行解析。organizer 仅使用 `get_log_state_reader(log_path)` 持有 reader，实际解析只依赖 `read_new_lines()` + `parse_stats_line()`。 |
| **log_indent_spec** | 行首 TAB/空格规范（docs/LOG_INDENT_SPEC.md）：0 缩进 = 新条，正缩进 = 续行；`get_line_indent_state`、`parse_line_timestamp`、`get_full_state` 等。 | 规范中写明：**当前样本未使用行首 TAB**（均为 0）；续行多为 3 空格。统计行若为**顶格行**（带时间戳的 INFO 行），会先有 "YYYY-MM-DD HH:MM:SS,mmm INFO - " 再跟 "Boting duration ..."；若为**续行**（行首有空格），则可能被按“块”归类，但 organizer 当前是**按行** strip 后逐行传 `parse_stats_line`，不区分块。 |

**结论**：  
- **TAB/层级**：规范中行首 TAB 表示块层级；若统计行**行内**用 TAB 分隔字段，当前正则以 `\s` 可匹配 TAB，一般仍可匹配，除非某处把 TAB 当特殊分隔符写死。  
- **固定标记**：日志中 "Game #"、"Performance:" 等为固定前缀；当前用正则定位，未用 log_indent_spec 的 message_type 识别“统计行”。

---

## 三、可能性归纳（按优先级）

### 可能性 1（高）：seek_to_end 导致只读“新行”，启动后无新内容则恒为空

- **表现**：运行 test_log_organizer_poll 后始终显示全部 "--"。
- **依据**：L122-123 先 `seek_to_end()` 再轮询；若日志在启动后无新写入，`read_new_lines()` 每次返回空列表，`parse_stats_line` 从未被调用，结果恒为空，脚本即恒打印 `_DEFAULT_PLACEHOLDER_LINES`。
- **与“数据还原”的关系**：若需求是“从已有日志中还原最近一条统计行”，当前逻辑只处理“自上次位置起的新行”，不会回溯文件内已有内容，导致无法还原。

### 可能性 2（高）：日志拼写 "Eamed Xp" 导致该字段不匹配

- **表现**：其他字段有值，仅 "Earned Xp" 为 "--"；或若 UI 按“必须全部字段都有值”才显示，则整条显示为 "--"。
- **依据**：_STATS_PATTERNS 中仅 `Earned\s+Xp:`，实际日志为 "Eamed Xp:"，正则不匹配，该字段不会出现在 `parse_stats_line` 的返回中。
- **与用户样本一致**：用户给出的近似数据中明确为 "Eamed Xp"。

### 可能性 3（中）：统计行带时间戳前缀，整行格式与正则假设不一致

- **表现**：行首为 "2025-12-31 06:38:57,103 INFO - Boting duration ..."，长度和内容均满足 _is_stats_line，但某些子模式因空格/标点/单位与正则不一致而匹配失败。
- **依据**：当前用 `re.search` 不要求从行首匹配，时间戳前缀不影响“整行中是否含 Botting duration / Performance”的判断；但若标签与值之间或值与下一标签之间为 **TAB**、或多个空格、或无空格（如 "6590Eamed"），部分模式的 `\s` 或 `[^\s\-]+` 等可能匹配到不期望的边界，导致漏匹配或多匹配。需用真实日志样本逐条验证。

### 可能性 4（中）：统计行以续行形式出现（行首有空格）

- **表现**：统计行在文件中为 "   Boting duration ..."（或其它正缩进），若上游只把“顶格行”当作有效行传入，或 strip 后与 _is_stats_line 的语义不一致，可能被忽略。
- **依据**：LOG_INDENT_SPEC 规定行首空格表示续行；当前 organizer 对 `read_new_lines()` 得到的每行做 `strip()` 后传 `parse_stats_line`，故**内容上**仍会包含 "Boting duration" 等，_is_stats_line 应能通过；但若未来有“仅解析顶格行”的改动，或读取逻辑过滤了续行，则可能漏掉统计行。

### 可能性 5（低）：编码/换行导致行被截断或合并

- **表现**：统计行被拆成多行或与其它行合并，导致整行不满足 _is_stats_line 或正则无法一次匹配完整。
- **依据**：当前以 `errors="ignore"` 打开文件，按 `splitlines()` 分行；若日志用非 UTF-8 或非常规换行，可能影响“单行”边界，概率较低但可留作排查项。

---

## 四、代码实际与查找是否同一问题（对照表）

| 查找的问题 | 代码实际 | 是否同一问题 |
|------------|----------|--------------|
| **当前数据全部为 "--"** | test 脚本先 `seek_to_end()`，再轮询；无新行则 `poll_once_and_get_stats_lines()` 恒返回 []，脚本打印 _DEFAULT_PLACEHOLDER_LINES。 | **是**：读不到行 → 解析为空 → 显示占位。 |
| **需要对日志进行数据还原** | 当前设计是“自上次位置起的新行”解析，不回溯文件内已有内容，无法还原“文件中已有的最后一条统计行”。 | **是**：需求与“仅新行”逻辑不一致。 |
| **日志中 tab、层级** | LOG_INDENT_SPEC 规定行首 TAB/空格为块层级；行内是否用 TAB 分隔字段未在 organizer 中显式约定；正则以 `\s` 匹配空白，TAB 一般可匹配。 | **是**：若行内用 TAB 作固定分隔，可考虑“按 TAB 分段”再逐段匹配，提高鲁棒性。 |
| **特殊标记固定、无特性** | "Game #"、"Performance:" 等为固定前缀；当前用正则定位，未用 log_indent_spec 的 message_type 或独立“统计行”类型。 | **是**：可把“固定标记”显式列为解析约定，或与 indent/state 结合。 |

---

## 五、多种新思路（结合代码与文档）

### 5.1 思路 A：回溯最近 N 行或全文件尾块，而不是只读“新行”

- **目的**：支持“从已有日志还原最近一条统计行”，而不是仅显示启动后新写入的内容。
- **做法**：在 organizer 或 test 脚本中，提供“初始化时从文件末尾回溯读最近 N 行（或最近 N KB）”，对这批行逐行 `parse_stats_line`，取**最后一条**非空解析结果作为“当前统计”；轮询仍只读新行，但展示时优先用“已还原的最近统计”，无则用新行解析结果，再无则 "--"。
- **与现有结构**：可新增 `get_latest_stats_from_tail(self, max_lines=500)`，内部 seek 到文件尾，再逐块向前读或按行回溯，不改变现有 `read_new_lines` 的语义。

### 5.2 思路 B：拼写/格式容错（Eamed、Boting 等）

- **目的**：避免因日志拼写或少量空格差异导致整段解析失败。
- **做法**：在 _STATS_PATTERNS 中为已知变体增加分支，例如 `Earned\s+Xp` 改为 `Ea(?:rned|med)\s+Xp`；对 "Boting" 已支持；对 "earned/eared" 已支持。可集中维护一份“标签 → 多正则或多关键字”的映射，优先匹配，再回退到单一正则。
- **与现有结构**：仅扩展 _STATS_PATTERNS 或拆成“多模式 per 标签”，不改变 parse_stats_line 的接口。

### 5.3 思路 C：按 TAB 或固定分隔符先分段，再按段匹配标签

- **目的**：利用“有些标记为固定”的约定，先按 TAB（或 "  " 等）把一行拆成若干段，每段形如 "Label: value" 或 "Label value"，再对每段用短正则或关键字提取 Label/value，减少长行上单一大正则的脆弱性。
- **做法**：若日志约定“字段间用 TAB 分隔”，则 `line.split('\t')` 后逐段解析；若为“双空格”等，则用相应 split；对每段可先识别固定标记（如 "Game #"、"Performance:"），再取其后内容为 value。
- **与 LOG_INDENT_SPEC**：行首 TAB 仍表示块层级；行内 TAB 在此思路中仅作字段分隔，与规范不冲突。

### 5.4 思路 D：结合 log_state_reader / log_indent_spec 的块与时间

- **目的**：只对“顶格行”（新块头）做统计行解析，避免续行中的相似文本被误识；或仅解析“某时间之后的块”中的统计行，与 get_blocks_after 语义一致。
- **做法**：用 `log_indent_spec.get_line_indent_state(line)` 判断是否顶格；仅当 `indent_key == "tabs=0, U+0020=0"` 时才调用 `parse_stats_line`；或先 `build_blocks_with_time` / `get_blocks_after`，只对块头行做统计解析。这样统计行若总是顶格带时间戳的 INFO 行，解析更稳定；若统计行出现在续行，则需在规范中明确并单独处理。
- **与现有结构**：organizer 已持有 `LogStateReader`，可调用其 `get_indent_state_for_line(line)` 或直接使用 log_indent_spec，在 `get_latest_stats_as_lines` 内过滤行后再解析。

### 5.5 思路 E：单行全匹配 + 命名分组，替代多段独立正则

- **目的**：把“一条统计行”视为固定格式，用一条（或少数几条）大正则一次性提取所有字段，便于维护和调试。
- **做法**：设计一个覆盖整行的正则，使用命名分组，如 `(?P<duration>...)`、`(?P<game_num>...)`、…，一次 match 得到所有字段；对可选或拼写变体用 `(?:Earned|Eamed)` 等。适合日志格式非常稳定、仅少数变体的场景。
- **与现有结构**：可新增 `parse_stats_line_named(line)` 返回 `Dict[str, str]`，再在 get_latest_stats_as_lines 中转为 "Label: value" 列表，或与现有 parse_stats_line 并存、由配置或探测选择。

### 5.6 思路 F：明确“固定标记”清单与顺序，文档化

- **目的**：满足“有些特殊标记 tab 没有特性而是固定的”的约束，便于后续按分隔符或按顺序切分。
- **做法**：在 docs 或代码注释中列出统计行所有固定标签及推荐出现顺序（如 Botting duration → Game # → … → Performance），并注明行内是否使用 TAB、空格个数等；解析逻辑可据此实现“按固定标记 split”或“按顺序扫描”的 fallback，与正则方案互补。

---

## 六、架构与流程优化建议（不修改代码，仅设计）

1. **读策略**：区分“仅新行”（当前）与“还原最近一条统计行”。后者建议在 organizer 或上层提供“tail 回溯 + 解析最后一条”的 API，test 脚本或 UI 在启动时调用一次以还原，再轮询新行做增量更新。  
2. **解析层**：保持“行 → List[Label: value]”的接口，内部可多实现并存（多正则、按 TAB 分段、单行命名分组），由配置或自动探测选择。  
3. **与 log_indent_spec 的集成**：若需按块/层级过滤，仅在“顶格行”解析统计，则依赖 `get_line_indent_state` / `indent_key_to_level`；若需按时间只解析某段时间后的统计，可依赖 `get_blocks_after` 再对块头行解析。  
4. **占位与回退**：当前“解析为空则全显示 --”合理；若采用“还原最近一条”，建议逻辑为：有“最近一条”则用其填充各字段，缺字段的用 "--"；无“最近一条”且本轮无新解析结果时，再整行占位 "--"。

---

## 七、文档与引用

- **项目**：`scripts/test_log_organizer_poll.py`（seek_to_end、poll_once、_DEFAULT_PLACEHOLDER_LINES）、`d3utils/log_info_organizer.py`（_is_stats_line、_STATS_PATTERNS、parse_stats_line、read_new_lines、get_latest_stats_as_lines）、`d3utils/log_state_reader.py`、`d3utils/log_indent_spec.py`、`docs/LOG_INDENT_SPEC.md`（TAB/空格层级、状态键）。  
- **官方**：Python `re` 模块（re.search、分组、可选分支 (?:Earned|Eamed)）；无额外 MCP 引用。

---

## 八、小结

- **当前全部 "--" 的主要原因**：test 脚本启动后 `seek_to_end()`，只读“新行”；若日志无新写入，则解析恒为空，恒显示占位。  
- **数据还原**：当前逻辑不做“从已有文件内容还原最近一条统计行”，需增加 tail 回溯或等价读策略。  
- **日志格式**：实际样本存在 "Eamed Xp"、无空格连接（如 "day(s)Game #"）等，需在正则或分段逻辑中做拼写/分隔容错；TAB 与层级在 LOG_INDENT_SPEC 中已约定，行内 TAB 可作为固定分隔符思路利用。  
- **多种新思路**：回溯读 tail、拼写容错、按 TAB/固定标记分段、结合 indent 只解析顶格行、单行命名分组、固定标记清单文档化；可组合使用并与现有架构兼容。本文档仅做可能性报告与设计建议，不修改代码。
