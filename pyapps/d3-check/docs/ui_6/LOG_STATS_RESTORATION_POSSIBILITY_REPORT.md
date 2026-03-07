# 日志统计行数据还原可能性报告（文档编号 6）

**目录**: `docs/ui_6`  
**涉及**: `scripts/test_log_organizer_poll.py`、`d3utils/log_info_organizer.py`、`d3utils/log_state_reader.py`、`d3utils/log_indent_spec.py`  
**目的**: 对日志进行数据还原时，当前输出全部为 `--`，本报告结合代码与文档给出根因与多种思路，**仅创建文档，不修改代码**。

---

## 一、现象与目标

### 1.1 实际近似数据（日志中应有的一行）

单行、无换行，部分拼写与空格与规范不一致：

```
Boting duration : 00.00:56:12 day(s)Game # 30 00:00:00(30.95/h)Run: 00:00 - Step: 00:00Failed runs: 0 - Deaths: 0Keys Total/Looted: 301/123 131.68/hAvg.Keys/Rift: - 29r 0grShards earned: 6590Eamed Xp: 237.984 B (254.777 B/h)Run Xp: 0 (0/h)Xp Pools: 13 (13/h)Legendaries Kept/Looted: 1/254Distance: 70834y (43.09mi/h)Performance: 0/570
```

要点：

- 拼写: `Boting`（非 Botting）、`Eamed`（非 Earned）。
- 层级/缩进: 该行在文件中可能是**顶格行**（带时间戳）或**续行**（行首 TAB/空格，见 LOG_INDENT_SPEC）。
- 部分字段间无空格（如 `day(s)Game #`、`6590Eamed`），部分为固定标签格式。

### 1.2 当前输出（有误）

所有字段均为占位符 `--`：

- Botting duration: --
- Game #: --
- Run time (per h): --
- Run - Step: --
- Failed runs - Deaths: --
- Keys Total/Looted: --
- Avg.Keys/Rift: --
- Shards earned: --
- Earned Xp: --
- Run Xp: --
- Xp Pools: --
- Legendaries Kept/Looted: --
- Distance: --
- Performance: --

---

## 二、当前架构与数据流（代码实际）

### 2.1 调用链

```
test_log_organizer_poll.py
  → get_log_info_organizer(log_path)   # 单例
  → organizer.seek_to_end()            # 将 _last_position 设为当前文件大小
  → while: organizer.poll_once_and_get_stats_lines()
       → get_latest_stats_as_lines()
          → read_new_lines()           # 从 _last_position 读到 EOF，更新 _last_position
          → 对每条 line 调用 parse_stats_line(line)，合并结果
       → 若 result 为空 → 打印 _DEFAULT_PLACEHOLDER_LINES（全部 "--"）
```

### 2.2 关键实现

| 位置 | 行为 |
|------|------|
| `log_info_organizer.py` | `read_new_lines()` 仅读取「自 `_last_position` 到当前 EOF」的内容；读取后更新 `_last_position`。 |
| 同文件 | `_is_stats_line(line)`：要求行中同时存在 `Performance:`（或 `Performance `）与 `Botting duration` 或 `Boting duration`，且 `len(line.strip()) >= 50`。 |
| 同文件 | `parse_stats_line(line)`：仅当 `_is_stats_line(line)` 为 True 时，用 `_STATS_PATTERNS` 的正则依次匹配，输出 `"Label: value"` 列表。 |
| `test_log_organizer_poll.py` | 启动后先 `seek_to_end()`，再轮询；若本轮没有解析到任何 stats 行，则打印占位符。 |

### 2.3 与 log_state_reader / log_indent_spec 的关系

- **log_state_reader**：基于 `log_indent_spec` 的 `analyze_log_blocks` 做整文件扫描，提供「缩进状态、消息类型、块、时间戳、get_blocks_after」等，**不参与** stats 行的识别与解析。
- **log_indent_spec**：定义行首 TAB/空格层级（如 `tabs=0, U+0020=0` 为新条，`U+0020=3` 为续行）；消息类型中有 `"Botting !"` → `msg_Botting`，**没有**专门针对「整行统计行」（Botting duration + … + Performance）的类型。
- **log_info_organizer**：**不依赖** log_state_reader / log_indent_spec，仅按「文件位置 + 原始行文本」做 tail 读取与正则解析。

因此：**数据还原是否成功，完全由「是否读到包含统计内容的行」以及「正则是否匹配当前行格式」决定。**

---

## 三、根因分析（代码实际 vs 还原目标）

### 3.1 主要原因：只消费「新追加」内容，不读已有内容

- 测试脚本启动时调用 **`seek_to_end()`**，将 `_last_position` 设为当前文件末尾。
- 之后每次 `poll_once_and_get_stats_lines()` 只处理 **从 `_last_position` 到当前 EOF** 的新增内容。
- 若统计行在脚本启动前就已写入文件，则**永远不会被读到**，`parse_stats_line` 从未被调用，结果必然为空，于是始终打印 `_DEFAULT_PLACEHOLDER_LINES`（全部 `--`）。

即：**当前设计是「仅对新增行做 stats 解析」的 tail 模式，与「从已有日志中还原出最新一条统计」的目标不一致。**

### 3.2 次要原因：日志拼写与正则不一致

- 实际日志为 **`Eamed Xp:`**，而 `_STATS_PATTERNS` 中为 **`Earned\s+Xp:`**，该字段无法匹配，即使读到了行也会缺「Earned Xp」。
- `_is_stats_line` 已兼容 `Boting duration`，主入口判断无问题；字段级兼容可再扩展（见下）。

### 3.3 层级/缩进的影响（LOG_INDENT_SPEC）

- 规范：行首无 TAB、无空格 = 新日志条；有空格（如 3 空格）= 续行。部分标记是「固定格式」，不依赖 TAB 语义。
- 统计行可能是**带时间戳的顶格行**，也可能是**续行**（行首 TAB/空格）。  
- `_is_stats_line` 与 `parse_stats_line` 均对 **`line.strip()`** 做判断和匹配，**不依赖行首缩进**，因此只要该行在「被读到的内容」里，顶格或续行都能被识别。  
- 若统计被拆成**多行**（例如每行几个字段），则没有单行同时含 `Botting duration` 与 `Performance:`，`_is_stats_line` 恒为 False，当前逻辑无法还原。需多行拼接或按块解析（见思路四）。

---

## 四、多种思路（结合代码与文档）

### 思路一：不 seek_to_end，或按「模式」选择初始位置（推荐用于还原）

- **做法**：  
  - 若目标是「还原当前文件中的最新统计」，则**不要**在启动时调用 `seek_to_end()`，让 `_last_position` 保持 0（或上次关闭前保存的位置），这样第一次 `read_new_lines()` 会读到整个文件，从中解析出 stats 行；或  
  - 增加「初始化模式」：例如 `init_mode="restore"` 时从 0 开始读一遍并只保留「最后一条」stats；`init_mode="tail"` 时再使用 `seek_to_end()`。
- **代码点**：`test_log_organizer_poll.py` 中删除或条件化 `organizer.seek_to_end()`；或为 `LogInfoOrganizer` 增加 `reset_to_start()` / `seek(0)` 及「只取最后一条」的 API。
- **与文档一致**：不依赖 LOG_INDENT_SPEC 的层级，仅依赖「读到整行」；固定标记仍由正则识别。

### 思路二：在 Organizer 内提供「从全文件或尾部 N 行中取最后一条 stats」

- **做法**：  
  - 在 `LogInfoOrganizer` 中新增方法，例如 `get_last_stats_from_file(max_tail_bytes=0)`：若 `max_tail_bytes==0` 则从 0 读到 EOF，否则只读最后 N 字节；在得到的行中筛选 `_is_stats_line` 为 True 的，取**最后一条**再 `parse_stats_line` 返回。  
  - 测试脚本在启动时调用该方法做一次「初始还原」，再进入轮询；轮询仍可用现有 `poll_once_and_get_stats_lines()` 显示后续新增。
- **代码点**：`log_info_organizer.py` 增加一次按位置/尾部的只读扫描，不改变现有 `_last_position` 的 tail 语义（或仅在选择 restore 时临时改）。
- **与文档一致**：仍以「行」为单位，不依赖缩进层级；固定标记由现有正则处理。

### 思路三：放宽字段正则，兼容常见拼写与空格

- **做法**：  
  - 将 `Earned\s+Xp:` 改为例如 `E(?:arned|amed)\s+Xp:`，兼容 `Eamed`。  
  - 对其他可能拼写变体（如 Shards 已有 `ear(?:ned|ed)`）做类似放宽；并对「标签:」后的空格、无空格（如 `6590Eamed`）在正则中做容错。
- **代码点**：仅改 `_STATS_PATTERNS` 与可能的 `_is_stats_line`（若将来用更多字段作入口判断）。
- **与文档一致**：LOG_INDENT_SPEC 中「固定标记」可视为「内容上的固定关键字」，用正则容错不影响层级逻辑。

### 思路四：利用 log_state_reader / log_indent_spec 做「块内」或「多行」统计还原

- **做法**：  
  - 若将来统计被拆成多行（同一逻辑块内），可用 `log_indent_spec` 的「新块/续行」规则，将同一块的多行拼成一段再交给 `parse_stats_line`（或新写一个多行解析器）。  
  - 或先用 `log_state_reader.get_blocks_after(t)` 按时间取块，在块内容中查找包含 `Performance:` 与 duration 的片段再解析。
- **代码点**：在 `log_state_reader` 或新模块中，结合 `get_line_indent_state` / 块 API 产出「可能为 stats 的文本」，再调用 organizer 的解析或新解析函数。  
- **与文档一致**：显式使用 LOG_INDENT_SPEC 的层级与分块，适合「统计行非单行」或「需按块/时间过滤」的场景。

### 思路五：统一「最后一条 stats」的数据源与展示

- **做法**：  
  - 将「当前要展示的 stats」视为单一数据源：要么来自「文件内最后一次解析到的 stats 行」，要么来自「本轮 poll 新解析到的行」（若有多条可取最后一条）。  
  - 测试脚本：启动时先做一次「全文件或 tail 扫描」得到 last_stats；轮询时若有新解析结果则更新 last_stats，若无则**继续显示 last_stats**，仅在没有过任何 stats 时才显示 `--`。
- **代码点**：organizer 或脚本内维护 `last_parsed_stats`；`seek_to_end` 改为可选；poll 空结果时不覆盖已有 last_stats。
- **与文档一致**：不改变 LOG_INDENT_SPEC，只改变「何时读、何时更新、何时展示」的策略。

---

## 五、代码实际 vs 查找是否同一问题

| 维度 | 代码实际 | 还原目标（查找） | 是否同一问题 |
|------|----------|------------------|--------------|
| 读范围 | 仅自 `_last_position` 到 EOF（且常因 seek_to_end 而为空） | 需要从已有日志中读出「最新一条」统计行 | **是**：不读已有内容导致永远解析不到，直接表现为全部 `--`。 |
| 行格式 | 单行、strip 后含 duration + Performance | 实际为单行，但有 Boting/Eamed 等拼写 | **部分**：读不到是主因；拼写导致缺字段是次因。 |
| 层级/固定标记 | 不依赖缩进，仅用 strip 后内容 | 文档要求注意 tab/层级与固定标记 | **兼容**：当前实现不依赖 tab，固定标记由正则覆盖；若未来多行/块级解析则需结合 log_indent_spec。 |

结论：**主要问题是「只 tail 不扫已有」**；**次要问题是「Eamed」等拼写**。按思路一+二+三即可覆盖「从现有日志还原并正确显示」；思路四、五用于扩展与架构优化。

---

## 六、架构与流程优化建议（高层）

1. **职责分离**  
   - **解析**：仅负责「给定一行/一段文本 → 是否为 stats 行 + 字段列表」（可保留在 `log_info_organizer` 或独立模块）。  
   - **读取策略**：由调用方或 Organizer 的「模式」决定——restore（扫全文件/尾部）vs tail（仅新增）。

2. **单一数据源**  
   - 明确「当前 UI 显示的 stats」来自哪一次解析结果（例如 organizer 内部维护 `_last_stats_lines`），避免「无新行就清空」的占位符逻辑与「还原」目标冲突。

3. **与 log_indent_spec 的协同**  
   - 若始终是单行 stats，现有 strip + 正则即可。  
   - 若将来出现多行/块内 stats，可由 log_state_reader 或基于 log_indent_spec 的块遍历产出候选文本，再交给同一套解析逻辑，避免重复实现「何为 stats 行」的规则。

4. **测试脚本**  
   - 区分「仅看新增」与「启动时还原 + 再追新」两种用法；通过参数或配置选择是否 `seek_to_end()`、是否在无新行时保留上次解析结果。

---

## 七、小结

- **根因**：启动时 `seek_to_end()` 导致只处理「之后追加」的内容，已有统计行从未被读取，故输出恒为 `--`。  
- **次因**：日志中 `Eamed Xp` 与正则 `Earned\s+Xp` 不匹配，会导致该字段缺失。  
- **思路**：  
  - 不 seek_to_end 或按模式选择初始位置（思路一）；  
  - 提供「从全文件/尾部取最后一条 stats」的 API（思路二）；  
  - 放宽字段正则（思路三）；  
  - 多行/块级还原时结合 log_indent_spec（思路四）；  
  - 统一「最后一条」数据源与展示逻辑（思路五）。  

本报告仅做分析与方案说明，**不修改代码**；实现时可按优先级采用思路一、二、三，再视需要引入四、五。
