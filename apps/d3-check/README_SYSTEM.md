# D3Check Interface Detection System

## 项目结构

```
d3check/
├── d3utils/                          # D3 专用工具类
│   ├── __init__.py
│   ├── interface_manager.py          # 界面属性管理器（主类）
│   ├── interface_property_detector.py # 界面属性检测器
│   └── screenshot_capturer.py        # 截屏捕获器
├── images/                           # 模板图片
│   ├── bag_left.png
│   ├── bag_buttom.png
│   ├── bag_right.png
│   ├── button_put_material*.png
│   ├── button_convert_*.png
│   └── item_*.png
└── test_auto_capture.py             # 测试脚本

ncore/pytools/pyutils/               # 公共基础类库
├── image_annotator.py               # 图像标注工具
├── image_matcher.py                 # 图像匹配工具
└── window_screenshot.py             # 窗口截屏工具
```

## 核心类说明

### 1. D3InterfaceManager (主类)
**位置**: `d3utils/interface_manager.py`

**功能**: 管理所有游戏界面属性

**主要方法**:
```python
# 初始化（自动截屏）
manager.initialize()  # 不需要传入参数！

# 强制刷新所有属性
manager.initialize(force_refresh=True)

# 使用已有截图
manager.initialize(screenshot_path="path/to/screenshot.png")

# 获取属性
bag = manager.get_bag_coordinates()
material_btn = manager.get_put_material_button()
conv_btn = manager.get_conversion_button()
clickable = manager.get_conversion_clickable()
func_type = manager.get_functional_interface()

# 打印摘要
manager.print_summary()
```

**属性管理规则**:
- **一次设置**: 背包坐标、按钮位置（除非 `force_refresh=True`）
- **每次刷新**: 转化按钮状态、功能界面类型

### 2. InterfacePropertyDetector
**位置**: `d3utils/interface_property_detector.py`

**功能**: 检测界面元素

**特点**:
- 自动调用截屏（通过 `screenshot_capturer`）
- 使用模板匹配检测各种元素
- 智能判断功能界面类型

**功能界面判断逻辑**:
```python
button_put_material / button_put_material_alt  → "reforge" (重铸)
button_put_material_page2                      → "upgrade" (升级黄装)
```

### 3. D3ScreenshotCapturer
**位置**: `d3utils/screenshot_capturer.py`

**功能**: 截取游戏窗口

**特点**:
- 自动查找 Diablo III 窗口（支持多语言标题）
- 截屏前自动激活窗口
- 找不到窗口时返回 `None`

**使用**:
```python
capturer = D3ScreenshotCapturer()

# 检查窗口是否存在
if capturer.check_window_exists():
    # 捕获截屏
    screenshot_path = capturer.capture()
    if screenshot_path:
        print(f"截屏成功: {screenshot_path}")
```

### 4. ImageAnnotator (公共类)
**位置**: `ncore/pytools/pyutils/image_annotator.py`

**功能**: 在图片上绘制标注

**支持**:
- 矩形、圆形、多边形、线条
- 文本标签（带背景）
- 网格绘制
- 中文路径支持

## 使用示例

### 完整流程
```python
from d3utils.interface_manager import D3InterfaceManager
from pytools.pyutils.image_annotator import ImageAnnotator

# 1. 创建管理器
manager = D3InterfaceManager()

# 2. 初始化（自动截屏、检测）
if manager.initialize():
    # 3. 获取属性
    bag = manager.get_bag_coordinates()
    func_type = manager.get_functional_interface()

    print(f"功能界面: {func_type}")
    print(f"背包坐标: {bag}")

    # 4. 绘制标注
    screenshot = manager._detector.last_screenshot
    annotator = ImageAnnotator(screenshot)

    if bag:
        annotator.draw_rectangle(
            bag["top_left"],
            bag["bottom_right"],
            color=(0, 255, 0),
            label="Bag"
        )

    annotator.save("output.png")
```

### 简化使用
```python
from d3utils.interface_manager import D3InterfaceManager

manager = D3InterfaceManager()

# 只需要一行！
manager.initialize()

# 直接使用
manager.print_summary()
```

## 模板图片说明

### 背包标记
- `bag_left.png` - 背包左侧边界
- `bag_buttom.png` - 背包底部边界
- `bag_right.png` - 背包右侧滚动条

### 按钮
- `button_put_material.png` - 放入材料按钮（重铸界面）
- `button_put_material_alt.png` - 放入材料按钮（备选）
- `button_put_material_page2.png` - 放入材料按钮（升级界面）
- `button_convert_enabled.png` - 转化按钮（可点击）
- `button_convert_disabled.png` - 转化按钮（不可点击）

### 物品品质
- `item_primal_ancient.png` - 太古装备
- `item_ancient_set.png` - 远古套装
- `item_legendary.png` - 传奇装备
- `item_rare_yellow.png` - 黄装
- `item_rare_blue.png` - 蓝装

## 设计原则

1. **公共类库纯净**: `ncore/pytools` 只提供基础工具，不包含游戏逻辑
2. **自动化**: 无需手动截屏，自动查找窗口
3. **智能缓存**: 已设置的属性不会重复检测（除非强制刷新）
4. **容错处理**: 窗口不存在时返回 `None` 而不是异常

## 测试

```bash
cd D:\programing\core_node\apps\d3check
python test_auto_capture.py
```

确保 Diablo III 正在运行！

---
*文档生成时间: 2025-09-30*
