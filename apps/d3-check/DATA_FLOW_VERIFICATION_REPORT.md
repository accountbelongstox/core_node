# 数据流验证报告

## 执行时间
生成时间: 2025-10-18

## 验证目标
确保所有数据都通过 `game_interface_data.py` (D4InterfaceData) 交换，没有硬编码或重复定义。

---

## ✅ 验证结果总结

### 1. 坐标定义 - 统一且唯一

**定义位置**: `share/game_interface_data.py`

```python
@dataclass
class D4StandardCoordinates:
    """D4 standard coordinates for UI elements at base resolution (1763x1126)"""

    # 所有12个区域的坐标都在这里定义
    bag_top_left: Tuple[int, int] = (1093, 756)
    bag_bottom_right: Tuple[int, int] = (1710, 1004)
    blacksmith_menu_start: Tuple[int, int] = (392, 172)
    blacksmith_menu_end: Tuple[int, int] = (682, 212)
    # ... 等等
```

**全局实例**:
```python
D4_STANDARD_COORDS = D4StandardCoordinates()
```

### 2. 坐标引用 - 全部通过D4_STANDARD_COORDS

| 文件 | 引用方式 | 状态 |
|------|---------|------|
| `controller/d4func/image_annotator.py` | `D4_STANDARD_COORDS.minimap_region_start` | ✅ |
| `controller/d4func/region_detector.py` | `D4_STANDARD_COORDS.exp_bar_region_start` | ✅ |
| `d4utils/small_map_detector.py` | `D4_STANDARD_COORDS.minimap_region_start` | ✅ |
| `d4utils/team_health_detector.py` | `D4_STANDARD_COORDS.team_count_region_start` | ✅ |
| `d4utils/window_region_detector.py` | `D4_STANDARD_COORDS.bag_top_left` | ✅ |

**结论**: ✅ 没有硬编码坐标，所有引用都通过 `D4_STANDARD_COORDS`

### 3. 数据交换 - 全部通过D4InterfaceData

#### 数据写入点

| 组件 | 写入字段 | 位置 |
|------|---------|------|
| ScreenshotHandler | `screenshot_data` | `share/game_interface_data.py:1088` |
| RegionDetector | `detected_regions['region_images']` | `controller/d4func/region_detector.py:170` |
| TeamHealthDetector | `team_health_info` | `share/game_interface_data.py:1091` |
| SmallMapDetector | `small_map_detection` | `share/game_interface_data.py:1095` |

#### 数据读取点

| 组件 | 读取字段 | 位置 |
|------|---------|------|
| RegionDetector | `screenshot_data` | `controller/d4func/region_detector.py:64` |
| DebugWindow | `detected_regions['region_images']` | `ui/components/debug_window.py:156` |
| D4Controller | `detected_regions` | `controller/d4_controller.py:228` |
| UIStatusUpdater | `detected_regions` | `controller/d4func/ui_status_updater.py:136` |

**结论**: ✅ 所有数据交换都通过 `D4InterfaceData`，没有直接传递

---

## 📊 区域定义对比表

### image_annotator.py vs region_detector.py

| 区域名称 | image_annotator | region_detector | 状态 |
|---------|----------------|-----------------|------|
| Bag | ✅ D4_STANDARD_COORDS.bag_top_left | ✅ D4_STANDARD_COORDS.bag_top_left | ✅ 一致 |
| Blacksmith Menu | ✅ D4_STANDARD_COORDS.blacksmith_menu_start | ✅ D4_STANDARD_COORDS.blacksmith_menu_start | ✅ 一致 |
| Whisper Obols | ✅ D4_STANDARD_COORDS.whisper_obols_region_start | ✅ D4_STANDARD_COORDS.whisper_obols_region_start | ✅ 一致 |
| Equipment Left | ✅ D4_STANDARD_COORDS.equipment_left_region_start | ✅ D4_STANDARD_COORDS.equipment_left_region_start | ✅ 一致 |
| Equipment Right | ✅ D4_STANDARD_COORDS.equipment_right_region_start | ✅ D4_STANDARD_COORDS.equipment_right_region_start | ✅ 一致 |
| Blacksmith Function | ✅ D4_STANDARD_COORDS.blacksmith_function_region_start | ✅ D4_STANDARD_COORDS.blacksmith_function_region_start | ✅ 一致 |
| EXP Bar | ✅ D4_STANDARD_COORDS.exp_bar_region_start | ✅ D4_STANDARD_COORDS.exp_bar_region_start | ✅ 一致 |
| Minimap | ✅ D4_STANDARD_COORDS.minimap_region_start | ✅ D4_STANDARD_COORDS.minimap_region_start | ✅ 一致 |
| Map Name | ✅ D4_STANDARD_COORDS.map_name_region_start | ✅ D4_STANDARD_COORDS.map_name_region_start | ✅ 一致 |
| Quest Text | ✅ D4_STANDARD_COORDS.quest_text_region_start | ✅ D4_STANDARD_COORDS.quest_text_region_start | ✅ 一致 |
| Team Count | ✅ D4_STANDARD_COORDS.team_count_region_start | ✅ D4_STANDARD_COORDS.team_count_region_start | ✅ 一致 |
| Team Vote | ✅ D4_STANDARD_COORDS.team_vote_region_start | ✅ D4_STANDARD_COORDS.team_vote_region_start | ✅ 一致 |

---

## 🔍 当前问题分析

### 用户反馈

> "目前只有bag area, blacksmith menu, whispering obols的正确，其他项显然从区域检测就没有正确"

### 问题定位

既然：
1. ✅ 所有代码都通过 `D4_STANDARD_COORDS` 引用坐标
2. ✅ 没有硬编码或重复定义
3. ✅ `image_annotator.py` 和 `region_detector.py` 使用相同的坐标

那么问题只能是：**坐标值本身不正确**

### 坐标值验证

#### ✅ 正确的坐标（用户确认）

```python
bag_top_left = (1093, 756)
bag_bottom_right = (1710, 1004)
blacksmith_menu_start = (392, 172)
blacksmith_menu_end = (682, 212)
whisper_obols_region_start = (1291, 1025)
whisper_obols_region_end = (1353, 1048)
```

#### ❌ 可能不正确的坐标（需要重新测量）

```python
# Equipment regions
equipment_left_region_start = (1294, 108)
equipment_left_region_end = (1359, 695)
equipment_right_region_start = (1660, 206)
equipment_right_region_end = (1724, 695)

# Blacksmith function
blacksmith_function_region_start = (198, 467)
blacksmith_function_region_end = (536, 776)

# EXP Bar
exp_bar_region_start = (733, 993)
exp_bar_region_end = (1041, 996)

# Minimap
minimap_region_start = (1439, 78)
minimap_region_end = (1731, 290)

# Map Name
map_name_region_start = (1440, 40)
map_name_region_end = (1602, 68)

# Quest Text
quest_text_region_start = (1439, 315)
quest_text_region_end = (1720, 1006)

# Team regions
team_count_region_start = (146, 310)
team_count_region_end = (228, 624)
team_vote_region_start = (127, 119)
team_vote_region_end = (523, 327)
```

---

## 🎯 解决方案

### 选项1: 使用Annotated图片验证

1. 运行程序生成annotated截图:
   - 位置: `D:\programing\core_node\tmp\d4_annotated\d4_annotated_*.png`

2. 打开annotated图片，检查每个区域的框是否正确

3. 对于框不正确的区域，使用截图工具重新测量坐标

### 选项2: 查看历史记录

检查坐标最初是如何定义的：

```bash
git log -p share/game_interface_data.py | grep -A 5 "exp_bar_region_start"
```

### 选项3: 动态调试

在 `region_detector.py` 中临时添加调试输出：

```python
for label, start_coord, end_coord in regions_to_extract:
    ColorPrint.blue(f"\n=== {label} ===")
    ColorPrint.blue(f"Standard resolution: {D4_STANDARD_RESOLUTION_WIDTH}x{D4_STANDARD_RESOLUTION_HEIGHT}")
    ColorPrint.blue(f"Game window size: {game_window_size}")
    ColorPrint.blue(f"Windowed mode: {is_windowed}")
    ColorPrint.blue(f"Original coords: {start_coord} → {end_coord}")
    ColorPrint.blue(f"Scaled coords: {scaled_start} → {scaled_end}")
    ColorPrint.blue(f"Extracted image size: {region_crop.size}")
```

这样可以看到每个区域的坐标转换过程。

---

## 📝 修正坐标的步骤

当找到正确坐标后：

1. **编辑文件**: `share/game_interface_data.py`

2. **找到** `class D4StandardCoordinates`

3. **修改对应的坐标值**，例如：
   ```python
   # 修改前
   exp_bar_region_start: Tuple[int, int] = (733, 993)

   # 修改后（使用正确测量的值）
   exp_bar_region_start: Tuple[int, int] = (新X, 新Y)
   ```

4. **保存并重启程序**

5. **验证**: 检查debug窗口显示的图片是否正确

---

## 🔄 数据流完整性检查清单

- [x] 坐标定义统一在 `D4StandardCoordinates`
- [x] 全局实例 `D4_STANDARD_COORDS` 唯一
- [x] 所有代码通过 `D4_STANDARD_COORDS` 引用
- [x] 无硬编码坐标值
- [x] 数据交换通过 `D4InterfaceData`
- [x] 无直接传递数据
- [x] `image_annotator` 和 `region_detector` 使用相同定义
- [ ] 坐标值正确性（需要验证）

---

## 结论

**架构层面**: ✅ 完全符合要求
- 所有数据通过 `game_interface_data.py` 交换
- 没有重复定义
- 没有硬编码

**数据层面**: ⚠️ 需要验证
- 坐标值可能不准确
- 需要重新测量或验证不正确的坐标

**建议行动**:
1. 查看annotated截图验证坐标
2. 对不正确的区域重新测量坐标
3. 更新 `D4StandardCoordinates` 中的坐标值
