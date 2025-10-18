# D4 Debug Window Feature - 最终实现

## 概述 (Overview)

这个功能为D4面板添加了一个debug图片显示窗口,用于实时显示区域探测器提取的各个UI区域的截图。

**核心设计理念**:
- **统一数据源**: 所有数据通过 `D4InterfaceData` 共享
- **单次提取**: 所有区域在每个tick中只提取一次
- **复用现有结构**: 使用 `detected_regions` 存储区域图片,避免重复定义

## 架构设计 (Architecture)

### 数据流 (Data Flow)

```
Tick开始
  ↓
Screenshot Provider → screenshot_data
  ↓
Region Detector → 提取ALL regions → detected_regions['region_images']
  ↓
D4 Controller → 检查debug_window_open
  ↓
Debug Window → 从detected_regions读取 → 更新显示
```

### 关键组件 (Key Components)

#### 1. D4InterfaceData (共享数据中心)

```python
@dataclass
class D4InterfaceData:
    # 现有字段
    detected_regions: Optional[Dict[str, Any]] = None

    # Debug窗口状态
    debug_window_open: bool = False
```

**detected_regions结构**:
```python
detected_regions = {
    'region_images': {
        'Team Count': PIL.Image,
        'Team Vote': PIL.Image,
        'Minimap': PIL.Image,
        'EXP Bar': PIL.Image,
        'Quest Text': PIL.Image,
        'Bag': PIL.Image,
        'Blacksmith Menu': PIL.Image,
        'Whisper Obols': PIL.Image,
        'Equipment Left': PIL.Image,
        'Equipment Right': PIL.Image,
        'Blacksmith Function': PIL.Image,
        'Map Name': PIL.Image,
    }
}
```

#### 2. Region Detector (区域提取器)

**文件**: `controller/d4func/region_detector.py`

**核心方法**: `_extract_all_regions_to_share()`

```python
def _extract_all_regions_to_share(self, screenshot_data):
    """
    Extract all regions defined in image_annotator and store in detected_regions

    This extracts ALL regions from image_annotator.regions_to_draw once per tick,
    storing the cropped images in detected_regions for sharing across the application.
    """
```

**特点**:
- 与 `image_annotator.py` 中的 `regions_to_draw` 保持一致
- 每个tick只执行一次
- 所有区域统一提取,避免重复代码

#### 3. Debug Window (调试窗口)

**文件**: `ui/components/debug_window.py`

**核心方法**: `update_images()`

```python
def update_images(self):
    """Update all debug images from detected_regions"""
    # Get region_images from detected_regions
    detected_regions = self.d4_data.detected_regions
    region_images = detected_regions['region_images']

    # Update each image label
    for region_key, img_label in self.image_labels.items():
        if region_key in region_images:
            pil_image = region_images[region_key]
            # Resize and display...
```

**特点**:
- 从 `D4InterfaceData.detected_regions` 读取
- 不直接传递数据,通过共享数据通信
- 支持12个区域的显示

#### 4. D4 Controller (控制器)

**文件**: `controller/d4_controller.py`

**执行顺序**:
```python
def process(self):
    # 1. EXP Farming (包含region detection)
    success = self.exp_farming_manager.start_exp_farming_process(self.d4_data)

    # 2. Update debug window (读取detected_regions)
    self._update_debug_window_if_open()
```

**拦截器模式**:
```python
def _update_debug_window_if_open(self):
    """只在debug_window_open=True时更新"""
    if not self.d4_data.debug_window_open:
        return  # 跳过更新
```

## 显示的区域 (Displayed Regions)

所有区域与 `image_annotator.py` 中的 `regions_to_draw` 完全一致:

| 序号 | 区域标签 | 坐标定义 | 用途 |
|------|---------|---------|------|
| 1 | Team Count | team_count_region_start/end | 队伍成员数量 |
| 2 | Team Vote | team_vote_region_start/end | 队伍投票区域 |
| 3 | Minimap | minimap_region_start/end | 小地图 |
| 4 | EXP Bar | exp_bar_region_start/end | 经验条 |
| 5 | Quest Text | quest_text_region_start/end | 任务文本 |
| 6 | Bag | bag_top_left/bag_bottom_right | 背包 |
| 7 | Blacksmith Menu | blacksmith_menu_start/end | 铁匠菜单 |
| 8 | Whisper Obols | whisper_obols_region_start/end | 低语货币 |
| 9 | Equipment Left | equipment_left_region_start/end | 左侧装备 |
| 10 | Equipment Right | equipment_right_region_start/end | 右侧装备 |
| 11 | Blacksmith Function | blacksmith_function_region_start/end | 铁匠功能 |
| 12 | Map Name | map_name_region_start/end | 地图名称 |

## 代码优化 (Code Optimization)

### 1. 避免重复提取

**之前** (错误示例):
```python
# region_detector.py
_extract_team_regions()      # 提取队伍区域
_extract_all_debug_regions() # 再次提取所有区域 (重复!)
```

**现在** (正确):
```python
# region_detector.py
_extract_all_regions_to_share() # 只执行一次,提取所有12个区域
```

### 2. 统一数据源

**之前** (错误示例):
```python
# 在多个地方定义区域
debug_images = {}  # 单独的字典
detected_regions = {}  # 另一个字典
```

**现在** (正确):
```python
# 只使用D4InterfaceData
detected_regions['region_images'] = {}  # 统一存储
```

### 3. 避免直接传递数据

**原则**: 所有组件通过 `D4InterfaceData` 共享数据,不直接传递

```python
# ✅ 正确
class DebugWindow:
    def __init__(self):
        self.d4_data = get_d4_interface_data()  # 获取共享数据

    def update_images(self):
        region_images = self.d4_data.detected_regions['region_images']

# ❌ 错误
class DebugWindow:
    def __init__(self, regions):  # 直接传递数据
        self.regions = regions
```

## 性能优化 (Performance)

### 1. 单次提取

- 所有12个区域在每个tick中只提取一次
- 存储在 `detected_regions['region_images']` 中
- Debug窗口和其他组件共享同一份数据

### 2. 拦截器模式

```python
# d4_controller.py
def _update_debug_window_if_open(self):
    if not self.d4_data.debug_window_open:
        return  # 窗口关闭时跳过更新,节省性能
```

### 3. 内存管理

- PIL图片存储在共享数据中
- 窗口关闭时不清理图片(其他组件可能使用)
- 只在 `D4InterfaceData.clear()` 时清理

## 使用方法 (Usage)

1. **启动应用**
   ```bash
   python main.py
   ```

2. **打开D4面板**
   - 切换到"D4"标签页

3. **点击Debug按钮**
   - 位置: 游戏状态区域下方
   - 文本: "Debug Images"

4. **查看区域图片**
   - 窗口自动在屏幕左侧打开(680x1000px)
   - 显示12个区域的实时截图
   - 可滚动查看所有区域

5. **自动更新**
   - 当EXP Farming运行时,每个tick自动更新
   - 执行顺序: Region Detection → Debug Window Update

6. **关闭窗口**
   - 点击窗口内的"Close"按钮
   - 或再次点击"Debug Images"按钮

## 文件修改列表 (Modified Files)

### 1. share/game_interface_data.py
- ✅ 保留 `detected_regions` 字段
- ✅ 添加 `debug_window_open` 字段
- ❌ 移除 `debug_images` 字段(不再需要)

### 2. controller/d4func/region_detector.py
- ✅ 添加 `_extract_all_regions_to_share()` 方法
- ✅ 提取12个区域到 `detected_regions['region_images']`
- ✅ 与 `image_annotator.regions_to_draw` 保持一致
- ❌ 移除 `_extract_team_regions()` 和 `_extract_all_debug_regions()`

### 3. ui/components/debug_window.py
- ✅ 从 `detected_regions['region_images']` 读取图片
- ✅ 支持12个区域显示
- ✅ 区域标签与 `image_annotator` 一致

### 4. controller/d4_controller.py
- ✅ 保持执行顺序: detect → update
- ✅ 使用拦截器模式优化性能

### 5. ui/panels/d4_panel.py
- ✅ 添加Debug按钮
- ✅ 切换 `debug_window_open` 状态

### 6. ui/components/__init__.py
- ✅ 导出 `DebugWindow`, `get_debug_window`, `close_debug_window`

## 测试检查 (Testing Checklist)

- [x] 所有文件语法检查通过
- [x] 数据流通过 `D4InterfaceData` 共享
- [x] 区域只提取一次(无重复)
- [x] Debug窗口从 `detected_regions` 读取
- [x] 执行顺序正确: detect → debug update
- [x] 拦截器模式工作正常
- [x] 区域标签与 `image_annotator` 一致

## 总结 (Summary)

### 核心改进

1. **统一数据源** ✅
   - 所有数据通过 `D4InterfaceData` 共享
   - 移除了重复的 `debug_images` 字典

2. **单次提取** ✅
   - 12个区域在每个tick中只提取一次
   - 存储在 `detected_regions['region_images']`

3. **代码复用** ✅
   - 区域定义与 `image_annotator.regions_to_draw` 一致
   - 避免重复定义和维护成本

4. **清晰架构** ✅
   - 数据流清晰: Screenshot → Region Detection → Share → Debug Display
   - 执行顺序明确: detect first, then update

### 性能优势

- ⚡ 减少50%的图片提取操作(从2次降为1次)
- ⚡ 拦截器模式避免不必要的更新
- ⚡ 共享数据避免内存复制

### 可维护性

- 📝 区域定义统一管理(image_annotator.py)
- 📝 数据流向清晰(单向流动)
- 📝 组件解耦(通过共享数据通信)
