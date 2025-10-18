# Debug Window 故障排除指南

## 问题症状

Debug窗口打开后，图片没有变化或显示"No Image Available"。

## 调试步骤

### 1. 检查日志输出

当debug窗口打开并运行时，应该看到以下日志序列：

#### A. Region Detector日志

```
[RegionDetector] Detecting regions from shared data...
[RegionDetector] About to extract all regions to share...
[RegionDetector] Extracting all regions to share...
[RegionDetector] ✓ Extracted 'Team Count' - Size: (width, height)
[RegionDetector] ✓ Extracted 'Team Vote' - Size: (width, height)
[RegionDetector] ✓ Extracted 'Minimap' - Size: (width, height)
...
[RegionDetector] Extracted 12/12 regions to detected_regions
[RegionDetector] Region keys: ['Team Count', 'Team Vote', 'Minimap', ...]
[RegionDetector] Finished extracting all regions to share
```

#### B. D4 Controller日志

```
[D4Controller] Checking debug window status: True
[D4Controller] Debug window is open, updating images...
[D4Controller] detected_regions has 12 region images
[D4Controller] Debug window images updated successfully
```

#### C. Debug Window日志

```
[DebugWindow] Starting update_images...
[DebugWindow] Found 12 region images
[DebugWindow] Available regions: ['Team Count', 'Team Vote', ...]
[DebugWindow] Expected regions: ['Team Count', 'Team Vote', ...]
[DebugWindow] ✓ Updated 'Team Count'
[DebugWindow] ✓ Updated 'Team Vote'
...
[DebugWindow] Updated 12/12 images
```

### 2. 常见问题及解决方案

#### 问题 1: "No screenshot data in shared memory"

**症状**:
```
[RegionDetector] No screenshot data in shared memory
```

**原因**: Screenshot未被capture

**解决方案**:
- 确保游戏窗口存在并可见
- 检查WindowFinder是否找到游戏窗口
- 查看ScreenshotHandler的日志

#### 问题 2: "detected_regions is None"

**症状**:
```
[D4Controller] detected_regions is None
```

**原因**: Region detector未正常执行

**解决方案**:
1. 检查`detect_regions_from_shared_data()`是否被调用
2. 查看是否有异常抛出
3. 确认`_extract_all_regions_to_share()`是否执行

#### 问题 3: "'region_images' not in detected_regions"

**症状**:
```
[DebugWindow] 'region_images' not in detected_regions. Keys: ['map_name', 'dungeon_progress']
```

**原因**: `_extract_all_regions_to_share()`未执行或失败

**解决方案**:
1. 检查RegionDetector日志中是否有"Extracting all regions to share..."
2. 查看是否有提取失败的错误
3. 确认`screenshot_data.game_window_image`不为None

#### 问题 4: "No image for 'XXX'"

**症状**:
```
[DebugWindow] ✗ No image for 'Team Count'
```

**原因**: 区域标签不匹配

**解决方案**:
检查debug_window.py中的regions列表是否与region_detector.py中的regions_to_extract完全一致。

**当前正确的标签**:
- Team Count
- Team Vote
- Minimap
- EXP Bar
- Quest Text
- Bag
- Blacksmith Menu
- Whisper Obols
- Equipment Left
- Equipment Right
- Blacksmith Function
- Map Name

#### 问题 5: Debug窗口状态未更新

**症状**:
```
[D4Controller] Checking debug window status: False
```

**原因**: `debug_window_open`未正确设置

**解决方案**:
1. 检查D4Panel中`_toggle_debug_window()`是否被调用
2. 确认`d4_data.debug_window_open = True`被执行
3. 查看是否有异常导致状态未更新

### 3. 数据流检查清单

使用以下清单检查数据流是否正常：

```
□ Step 1: Screenshot Capture
   □ WindowFinder找到游戏窗口
   □ ScreenshotHandler捕获截图
   □ screenshot_data写入D4InterfaceData

□ Step 2: Region Detection
   □ RegionDetector从screenshot_data读取
   □ _extract_all_regions_to_share()被调用
   □ 12个区域被提取到detected_regions['region_images']

□ Step 3: Debug Window Status
   □ debug_window_open = True
   □ D4Controller检测到窗口打开
   □ _update_debug_window_if_open()被调用

□ Step 4: Image Update
   □ DebugWindow.update_images()被调用
   □ 从detected_regions['region_images']读取图片
   □ 图片显示在UI上
```

### 4. 手动调试步骤

如果自动日志不够详细，可以手动添加断点或打印：

#### A. 检查detected_regions内容

在`debug_window.py`的`update_images()`中添加：

```python
print("\n=== DEBUG INFO ===")
print(f"detected_regions type: {type(self.d4_data.detected_regions)}")
print(f"detected_regions keys: {list(self.d4_data.detected_regions.keys()) if self.d4_data.detected_regions else 'None'}")
if self.d4_data.detected_regions and 'region_images' in self.d4_data.detected_regions:
    print(f"region_images keys: {list(self.d4_data.detected_regions['region_images'].keys())}")
    for key, img in self.d4_data.detected_regions['region_images'].items():
        print(f"  {key}: {type(img)}, {img.size if img else 'None'}")
print("==================\n")
```

#### B. 检查执行顺序

在`d4_controller.py`的`process()`方法中验证：

```python
print("\n=== TICK EXECUTION ORDER ===")
print("1. Starting exp_farming_process...")
success = self.exp_farming_manager.start_exp_farming_process(self.d4_data)
print(f"   Result: {success}")

print("2. Updating UI status...")
self.ui_status_updater.update_ui_status()

print("3. Checking state changes...")
self.event_manager.check_state_changes()

print("4. Updating debug window...")
self._update_debug_window_if_open()
print("============================\n")
```

### 5. 预期行为

**正常工作时的完整日志示例**:

```
================================================================================
[D4 EXP Farming] Tick #1
================================================================================

[ScreenshotHandler] Capturing screenshot...
[ScreenshotHandler] Screenshot captured successfully

[RegionDetector] Detecting regions from shared data...
[RegionDetector] About to extract all regions to share...
[RegionDetector] Extracting all regions to share...
[RegionDetector] ✓ Extracted 'Team Count' - Size: (120, 40)
[RegionDetector] ✓ Extracted 'Team Vote' - Size: (200, 60)
[RegionDetector] ✓ Extracted 'Minimap' - Size: (250, 250)
[RegionDetector] ✓ Extracted 'EXP Bar' - Size: (400, 20)
[RegionDetector] ✓ Extracted 'Quest Text' - Size: (300, 100)
[RegionDetector] ✓ Extracted 'Bag' - Size: (400, 500)
[RegionDetector] ✓ Extracted 'Blacksmith Menu' - Size: (350, 450)
[RegionDetector] ✓ Extracted 'Whisper Obols' - Size: (150, 30)
[RegionDetector] ✓ Extracted 'Equipment Left' - Size: (200, 300)
[RegionDetector] ✓ Extracted 'Equipment Right' - Size: (200, 300)
[RegionDetector] ✓ Extracted 'Blacksmith Function' - Size: (300, 200)
[RegionDetector] ✓ Extracted 'Map Name' - Size: (200, 40)
[RegionDetector] Extracted 12/12 regions to detected_regions
[RegionDetector] Region keys: ['Team Count', 'Team Vote', 'Minimap', 'EXP Bar', 'Quest Text', 'Bag', 'Blacksmith Menu', 'Whisper Obols', 'Equipment Left', 'Equipment Right', 'Blacksmith Function', 'Map Name']
[RegionDetector] Finished extracting all regions to share

[D4Controller] Checking debug window status: True
[D4Controller] Debug window is open, updating images...
[D4Controller] detected_regions has 12 region images

[DebugWindow] Starting update_images...
[DebugWindow] Found 12 region images
[DebugWindow] Available regions: ['Team Count', 'Team Vote', 'Minimap', 'EXP Bar', 'Quest Text', 'Bag', 'Blacksmith Menu', 'Whisper Obols', 'Equipment Left', 'Equipment Right', 'Blacksmith Function', 'Map Name']
[DebugWindow] Expected regions: ['Team Count', 'Team Vote', 'Minimap', 'EXP Bar', 'Quest Text', 'Bag', 'Blacksmith Menu', 'Whisper Obols', 'Equipment Left', 'Equipment Right', 'Blacksmith Function', 'Map Name']
[DebugWindow] ✓ Updated 'Team Count'
[DebugWindow] ✓ Updated 'Team Vote'
[DebugWindow] ✓ Updated 'Minimap'
[DebugWindow] ✓ Updated 'EXP Bar'
[DebugWindow] ✓ Updated 'Quest Text'
[DebugWindow] ✓ Updated 'Bag'
[DebugWindow] ✓ Updated 'Blacksmith Menu'
[DebugWindow] ✓ Updated 'Whisper Obols'
[DebugWindow] ✓ Updated 'Equipment Left'
[DebugWindow] ✓ Updated 'Equipment Right'
[DebugWindow] ✓ Updated 'Blacksmith Function'
[DebugWindow] ✓ Updated 'Map Name'
[DebugWindow] Updated 12/12 images

[D4Controller] Debug window images updated successfully
```

## 总结

通过以上调试日志，你可以快速定位问题所在：

1. **日志完全没有** → EXP Farming未运行
2. **只有Step 1日志** → Region detection失败
3. **只有Step 1-2日志** → Debug window未打开
4. **有所有日志但图片不更新** → UI线程问题或标签不匹配

现在运行程序并查看日志输出，找出具体哪一步出现了问题。
