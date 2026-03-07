# DEBUG / 绘制逻辑一览表

项目中所有与 DEBUG 输出、标注图保存、网格/结果绘制的逻辑汇总。

---

## 一、常量与目录（app_constants）

| 常量 | 路径 | 说明 |
|------|------|------|
| `DEBUG` | - | 全局 DEBUG 开关（True/False），控制是否写调试图 |
| `TMP_DIR` | `~/.core_node/pytools/tmp` | 临时根目录 |
| `MATCH_DEBUG_DIR` | `TMP_DIR / "match_debug"` | 模板匹配调试图 |
| `DEBUG_CAPTURE_DIR` | `TMP_DIR / "debug_capture"` | 调试截图目录 |
| `D4_ANNOTATED_DIR` | `TMP_DIR / "d4_annotated"` | D4 标注图目录 |
| `UI_ANNOTATED_DIR` | `TMP_DIR / "ui_annotated"` | UI 标注图目录 |
| `ROSBOT_UI_DEBUG_DIR` | `TMP_DIR / "debug"` | ROSBOT UI 调试目录 |

---

## 二、通用绘制/保存（image_annotator_helper）

| 函数 | 触发条件 | 输出路径/目录 | 绘制内容 |
|------|----------|----------------|----------|
| `draw_grid_overlay` | 被调用时 | 无（只画到 annotator） | 在图上画 rows×cols 网格，可选区域或全图 |
| `draw_match_result` | 被调用时 | 无 | 在 annotator 上画单次匹配结果（框+模板小图） |
| `draw_match_results` | 被调用时 | 可选 save_path | 画多个匹配结果，可选保存 |
| `save_match_debug_image` | 被调用时 | 调用方传入 output_dir | 画单次匹配结果并保存，通用模板匹配调试 |
| `save_no_match_debug_image` | 被调用时 | 调用方传入 output_dir | 画“未匹配”提示+模板小图并保存 |
| `save_click_debug_image` | 被调用时 | 调用方传入 output_dir | 在图上画点击点（圆+序号/标签）并保存 |
| `save_anchor_detection_result` | 被调用时 | 调用方传入 save_path | 画锚点检测结果（边框线、窗口框、锚点信息）并保存 |
| `save_bag_detection_result` | 被调用时 | 调用方传入 save_path | 画背包边框匹配、背包矩形、可选背包格子网格（_draw_bag_layout_grid）并保存 |
| `_draw_bag_layout_grid` | 被 save_bag_detection_result / BagInfoCollector 调用 | 无（画到已有 annotator） | 在背包区域内画网格线 + 每格品质标记（圆/矩形+字母 L/R/M 等） |

---

## 三、D3 截图与 UI 区域

| 模块 | 方法/位置 | 触发条件 | 输出路径/文件名 | 绘制/保存内容 |
|------|------------|----------|------------------|----------------|
| `screenshot_provider` | 全屏截图分支 | `DEBUG==True` | `TMP_DIR / "debug_fullscreen_{timestamp}.png"` | 保存原始全屏图 |
| `screenshot_provider` | 游戏窗口截图分支 | `DEBUG==True` | `TMP_DIR / "debug_game_window_{timestamp}.png"` | 保存游戏窗口裁剪图 |
| `ui_region_collector_optimized` | collect 内 | `DEBUG==True` 且存在 game_window_image | `TMP_DIR / "debug_ui_optimized_{timestamp}.png"` | 保存当前游戏窗口图（无标注） |
| `ui_region_collector_optimized` | `_save_annotated_screenshot` | `save_screenshot==True` | `get_tmp_dir() / "optimized_detection_{timestamp}.png"` | 在内存图上画 UI 区域框+文字，再保存 |
| `ui_region_collector_anchor` | 成功/失败分支 | 每次检测 | `get_tmp_dir() / "anchor_detection_{timestamp}.png"` | 通过 save_anchor_detection_result 画锚点结果并保存 |
| `ui_region_collector_anchor` | DEBUG 分支 | `DEBUG==True` | `TMP_DIR / "debug_ui_anchor_{timestamp}.png"` | 保存裁剪的 UI 区域图 |
| `ui_region_collector_ultralytics` | `_save_annotated_screenshot` | `save_screenshot==True` | `get_tmp_dir() / "yolo_detection_{timestamp}.png"` | 在临时全屏图上画 YOLO 检测框，再保存 |

---

## 四、D3 背包

| 模块 | 方法/位置 | 触发条件 | 输出路径/文件名 | 绘制/保存内容 |
|------|------------|----------|------------------|----------------|
| `bag_info_collector` | `_save_comprehensive_detection_result` | `save_to_disk==True`（即 collect 的 save_screenshot=True） | `get_tmp_dir() / "bag_comprehensive_{timestamp}.png"` | 综合标注：状态、分辨率、offset、bag_buttom/bag_left、背包矩形、_draw_bag_layout_grid、按钮图例等 |
| `bag_info_collector` | `_draw_comprehensive_detection_annotation` | 每次 collect（画到内存 annotator） | 无（仅当 save_to_disk 时由上面保存） | 同上，只绘制不落盘 |
| `image_annotator_helper` | `save_bag_detection_result` | 被显式调用时 | 调用方传入 save_path | 背包边框匹配 + 背包矩形 + 可选 _draw_bag_layout_grid |

---

## 五、D3 背包格子绘制（两处实现）

| 位置 | 函数/方法 | 输入 | 绘制内容 |
|------|------------|------|----------|
| `image_annotator_helper` | `_draw_bag_layout_grid` | annotator, bag_coords, bag_layout | 在整张图上的背包区域画网格线；每格根据 type/quality 画圆或 2 格矩形 + 品质首字母（L/R/M/E 等），颜色按品质 |
| `debug_window` | `_draw_d3_bag_grid_on_pil` | 裁剪后的背包 PIL 图, coords, layout | 在**已裁剪的背包图**上画网格 + 每格色块 + 品质字母，用于调试 UI 显示 |

---

## 六、BagLayoutDetector 内调试绘制

| 模块 | 方法/位置 | 触发条件 | 绘制内容 |
|------|------------|----------|----------|
| `bag_layout_detector` | 可视化/调试分支 | 内部逻辑（如可视化时） | `draw_grid_overlay(bag_annotator, rows, cols, grid_color="green")` 画背包网格 |
| `bag_layout_detector` | 提取区域可视化 | 有 color_analysis 时 | `draw_grid_overlay(extraction_annotator, rows, cols, grid_color="cyan")` + 每个格子的提取区域矩形 |

---

## 七、D4 相关

| 模块 | 方法/位置 | 触发条件 | 输出路径/文件名 | 绘制/保存内容 |
|------|------------|----------|------------------|----------------|
| `d4_scaled_template_matcher` | 区域匹配后 | `DEBUG==True` 且 match_result 存在 | `output_dir or TMP_DIR/"d4_annotated"`，`region_match_{region}_{template}_{ts}.png` | `_save_region_debug_image`：区域匹配调试图 |
| `small_map_detector` | 检测后 | `DEBUG==True` | `TMP_DIR / "d4_annotated"`，带时间戳的 debug/region 文件名 | `_save_debug_image`：小地图区域+标注 |
| `window_region_detector` | 检测后 | `DEBUG==True` 且传入 screenshot_image | `D4_ANNOTATED_DIR`，带时间戳 | 在截图上画检测到的区域并保存 |
| `team_health_detector` | 检测后 | `DEBUG==True` | `D4_ANNOTATED_DIR`，带时间戳 | 队伍血条等标注图 |
| `controller/d4func/region_detector` | 流程内 | 流程逻辑 | `D4_ANNOTATED_DIR` | 区域检测标注图，写入 last_annotated_screenshot_path |
| `controller/d4func/exp_farming` | 流程内 | 流程逻辑 | 通过 image_annotator.save_annotated_image | D4 经验 farming 标注图 |

---

## 八、其他（登录、路径、ROSBOT、Battle.net）

| 模块 | 方法/位置 | 触发条件 | 输出路径/目录 | 绘制/保存内容 |
|------|------------|----------|----------------|----------------|
| `login_try_screenshot_controller` | 匹配流程 | 流程中调用 | `MATCH_DEBUG_DIR` | save_match_debug_image / save_no_match_debug_image / save_click_debug_image |
| `d3_start_game_and_teleport_waiter` | 点击等待流程 | 流程中 | `MATCH_DEBUG_DIR` | save_click_debug_image（点击点） |
| `battlenet_match_debug` | debug_all_match_methods | 被调用时 | 调用方传入 out_dir | save_match_debug_image / save_no_match_debug_image |
| `pathfinding_controller` | 搜索完成后 | 流程逻辑 | `TMP_DIR`，pathfinding_result_*.txt 等 | 路径搜索结果与标注图 |
| `rosbot_ui_automation` | 获取 ROSBOT 窗口后 | 正常流程 | `ROSBOT_UI_DEBUG_DIR / "rosbot_ui_structure_{ts}.txt"` | 可操作节点列表（文本，非图） |

---

## 九、调试 UI 内显示（不写文件）

| 模块 | 方法 | 数据来源 | 显示内容 |
|------|------|----------|----------|
| `debug_window` | `_update_d3_bag_section` | get_game_interface_data()：bag_coordinates, bag_layout, game_window_image | 文本：网格、尺寸、占用数、品质统计、每格 type/quality；图片：裁剪背包 + `_draw_d3_bag_grid_on_pil` 画的格子与品质 |

---

以上为当前项目中与 DEBUG 输出、标注保存、网格/结果绘制相关的逻辑汇总表。
