# D4 地图切换检测功能

## 📋 功能描述

通过检测Map Name区域的黑屏状态,自动检测和统计D4游戏中的地图切换次数,并提供三种状态追踪:
1. **正在切换地图** (`is_switching_map`)
2. **切换后未操作** (`is_post_switch_idle`)
3. **总切换次数** (`map_switch_count`)

## 🎯 功能需求

- ✅ 创建黑屏检测器 (000000 ±10%明暗度容差)
- ✅ 对Map Name区域每tick检测一次
- ✅ 检测到全黑时标记为"正在切换"
- ✅ 黑屏消失后设置为"切换后未操作"并计数+1
- ✅ 将切换次数和状态显示在UI面板上

## 🏗️ 系统架构

### 数据流

```
每个Tick:
  D4Controller.tick()
    ↓
  screenshot_handler.capture_and_collect_info()
    ↓
  region_detector.detect_regions_from_shared_data()
    └─ 提取Map Name区域图像
    ↓
  map_switch_detector.detect_map_switch()
    ├─ 使用BlackScreenDetector检测Map Name是否为黑屏
    ├─ 状态机转换
    └─ 更新d4_data中的状态变量
    ↓
  UIStatusUpdater定时刷新
    └─ d4_panel显示最新的切换次数和状态
```

### 状态机

```
States:
  - Normal (正常): 游戏正常运行
  - Switching (切换中): 检测到黑屏
  - Post-Switch Idle (切换后): 黑屏消失,等待用户操作

Transitions:
  1. Normal → Switching
     条件: Map Name区域变为全黑
     操作: is_switching_map = True

  2. Switching → Post-Switch Idle
     条件: Map Name区域不再全黑
     操作: is_switching_map = False
          is_post_switch_idle = True
          map_switch_count += 1

  3. Post-Switch Idle → Normal
     条件: 用户执行任何操作 (需要调用reset_post_switch_idle())
     操作: is_post_switch_idle = False
```

## 📁 文件结构

### 1. Share模块 - 状态变量定义

**文件**: `share/game_interface_data.py`

```python
class D4InterfaceData:
    # Map switching state (Line 1169-1172)
    is_switching_map: bool = False         # 是否正在切换地图
    map_switch_count: int = 0              # 总切换次数
    is_post_switch_idle: bool = False      # 切换后未操作状态
```

### 2. 黑屏检测器

**文件**: `d4utils/black_screen_detector.py`

**核心类**: `BlackScreenDetector`

**关键参数**:
- `BLACK_THRESHOLD = 25` (255的10% ≈ 25)
  - RGB每个通道 ≤ 25 认为是黑色
- `BLACK_PIXEL_PERCENTAGE = 0.95` (95%)
  - 95%以上的像素必须是黑色才认为是黑屏

**主要方法**:
```python
def is_black_screen(image, threshold=25, black_percentage=0.95) -> bool:
    """
    检测图像是否为黑屏

    Args:
        image: PIL Image 或 numpy array
        threshold: 黑色阈值 (0-255), 默认25
        black_percentage: 黑色像素最小百分比, 默认0.95

    Returns:
        True if 黑屏, False otherwise
    """
```

**检测逻辑**:
1. 将图像转换为numpy array
2. 检查每个像素的所有通道 (R, G, B) 是否都 ≤ threshold
3. 计算黑色像素百分比
4. 如果 ≥ black_percentage，返回True

### 3. 地图切换检测器

**文件**: `controller/d4func/map_switch_detector.py`

**核心类**: `MapSwitchDetector`

**主要方法**:
```python
def detect_map_switch() -> bool:
    """
    每tick调用一次,检测地图切换状态

    流程:
    1. 获取Map Name区域图像
    2. 使用BlackScreenDetector检测是否为黑屏
    3. 根据当前和上一次的黑屏状态执行状态转换
    4. 更新d4_data中的状态变量

    Returns:
        True if 检测成功, False otherwise
    """

def reset_post_switch_idle():
    """
    重置"切换后未操作"状态
    当检测到用户操作时调用 (需要手动集成)
    """

def get_map_switch_stats() -> dict:
    """
    获取当前统计数据

    Returns:
        {
            'is_switching': bool,
            'is_post_switch_idle': bool,
            'switch_count': int
        }
    """
```

### 4. 控制器集成

**文件**: `controller/d4_controller.py` (Line 125-128)

```python
if detection_success:
    # Step 3: Detect map switching
    from .d4func.map_switch_detector import get_map_switch_detector
    map_switch_detector = get_map_switch_detector()
    map_switch_detector.detect_map_switch()

    # Update debug window...
```

### 5. UI面板显示

**文件**: `ui/panels/d4_panel.py`

**位置**: Game Status区域第2行

| 字段 | 键值 | 显示内容 |
|------|------|---------|
| Map Switches | map_switch_count | 切换次数 (数字) |
| Map State | map_switch_state | 状态 (Switching/Post-Switch/Normal) |

**更新逻辑** (Line 483-495):
```python
# 更新切换次数
map_switch_count = d4_data.map_switch_count
self._update_status_value("map_switch_count", str(map_switch_count))

# 更新切换状态
if d4_data.is_switching_map:
    map_switch_state = "Switching"
elif d4_data.is_post_switch_idle:
    map_switch_state = "Post-Switch"
else:
    map_switch_state = "Normal"
self._update_status_value("map_switch_state", map_switch_state)
```

### 6. 国际化支持

**英文** (`providor/i18n/i18n_d4_panel_en.json`):
```json
"map_switch_count": "Map Switches",
"map_switch_state": "Map State"
```

**中文** (`providor/i18n/i18n_d4_panel_zh.json`):
```json
"map_switch_count": "切换地图次数",
"map_switch_state": "地图切换状态"
```

## 🔧 技术细节

### 黑屏检测算法

```python
# 1. 定义黑色阈值 (±10%容差)
BLACK_THRESHOLD = 25  # 255 * 0.1 ≈ 25

# 2. 对于RGB图像,每个像素检查所有通道
is_black_pixel = (R <= 25) AND (G <= 25) AND (B <= 25)

# 3. 统计黑色像素百分比
black_ratio = count(is_black_pixel) / total_pixels

# 4. 判断是否为黑屏
is_black_screen = black_ratio >= 0.95  # 95%以上为黑
```

### 为什么选择Map Name区域?

1. **可靠性高**: Map Name在切换地图时总是会变成完全黑色
2. **区域小**: 图像小,检测速度快
3. **位置固定**: 不受游戏状态影响
4. **已有提取**: region_detector已经提取此区域

### 性能考虑

- **检测频率**: 每个tick一次 (~3秒间隔)
- **图像大小**: Map Name区域约 186x28像素
- **计算复杂度**: O(width × height) ≈ O(5,000) - 非常快
- **内存占用**: 使用已提取的region_images,无额外内存开销

## 📊 使用示例

### 查看统计数据

```python
from controller.d4func.map_switch_detector import get_map_switch_detector

detector = get_map_switch_detector()
stats = detector.get_map_switch_stats()

print(f"Is switching: {stats['is_switching']}")
print(f"Is post-switch idle: {stats['is_post_switch_idle']}")
print(f"Switch count: {stats['switch_count']}")
```

### 重置Post-Switch Idle状态

```python
# 当检测到用户操作时 (例如点击,键盘输入等)
detector = get_map_switch_detector()
detector.reset_post_switch_idle()
```

### UI显示

在D4 Panel的Game Status区域:
```
Row 2, Column 2: Map Switches: 15
Row 2, Column 3: Map State: Normal
```

## 🎨 UI显示效果

```
┌──────────────────────────────────────────────────────────┐
│  Game Status                                             │
├──────────────┬──────────────┬──────────────┬─────────────┤
│ Current Map  │ Game State   │ Team Count   │ ...         │
│ Dungeon      │ Running      │ 4            │             │
├──────────────┼──────────────┼──────────────┼─────────────┤
│ Screen Coord │ Screen Size  │ Map Switches │ Map State   │
│ (100, 200)   │ 1920x1080    │ 15           │ Normal      │
└──────────────┴──────────────┴──────────────┴─────────────┘
```

**状态显示**:
- `Normal`: 正常游戏中
- `Switching`: 正在切换地图 (黑屏)
- `Post-Switch`: 刚切换完,未操作

## 🧪 测试验证

### 手动测试步骤

1. **启动D4并打开程序**
   - 启动Diablo IV
   - 打开D3-Check程序
   - 进入D4 Panel

2. **验证初始状态**
   - Map Switches: 0
   - Map State: Normal

3. **触发地图切换**
   - 在游戏中使用传送门/返回城镇/进入地下城
   - 观察黑屏出现

4. **验证切换中状态**
   - Map State应变为: Switching
   - 控制台输出: `[MapSwitchDetector] 🗺️  Map switching started`

5. **验证切换完成**
   - 黑屏消失后
   - Map Switches应+1
   - Map State应变为: Post-Switch
   - 控制台输出: `[MapSwitchDetector] ✅ Map switch completed (count: X)`

6. **多次切换验证**
   - 重复步骤3-5
   - 确认计数正确累加

### 单元测试

黑屏检测器已包含内置测试:

```bash
cd D:\programing\core_node\apps\d3-check
python d4utils/black_screen_detector.py
```

预期输出:
```
Pure black (0,0,0): True
Near black (20,20,20): True
Dark gray (50,50,50): False
White (255,255,255): False
90% black, 10% white: False
```

## 🔍 故障排除

### 问题1: 切换次数不增加

**可能原因**:
- Map Name区域未正确提取
- 黑屏阈值设置不当
- UIStatusUpdater未正常刷新

**解决方案**:
```python
# 检查Map Name区域
from share.game_interface_data import get_d4_interface_data
d4_data = get_d4_interface_data()
print(d4_data.detected_regions.get('region_images', {}).keys())
# 应包含'Map Name'

# 检查亮度统计
from d4utils.black_screen_detector import BlackScreenDetector
map_name_img = d4_data.detected_regions['region_images']['Map Name']
stats = BlackScreenDetector.get_brightness_stats(map_name_img)
print(stats)  # 黑屏时mean应接近0
```

### 问题2: 误报黑屏

**可能原因**:
- 阈值太高
- Map Name在某些场景下正常也很暗

**解决方案**:
- 调整`BLACK_THRESHOLD` (降低阈值,例如从25降到15)
- 调整`BLACK_PIXEL_PERCENTAGE` (提高百分比,例如从0.95提到0.98)

### 问题3: UI不更新

**可能原因**:
- UIStatusUpdater未运行
- 字段映射错误

**解决方案**:
- 检查UIStatusUpdater是否正常运行
- 确认i18n键值是否正确

## 📝 未来改进

### 可选功能

1. **切换速度统计**
   - 记录每次切换的耗时
   - 显示平均切换时间

2. **切换历史记录**
   - 保存最近N次切换的时间戳
   - 显示切换频率趋势

3. **自动重置Post-Switch Idle**
   - 集成键盘/鼠标监听
   - 自动检测用户操作并重置状态

4. **地图路径追踪**
   - 结合current_map字段
   - 记录地图切换路径 (A→B→C)

5. **切换效率分析**
   - 统计切换间隔
   - 识别异常切换 (过快/过慢)

## 📦 新增文件

1. `d4utils/black_screen_detector.py` - 黑屏检测工具类
2. `controller/d4func/map_switch_detector.py` - 地图切换检测器
3. `MAP_SWITCH_DETECTOR_FEATURE.md` - 本文档

## 🔄 修改的文件

1. `share/game_interface_data.py` - 添加3个状态变量
2. `controller/d4_controller.py` - 集成检测器到tick流程
3. `ui/panels/d4_panel.py` - 显示切换次数和状态
4. `providor/i18n/i18n_d4_panel_en.json` - 英文翻译
5. `providor/i18n/i18n_d4_panel_zh.json` - 中文翻译

---

**实现时间**: 2025-10-19
**状态**: ✅ 完成并可用
**版本**: 1.0.0
