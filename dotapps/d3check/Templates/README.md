# D3 辅助宏模板图 (Templates)

界面检测使用的静态图，与 Python `pyapps/d3-check/images` 一致。

## 所需文件

- `bag_opened_indicator.png` — 背包打开指示（左 30% 匹配 → blacksmith 流程）
- `kanai_cube_left_panel_indicator.png` — 卡奈魔方左侧面板指示（左 30% 匹配 → kanai_cube 流程）

## 来源

- 若仓库中存在 `pyapps/d3-check/images/`，DOT 会优先使用该目录（与 Python 共用）。
- 否则使用本目录；请从 Python 项目复制上述两个 PNG，或从游戏截图中裁剪对应区域保存为同名文件。

## 分辨率

模板图按 D3 标准分辨率 1300×800 下的比例制作；运行时由 `GameInterfaceData.GetGlobalScale()` 对模板做缩放后再匹配。
