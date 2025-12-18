# PySide6 Title Bar 样式系统指南

## 📚 概述

PySide6 Title Bar 提供了一个完整的样式系统，允许你：
- 使用预设的主题样式
- 自定义任何样式属性
- 叠加样式（基础样式 + 自定义覆盖）

## 🎨 样式系统架构

### 1. 样式配置类 `TitleBarStyles`

包含所有可配置的样式属性，分为五大类：

#### **标题栏总样式**
```python
bar_height: int = 40                    # 标题栏高度
bar_bg_color: str = "#1a1a2e"           # 背景色
bar_use_gradient: bool = True           # 是否使用渐变
bar_gradient_colors: list               # 渐变颜色列表
bar_border_bottom: str                  # 底部边框
bar_padding_left: int = 12              # 左边距
bar_padding_right: int = 8              # 右边距
```

#### **Logo 样式**
```python
logo_size: int = 28                     # Logo 尺寸
logo_border_radius: int = 4             # 圆角
logo_padding: int = 2                   # 内边距
logo_spacing_right: int = 10            # 右侧间距
```

#### **标题文字样式**
```python
title_font_size: str = "11pt"           # 字体大小
title_font_weight: int = 600            # 字体粗细
title_font_family: str                  # 字体家族
title_color: str = "#ffffff"            # 文字颜色
title_text_shadow: str                  # 文字阴影
```

#### **菜单按钮样式**
```python
menu_icon: str = "☰"                    # 菜单图标
menu_hover_color: str                   # 悬停颜色
menu_pressed_color: str                 # 按下颜色
```

#### **窗口控制按钮样式**
```python
button_width: int = 48                  # 按钮宽度
button_height: int = 40                 # 按钮高度
button_border_radius: int = 8           # 圆角
button_font_size: str = "16px"          # 字体大小

# 最小化按钮
minimize_icon: str = "−"
minimize_hover_color: str

# 最大化按钮
maximize_icon: str = "□"
maximize_icon_restore: str = "❐"
maximize_hover_color: str

# 关闭按钮
close_icon: str = "✕"
close_use_gradient: bool = True         # 使用渐变效果
close_hover_gradient_start: str
close_hover_gradient_end: str
```

## 🚀 使用方法

### 方式 1：使用默认样式

```python
from pycore.pyutils.native_ui.pyside6.title_bar import PySide6TitleBar

title_bar = PySide6TitleBar(
    app_name="我的应用",
    show_menu=True
)
```

### 方式 2：使用预设主题

```python
from pycore.pyutils.native_ui.pyside6.title_bar import PySide6TitleBar
from pycore.pyutils.native_ui.pyside6.title_bar_styles import (
    get_dark_style,
    get_light_style,
    get_vibrant_style,
    get_minimal_style
)

# 深色主题
title_bar = PySide6TitleBar(
    app_name="我的应用",
    styles=get_dark_style()
)

# 浅色主题
title_bar = PySide6TitleBar(
    app_name="我的应用",
    styles=get_light_style()
)

# 鲜艳主题
title_bar = PySide6TitleBar(
    app_name="我的应用",
    styles=get_vibrant_style()
)

# 极简主题
title_bar = PySide6TitleBar(
    app_name="我的应用",
    styles=get_minimal_style()
)
```

### 方式 3：自定义样式覆盖

```python
# 覆盖默认样式的部分属性
title_bar = PySide6TitleBar(
    app_name="我的应用",
    custom_styles={
        "bar_height": 50,
        "title_color": "#00ff00",
        "title_font_size": "14pt",
        "close_hover_gradient_start": "#ff0000",
        "close_hover_gradient_end": "#cc0000"
    }
)
```

### 方式 4：基础主题 + 自定义覆盖

```python
from pycore.pyutils.native_ui.pyside6.title_bar_styles import get_dark_style

# 在深色主题基础上修改
title_bar = PySide6TitleBar(
    app_name="我的应用",
    styles=get_dark_style(),  # 基础样式
    custom_styles={           # 覆盖部分属性
        "bar_height": 45,
        "button_border_radius": 12
    }
)
```

### 方式 5：创建完全自定义的样式

```python
from pycore.pyutils.native_ui.pyside6.title_bar_styles import (
    TitleBarStyles,
    create_custom_style
)

# 方法 A：直接实例化
my_style = TitleBarStyles(
    bar_height=50,
    bar_bg_color="#2c3e50",
    bar_use_gradient=False,
    title_color="#ecf0f1",
    title_font_size="12pt",
    button_border_radius=10,
    close_hover_gradient_start="#e74c3c",
    close_hover_gradient_end="#c0392b"
)

title_bar = PySide6TitleBar(
    app_name="我的应用",
    styles=my_style
)

# 方法 B：使用便捷函数
my_style = create_custom_style(
    bar_height=50,
    bar_bg_color="#2c3e50",
    title_color="#ecf0f1"
)

title_bar = PySide6TitleBar(
    app_name="我的应用",
    styles=my_style
)
```

## 🎭 预设主题对比

### Default（默认）
- **适用场景**：通用深色应用
- **特点**：深色渐变，现代感强

### Dark（深色）
- **适用场景**：暗色主题应用
- **特点**：与默认样式相同，保护视力

### Light（浅色）
- **适用场景**：明亮环境
- **特点**：浅色背景，清爽简洁

### Vibrant（鲜艳）
- **适用场景**：创意类应用
- **特点**：紫蓝渐变，视觉冲击强

### Minimal（极简）
- **适用场景**：专业商务应用
- **特点**：低调简洁，注重内容

## 🧪 测试和演示

### 运行样式演示
```bash
# 默认样式
python pycore/pyutils/native_ui/pyside6/styles_demo.py

# 指定样式
python pycore/pyutils/native_ui/pyside6/styles_demo.py light
python pycore/pyutils/native_ui/pyside6/styles_demo.py vibrant
python pycore/pyutils/native_ui/pyside6/styles_demo.py minimal
```

### 运行基础测试
```bash
python pycore/pyutils/native_ui/pyside6/test_modern_titlebar.py
```

## 🔧 高级用法

### 1. 样式合并工具

```python
from pycore.pyutils.native_ui.pyside6.title_bar_styles import merge_styles, get_dark_style

base = get_dark_style()
custom = {
    "title_color": "#00ff00",
    "bar_height": 50
}

final_style = merge_styles(base, custom)
```

### 2. 导出样式为字典

```python
from pycore.pyutils.native_ui.pyside6.title_bar_styles import get_default_style

style = get_default_style()
style_dict = style.to_dict()

# 可以保存为 JSON
import json
with open("my_style.json", "w") as f:
    json.dump(style_dict, f, indent=2)
```

### 3. 从字典加载样式

```python
from pycore.pyutils.native_ui.pyside6.title_bar_styles import TitleBarStyles
import json

with open("my_style.json", "r") as f:
    style_dict = json.load(f)

style = TitleBarStyles.from_dict(style_dict)
```

### 4. 动态切换样式

```python
# 创建标题栏
title_bar = PySide6TitleBar(app_name="我的应用")

# 稍后切换样式（需要重新创建 UI）
def switch_to_light():
    from pycore.pyutils.native_ui.pyside6.title_bar_styles import get_light_style
    title_bar.styles = get_light_style()
    title_bar._setup_ui()  # 重新构建 UI
```

## 📝 样式属性完整列表

查看 `title_bar_styles.py` 中的 `TitleBarStyles` 类获取所有可配置属性的完整列表和默认值。

## 🎨 颜色建议

### 深色主题推荐色
```python
background: "#1a1a2e", "#16213e", "#0f1419"
text: "#ffffff", "#ecf0f1"
hover: "#4a5568", "#5a6c7d"
close: "#ff4757", "#e74c3c"
```

### 浅色主题推荐色
```python
background: "#f5f5f5", "#e8e8e8", "#d0d0d0"
text: "#2c3e50", "#34495e"
hover: "#d0d0d0", "#c0c0c0"
close: "#ff6b6b", "#ee5a52"
```

## 📖 更多示例

查看项目中的示例文件：
- `test_modern_titlebar.py` - 基础使用
- `styles_demo.py` - 所有预设主题演示
- `example.py` - 完整应用示例

## 🐛 故障排除

### 样式不生效
确保导入了正确的模块：
```python
from pycore.pyutils.native_ui.pyside6.title_bar import PySide6TitleBar
from pycore.pyutils.native_ui.pyside6.title_bar_styles import get_default_style
```

### 窗口透明问题
已修复 - 主窗口现在默认使用不透明背景。

### 按钮点击无响应
确保连接了信号：
```python
title_bar.close_clicked.connect(window.close)
title_bar.minimize_clicked.connect(window.showMinimized)
```

## 🎉 总结

样式系统提供了极大的灵活性，你可以：
1. 快速使用预设主题
2. 轻松覆盖单个属性
3. 创建完全自定义的样式
4. 保存和加载样式配置

享受自定义你的标题栏吧！ 🚀
