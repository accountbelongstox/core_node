# 队伍检查流程完整分析

## 📋 实际日志分析

### 原始问题日志（修复前）
```
[D4] Checking team status before starting EXP farming
[TeamFormationChecker] Initialized
[Global] Team formation checker initialized
[D4Operation] _ensure_window_active called, _window_activated=False
[D4Operation] is_windowed_mode=False
[D4Operation] fullscreen_size=(0, 0), game_window_size=(0, 0)  ← 问题！
[D4Operation] Fullscreen mode detected, no activation needed
[TeamFormationChecker] Starting team formation check...
[TeamFormationChecker] Pressing 'O' key to open team panel
[D4Operation] Pressing key: 'o'
```

## 🔍 流程图（修复前）

```
用户点击"启动挂机经验"按钮
  ↓
d4_panel.py: _start_exp_farming()
  ↓
创建 TeamFormationChecker 实例
  ├─ 初始化 d4_data = get_d4_interface_data()
  ├─ 此时 d4_data.fullscreen_size = (0, 0)  ← 数据未初始化
  └─ 此时 d4_data.game_window_size = (0, 0)
  ↓
调用 team_checker.run()
  ↓
d4_operation_base.py: run()
  ↓
调用 _ensure_window_active()
  ├─ 检查 self.d4_data.is_windowed_mode()
  ├─ fullscreen_size=(0, 0), game_window_size=(0, 0)
  ├─ is_windowed_mode() 返回 False  ← 错误判断
  └─ 跳过窗口激活（认为是全屏）
  ↓
调用 execute()
  ↓
team_formation_checker.py: execute()
  ├─ 按 'O' 键  ← 直接按键，没有先激活窗口
  ├─ 等待 0.1s
  ├─ 查找 "Find Team" 区域
  └─ 区域不可用（因为之前没有截图数据）
  ↓
返回 False
```

## 🛠️ 修复方案

### 修复代码位置

**文件：** `ui/panels/d4_panel.py`
**方法：** `_start_exp_farming()`
**位置：** 行 264-276

```python
def _start_exp_farming(self):
    """Start EXP farming - checks team status first"""
    # Add log
    self._add_exp_farming_log("Checking team status...")
    ColorPrint.blue("[D4] Checking team status before starting EXP farming")

    # IMPORTANT: Capture screenshot first to update D4 data (window size, offset, etc.)
    # This is needed for TeamFormationChecker to correctly detect windowed mode
    from controller.d4func.screenshot_handler import ScreenshotHandler
    from share.game_interface_data import get_d4_interface_data

    screenshot_handler = ScreenshotHandler()
    d4_data = get_d4_interface_data()

    ColorPrint.blue("[D4] Capturing screenshot to initialize window data...")
    if not screenshot_handler.capture_and_collect_info(d4_data):
        ColorPrint.yellow("[D4] Failed to capture screenshot, window data may be incomplete")
    else:
        ColorPrint.green(f"[D4] Window data initialized: fullscreen={d4_data.fullscreen_size}, window={d4_data.game_window_size}, windowed={d4_data.is_windowed_mode()}")

    # Check team formation status
    from d4utils.team_formation_checker import get_team_formation_checker
    team_checker = get_team_formation_checker()

    # ... rest of the code
```

## ✅ 修复后的流程图

```
用户点击"启动挂机经验"按钮
  ↓
d4_panel.py: _start_exp_farming()
  ↓
【新增】调用 screenshot_handler.capture_and_collect_info()
  ├─ 调用 screenshot_provider.gen()
  ├─ 捕获游戏窗口截图
  ├─ 获取 window_offset = (735, 15)
  ├─ 获取 game_window_size = (1826, 1031)
  ├─ 获取 fullscreen_size = (2560, 1600)  ← 屏幕分辨率
  └─ 更新 d4_data
       ├─ d4_data.fullscreen_size = (2560, 1600)  ✅
       ├─ d4_data.game_window_size = (1826, 1031)  ✅
       ├─ d4_data.window_offset = (735, 15)  ✅
       └─ is_windowed_mode() = True  ✅
  ↓
创建 TeamFormationChecker 实例
  ├─ 初始化 d4_data = get_d4_interface_data()
  ├─ 此时 d4_data.fullscreen_size = (2560, 1600)  ✅
  └─ 此时 d4_data.game_window_size = (1826, 1031)  ✅
  ↓
调用 team_checker.run()
  ↓
d4_operation_base.py: run()
  ↓
调用 _ensure_window_active()
  ├─ 检查 self.d4_data.is_windowed_mode()
  ├─ fullscreen_size=(2560, 1600), game_window_size=(1826, 1031)  ✅
  ├─ width_diff = 2560 - 1826 = 734
  ├─ height_diff = 1600 - 1031 = 569
  ├─ is_windowed_mode() 返回 True  ✅ 正确判断
  └─ 进入窗口激活流程
       ↓
       调用 _click_title_bar()
         ├─ 调用 get_title_bar_random_point()
         ├─ 计算标题栏坐标范围
         │   ├─ window_offset = (735, 15)
         │   ├─ game_window_size = (1826, 1031)
         │   ├─ LEFT_BORDER = 9
         │   ├─ RIGHT_BORDER = 7
         │   ├─ TOP_OFFSET = -1
         │   ├─ TITLE_BAR_HEIGHT = 31
         │   ├─ margin = 10
         │   ├─ title_left = 735 + 9 + 10 = 754
         │   ├─ title_right = 735 + 1826 - 7 - 10 = 2544
         │   ├─ title_top = 15 + (-1) + 5 = 19
         │   └─ title_bottom = 15 + (-1) + 31 - 5 = 40
         ├─ 随机生成点 (random_x, random_y)
         │   └─ 例如: (1250, 25)
         ├─ 打印日志: "Clicking title bar at screen (1250, 25)"
         └─ 执行 pyautogui.click(1250, 25)  ← 鼠标移动并点击！
  ↓
调用 execute()
  ↓
team_formation_checker.py: execute()
  ├─ 按 'O' 键  ← 现在窗口已激活
  ├─ 等待 0.1s
  ├─ 查找 "Find Team" 区域
  └─ OCR识别队伍状态
  ↓
返回结果
```

## 📊 数据流转核对

### 1. 截图数据源

**来源：** `d3utils/screenshot_provider.py`
**方法：** `gen(use_optimized_capture=True, window_titles=DIABLO_IV_WINDOW_TITLES)`

**返回对象：** `ScreenshotData`
```python
ScreenshotData(
    fullscreen_image=None,              # 优化模式下为NULL
    game_window_image=<PIL.Image>,      # 游戏窗口图像
    game_window_rect=(0, 0, 1826, 1031),
    window_offset=(735, 15),            # 窗口在屏幕上的位置
    fullscreen_size=(2560, 1600),       # 屏幕分辨率
    game_window_size=(1826, 1031),      # 窗口大小（包含边框）
    timestamp="2025-10-20T03:34:55"
)
```

### 2. 数据更新路径

**D3系统（自动更新）：**
```
screenshot_provider.gen()
  ↓
更新 get_game_interface_data()  ← D3InterfaceData
  ├─ fullscreen_size = (2560, 1600)
  ├─ game_window_size = (1826, 1031)
  └─ window_offset = (735, 15)
```

**D4系统（需要手动调用）：**
```
screenshot_handler.capture_and_collect_info(d4_data)
  ↓
调用 screenshot_provider.gen()
  ↓
从返回的 screenshot_data 提取数据
  ↓
更新 get_d4_interface_data()  ← D4InterfaceData
  ├─ d4_data.fullscreen_size = screenshot_data.fullscreen_size
  ├─ d4_data.game_window_size = screenshot_data.game_window_size
  └─ d4_data.window_offset = screenshot_data.window_offset
```

### 3. 窗口模式判断

**位置：** `share/game_interface_data.py:497`
**方法：** `D4InterfaceData.is_windowed_mode()`

```python
def is_windowed_mode(self) -> bool:
    """Check if the game is running in windowed mode"""
    if not self.game_window_size or not self.fullscreen_size:
        return False  # 数据未初始化时返回False

    window_width, window_height = self.game_window_size
    fullscreen_width, fullscreen_height = self.fullscreen_size
    width_diff = fullscreen_width - window_width
    height_diff = fullscreen_height - window_height

    # 阈值是 TITLE_BAR_HEIGHT = 31
    return (width_diff >= 31 and height_diff >= 31)
```

**判断逻辑验证：**
```
fullscreen_size = (2560, 1600)
game_window_size = (1826, 1031)
width_diff = 2560 - 1826 = 734  ✅ >= 31
height_diff = 1600 - 1031 = 569  ✅ >= 31
→ is_windowed_mode() = True  ✅
```

### 4. 标题栏坐标计算

**位置：** `share/coordinate_helper.py:119`
**方法：** `get_title_bar_random_point()`

**常量定义：**
```python
# share/game_interface_data.py:80-82
WINDOW_BORDER_LEFT = 9
WINDOW_BORDER_RIGHT = 7
TITLE_BAR_TOP_OFFSET = -1
TITLE_BAR_HEIGHT = 31
CLICK_MARGIN_DEFAULT = 10
```

**计算过程：**
```python
window_offset = (735, 15)
game_window_size = (1826, 1031)

# 标题栏左边界
title_left = 735 + 9 + 10 = 754

# 标题栏右边界
title_right = 735 + 1826 - 7 - 10 = 2544

# 标题栏上边界
title_top = 15 + (-1) + 5 = 19

# 标题栏下边界
title_bottom = 15 + (-1) + 31 - 5 = 40

# 随机点范围
random_x ∈ [754, 2544]
random_y ∈ [19, 40]
```

**验证：**
- 标题栏宽度：2544 - 754 = 1790 像素  ✅
- 标题栏高度：40 - 19 = 21 像素  ✅
- 实际测量：(740, 16) 到 (2550, 47)
- 计算范围：(754, 19) 到 (2544, 40)
- **差异：**左边多了14px安全边距，上下各5px安全边距  ✅ 合理

## 🎯 预期日志（修复后）

```
[D4] Checking team status before starting EXP farming

[D4] Capturing screenshot to initialize window data...
[ScreenshotHandler] Capturing screenshot and collecting info...
[Provider] Generating new screenshot...
[Provider] Using optimized capture for: [...]
[FAST_SINGLE] Found window: '《暗黑破壞神 IV》'
[FAST_SINGLE] Window rect: (735, 15, 2561, 1046)
[Provider] Screenshot captured: 1826x1031
[Provider] Screen resolution: 2560x1600
[Provider] Optimized mode: using captured game window directly
[Provider] Got window offset from cache: (735, 15)
[Provider] Updated shared game interface data
[ScreenshotHandler] 📸 Updated D4 data:
  fullscreen_size: (2560, 1600)
  game_window_size: (1826, 1031)
  window_offset: (735, 15)
  is_windowed: True
[ScreenshotHandler] Screenshot captured and info collected

[D4] Window data initialized: fullscreen=(2560, 1600), window=(1826, 1031), windowed=True

[Global] Team formation checker initialized
[D4Operation] _ensure_window_active called, _window_activated=False
[D4Operation] is_windowed_mode=True
[D4Operation] fullscreen_size=(2560, 1600), game_window_size=(1826, 1031)
[D4Operation] Windowed mode detected, will click title bar
[D4Operation] Clicking title bar at screen (1250, 25)
[D4Operation] ✓ Title bar clicked successfully
[D4Operation] Window activated

[TeamFormationChecker] Starting team formation check...
[TeamFormationChecker] Pressing 'O' key to open team panel
[D4Operation] Pressing key: 'o'
[TeamFormationChecker] Waiting for UI to update...
[TeamFormationChecker] Find Team region available
[TeamFormationChecker] OCR result: '寻找队伍' / 'Team'
[TeamFormationChecker] ✓/✗ Team status detected
```

## ✅ 数据一致性检查清单

| 检查项 | 位置 | 修复前 | 修复后 | 状态 |
|--------|------|--------|--------|------|
| 截图捕获时机 | d4_panel.py | EXP farming开始后 | 队伍检查前 | ✅ |
| D4数据初始化 | get_d4_interface_data() | (0, 0) | (2560, 1600) | ✅ |
| 窗口模式判断 | is_windowed_mode() | False | True | ✅ |
| 标题栏点击 | _click_title_bar() | 跳过 | 执行 | ✅ |
| 按键时机 | team_checker.execute() | 窗口未激活 | 窗口已激活 | ✅ |
| 区域数据可用性 | detected_regions | 不可用 | 可用 | ✅ |

## 🔧 相关文件修改列表

1. ✅ **`ui/panels/d4_panel.py:264-276`** - 在队伍检查前初始化窗口数据
2. ✅ **`controller/d4func/screenshot_handler.py:84-89`** - 添加数据更新日志
3. ✅ **`d4utils/d4_operation_base.py:63-87`** - 添加窗口激活详细日志
4. ⚠️ **`d3utils/screenshot_provider.py`** - 未修改（D3系统独立）

## 📝 总结

**核心问题：** 数据初始化时机错误
**修复方法：** 在使用数据前先初始化
**修复位置：** 点击"启动挂机经验"按钮后，创建 TeamFormationChecker 之前
**影响范围：** D4队伍检查流程
**副作用：** 无（只是提前了数据初始化时机）

---

**结论：修复完成，数据流转一致，逻辑正确。**
