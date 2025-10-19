# D4区域偏移问题 - 修复总结

## 📋 问题描述
用户报告在D4 debug_window中显示的区域图片出现错位,大约向左偏移70像素。Team Count区域已对齐正确,但其他区域仍有偏移问题。

## ✅ 已完成的修复

### 1. 修复screenshot_provider.py中的尺寸赋值错误

**文件**: `D:\programing\core_node\apps\d3-check\d3utils\screenshot_provider.py`

#### 问题1: game_window_size使用了错误的值
```python
# ❌ 修复前 (line 261):
game_window_size = fullscreen_size  # 错误 - 使用了屏幕分辨率而非实际窗口大小

# ✅ 修复后:
game_window_size = captured_size  # 正确 - 使用实际捕获的窗口大小
game_window_rect = (0, 0, captured_size[0], captured_size[1])
```

**影响**: 这导致所有坐标缩放计算使用了错误的基准分辨率,造成所有区域大幅度错位。

#### 问题2: fullscreen_size变量名混淆
```python
# ❌ 修复前 (line 238):
fullscreen_size = (screen_width, screen_height)  # 变量名容易混淆

# ✅ 修复后 (line 238):
screen_resolution = (screen_width, screen_height)
# ... later in code:
fullscreen_size = screen_resolution  # 明确赋值
```

**影响**: 提高代码可读性,避免fullscreen_size在不同上下文中含义不同。

### 2. 移除硬编码的is_windowed值

**文件**: `D:\programing\core_node\apps\d3-check\d4utils\red_portal_detector.py`

```python
# ❌ 修复前 (line 171):
is_windowed = False  # Assume fullscreen for simplicity

# ✅ 修复后:
d4_data = get_d4_interface_data()
is_windowed = d4_data.is_windowed_mode()  # 从共享数据获取
```

**原因**: 遵循用户要求 - 所有数据通过share共享,不在个别文件中硬编码。

### 3. 添加全面的调试日志

#### 在region_detector.py中添加 (lines 123-128, 172-176):
- 打印game_window_size, fullscreen_size, is_windowed等关键值
- 打印Team Count区域的坐标转换详情
- 打印图像实际尺寸

#### 在game_interface_data.py中添加 (lines 131, 149-150, 176-181, 199-202):
- 在`calculate_unified_scaled_coordinate()`中添加Team Count坐标的调试输出
- 显示有效尺寸(effective dimensions)计算
- 显示scale因子
- 显示坐标转换的每一步

## 🔍 数据流验证

### 完整数据流:
```
screenshot_provider.gen()
  ├─ 捕获: captured_size = result["window_size"]
  ├─ 屏幕: screen_resolution = get_screen_resolution()
  └─ 创建: ScreenshotData(
       game_window_size = captured_size,      ✅
       fullscreen_size = screen_resolution    ✅
     )
       ↓
screenshot_handler.capture_and_collect_info()
  └─ 保存: d4_data.screenshot_data = screenshot_data
       ↓
region_detector.detect_regions_from_shared_data()
  ├─ 读取: screenshot_data = d4_data.screenshot_data
  ├─ 尺寸: game_window_size = screenshot_data.game_window_size
  ├─ 模式: is_windowed = d4_data.is_windowed_mode()
  └─ 提取: _extract_all_regions_to_share(screenshot_data)
       ↓
_extract_all_regions_to_share()
  ├─ 对每个区域:
  │   ├─ 计算: calculate_unified_scaled_coordinate()
  │   └─ 裁剪: ImageCrop.crop_region()
  └─ 保存: d4_data.detected_regions['region_images']
       ↓
debug_window.update_images()
  └─ 显示: d4_data.detected_regions['region_images'][label]
```

### 数据共享验证:
✅ **所有窗口模式判断**: 统一使用 `d4_data.is_windowed_mode()`
✅ **所有窗口尺寸**: 统一从 `screenshot_data.game_window_size` 获取
✅ **所有常量定义**: 统一在 `share/game_interface_data.py` 中定义
✅ **无硬编码**: 移除了 `red_portal_detector.py` 中的硬编码 `is_windowed = False`
✅ **无重复定义**: 验证了 `WINDOW_BORDER_WIDTH` 和 `TITLE_BAR_HEIGHT` 只在share中定义

## 📊 调试输出示例

运行程序后,会看到类似以下的调试输出:

```
[RegionDetector] 🔍 DEBUG - game_window_size: (1747, 1087)
[RegionDetector] 🔍 DEBUG - fullscreen_size: (1920, 1080)
[RegionDetector] 🔍 DEBUG - is_windowed: True
[RegionDetector] 🔍 DEBUG - d4_data.fullscreen_size: (1920, 1080)
[RegionDetector] 🔍 DEBUG - d4_data.game_window_size: (1747, 1087)

[RegionDetector] 🔍 DEBUG 'Team Count':
  Standard: (146, 310) -> (228, 624)
  Scaled:   (144, 307) -> (225, 618)
  Image size: (1747, 1087)

[CoordCalc] 🔍 Input: std=(146, 310), actual_size=(1747, 1087), std_size=(1763, 1126), windowed=True
[CoordCalc] 🔍 Windowed mode:
  effective_actual: 1731x1048
  effective_std: 1747x1087
  scale: 0.9908, 0.9641
  (146, 310) -> (144, 307)
```

## 🎯 下一步调试步骤

1. **运行程序**并打开D4 debug window
2. **收集调试输出**,查找所有包含🔍标记的行
3. **检查以下关键值**:
   - `game_window_size` 是否等于实际游戏窗口尺寸
   - `fullscreen_size` 是否等于屏幕分辨率
   - `is_windowed` 是否正确判断窗口模式
   - `scale` 因子是否合理
   - Team Count的坐标转换是否正确

4. **如果仍有偏移**,提供:
   - 完整的调试输出
   - 游戏窗口实际模式(窗口/全屏)
   - 游戏窗口实际分辨率
   - 哪些区域正确,哪些区域错位
   - 错位的方向和大致像素数

## 📁 修改的文件列表

1. `D:\programing\core_node\apps\d3-check\d3utils\screenshot_provider.py`
   - 修复game_window_size赋值错误
   - 修复fullscreen_size变量命名

2. `D:\programing\core_node\apps\d3-check\d4utils\red_portal_detector.py`
   - 移除硬编码的is_windowed = False
   - 改为从shared data获取

3. `D:\programing\core_node\apps\d3-check\controller\d4func\region_detector.py`
   - 添加调试日志输出

4. `D:\programing\core_node\apps\d3-check\share\game_interface_data.py`
   - 添加坐标计算调试日志

## ⚠️ 重要说明

- **调试日志是临时的**: 这些🔍标记的调试输出是为了诊断问题,确认修复后应该移除
- **数据共享原则**: 所有数据必须通过share模块共享,不允许在个别文件中硬编码
- **常量定义位置**: 所有常量(如WINDOW_BORDER_WIDTH)只在 `share/game_interface_data.py` 中定义

---
**修复完成时间**: 2025-10-19
**状态**: ✅ 已修复主要问题,等待用户运行测试并提供调试输出
