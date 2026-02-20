# 自动使用界面 - 铁匠流程（bag_opened_indicator 扩展）

**铁匠与魔盒为不同流程，不可混为一谈：铁匠 = blacksmith（拆解装备），魔盒 = Kanai Cube（升级/重铸等），二者界面与逻辑均不同。**

## 概述

- **铁匠 (blacksmith)**：同一图标 `bag_opened_indicator`，仅当匹配中心在窗口**最左 30% 宽**内时视为铁匠入口；靠右则仅表示背包已打开，不视为铁匠。
- **魔盒 (Kanai Cube)**：**唯一图标为 `kanai_cube_left_panel_indicator`**，且**匹配中心也须在窗口最左 30% 宽内**；魔盒与铁匠为不同界面，识别后走 Kanai 流程，不走铁匠拆解。

助手热键触发的「自动使用界面」中，铁匠相关流程以「铁匠 UI 指示器」为入口，且仅在用户开启了「铁匠升级」或「自动分解装备」之一时才尝试识别铁匠界面，避免影响魔盒等其他流程。

**同一图标、按位置区分**：模板 `bag_opened_indicator` 为**同一个图标**。  
- **靠左 30% 区域宽内**匹配到 → 视为**铁匠**流程入口。  
- **靠右**（即匹配中心不在左 30% 内）→ 仅表示**背包已打开**，**不视为铁匠**，不进入铁匠分支。  

若未在左 30% 内匹配到该图标，再尝试魔盒指示器；若魔盒也未找到且需要铁匠，则提示「先没有找到铁匠UI」。

## 流程

1. **前置条件（UI 配置）**  
   以下两项至少开启其一，才进入铁匠流程的识别：
   - **铁匠升级**：`macro_configs.auxiliary_config.blacksmith.enabled`
   - **自动分解装备**：`macro_configs.auxiliary_config.auto_salvage.enabled`  
   若两者都未开启，不尝试用 `bag_opened_indicator` 作铁匠入口，仅按现有逻辑识别魔盒（`kanai_cube_left_panel_indicator`），不进入铁匠分支。

2. **查找铁匠 UI（仅 bag_opened_indicator + 左 30%）**  
   当上述前置条件满足时（`want_blacksmith=True`）：
   - 匹配模板 `bag_opened_indicator`；**仅当匹配中心落在游戏窗口最左 30% 宽度内**（`is_match_center_in_left_region`）时才视为铁匠流程入口；**同一图标在靠右时仅表示背包已打开，不视为铁匠**。
   - 若在左 30% 内匹配到 → 判定为铁匠流程，继续步骤 3。
   - 若未在左 30% 内匹配到（或未匹配到）→ 再尝试匹配 `kanai_cube_left_panel_indicator`；若仍无且需要铁匠，则提示「**先没有找到铁匠UI**」并结束，不执行后续逻辑。

3. **确认背包打开并遍历装备**  
   在已判定为铁匠流程后，沿用当前逻辑：
   - 使用当前共享画面收集背包/界面信息（`collect_bag_info_from_current_shared`），等价于确认背包已打开并可用的状态。
   - 根据配置执行：
     - 若开启了「自动分解装备」：按下拉框选择的保留规则遍历所有装备格：
       - **保留远古+**（`keep_ancient_plus`）：保留远古、太古传奇，分解普通传奇及蓝白。
       - **仅保留太古**（`keep_primal`）：只保留太古传奇，分解普通/远古传奇及蓝白。
       - 遍历时输出 DEBUG 提示：哪些格子**保留**、哪些**可分解材料**（含格子 (r,c) 与品质/阶位标签）。当前默认仅 DEBUG 提示，不执行实际分解（`debug_only=True`）；后续可通过配置 `auto_salvage.debug_only=False` 执行真实分解。
     - 若未开启自动分解：执行铁匠分解操作 `handle_salvage_operation`。

## 与其他流程的关系

- **魔盒流程**：**魔盒（卡奈）的唯一图标为 `kanai_cube_left_panel_indicator`**，且匹配中心须在**左 30%** 内才视为魔盒界面，不依赖「铁匠升级/自动分解」配置。
- **铁匠流程**：仅在「铁匠升级」或「自动分解装备」至少开启时才匹配 `bag_opened_indicator`；未找到时仅提示「先没有找到铁匠UI」，不改变魔盒分支行为。

## 提示文案

- 需要铁匠流程但未找到 `bag_opened_indicator`：**先没有找到铁匠UI**（并写入 debug 面板，若开启）。
- 未开启铁匠/自动分解且也未识别到魔盒时：沿用原有提示（无 bag_opened / kanai 指示器）。

## 自动分解：保留规则与 DEBUG 提示

- **下拉框**：`macro_configs.auxiliary_config.auto_salvage.keep` 可选 `keep_ancient_plus`（保留远古+）、`keep_primal`（仅保留太古）。若「自动分解装备」打开，则根据该下拉框选择的保留远古或太古进行判断。
- **遍历装备**：对每个背包格判断品质（蓝/黄/传奇等）及传奇阶位（普通/远古/太古），决定**哪些装备要保留、哪些可以分解材料**。
- **执行逻辑**：默认对可分解格执行真实拆解；仅在配置 `debug_only=True` 或通过「调试铁匠」按钮触发时为预览（不点击）。
- **是否执行操作**：`auto_salvage.debug_only` 默认 `False`，**执行真实拆解**（点 TAB → 对每个可分解格执行移鼠标→左键→拆解按钮→确认）；设为 `True` 时仅预览不点击。

## 铁匠操作 UI 坐标与缩放

- **标准坐标**（`share/game_interface_data.py` 中 `StandardCoordinates`，相对游戏窗口 1316×839）：
  - 左侧 TAB：`blacksmith_tab_forge_weapon=(390,201)`、`blacksmith_tab_armor=(386,296)`、**`blacksmith_tab_salvage_materials=(385,387)` 拆解材料**、`blacksmith_tab_repair=(385,488)`、`blacksmith_tab_train=(387,578)`
  - 拆解页：`blacksmith_salvage_button=(144,226)`（页内拆解按钮）
  - 拆解确认对话框：**`blacksmith_salvage_dialog_salvage_button=(128,249)` 拆解按钮**、**`blacksmith_salvage_dialog_confirm=(584,310)` 确认**、`blacksmith_salvage_dialog_cancel=(766,310)` 取消
- **得到当前缩放值**：通过 `d3_scale_single_coord(coord)` 或 `get_scaled_blacksmith_*()` 获取；汇总接口 `get_scaled_blacksmith_ui_coords()` 返回 `Dict[str, Tuple[int,int]]`（相对窗口），加 `window_offset` 即屏幕坐标。**所有鼠标操作均使用上述缩放后的坐标**（通过 scale 类库得到当前分辨率下的值）。
- **备选/参考坐标**（不同分辨率或测量方式可能得到略有差异的数值，仅供参考）：  
  例如 TAB 曾测得过 `(391,195)`、`(392,298)`、`(388,395)`、`(387,474)`、`(386,600)` 等，与当前常量 `(390,201)`、`(386,296)`、`(385,387)`、`(385,488)`、`(387,578)` 对应。若需适配其他分辨率，应在 `game_interface_data.py` 中统一维护标准坐标，运行时通过 scale 换算。

## 自动分解鼠标流程（保留规则：太古 > 远古）

- **保留规则**：下拉框「保留远古+」= 保留远古与太古，分解其余；「仅保留太古」= 只保留太古，分解其余。**阶位规范：太古 > 远古 > 普通**；小于所选保留等级的装备才会进入拆解流程。
- **流程**：
  1. **整流程只点一次**：先点一下「拆解材料」TAB（`tab_salvage_materials`），确保切换到拆解材料页（整个自动分解流程中仅点这一次 TAB）。
  2. **遍历装备**：按背包格子遍历，仅对「低于所选保留等级」的装备（即需要拆解材料的格子）执行下面的单件循环；**每遍历到一个需要拆解的装备，就按下面步骤执行一次**。
  3. **单件循环**（对每个需拆解格）：移动鼠标到装备格中心 → 左键点击（选中并弹出拆解对话框）→ 点击对话框内「拆解」按钮 → 点击「确认」。所有坐标均使用 scale 后的铁匠 UI 坐标与背包格子中心（由 `bag_coordinates` + 格子索引计算）。

## 完整流程说明（为何可能未完全执行）

- **入口**：只有通过**助手热键**触发的「自动使用界面」才会走本流程。

### 调试铁匠/调试升级 流程要求的动作

**调试铁匠**、**调试升级**按钮仅执行以下动作（不执行铁匠拆解、不执行魔盒升级）：

1. **截图**：调用 `collect_bag_info_quik`（或复用已有共享数据），得到当前游戏窗口图与背包布局。
2. **检测界面类型**：在全窗图上匹配 `bag_opened_indicator`（仅当匹配中心在左 30% 内视为铁匠）、`kanai_cube_left_panel_indicator`（仅当匹配中心在左 30% 内视为魔盒）；输出当前界面类型（blacksmith / kanai_cube / none）。
3. **若当前为铁匠界面**：根据配置中的保留规则（`auto_salvage.keep`）计算「保留」与「可分解材料」列表，输出 DEBUG 提示：`[DEBUG] To keep (n): [...]`、`[DEBUG] To salvage for materials (n): [...]`，以及「Debug only: no salvage clicks performed」。**不点击任何铁匠 UI**。
4. **背包悬停与格子识别**：对每个有物品的背包格，移动鼠标到格子中心 → 等待悬停稳定 → 截取该区域图 → 做太古/远古线条或点检测 → 将区域图保存到调试目录（如 `debug_bag_line/run_YYYYMMDD_HHMMSS/`），控制台输出 `(r,c) type quality line_str`。
5. **结束**：恢复鼠标到原位置。全程不点击拆解按钮、不点击魔盒相关按钮。
- **分支判定**（一次截图）：铁匠与魔盒**均要求**匹配中心在窗口最左 30% 宽内。
  1. 若已开启「铁匠升级」或「自动分解装备」：匹配 `bag_opened_indicator`，**仅当匹配中心在左 30% 内**才视为命中 → **铁匠流程**。
  2. 再匹配 **魔盒唯一图标** `kanai_cube_left_panel_indicator`（同样仅当匹配中心在左 30% 内）；若命中 → **魔盒流程**。
  3. 若未在左 30% 内匹配到 bag_opened_indicator 且需要铁匠：提示「**先没有找到铁匠UI**」；若步骤 1、2 都未命中：提示无 bag_opened/kanai。
- **为何走到魔盒**：同一图标 `bag_opened_indicator` 在**靠右**时只表示背包已打开、不视为铁匠；在**靠左 30%** 内才视为铁匠。当前画面若打开魔盒或背包在右侧，该图标可能匹配在靠右位置，则未在左 30% 内，不进入铁匠分支；再匹配到 `kanai_cube_left_panel_indicator` 则走魔盒分支，**不会**执行铁匠拆解。
- **铁匠分支内**（仅当识别为铁匠时，与魔盒无关）：
  - 若未开启「自动分解装备」：只执行铁匠分解操作（点侧栏拆解材料 TAB + 点页内拆解按钮）。
  - 若开启了「自动分解装备」：按下拉框保留规则遍历装备，**默认执行真实拆解**（点一次拆解材料 TAB，再对每个「可分解」格执行「移鼠标到装备 → 左键 → 对话框拆解 → 确认」）。仅当配置 `auto_salvage.debug_only=True` 时不点击、仅预览。

## 代码入口

- 流程实现：`controller/game_assistant_controller.py`  
  - `auto_use_interface_function()`：先根据配置计算 `want_blacksmith`，再调用 `_detect_interface_from_full_window(full_window, want_blacksmith)`；自动分解时传入 `keep` 与 `debug_only`。
- 铁匠自动分解：`controller/ctl_func/blacksmith_handler.py`  
  - `handle_auto_salvage_by_slots(keep, debug_only=False)`：按保留规则计算保留/可分解列表；默认执行真实拆解（一次点击拆解材料 TAB，再对每个可分解格执行「移动鼠标到装备 → 左键 → 拆解按钮 → 确认」）。`debug_only=True` 时仅预览不点击。
- 坐标与缩放：`share/game_interface_data.py` 中 `STANDARD_COORDS`、`d3_scale_single_coord()`、`get_scaled_blacksmith_ui_coords()`。

---

## 需求对照清单（全部细节）

以下为铁匠流程相关需求的逐条记录，便于核对是否均已落实到文档与代码。

| # | 需求描述 | 文档位置 | 代码/配置 |
|---|----------|----------|-----------|
| 1 | 以 bag_opened_indicator 扩展铁匠逻辑，不影响其他流程（魔盒等） | 概述、流程 1、与其他流程的关系 | `want_blacksmith` 仅当铁匠升级或自动分解开启时为 True；未开启时不匹配铁匠模板 |
| 2 | 若未找到铁匠 UI，提示「先没有找到铁匠UI」 | 流程 2、提示文案、完整流程说明 3 | `game_assistant_controller`: 提示 "Blacksmith UI not found (bag_opened_indicator not matched in left 30%)" 及 debug 推送 |
| 3 | 首先 UI 上「铁匠升级」或「自动分解装备」任意有一个打开 | 流程 1 前置条件 | `auxiliary_config.blacksmith.enabled` 或 `auto_salvage.enabled` |
| 4 | 之后查找 bag_opened_indicator，仅当匹配中心在左 30% 内视为铁匠 | 概述、流程 2 | `_detect_interface_from_full_window`: BAG_OPENED_INDICATOR + require_left_30；BagInfoCollector: is_match_center_in_left_region |
| 4b | **同一图标**：靠左 30% 区域宽 = 铁匠，靠右 = 仅背包（不视为铁匠） | 概述、流程 2、为何走到魔盒 | 常量注释 `providor/constants/d3.py`；`LEFT_REGION_RATIO`、`is_match_center_in_left_region`；img_width 用 shape[1]/size[0] |
| 5 | 找到以后确认背包打开并遍历所有装备 | 流程 3 | `collect_bag_info_from_current_shared`；`handle_auto_salvage_by_slots` 遍历 `bag_coordinates` + `bag_layout` |
| 6 | 若「自动分解装备」打开，根据下拉框选择保留远古或太古 | 自动分解：保留规则与 DEBUG 提示、自动分解鼠标流程 | `auto_salvage.keep`: `keep_ancient_plus` / `keep_primal`；面板下拉绑定 |
| 7 | 遍历装备并执行拆解；可选 debug_only 仅预览 | 自动分解：保留规则与执行逻辑、完整流程说明 铁匠分支内 | 默认 `debug_only=False` 执行真实拆解；`debug_only=True` 仅预览 |
| 8 | 铁匠操作 UI 相对坐标，通过 scale 类库得到当前值，使用鼠标操作 | 铁匠操作 UI 坐标与缩放、自动分解鼠标流程 | `get_scaled_blacksmith_*()`、`get_scaled_blacksmith_ui_coords()`；`state_aware_click_handler` 点击/移动 |
| 9 | 保留规则：太古 > 远古；小于所选等级的装备才拆解 | 自动分解鼠标流程 | `keep_ancient_plus`: 仅 normal 拆解；`keep_primal`: normal+ancient 拆解 |
| 10 | 整流程只点一次「拆解材料」TAB，再遍历装备 | 自动分解鼠标流程 1、2 | `handle_auto_salvage_by_slots`: 先一次 `tab_salvage_materials`，再 for to_salvage |
| 11 | 单件循环：移鼠标到装备 → 左键 → 对话框拆解按钮 → 确认 | 自动分解鼠标流程 3、完整流程说明 | `click_handler.move_mouse` → `click` 格子 → `click` salvage_dialog_salvage_button → `click` salvage_dialog_confirm |
| 12 | 遍历到一个需要拆解的装备就按上述流程走一次 | 自动分解鼠标流程 2、3 | `for (r, c, _) in to_salvage:` 内执行单件循环 |
| 13 | 常量中定义的铁匠 UI 相对坐标（含备选参考值如 391,195 等） | 铁匠操作 UI 坐标与缩放、备选/参考坐标 | `game_interface_data.py` StandardCoordinates；文档中列出备选数值 |
| 14 | 缺少的常量相对坐标时先把代码与文档写全再补坐标 | 铁匠操作 UI 坐标与缩放、代码入口 | 当前 TAB/拆解/确认坐标已定义；新坐标应在 `game_interface_data.py` 增加并提供 `get_scaled_*` |
| 15 | **调试铁匠/调试升级** 仅执行：截图→检测界面类型→(若铁匠)DEBUG 保留/可分解列表→背包悬停+格子识别+保存区域图；不执行拆解、不执行魔盒升级 | 本节「调试铁匠/调试升级 流程要求的动作」 | `run_debug_bag_hover()`；铁匠时调用 `handle_auto_salvage_by_slots(keep, debug_only=True)` 仅打日志 |
