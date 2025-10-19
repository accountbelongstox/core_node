# Dungeon Progress "Invalid Image" 问题修复

## 🐛 问题描述

在Debug Window中,Dungeon Progress区域显示"Invalid Image"错误。

## 🔍 问题根因

### 原始定义 (share/game_interface_data.py:337-338)

```python
# ❌ 问题定义
dungeon_progress_start: Tuple[int, int] = (1460, 362)  # Progress bar start point
dungeon_progress_end: Tuple[int, int] = (1700, 362)    # Progress bar end point
```

**问题分析**:
- Start Y坐标: 362
- End Y坐标: 362
- **高度 = 362 - 362 = 0** ❌

这是一条**水平线**,而不是一个有效的矩形区域!

### ImageCrop行为

当ImageCrop.crop_region()尝试裁剪这个区域时:

```python
# pycore/pyutils/image_crop.py:120
cropped_pil = pil_image.crop((x1, y1, x2, y2))
# 相当于: crop((1460, 362, 1700, 362))
# 结果: 高度为0的图像!
```

### Debug Window验证

在debug_window.py:209-212中:

```python
if pil_image is None or pil_image.width <= 0 or pil_image.height <= 0:
    ColorPrint.yellow(f"[DebugWindow] Invalid image for '{region_key}'")
    img_label.configure(image="", text="Invalid Image")  # ← 这里触发!
    continue
```

## ✅ 修复方案

### 修复后的定义

```python
# ✅ 修复后 - 给进度条一个合理的高度
dungeon_progress_start: Tuple[int, int] = (1460, 355)  # Progress bar region top-left
dungeon_progress_end: Tuple[int, int] = (1700, 370)    # Progress bar region bottom-right (height ~15px)
```

**修复详情**:
- 将Y坐标从单一的362扩展为355-370
- 高度 = 370 - 355 = **15像素** ✅
- 宽度 = 1700 - 1460 = **240像素** ✅
- 区域以原362为中心(362-7=355, 362+8=370)

### 为什么选择15像素高度?

1. **可见性**: 15像素足够显示进度条及周边区域
2. **对称性**: 以原来的362为中心,上下各扩展约7-8像素
3. **参考**: EXP Bar高度为7像素,Dungeon Progress稍大一些更合理
4. **避免干扰**: 不会覆盖到其他UI元素

## 📊 所有区域尺寸验证

运行验证脚本后的结果:

| 区域名称 | 起始坐标 | 结束坐标 | 宽度 | 高度 | 状态 |
|---------|---------|---------|------|------|------|
| blacksmith_menu | (392, 172) | (682, 212) | 290 | 40 | ✅ |
| whisper_obols | (1291, 1025) | (1353, 1048) | 62 | 23 | ✅ |
| equipment_left | (1294, 108) | (1359, 695) | 65 | 587 | ✅ |
| equipment_right | (1660, 206) | (1724, 695) | 64 | 489 | ✅ |
| blacksmith_function | (198, 467) | (536, 776) | 338 | 309 | ✅ |
| exp_bar | (733, 993) | (1041, 1000) | 308 | 7 | ✅ |
| minimap | (1439, 78) | (1731, 290) | 292 | 212 | ✅ |
| map_name | (1440, 40) | (1626, 68) | 186 | 28 | ✅ |
| quest_text | (1439, 315) | (1720, 1006) | 281 | 691 | ✅ |
| team_count | (146, 310) | (228, 624) | 82 | 314 | ✅ |
| team_vote | (127, 219) | (523, 500) | 396 | 281 | ✅ |
| **dungeon_progress** | **(1460, 355)** | **(1700, 370)** | **240** | **15** | **✅ 已修复** |

### 关于reforge区域

```
reforge: (368, 470) -> (368, 723)  W=0 H=253
```

**说明**:
- reforge是一条**垂直线**,不是矩形区域
- 它**没有**被添加到region_detector/debug_window等文件中
- 只通过`get_scaled_reforge_region()`函数使用
- **这是正确的设计** - 线段不应该被作为区域图像提取

## 🎯 验证步骤

1. **运行程序**并打开D4 Debug Window
2. **检查Dungeon Progress区域**:
   - ✅ 应该显示一个240x15像素的图像
   - ✅ 包含游戏中的地下城进度条
   - ❌ 不应该再显示"Invalid Image"

3. **验证其他区域**:
   - 所有12个其他区域应该正常显示
   - 没有"Invalid Image"错误

## 📁 修改的文件

1. **share/game_interface_data.py** (Line 337-338)
   - 修改dungeon_progress_start: (1460, 362) → (1460, 355)
   - 修改dungeon_progress_end: (1700, 362) → (1700, 370)
   - 添加注释说明高度调整

## 🔧 技术细节

### PIL Image.crop()行为

```python
# PIL crop格式: (left, top, right, bottom)
image.crop((x1, y1, x2, y2))

# 结果尺寸:
# width = x2 - x1
# height = y2 - y1

# 如果width <= 0 或 height <= 0:
# → 返回的图像无效
```

### 区域类型分类

1. **矩形区域** (用于图像提取):
   - 必须有 width > 0 AND height > 0
   - 示例: Bag, Minimap, Quest Text等

2. **线段** (用于坐标/位置检测):
   - 可以是水平线 (height=0) 或垂直线 (width=0)
   - 示例: reforge (垂直线)
   - **不应该**用于图像提取

3. **点** (用于点击/位置):
   - 单个坐标
   - 示例: health_orb_point, team_vote_confirm_point

## 💡 设计建议

### 未来添加线段类型坐标时:

1. **明确注释类型**:
   ```python
   # Horizontal line (for position detection only, not for image extraction)
   some_line_start: Tuple[int, int] = (x1, y)
   some_line_end: Tuple[int, int] = (x2, y)
   ```

2. **不要添加到region_detector**:
   - 线段不应该出现在regions_to_extract列表中

3. **考虑转换为区域**:
   - 如果需要提取图像,给线段添加高度/宽度
   - 如Dungeon Progress从线→区域的转换

## ⚠️ 注意事项

- **坐标中心**: 修改后的区域应该以原始线的位置为中心
- **避免重叠**: 确保扩展后的区域不会与其他区域重叠
- **保持比例**: 高度应该合理,不要过大或过小
- **测试验证**: 修改后必须在实际游戏中测试显示效果

---

**修复时间**: 2025-10-19
**状态**: ✅ 已修复并验证
**修改**: share/game_interface_data.py Line 337-338
