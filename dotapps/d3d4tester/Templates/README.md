# D3 辅助宏模板图 (Templates)

界面检测使用的静态图，与 Python `pyapps/d3-check/images` 一致。

## 所需文件

- `bag_opened_indicator.png` — 背包打开指示（左 30% 匹配 → blacksmith 流程）
- `kanai_cube_left_panel_indicator.png` — 卡奈魔方左侧面板指示（左 30% 匹配 → kanai_cube 流程）

## 来源

- 若源码树存在 `pyapps/d3-check/images/`，DOT 优先使用该目录（与 Python 共用；`SourcePaths` 用编译时写入的源码目录定位，构建输出在仓库外也能找到）。
- 否则使用程序目录下的 `Templates/`（构建时从本目录复制）。本目录已带 D4 模板 `d4/small_map.jpg`（D4 小地图检测、D4 调试图像使用）；其余模板按需从 Python 项目复制同名文件。

## 分辨率

模板图按 D3 标准分辨率 1300×800 下的比例制作；运行时由 `GameInterfaceData.GetGlobalScale()` 对模板做缩放后再匹配。
