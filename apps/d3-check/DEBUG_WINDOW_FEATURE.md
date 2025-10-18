# D4 Debug Window Feature

## 概述 (Overview)

这个功能为D4面板添加了一个debug图片显示窗口,用于实时显示区域探测器提取的各个UI区域的截图。

This feature adds a debug image display window to the D4 panel, which shows real-time screenshots of various UI regions extracted by the region detector.

## 功能特性 (Features)

### 1. Debug图片按钮 (Debug Image Button)
- 位置: D4面板的游戏状态区域下方
- Location: Below the game status area in the D4 panel
- 功能: 点击后打开/关闭debug窗口
- Function: Opens/closes the debug window when clicked

### 2. Debug弹出窗口 (Debug Popup Window)
- 尺寸: 680x1000px
- Size: 680x1000px
- 位置: 屏幕左侧 (50, 50)
- Position: Left side of screen at (50, 50)
- 特性:
  - 可滚动查看所有区域
  - Scrollable to view all regions
  - 自动调整图片大小以适应窗口
  - Auto-resize images to fit window
  - 关闭按钮
  - Close button

### 3. 显示的区域 (Displayed Regions)

窗口显示以下探测区域:
The window displays the following detected regions:

1. **队伍区域** (Team Count Region)
   - 键值: `team_area`
   - 坐标: D4_STANDARD_COORDS.team_count_region_start/end

2. **队伍投标区** (Team Vote Region)
   - 键值: `team_vote_area`
   - 坐标: D4_STANDARD_COORDS.team_vote_region_start/end

3. **小地图区** (Minimap)
   - 键值: `minimap`
   - 坐标: D4_STANDARD_COORDS.minimap_region_start/end

4. **经验区** (Experience Bar)
   - 键值: `exp_bar`
   - 坐标: D4_STANDARD_COORDS.exp_bar_region_start/end

5. **任务显示区域** (Quest Area)
   - 键值: `quest_area`
   - 坐标: D4_STANDARD_COORDS.quest_text_region_start/end

6. **背包区域** (Bag Area)
   - 键值: `bag_area`
   - 使用: get_d4_scaled_bag_region()

7. **铁匠按钮区** (Blacksmith Button)
   - 键值: `blacksmith_button`
   - 坐标: D4_STANDARD_COORDS.blacksmith_menu_start/end

## 技术实现 (Technical Implementation)

### 1. 共享数据结构 (Shared Data Structure)

在 `D4InterfaceData` 中添加:
Added to `D4InterfaceData`:

```python
# Debug window state
debug_window_open: bool = False

# Debug images (stored in memory)
debug_images: Dict[str, Optional[Image.Image]] = field(default_factory=dict)
```

### 2. 区域探测器 (Region Detector)

`controller/d4func/region_detector.py`:

- `_extract_team_regions()`: 提取队伍相关区域
- `_extract_all_debug_regions()`: 提取所有其他debug区域
- 只在debug窗口打开时提取(性能优化)
- Only extracts when debug window is open (performance optimization)

### 3. 控制器拦截器 (Controller Interceptor)

`controller/d4_controller.py`:

- `_update_debug_window_if_open()`: 使用拦截器模式
- 只在窗口打开时更新图片
- Only updates images when window is open
- 在每个tick中调用
- Called in each tick

### 4. UI组件 (UI Components)

`ui/components/debug_window.py`:

- `DebugWindow`: 主窗口类
- `get_debug_window()`: 单例获取函数
- `close_debug_window()`: 关闭函数
- `update_images()`: 更新所有图片

`ui/panels/d4_panel.py`:

- `_create_debug_button_area()`: 创建debug按钮
- `_toggle_debug_window()`: 切换窗口显示

## 使用方法 (Usage)

1. 启动应用程序
   Start the application

2. 切换到D4面板
   Switch to D4 panel

3. 点击"Debug Images"按钮
   Click the "Debug Images" button

4. Debug窗口将在屏幕左侧打开
   Debug window will open on the left side of the screen

5. 当EXP Farming运行时,窗口会自动更新显示最新的区域截图
   When EXP Farming is running, the window auto-updates with latest region screenshots

6. 点击"Close"按钮或再次点击"Debug Images"按钮关闭窗口
   Click "Close" button or click "Debug Images" button again to close the window

## 代码复用 (Code Reuse)

所有代码遵循以下原则:
All code follows these principles:

- 使用统一的UI主题 (`UnifiedStyles`)
  Uses unified UI theme (`UnifiedStyles`)

- 复用现有的坐标计算函数
  Reuses existing coordinate calculation functions

- 复用ImageCrop库进行图片裁剪
  Reuses ImageCrop library for image cropping

- 使用拦截器模式避免重复检查
  Uses interceptor pattern to avoid repeated checks

## 性能优化 (Performance Optimization)

1. **条件提取** (Conditional Extraction)
   - 只在debug窗口打开时提取所有区域
   - Only extracts all regions when debug window is open
   - 关闭时只提取队伍区域(保持现有功能)
   - Only extracts team regions when closed (maintains existing functionality)

2. **拦截器模式** (Interceptor Pattern)
   - Tick中首先检查状态
   - Checks state first in tick
   - 避免不必要的窗口更新
   - Avoids unnecessary window updates

3. **内存管理** (Memory Management)
   - 图片存储在共享数据中
   - Images stored in shared data
   - 窗口关闭时清理资源
   - Resources cleaned up when window closes

## 文件修改列表 (Modified Files)

1. `share/game_interface_data.py`
   - 添加debug_window_open和debug_images字段
   - Added debug_window_open and debug_images fields

2. `controller/d4func/region_detector.py`
   - 添加_extract_all_debug_regions()方法
   - Added _extract_all_debug_regions() method
   - 修改detect_regions_from_shared_data()以条件性提取
   - Modified detect_regions_from_shared_data() for conditional extraction

3. `controller/d4_controller.py`
   - 添加_update_debug_window_if_open()方法
   - Added _update_debug_window_if_open() method
   - 在process()中调用更新
   - Called update in process()

4. `ui/components/debug_window.py` (新文件 / New File)
   - 创建DebugWindow类
   - Created DebugWindow class
   - 实现图片显示和更新逻辑
   - Implemented image display and update logic

5. `ui/components/__init__.py`
   - 导出debug_window相关函数
   - Exported debug_window related functions

6. `ui/panels/d4_panel.py`
   - 添加debug按钮区域
   - Added debug button area
   - 实现窗口切换逻辑
   - Implemented window toggle logic

## 注意事项 (Notes)

1. 窗口位置固定在屏幕左侧,便于观察
   Window position is fixed on the left side for easy observation

2. 图片会自动缩放以适应窗口宽度(最大650px)
   Images auto-scale to fit window width (max 650px)

3. 使用拦截器模式确保性能
   Uses interceptor pattern to ensure performance

4. 所有UI样式统一使用UnifiedStyles
   All UI styles use UnifiedStyles uniformly

5. 代码结构清晰,易于维护和扩展
   Code structure is clear, easy to maintain and extend
