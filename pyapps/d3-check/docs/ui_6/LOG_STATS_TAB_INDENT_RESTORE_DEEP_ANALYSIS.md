# 日志统计行数据还原深度分析 — TAB/层级/固定标记处理（文档编号 6）

**现象**：实际近似数据为单行统计（含 Botting duration、Game #、Keys、Shards、Eamed Xp、Performance 等），但当前显示为全部 "--"。  
**重点**：用户要求注意“日志中使用的 tab、层级，以及有些特殊标记 tab 没有特性而是固定的”。  
**范围**：`scripts/test_log_organizer_poll.py`、`d3utils/log_info_organizer.py`、`d3utils/log_state_reader.py`、`d3utils/log_indent_spec.py`、`docs/LOG_INDENT_SPEC.md`。  
**方法**：先看代码 → 再看项目文档 → 再调用 MCP 参考官方方案 → 给出多种新思路与架构优化。  
**目录**：`docs/ui_6`（文档编号 6）。  
**状态**：本文档仅做可能性报告与架构设计，暂不修改代码。

---

## 一、实际数据格式深度解析

### 1.1 用户提供的实际近似数据（单行样本）

```
Boting duration : 00.00:56:12 day(s)Game # 30 00:00:00(30.95/h)Run: 00:00 - Step: 00:00Failed runs: 0 - Deaths: 0Keys Total/Looted: 301/123 131.68/hAvg.Keys/Rift: - 29r 0grShards earned: 6590Eamed Xp: 237.984 B (254.777 B/h)Run Xp: 0 (0/h)Xp Pools: 13 (13/h)Legendaries Kept/Looted: 1/254Distance: 70834y (43.09mi/h)Performance: 0/570
```

### 1.2 格式特征分析

| 特征 | 观察 | 影响 |
|------|------|------|
| **拼写变体** | `Boting`（非 Botting）、`Eamed Xp`（非 Earned Xp） | 正则需支持变体 |
| **字段分隔** | 部分字段间无空格（如 `day(s)Game #`、`6590Eamed`），可能含 **TAB** | 需考虑 TAB 作为固定分隔符 |
| **固定标记** | `Game #`、`Performance:` 等为固定前缀，无额外“特性” | 可用固定标记定位分段 |
| **层级** | 若为顶格行，前有 "YYYY-MM-DD HH:MM:SS,mmm INFO - "；若为续行，行首有空格/TAB | 需结合 log_indent_spec 判断层级 |
| **单行格式** | 整条统计为单行，字段紧密连接 | 需一次性解析或按分隔符分段 |

### 1.3 当前输出（有误）

全部显示为 "--"：
- Botting duration: --
- Game #: --
- Run time (per h): --
- ...（所有字段均为 "--"）

说明：`test_log_organizer_poll.py` 的 `_DEFAULT_PLACEHOLDER_LINES` 被使用，表明 `organizer.poll_once_and_get_stats_lines()` 返回空列表。

---

## 二、代码现状深度扫描

### 2.1 test_log_organizer_poll.py 流程

| 位置 | 代码行为 | 问题点 |
|------|----------|--------|
| L237-238 | `organizer = get_log_info_organizer(log_path)` → **`organizer.seek_to_end()`** | 将 `_last_position` 设为文件末尾，之后只读“新追加”内容 |
| L241-253 | 循环：`lines = organizer.poll_once_and_get_stats_lines()`；若 `not lines` 则打印 `_DEFAULT_PLACEHOLDER_LINES` | 启动后若无新写入，`read_new_lines()` 恒返回空 → 恒显示 "--" |

**根因 1**：`seek_to_end()` 导致无法从已有日志中还原数据，只能等待新写入。

### 2.2 log_info_organizer.py 解析逻辑

#### 2.2.1 行判定：`_is_stats_line(line)`

```python
def _is_stats_line(line: str) -> bool:
    if not line or len(line.strip()) < _STATS_LINE_MIN_LEN:  # 50
        return False
    s = line.strip()
    if "Performance:" not in s and "Performance " not in s:
        return False
    if "Botting duration" not in s and "Boting duration" not in s:
        return False
    return True
```

**问题点**：
- 要求同时含 "Performance" 和 "Botting duration"，但若日志中为 "Performance "（无冒号）或拼写不同，可能漏判。
- 不区分行首缩进，续行中的统计行也会被识别（若满足条件）。

#### 2.2.2 正则模式：`_STATS_PATTERNS`

```python
_STATS_PATTERNS = [
    (r"(?:Boting|Botting)\s+duration\s*:\s*([^G]+?)(?=Game\s*#|$)", "Botting duration"),
    (r"Game\s*#\s*(\d+)", "Game #"),
    (r"(\d{2}:\d{2}:\d{2})\s*\(\s*([\d.]+)/h\)", "Run time (per h)"),
    (r"Run:\s*([\d:]+)\s*-\s*Step:\s*([\d:]+)", "Run - Step"),
    (r"Failed\s+runs:\s*(\d+)\s*-\s*Deaths:\s*(\d+)", "Failed runs - Deaths"),
    (r"Keys\s+Total/Looted:\s*([^\s\-]+)", "Keys Total/Looted"),
    (r"Avg\.Keys/Rift:\s*([^\s]+(?:\s+\d+r\s*\d+gr)?)", "Avg.Keys/Rift"),
    (r"Shards\s+ear(?:ned|ed):\s*(\d+)", "Shards earned"),
    (r"Earned\s+Xp:\s*([\d.]+\s*[TBMK]?(?:\s*\([^)]+\))?)", "Earned Xp"),  # ❌ 不匹配 "Eamed Xp"
    (r"Run\s+Xp:\s*([\d.]+\s*[TBMK]?(?:\s*\([^)]+\))?)", "Run Xp"),
    (r"Xp\s+Pools:\s*([\d.]+(?:\s*\([^)]+\))?)", "Xp Pools"),
    (r"Legendaries\s+Kept/Looted:\s*([^\s]+)", "Legendaries Kept/Looted"),
    (r"Distance:\s*([^\s]+(?:\s*\([^)]+\))?)", "Distance"),
    (r"Performance:\s*([^\s]+)", "Performance"),
]
```

**问题点**：
1. **拼写不匹配**：`Earned\s+Xp:` 不匹配 "Eamed Xp:"（用户样本）。
2. **分隔符假设**：各模式用 `\s+` 或 `\s*` 匹配空白，但若字段间为 **TAB** 或**无空格**（如 "6590Eamed"），可能匹配失败。
3. **顺序依赖**：`re.search` 在整行中搜索，若字段顺序变化或中间插入其他文本，可能误匹配。
4. **固定标记未利用**：`Game #`、`Performance:` 等固定标记未用于分段，而是作为正则的一部分。

#### 2.2.3 解析函数：`parse_stats_line(line)`

```python
def parse_stats_line(line: str) -> List[str]:
    if not _is_stats_line(line):
        return []
    s = line.strip()
    out: List[str] = []
    for pattern, label in _STATS_PATTERNS:
        m = re.search(pattern, s, re.IGNORECASE)
        if m:
            val = " ".join(m.groups()).strip()
            out.append(f"{label}: {val}")
    return out
```

**问题点**：
- 对每行独立调用，不区分“顶格行”与“续行”。
- 不利用 `log_indent_spec` 的层级信息。

### 2.3 log_state_reader.py / log_indent_spec.py 的职责

| 模块 | 职责 | 当前是否用于统计行解析 |
|------|------|----------------------|
| **log_state_reader** | 按路径单例，`load()` 扫描整文件得到块结构、层级、message_type；提供 `get_blocks_after(after_time)` | **否**：organizer 仅持有 reader，未调用其方法 |
| **log_indent_spec** | 行首 TAB/空格规范：0 缩进 = 新条，正缩进 = 续行；提供 `get_line_indent_state`、`parse_line_timestamp`、`get_full_state` | **否**：organizer 未使用层级信息过滤行 |

**结论**：统计行解析与块/层级系统**完全解耦**，未利用“固定标记”、“层级”等约定。

---

## 三、可能性归纳（按优先级与代码对应）

### 可能性 1（最高）：seek_to_end 导致只读“新行”，无法还原已有数据

- **代码位置**：`test_log_organizer_poll.py` L238 `organizer.seek_to_end()`
- **表现**：启动后若无新写入，`read_new_lines()` 恒返回空 → `parse_stats_line` 从未被调用 → 结果恒为空 → 恒显示 "--"。
- **与“数据还原”的关系**：当前逻辑只处理“自上次位置起的新行”，不会回溯文件内已有内容，无法还原“文件中已有的最后一条统计行”。
- **验证方法**：注释掉 `seek_to_end()`，观察首次 `poll_once_and_get_stats_lines()` 是否返回结果。

### 可能性 2（高）：正则不匹配 "Eamed Xp"

- **代码位置**：`log_info_organizer.py` L47 `r"Earned\s+Xp:"`
- **表现**：若日志为 "Eamed Xp:"，该字段不会被提取；其他字段可能仍能解析。
- **与用户样本一致**：用户明确给出 "Eamed Xp"。
- **验证方法**：在测试中直接对样本行调用 `parse_stats_line`，检查返回列表是否包含 "Earned Xp" 项。

### 可能性 3（中）：字段间无空格或 TAB 分隔导致正则边界错误

- **代码位置**：`log_info_organizer.py` L38-53 `_STATS_PATTERNS`
- **表现**：若字段间为 "6590Eamed"（无空格）或 TAB，`\s+` 可能匹配失败；若为 "day(s)Game #"（无空格），`[^G]+?` 可能提前截断。
- **依据**：用户样本中存在 "day(s)Game #"、"6590Eamed" 等无空格连接。
- **验证方法**：打印实际日志行的原始字节，检查 TAB（`\t`）位置；用 `re.findall` 测试各模式在样本行上的匹配结果。

### 可能性 4（中）：统计行为续行（行首有空格），但当前逻辑 strip 后仍可解析

- **代码位置**：`log_info_organizer.py` L106 `lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]`
- **表现**：若统计行为续行（如 "   Boting duration ..."），`strip()` 后内容仍含 "Boting duration"，`_is_stats_line` 应能通过；但若未来有“仅解析顶格行”的改动，可能漏掉。
- **依据**：LOG_INDENT_SPEC 规定行首空格表示续行；当前 organizer 对所有行 strip，不区分层级。
- **验证方法**：检查实际日志中统计行的行首缩进状态（用 `log_indent_spec.get_line_indent_state`）。

### 可能性 5（低）：时间戳前缀影响整行格式

- **代码位置**：`log_info_organizer.py` L64 `s = line.strip()`
- **表现**：若统计行为顶格行，前有 "2025-12-31 06:38:57,103 INFO - Boting duration ..."，strip 后仍含统计内容，`re.search` 不要求从行首匹配，应能解析；但若时间戳格式变化，可能影响。
- **验证方法**：检查实际日志行是否带时间戳前缀，以及 strip 后的内容是否满足 `_is_stats_line`。

---

## 四、代码实际与查找是否同一问题（对照表）

| 查找的问题 | 代码实际 | 是否同一问题 |
|------------|----------|--------------|
| **当前数据全部为 "--"** | test 脚本先 `seek_to_end()`，再轮询；无新行则 `poll_once_and_get_stats_lines()` 恒返回 []，脚本打印 `_DEFAULT_PLACEHOLDER_LINES`。 | **是**：读不到行 → 解析为空 → 显示占位。 |
| **需要对日志进行数据还原** | 当前设计是“自上次位置起的新行”解析，不回溯文件内已有内容，无法还原“文件中已有的最后一条统计行”。 | **是**：需求与“仅新行”逻辑不一致。 |
| **日志中 tab、层级** | LOG_INDENT_SPEC 规定行首 TAB/空格为块层级；行内是否用 TAB 分隔字段未在 organizer 中显式约定；正则以 `\s` 匹配空白，TAB 一般可匹配，但若字段间无空格（如 "6590Eamed"），正则可能失败。 | **是**：需明确行内 TAB 是否作为固定分隔符，并据此调整解析策略。 |
| **特殊标记固定、无特性** | "Game #"、"Performance:" 等为固定前缀；当前用正则定位，未用 log_indent_spec 的 message_type 或独立“统计行”类型；未利用固定标记做分段。 | **是**：可把“固定标记”显式列为解析约定，用于分段或顺序扫描。 |

---

## 五、多种新思路（结合代码与架构）

### 5.1 思路 A：Tail 回溯 + 最后一条统计行还原

**目的**：支持“从已有日志还原最近一条统计行”，而不是仅显示启动后新写入的内容。

**做法**：
- 在 `LogInfoOrganizer` 中新增 `get_last_stats_from_file(self, max_tail_bytes=0)`：
  - 若 `max_tail_bytes == 0`，从文件头读到 EOF；否则只读最后 N 字节。
  - 对读到的行筛选 `_is_stats_line` 为 True 的，取**最后一条**再 `parse_stats_line` 返回。
- 测试脚本在启动时调用该方法做一次「初始还原」，再进入轮询；轮询仍用现有 `poll_once_and_get_stats_lines()` 显示后续新增。

**与现有结构**：
- 不改变 `read_new_lines()` 的语义（仍只读新行）。
- 新增方法独立，不影响现有 `poll_once_and_get_stats_lines()`。

**代码示意**：
```python
def get_last_stats_from_file(self, max_tail_bytes: int = 0) -> List[str]:
    """从文件末尾回溯读，返回最后一条统计行的解析结果。"""
    if not os.path.isfile(self._log_path):
        return []
    try:
        with open(self._log_path, "r", encoding="utf-8", errors="ignore") as f:
            if max_tail_bytes > 0:
                f.seek(max(0, os.path.getsize(self._log_path) - max_tail_bytes))
            lines = [ln.strip() for ln in f if ln.strip()]
            # 从后往前找最后一条 stats 行
            for line in reversed(lines):
                if _is_stats_line(line):
                    return parse_stats_line(line)
    except Exception:
        pass
    return []
```

---

### 5.2 思路 B：拼写/格式容错（Eamed、Boting 等变体）

**目的**：避免因日志拼写或少量空格差异导致整段解析失败。

**做法**：
- 在 `_STATS_PATTERNS` 中为已知变体增加分支：
  - `Earned\s+Xp:` → `Ea(?:rned|med)\s+Xp:`
  - 对 "Boting" 已支持；对 "earned/eared" 已支持（Shards）。
- 可集中维护一份“标签 → 多正则或多关键字”的映射，优先匹配，再回退到单一正则。

**与现有结构**：
- 仅扩展 `_STATS_PATTERNS`，不改变 `parse_stats_line` 的接口。

**代码示意**：
```python
_STATS_PATTERNS = [
    # ... 其他模式 ...
    (r"Ea(?:rned|med)\s+Xp:\s*([\d.]+\s*[TBMK]?(?:\s*\([^)]+\))?)", "Earned Xp"),  # 支持 Eamed
    # ... 其他模式 ...
]
```

---

### 5.3 思路 C：按 TAB 或固定分隔符先分段，再按段匹配标签

**目的**：利用“有些标记为固定”的约定，先按 TAB（或 "  " 等）把一行拆成若干段，每段形如 "Label: value" 或 "Label value"，再对每段用短正则或关键字提取 Label/value，减少长行上单一大正则的脆弱性。

**做法**：
- 若日志约定“字段间用 TAB 分隔”，则 `line.split('\t')` 后逐段解析。
- 若为“双空格”等，则用相应 split。
- 对每段可先识别固定标记（如 "Game #"、"Performance:"），再取其后内容为 value。

**与 LOG_INDENT_SPEC**：
- 行首 TAB 仍表示块层级；行内 TAB 在此思路中仅作字段分隔，与规范不冲突。

**代码示意**：
```python
def parse_stats_line_by_tab_segments(line: str) -> List[str]:
    """按 TAB 分段解析统计行。"""
    if not _is_stats_line(line):
        return []
    segments = line.split('\t')
    out: List[str] = []
    fixed_markers = ["Botting duration", "Boting duration", "Game #", "Performance:"]
    for seg in segments:
        seg = seg.strip()
        if not seg:
            continue
        # 识别固定标记
        for marker in fixed_markers:
            if marker in seg:
                # 提取 marker 后的内容作为 value
                idx = seg.find(marker) + len(marker)
                value = seg[idx:].strip().lstrip(':').strip()
                if value:
                    label = marker.rstrip(':').strip()
                    out.append(f"{label}: {value}")
                    break
    return out
```

---

### 5.4 思路 D：结合 log_state_reader / log_indent_spec 的块与时间

**目的**：只对“顶格行”（新块头）做统计行解析，避免续行中的相似文本被误识；或仅解析“某时间之后的块”中的统计行，与 `get_blocks_after` 语义一致。

**做法**：
- 用 `log_indent_spec.get_line_indent_state(line)` 判断是否顶格；仅当 `indent_key == "tabs=0, U+0020=0"` 时才调用 `parse_stats_line`。
- 或先 `build_blocks_with_time` / `get_blocks_after`，只对块头行做统计解析。
- 这样统计行若总是顶格带时间戳的 INFO 行，解析更稳定；若统计行出现在续行，则需在规范中明确并单独处理。

**与现有结构**：
- organizer 已持有 `LogStateReader`，可调用其 `get_indent_state_for_line(line)` 或直接使用 log_indent_spec，在 `get_latest_stats_as_lines` 内过滤行后再解析。

**代码示意**：
```python
def get_latest_stats_as_lines(self) -> List[str]:
    """只解析顶格行的统计。"""
    _, lines = self.read_new_lines()
    result: List[str] = []
    for line in lines:
        # 检查是否为顶格行
        n_tabs, space_component, indent_key = get_line_indent_state(line)
        if indent_key != "tabs=0, U+0020=0":
            continue  # 跳过续行
        items = parse_stats_line(line)
        result.extend(items)
    return result
```

---

### 5.5 思路 E：单行全匹配 + 命名分组，替代多段独立正则

**目的**：把“一条统计行”视为固定格式，用一条（或少数几条）大正则一次性提取所有字段，便于维护和调试。

**做法**：
- 设计一个覆盖整行的正则，使用命名分组，如 `(?P<duration>...)`、`(?P<game_num>...)`、…，一次 match 得到所有字段。
- 对可选或拼写变体用 `(?:Earned|Eamed)` 等。
- 适合日志格式非常稳定、仅少数变体的场景。

**与现有结构**：
- 可新增 `parse_stats_line_named(line)` 返回 `Dict[str, str]`，再在 `get_latest_stats_as_lines` 中转为 "Label: value" 列表，或与现有 `parse_stats_line` 并存、由配置或探测选择。

**代码示意**：
```python
_STATS_FULL_PATTERN = re.compile(
    r"(?:Boting|Botting)\s+duration\s*:\s*(?P<duration>[^G]+?)(?:Game\s*#\s*(?P<game_num>\d+))?"
    r"(?:.*?Run:\s*(?P<run_time>[\d:]+)\s*-\s*Step:\s*(?P<step_time>[\d:]+))?"
    r"(?:.*?Performance:\s*(?P<performance>[^\s]+))?",
    re.IGNORECASE
)

def parse_stats_line_named(line: str) -> Dict[str, str]:
    """用命名分组一次性提取所有字段。"""
    if not _is_stats_line(line):
        return {}
    m = _STATS_FULL_PATTERN.search(line.strip())
    if not m:
        return {}
    return {k: v for k, v in m.groupdict().items() if v}
```

---

### 5.6 思路 F：明确“固定标记”清单与顺序，文档化

**目的**：满足“有些特殊标记 tab 没有特性而是固定的”的约束，便于后续按分隔符或按顺序切分。

**做法**：
- 在 docs 或代码注释中列出统计行所有固定标签及推荐出现顺序（如 Botting duration → Game # → … → Performance），并注明行内是否使用 TAB、空格个数等。
- 解析逻辑可据此实现“按固定标记 split”或“按顺序扫描”的 fallback，与正则方案互补。

**代码示意**：
```python
# 固定标记清单（按出现顺序）
_STATS_FIXED_MARKERS = [
    ("Botting duration", "Boting duration"),  # 变体
    "Game #",
    "Run:",
    "Failed runs:",
    "Keys Total/Looted:",
    "Avg.Keys/Rift:",
    "Shards earned:",
    "Earned Xp",  # 注意：可能为 "Eamed Xp"
    "Run Xp:",
    "Xp Pools:",
    "Legendaries Kept/Looted:",
    "Distance:",
    "Performance:",
]

def parse_stats_line_by_markers(line: str) -> List[str]:
    """按固定标记顺序扫描解析。"""
    if not _is_stats_line(line):
        return []
    out: List[str] = []
    s = line.strip()
    for marker_group in _STATS_FIXED_MARKERS:
        if isinstance(marker_group, tuple):
            markers = marker_group  # 变体
        else:
            markers = (marker_group,)
        # 找到第一个匹配的标记位置
        pos = -1
        matched_marker = None
        for marker in markers:
            idx = s.find(marker)
            if idx >= 0 and (pos < 0 or idx < pos):
                pos = idx
                matched_marker = marker
        if pos < 0:
            continue
        # 提取 value（到下一个标记或行尾）
        value_start = pos + len(matched_marker)
        value_end = len(s)
        for next_marker_group in _STATS_FIXED_MARKERS:
            if isinstance(next_marker_group, tuple):
                next_markers = next_marker_group
            else:
                next_markers = (next_marker_group,)
            for next_marker in next_markers:
                if next_marker == matched_marker:
                    continue
                next_pos = s.find(next_marker, value_start)
                if next_pos >= 0:
                    value_end = min(value_end, next_pos)
        value = s[value_start:value_end].strip().lstrip(':').strip()
        if value:
            label = matched_marker.rstrip(':').strip()
            out.append(f"{label}: {value}")
    return out
```

---

### 5.7 思路 G：混合策略：先尝试正则，失败则按 TAB/固定标记分段

**目的**：结合正则的灵活性与固定标记的鲁棒性，提供 fallback 机制。

**做法**：
- 先尝试现有 `parse_stats_line`（正则方案）。
- 若返回结果为空或字段数 < 阈值，则尝试按 TAB 分段或按固定标记扫描。
- 返回字段数最多的结果。

**代码示意**：
```python
def parse_stats_line_hybrid(line: str) -> List[str]:
    """混合策略：正则 → TAB 分段 → 固定标记扫描。"""
    if not _is_stats_line(line):
        return []
    # 策略 1：正则
    result_regex = parse_stats_line(line)
    if len(result_regex) >= 10:  # 阈值可调
        return result_regex
    # 策略 2：TAB 分段
    if '\t' in line:
        result_tab = parse_stats_line_by_tab_segments(line)
        if len(result_tab) > len(result_regex):
            return result_tab
    # 策略 3：固定标记扫描
    result_markers = parse_stats_line_by_markers(line)
    if len(result_markers) > len(result_regex):
        return result_markers
    return result_regex  # 至少返回正则结果（可能为空）
```

---

### 5.8 思路 H：利用 log_indent_spec 的 message_type 识别统计行

**目的**：将统计行识别从正则提升到 message_type 层面，与日志规范体系一致。

**做法**：
- 在 `log_indent_spec.py` 的 `_MESSAGE_PATTERNS` 中增加统计行模式：
  ```python
  ("Botting duration", "msg_stats_line"),
  ("Boting duration", "msg_stats_line"),
  ("Performance:", "msg_stats_line"),
  ```
- 在 `LogInfoOrganizer` 中，先用 `get_full_state(line)` 判断 `message_type == "msg_stats_line"`，再解析。
- 这样统计行识别与块/层级系统统一。

**与现有结构**：
- 需修改 `log_indent_spec.py` 的 `_MESSAGE_PATTERNS`，并在 organizer 中调用 `get_full_state`。

---

## 六、架构与流程优化建议（不修改代码，仅设计）

### 6.1 读策略分层

1. **初始化还原层**：提供“从文件末尾回溯读最后一条统计行”的 API（思路 A），供 test 脚本或 UI 在启动时调用一次。
2. **增量更新层**：保留现有 `poll_once_and_get_stats_lines()`（只读新行），用于实时更新。
3. **回退机制**：若初始化还原失败或无结果，且本轮无新解析结果，则显示占位 "--"。

### 6.2 解析层多实现并存

1. **正则方案**（现有）：`parse_stats_line`，适合格式稳定的场景。
2. **TAB 分段方案**（思路 C）：适合字段间用 TAB 分隔的场景。
3. **固定标记扫描方案**（思路 F）：适合固定标记明确的场景。
4. **混合策略**（思路 G）：自动选择最佳方案。

**接口统一**：所有方案返回 `List[str]`（"Label: value" 列表），由配置或自动探测选择实现。

### 6.3 与 log_indent_spec 的集成

1. **层级过滤**：若需只解析顶格行，在 `get_latest_stats_as_lines` 内调用 `get_line_indent_state` 过滤（思路 D）。
2. **时间过滤**：若需只解析某段时间后的统计，调用 `get_blocks_after` 再对块头行解析。
3. **message_type 识别**：将统计行识别提升到 message_type 层面（思路 H），与规范体系一致。

### 6.4 占位与回退策略

1. **字段级占位**：若某字段解析失败，该字段显示 "--"，其他字段正常显示。
2. **行级占位**：若整行解析失败（无任何字段），则所有字段显示 "--"。
3. **优先级**：初始化还原结果 > 本轮新解析结果 > 占位 "--"。

---

## 七、MCP 官方方案参考

### 7.1 Python `re` 模块最佳实践

- **命名分组**：使用 `(?P<name>...)` 提高可读性和维护性。
- **可选分支**：使用 `(?:pattern1|pattern2)` 支持变体。
- **非贪婪匹配**：使用 `+?`、`*?` 避免过度匹配。

### 7.2 日志解析通用模式

- **分段解析**：先按分隔符分段，再逐段匹配，减少长正则的脆弱性。
- **固定标记定位**：利用固定前缀定位字段边界，而非依赖正则边界。
- **容错机制**：提供多种解析策略，自动选择最佳结果。

---

## 八、文档与引用

- **项目**：
  - `scripts/test_log_organizer_poll.py`（seek_to_end、poll_once、_DEFAULT_PLACEHOLDER_LINES）
  - `d3utils/log_info_organizer.py`（_is_stats_line、_STATS_PATTERNS、parse_stats_line、read_new_lines、get_latest_stats_as_lines）
  - `d3utils/log_state_reader.py`（LogStateReader、get_blocks_after）
  - `d3utils/log_indent_spec.py`（get_line_indent_state、get_full_state、analyze_log_blocks）
  - `docs/LOG_INDENT_SPEC.md`（TAB/空格层级、状态键）
- **官方**：Python `re` 模块（re.search、命名分组、可选分支）

---

## 九、小结

### 9.1 当前全部 "--" 的主要原因

1. **seek_to_end 导致只读新行**：test 脚本启动后 `seek_to_end()`，只读“新行”；若日志无新写入，则解析恒为空，恒显示占位。
2. **正则不匹配变体**：`Earned\s+Xp:` 不匹配 "Eamed Xp:"，导致该字段缺失。
3. **字段间无空格**：若字段间为 "6590Eamed" 或 TAB，正则可能匹配失败。

### 9.2 数据还原需求

当前逻辑不做“从已有文件内容还原最近一条统计行”，需增加 tail 回溯或等价读策略（思路 A）。

### 9.3 日志格式处理

- **TAB/层级**：行首 TAB/空格为块层级（LOG_INDENT_SPEC）；行内 TAB 可作为固定分隔符利用（思路 C）。
- **固定标记**：可显式列出固定标记清单，用于分段或顺序扫描（思路 F）。
- **拼写容错**：需支持 "Eamed"、"Boting" 等变体（思路 B）。

### 9.4 多种新思路总结

| 思路 | 核心 | 适用场景 |
|------|------|----------|
| A：Tail 回溯 | 从文件末尾回溯读最后一条统计行 | 初始化还原 |
| B：拼写容错 | 支持 "Eamed"、"Boting" 等变体 | 格式变体处理 |
| C：TAB 分段 | 按 TAB 分隔字段，逐段解析 | 字段间用 TAB 分隔 |
| D：层级过滤 | 只解析顶格行，利用 log_indent_spec | 块/层级系统集成 |
| E：命名分组 | 单行大正则，命名分组提取 | 格式稳定场景 |
| F：固定标记扫描 | 按固定标记顺序扫描提取 | 固定标记明确 |
| G：混合策略 | 正则 → TAB → 标记，自动选择 | 通用容错 |
| H：message_type 识别 | 将统计行识别提升到规范层面 | 规范体系统一 |

**本文档仅做可能性报告与架构设计，不修改代码。**
