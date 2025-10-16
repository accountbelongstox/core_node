# Image Enhancement System - 完整使用指南

## 概述

训练数据生成系统现在支持两种模式，并提供强大的图像增强功能：

### 两种工作模式

#### 1. **坐标模式** (Coordinate Mode)
从大图中根据坐标提取patches
```json
{
  "source_image": "large_screenshot.png",
  "coordinates": [
    {"x1": 100, "y1": 200, "x2": 300, "y2": 250}
  ]
}
```

#### 2. **直接Patch模式** (Direct Patch Mode)
直接使用小图作为patches，支持动态增强
```json
{
  "source_image": "",
  "coordinates": [],
  "enhancements": [
    {"type": "random_time", "position": "center", "font_size": 12}
  ]
}
```

---

## 目录结构

```
.cache/training_data/source/
├── training_projects/          # 训练项目命名空间
│   └── rift_progress_bar/
│       ├── source/            # 项目源图片（小patch图）
│       │   └── rift_progress_bar.png
│       └── metadata.json      # 元数据配置
└── public/                    # 公共背景图（自动扫描用于负样本）
    ├── bg1.png
    ├── bg2.png
    └── ...
```

---

## 图像增强系统

### 核心类：`ImageEnhancer`

位置：`D:\programing\core_node\pycore\pyutils\image_enhancer.py`

### 支持的增强类型

#### 1. **文字增强** (TextEnhancement)

在图像上添加文字，支持丰富样式：

```python
from pycore.pyutils.image_enhancer import ImageEnhancer

enhancer = ImageEnhancer()
enhancer.add_text(
    text="12:34",
    position="center",  # 或 (x, y) 坐标
    font_size=12,
    color=(255, 255, 255),  # RGB白色
    shadow_color=(0x18, 0x34, 0x56),  # 阴影颜色
    shadow_offset=(2, 2),
    outline_color=(0, 0, 0),  # 描边颜色
    outline_width=1
)

result = enhancer.apply(img)
```

**位置关键词**：
- `"center"`, `"top"`, `"bottom"`, `"left"`, `"right"`
- `"top-left"`, `"top-right"`, `"bottom-left"`, `"bottom-right"`

**metadata.json 配置示例**：
```json
{
  "enhancements": [
    {
      "type": "text",
      "text": "12:34",
      "position": "center",
      "font_size": 12,
      "color": [255, 255, 255],
      "shadow_color": [24, 52, 86],
      "shadow_offset": [1, 1]
    }
  ]
}
```

#### 2. **随机时间文字** (RandomTimeTextEnhancement)

自动生成随机时间（HH:MM格式）：

```python
enhancer.add_random_time(
    position="center",
    font_size=12,
    color=(255, 255, 255),
    shadow_color=(0x18, 0x34, 0x56)
)
```

**metadata.json 配置**：
```json
{
  "enhancements": [
    {
      "type": "random_time",
      "position": "center",
      "font_size": 12,
      "color": [255, 255, 255],
      "shadow_color": [24, 52, 86]
    }
  ]
}
```

#### 3. **形状增强** (ShapeEnhancement)

添加矩形、圆形等形状：

```python
# 添加半透明矩形
enhancer.add_shape(
    shape_type="rectangle",
    position=(10, 10),
    size=(100, 50),
    color=(255, 0, 0),  # BGR红色
    thickness=-1,  # -1=填充
    alpha=0.5  # 半透明
)

# 添加圆形
enhancer.add_shape(
    shape_type="circle",
    position=(50, 50),
    size=30,  # 半径
    color=(0, 255, 0),
    thickness=2
)
```

**metadata.json 配置**：
```json
{
  "enhancements": [
    {
      "type": "shape",
      "shape_type": "rectangle",
      "position": [10, 10],
      "size": [100, 50],
      "color": [0, 0, 255],
      "thickness": -1,
      "alpha": 0.3
    }
  ]
}
```

#### 4. **子图像增强** (SubImageEnhancement)

在主图上粘贴更小的图片：

```python
enhancer.add_sub_image(
    sub_image_path="icon.png",
    position="center",
    scale=0.5,  # 缩放到50%
    alpha=0.8
)
```

**metadata.json 配置**：
```json
{
  "enhancements": [
    {
      "type": "sub_image",
      "sub_image_path": "path/to/icon.png",
      "position": "top-right",
      "scale": 0.5,
      "alpha": 0.9
    }
  ]
}
```

---

## 完整示例

### 示例1：进度条训练（直接Patch模式 + 随机时间）

**metadata.json**：
```json
{
  "project": "progress_bar",
  "description": "Progress bar with random time overlay",
  "auto_generated": true,
  "source_image": "",
  "coordinates": [],
  "enhancements": [
    {
      "type": "random_time",
      "position": "center",
      "font_size": 12,
      "color": [255, 255, 255],
      "shadow_color": [24, 52, 86],
      "shadow_offset": [1, 1]
    }
  ],
  "augmentation_count": 30,
  "augmentation": {
    "classification": {
      "allow_scale": true,
      "scale_range": [0.9, 1.1],
      "color_jitter": true
    }
  }
}
```

### 示例2：组合多种增强

```json
{
  "source_image": "",
  "coordinates": [],
  "enhancements": [
    {
      "type": "random_time",
      "position": "center",
      "font_size": 14
    },
    {
      "type": "shape",
      "shape_type": "rectangle",
      "position": [5, 5],
      "size": [50, 20],
      "color": [0, 255, 0],
      "alpha": 0.3
    },
    {
      "type": "sub_image",
      "sub_image_path": "icon.png",
      "position": "top-right",
      "scale": 0.3
    }
  ]
}
```

---

## Python API 使用

### 基础用法

```python
from pycore.pyutils.image_enhancer import ImageEnhancer
import cv2

# 加载图像
img = cv2.imread("patch.png")

# 创建增强器
enhancer = ImageEnhancer()

# 链式添加多个增强
enhancer.add_random_time(position="center", font_size=12) \
        .add_shape("rectangle", (0, 0), (50, 50), color=(255, 0, 0), alpha=0.2) \
        .add_text("LEVEL 70", position="bottom", font_size=10, color=(255, 255, 0))

# 应用所有增强
result = enhancer.apply(img)

# 保存
cv2.imwrite("enhanced.png", result)
```

### 自定义增强类

```python
from pycore.pyutils.image_enhancer import ImageEnhancement
import cv2
import numpy as np

class CustomEnhancement(ImageEnhancement):
    def __init__(self, param1, param2):
        self.param1 = param1
        self.param2 = param2

    def apply(self, img: np.ndarray) -> np.ndarray:
        # 实现你的增强逻辑
        result = img.copy()
        # ... 处理 ...
        return result

# 使用
enhancer = ImageEnhancer()
enhancer.add_enhancement(CustomEnhancement(param1=10, param2="test"))
```

---

## 训练流程

### 步骤1：准备数据

1. 将小patch图放入 `source/` 目录
2. 将背景图放入 `../../public/` 目录
3. 配置 `metadata.json`

### 步骤2：运行训练

```bash
cd D:\programing\core_node\apps\d3-check
python train_all.py --project rift_progress_bar --mode both
```

### 步骤3：查看结果

生成的数据位于：
- Classification: `.cache/training_data/processed/classification/rift_progress_bar/`
- Detection: `.cache/training_data/processed/detection/rift_progress_bar/`

---

## 扩展接口

系统设计为高度可扩展：

### 添加新的增强类型

1. 继承 `ImageEnhancement` 基类
2. 实现 `apply(img)` 方法
3. 在 `create_enhancement_from_config()` 中注册

```python
class MyCustomEnhancement(ImageEnhancement):
    def __init__(self, my_param):
        self.my_param = my_param

    def apply(self, img: np.ndarray) -> np.ndarray:
        # 你的逻辑
        return img

# 在 metadata.json 中使用
{
  "enhancements": [
    {
      "type": "my_custom",  # 需要在工厂函数中注册
      "my_param": "value"
    }
  ]
}
```

---

## 注意事项

1. **颜色格式**：
   - PIL (文字)：RGB格式
   - OpenCV (形状)：BGR格式
   - metadata.json：统一使用RGB格式，代码内部自动转换

2. **坐标为空时**：
   - 系统自动切换到直接Patch模式
   - 从 `source/` 目录加载patch图
   - 自动扫描 `../../public/` 作为背景图

3. **性能优化**：
   - 增强操作按顺序应用
   - 每次augmentation都会重新应用增强（生成不同的随机值）

4. **文件不存在处理**：
   - WARNING提示，不中断流程
   - 跳过无效文件继续处理

---

## 故障排除

### 问题1：文字不显示
- 检查字体路径是否正确
- 尝试不指定font_path使用默认字体
- 确认颜色与背景有对比度

### 问题2：增强未生效
- 检查 metadata.json 中 `enhancements` 字段格式
- 查看训练日志中的WARNING信息
- 确认 `image_enhancer.py` 已在 pycore 中

### 问题3：找不到patch图
- 确认图片在 `project_name/source/` 目录
- 检查文件扩展名（.png, .jpg, .jpeg）
- 查看日志中的文件加载信息

---

## API 参考

详细API文档请参考代码注释：
- `D:\programing\core_node\pycore\pyutils\image_enhancer.py`
- `D:\programing\core_node\pycore\pyutils\ultralytics\dataset_generator_yolo.py`

---

**版本**: 1.0
**最后更新**: 2025-10-16
