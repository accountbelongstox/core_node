# D3 辅助宏模板图 (Templates)

界面检测和图标使用的静态图。原 Python d3-check 的 `images/` 已整体迁到本目录（目录结构不变）；Python 版已弃用并删除，只保留代码参考 `dotapps/d3d4tester/reference/py_d3check/`。

## 内容

- 根目录：D3 界面检测模板（`D3TemplateConfig` 表：背包、铁匠、卡奈魔方、游戏状态、物品品质、格子、锚点）。
- `battlenet/`：战网界面模板（坐标拾取器）。
- `d4/small_map.jpg`：D4 小地图检测、D4 调试图像。
- `armor_icons/`、`weapon_icons/`、`gem_icons/`、`armor_recipe_list/`、`weapon_recipe_list/`、`maxroll_d3planner/`：物品图标资源（`scripts/selenium_test/fetch_*` 抓取到这里）。

## 来源

- 源码树存在时 DOT 直接读取本目录（`SourcePaths` 用编译时写入的源码目录定位，构建输出在仓库外也能找到，改图无需重新编译）。
- 否则使用程序目录下的 `Templates/`（构建时从本目录复制）。

## 分辨率

模板图按 D3 标准分辨率 1300×800 下的比例制作；运行时由 `GameInterfaceData.GetGlobalScale()` 对模板做缩放后再匹配。
