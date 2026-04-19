# 先民蓝门复用（`firstborn_blue_gate_reuse`）— 功能说明与 dot 对照

中文界面名：**先民蓝门复用**（`providor/i18n` 键 `rosbot.firstborn_blue_gate_reuse`）。英文：**Firstborn Blue Gate Reuse**。

这是 **ROSBOT 扩展页「Bot settings」** 里的一项**布尔开关**，不是 `main.py` 启动流程（入口与 HTTP 桥接见 [MAIN_PY_STARTUP_FOR_DOT.md](MAIN_PY_STARTUP_FOR_DOT.md)）。逻辑全部在 **日志解析层**（`d3utils/log_analyzer.py`），通过读 **ROSBOT 日志行** 更新 `share.game_interface_data` 中的地图/阶段状态。

---

## 1. 配置与界面

| 项 | 值 |
|----|-----|
| 配置键 | `rosbot.firstborn_blue_gate_reuse` |
| 类型 | `bool` |
| 默认 | `false`（`providor/template_config.json`、`ROSBOT_PANEL_CONFIG_KEYS`） |
| 界面位置 | `ui/panels/rosbot_extension_panel.py`：Bot settings **3×3 网格第 0 行第 2 列**（与「自动启用最新 ROS」「蓝门优先」同一行） |
| 绑定 | `ConfigBinding.create_checkbox_binding_with_initial`，持久化到用户配置 JSON |

**dot 侧已有对齐**：`ConfigKeys.RosbotFirstbornBlueGateReuse`、`I18nKeys.RosbotFirstbornBlueGateReuse`、`RosbotOptions.firstborn_blue_gate_reuse`（见 `dotapps/d3check`）。

---

## 2. 运行时行为（Python 源码）

实现类：`d3utils/log_analyzer.py` → `LogAnalyzer.analyze_line`。

### 2.1 计数器

- 实例字段：`self._firstborn_objective_count`（`int`，初始 `0`）。
- 每次日志行**包含**子串 **`Objective RunLogic: Temple of the Firstbor`**（注意日志里多为截断拼写 `Firstbor`，与 `history_indent_spec` 中 `msg_Objective_Firstborn` 一致）时：**计数 +1**。

### 2.2 与配置 `firstborn_blue_gate_reuse` 的分支

读取：`get_config_section("rosbot")` → `firstborn_blue_gate_reuse`（默认按 `False` 处理）。

记 `is_odd = (_firstborn_objective_count % 2 == 1)`。

| `firstborn_blue_gate_reuse` | 行为 |
|------------------------------|------|
| **关闭**（`false`） | **每次**出现上述 Objective 行：执行 `set_map_type("firstborn_temple")`、`set_game_stage("back_town")`，并认为 `updated`。 |
| **开启**（`true`） | **仅当计数为奇数**（第 1、3、5… 次）时，才执行上述 `set_map_type` / `set_game_stage`；**偶数次**不通过本分支更新地图（用于「蓝门复用」流程：隔次不把状态当成新一趟圣殿）。 |
| **开启** 且本次为奇数次 | 额外：`ColorPrint.blue`，文案为 i18n **`rosbot.firstborn_reuse_needed`**（中文：`当前需要复用 (第%s次)`，`%s` 为当前计数）。 |

### 2.3 与同文件其它「先民圣殿」规则的关系

同一次 `analyze_line` 里，后面还有**独立**判断（**不**受本开关影响计数逻辑之外的地图结果）：

- 若行内含 **`Running: Temple of the Firstborn`** → `set_map_type("firstborn_temple")`。

因此：**地图类型 `firstborn_temple`** 仍可能由其它日志行更新；本开关只约束 **「Objective RunLogic: Temple of the Firstbor…」** 这一条路径上**是否每次**都把地图/回城阶段写进 `game_state`。

---

## 3. dot 移植时要照抄的要点

1. **同一配置键**：`rosbot.firstborn_blue_gate_reuse`，默认 `false`。  
2. **同一计数语义**：仅对上述 **Objective RunLogic** 子串递增；进程内持久计数（与 Python 单例 `LogAnalyzer` 一致）。  
3. **同一奇偶规则**：开启时仅奇数次更新 `map_type`/`game_stage`（与 Python `if not firstborn_reuse or is_odd` 一致）。  
4. **可选日志提示**：奇数次且开启时，输出与 `rosbot.firstborn_reuse_needed` 等价文案。  
5. **不要**把本功能混成 `main.py` 或 HTTP 桥接初始化；它属于 **日志监视 → LogAnalyzer → game_interface_data**。

---

## 4. 代码锚点

| 用途 | 路径 |
|------|------|
| 配置默认与说明文案 | `providor/template_config.json`（`firstborn_blue_gate_reuse`、`firstborn_blue_gate_reuse_description`） |
| i18n | `providor/i18n/i18n_rosbot_panel_zh.json` / `_en.json`（`firstborn_blue_gate_reuse`、`firstborn_reuse_needed`） |
| UI 勾选框 | `ui/panels/rosbot_extension_panel.py`（`ROSBOT_PANEL_CONFIG_KEYS`、`add_check` 第 0 行第 2 列） |
| 核心逻辑 | `d3utils/log_analyzer.py`（`LogAnalyzer.__init__` 中 `_firstborn_objective_count`；`analyze_line` 中 Firstborn 段） |

---

*若 ROSBOT 日志格式变更导致子串不匹配，需同步更新 `log_analyzer` 与本文。*
