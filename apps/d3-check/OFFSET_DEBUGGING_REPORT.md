# D4 Region Offset Debugging Report

## 问题描述
用户报告在D4的debug_window中显示的区域图片出现错位,大约向左偏移70像素。Team Count区域已经对齐正确,但其他区域仍然有偏移问题。

## 已完成的修复

### 1. 修复screenshot_provider.py中的尺寸赋值错误

**文件**: `D:\programing\core_node\apps\d3-check\d3utils\screenshot_provider.py`

#### 修复1: game_window_size使用错误的值 (line 261)
```python
# 修复前:
game_window_size = fullscreen_size  # ❌ 错误 - 使用了屏幕分辨率

# 修复后:
game_window_size = captured_size  # ✅ 正确 - 使用实际捕获的窗口大小
```

#### 修复2: fullscreen_size变量名混淆 (line 238)
```python
# 修复前:
fullscreen_size = (screen_width, screen_height)  # 直接赋值导致变量名混淆

# 修复后:
screen_resolution = (screen_width, screen_height)  # 重命名为screen_resolution
fullscreen_size = screen_resolution  # 在需要的地方明确赋值
```

### 2. 添加了全面的调试日志

#### 在region_detector.py中添加:
- `_extract_all_regions_to_share()` 中打印game_window_size, fullscreen_size, is_windowed等关键值
- Team Count区域的坐标转换详细信息

**位置**: `D:\programing\core_node\apps\d3-check\controller\d4func\region_detector.py:123-128, 172-176`

#### 在game_interface_data.py中添加:
- `calculate_unified_scaled_coordinate()` 函数中针对Team Count坐标的调试输出
- 显示窗口模式/全屏模式的计算详情
- 显示scale因子和坐标转换过程

**位置**: `D:\programing\core_node\apps\d3-check\share\game_interface_data.py:131, 149-150, 176-181, 199-202`

## 数据流分析

### 完整的数据流路径:
```
1. screenshot_provider.gen()
   ├─ 捕获游戏窗口 -> captured_size
   ├─ 获取屏幕分辨率 -> screen_resolution
   ├─ 创建screenshot_data
   │  ├─ game_window_size = captured_size  ✅
   │  └─ fullscreen_size = screen_resolution  ✅
   └─ 更新shared_data

2. screenshot_handler.capture_and_collect_info()
   └─ 保存screenshot_data到d4_data.screenshot_data

3. region_detector.detect_regions_from_shared_data()
   ├─ 从d4_data.screenshot_data获取数据
   ├─ game_window_size = screenshot_data.game_window_size
   ├─ is_windowed = d4_data.is_windowed_mode()
   └─ 调用_extract_all_regions_to_share()

4. region_detector._extract_all_regions_to_share()
   ├─ 对每个区域:
   │  ├─ calculate_unified_scaled_coordinate(start_coord, game_window_size, ...)
   │  ├─ calculate_unified_scaled_coordinate(end_coord, game_window_size, ...)
   │  └─ ImageCrop.crop_region(image, scaled_start, scaled_end)
   └─ 保存到d4_data.detected_regions['region_images']

5. debug_window.update_images()
   └─ 从d4_data.detected_regions['region_images']读取并显示
```

### 关键数据传递:
- `screenshot_data.game_window_size` = 实际捕获的窗口大小 (例如: 1747x1087)
- `screenshot_data.fullscreen_size` = 屏幕分辨率 (例如: 1920x1080)
- `is_windowed` = 根据两者差异判断 (差值>31即为窗口模式)

## 窗口模式检测逻辑

```python
def is_windowed_mode(self) -> bool:
    window_width, window_height = self.game_window_size
    fullscreen_width, fullscreen_height = self.fullscreen_size

    width_diff = fullscreen_width - window_width
    height_diff = fullscreen_height - window_height

    return (width_diff >= 31 and height_diff >= 31)
```

## 坐标计算逻辑

### 窗口模式 (is_windowed=True):
```python
WINDOW_BORDER_WIDTH = 8  # 左右边框各8px
TITLE_BAR_HEIGHT = 31    # 标题栏31px

effective_actual_width = actual_width - (8 + 8)     # -16
effective_std_width = standard_width - (8 + 8)      # -16
effective_actual_height = actual_height - (31 + 8)  # -39
effective_std_height = standard_height - (31 + 8)   # -39

scale_x = effective_actual_width / effective_std_width
scale_y = effective_actual_height / effective_std_height

scaled_x = (std_x - 8) * scale_x + 8   # 减8,缩放,加回8
scaled_y = (std_y - 31) * scale_y + 31 # 减31,缩放,加回31
```

### 全屏模式 (is_windowed=False):
```python
scale_x = actual_width / standard_width
scale_y = actual_height / standard_height

scaled_x = (std_x - 8) * scale_x   # 减8,缩放,不加回
scaled_y = (std_y - 31) * scale_y  # 减31,缩放,不加回
```

## 下一步调试步骤

### 用户需要运行程序并提供以下调试输出:

1. **运行D4并打开debug window**
2. **查找以下调试信息** (蓝色标记🔍):

```
[RegionDetector] 🔍 DEBUG - game_window_size: (宽, 高)
[RegionDetector] 🔍 DEBUG - fullscreen_size: (宽, 高)
[RegionDetector] 🔍 DEBUG - is_windowed: True/False
[RegionDetector] 🔍 DEBUG - d4_data.fullscreen_size: (宽, 高)
[RegionDetector] 🔍 DEBUG - d4_data.game_window_size: (宽, 高)

[RegionDetector] 🔍 DEBUG 'Team Count':
  Standard: (146, 310) -> (228, 624)
  Scaled:   (x1, y1) -> (x2, y2)
  Image size: (宽, 高)

[CoordCalc] 🔍 Input: std=(146, 310), actual_size=(...), std_size=(...), windowed=...
[CoordCalc] 🔍 Windowed mode:  (或 Fullscreen mode:)
  effective_actual: ...x...
  effective_std: ...x...
  scale: ..., ...
  (146, 310) -> (..., ...)
```

3. **提供完整的控制台输出**,特别是所有包含🔍的行

## 可能的问题点

### 如果偏移仍然存在,可能的原因:

1. **边框/标题栏常量不正确**
   - 当前值: WINDOW_BORDER_WIDTH=8, TITLE_BAR_HEIGHT=31
   - 如果实际游戏窗口边框更宽,需要调整这些常量

2. **is_windowed判断错误**
   - 可能实际是窗口模式但被判断为全屏
   - 或相反

3. **game_window_size值不正确**
   - 捕获的窗口大小与实际显示的不一致

4. **标准分辨率坐标值错误**
   - D4_STANDARD_COORDS中的坐标可能在错误的分辨率下测量

5. **ImageCrop.crop_region的坐标系统问题**
   - PIL的crop使用(left, top, right, bottom)
   - 需要确认传入的坐标格式正确

## 需要用户提供的信息

请在运行程序后提供:
1. 完整的调试输出(所有🔍标记的行)
2. 游戏窗口模式(窗口/全屏)
3. 游戏窗口实际分辨率
4. 屏幕分辨率
5. 哪些区域错位,哪些区域正确
6. 错位的大致像素数(左/右/上/下)

---

**生成时间**: 2025-10-19
**修改的文件**:
- D:\programing\core_node\apps\d3-check\d3utils\screenshot_provider.py
- D:\programing\core_node\apps\d3-check\controller\d4func\region_detector.py
- D:\programing\core_node\apps\d3-check\share\game_interface_data.py
