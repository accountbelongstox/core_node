# image_annotator_helper.py 全面分析

## 📋 文件概述

**路径**: `D:\programing\core_node\apps\d3-check\d3utils\d3u_common\image_annotator_helper.py`

**作用**: 提供标准化的图像标注功能，用于绘制模板匹配结果

**核心依赖**:
- `ImageAnnotator` (from `providor.common_imports`)
- `ColorPrint` (用于彩色终端输出)
- OpenCV (`cv2`)
- PIL/Pillow (`Image`)

## 🎨 核心功能模块

### 1. 颜色管理系统

#### 颜色调色板 (30+ 种颜色)
```python
ANNOTATION_COLORS = {
    "green": (0, 255, 0),      # BGR 格式
    "red": (0, 0, 255),
    "blue": (255, 0, 0),
    # ... 30+ 种预定义颜色
}
```

#### 颜色序列（自动分配）
```python
COLOR_SEQUENCE = [
    "magenta", "yellow", "cyan", "orange", "purple",
    # ... 30 种颜色循环使用
]
```

#### 关键函数

**1. `get_annotation_color(color_name, default)`**
- 通过颜色名获取 BGR 元组
- 支持回退到默认颜色

**2. `get_auto_color(index)`**
- 自动分配颜色（循环使用）
- 适合多个元素需要不同颜色

### 2. ImageAnnotator 封装

#### 创建 Annotator

**函数**: `create_annotator(image_source)`

支持多种输入：
```python
# 从文件路径
annotator = create_annotator("path/to/image.png")

# 从 numpy 数组
annotator = create_annotator(cv2_image)

# 从 PIL Image
annotator = create_annotator(pil_image)
```

#### 转换为 PIL Image

**函数**: `get_image_pil(annotator)`
```python
# BGR (OpenCV) -> RGB (PIL)
pil_image = get_image_pil(annotator)
```

### 3. 绘制辅助功能

#### 3.1 绘制信息文本

**函数**: `draw_info_texts(annotator, info_items, ...)`

```python
info_items = [
    {
        "text": "Game: D3",
        "bg_color": "green",
        "font_scale": 0.7
    },
    {
        "text": "Resolution: 1920x1080",
        "bg_color": "blue",
        "font_scale": 0.6
    }
]

draw_info_texts(annotator, info_items)
```

**特性**:
- 支持多行文本
- 自定义背景色
- 自动计算垂直间距

#### 3.2 绘制网格覆盖

**函数**: `draw_grid_overlay(annotator, rows, cols, ...)`

```python
# 全图网格
draw_grid_overlay(annotator, rows=6, cols=10)

# 区域网格
draw_grid_overlay(
    annotator,
    rows=5,
    cols=7,
    top_left=(100, 100),
    bottom_right=(800, 600)
)
```

### 4. 模板匹配结果绘制（核心）

#### 4.1 单个匹配结果

**函数**: `draw_match_result(annotator, match_result, name, ...)`

**match_result 结构**:
```python
{
    "center": (x, y),           # 中心点坐标
    "polygon": np.array([...]), # 边界多边形
    "match_score": 0.85         # 匹配分数
}
```

**绘制内容**:
1. **多边形边界** (如果有)
   ```python
   annotator.draw_polygon(points=polygon, color=color, thickness=3)
   ```

2. **中心点** (实心圆)
   ```python
   annotator.draw_circle(center=(x, y), radius=8, thickness=-1)
   ```

3. **十字准星** (白色)
   ```python
   # 水平线
   draw_line((x-15, y), (x+15, y))
   # 垂直线
   draw_line((x, y-15), (x, y+15))
   ```

4. **标签文本**
   ```python
   label_text = f"{name} ({score:.3f})"
   # 显示在中心点右上方
   ```

5. **坐标文本**
   ```python
   coord_text = f"({x}, {y})"
   # 显示在中心点右下方
   ```

6. **模板图像** (可选)
   ```python
   # 在左侧显示模板图像
   annotator.draw_image(template_img, position=(10, 300))
   ```

#### 4.2 批量匹配结果

**函数**: `draw_match_results(annotator, match_results, ...)`

**match_results 结构**:
```python
[
    {
        "match_result": {...},           # 匹配结果字典
        "name": "bag_left",              # 模板名称
        "color": "green",                # 颜色（可选）
        "template_path": "path/to/..."   # 模板路径
    },
    # ... 更多结果
]
```

**核心特性**:

1. **自动颜色分配**
   ```python
   auto_color=True  # 自动为每个模板分配不同颜色
   ```

2. **分离 FOUND / NOT FOUND**
   - Found 项目: 绘制完整标注
   - Not Found 项目: 显示 "NOT FOUND" 文本

3. **模板图像堆叠**
   ```python
   # 左侧垂直排列所有模板图像
   template_pos = (10, 300 + idx * 100)
   ```

4. **总结文本**
   ```python
   summary_text = "Match Results: 5/10 found"
   # 显示在顶部
   ```

### 5. 专用场景绘制

#### 5.1 锚点检测结果

**函数**: `save_anchor_detection_result(...)`

**用途**: 游戏窗口锚点检测可视化

**绘制内容**:
- 边界线检测
- 多个锚点搜索结果
- 尝试次数和缩放信息
- 窗口矩形

#### 5.2 背包检测结果

**函数**: `save_bag_detection_result(...)`

**用途**: 背包区域和物品槽位检测

**绘制内容**:
- 背包边界
- 网格布局
- 物品质量标记
- 空槽位标记

## 🔧 关键设计模式

### 1. 数据结构标准化

所有匹配结果使用统一格式:
```python
{
    "center": (x, y),
    "polygon": np.array([...]),
    "match_score": float
}
```

### 2. 颜色管理

```
命名颜色 -> BGR元组 -> OpenCV绘制
  ↓
自动分配 (循环序列)
```

### 3. 图像格式转换

```
输入: 文件路径 / numpy / PIL
  ↓
ImageAnnotator (BGR)
  ↓
输出: 保存文件 / PIL Image (RGB)
```

### 4. 分层绘制

```
1. 背景图像
2. 边界/网格
3. 匹配标记 (多边形/圆形)
4. 文本标签
5. 模板图像 (左侧)
6. 总结信息 (顶部)
```

## 📊 与您的测试脚本集成

### 当前问题

您的测试脚本使用原始 OpenCV 绘制:
```python
# 当前方式
cv2.rectangle(result_img, ...)
cv2.putText(result_img, ...)
```

### 建议改进

使用 `image_annotator_helper`:

```python
from d3utils.d3u_common.image_annotator_helper import (
    create_annotator,
    draw_match_results,
    get_annotation_color,
    get_auto_color
)

# 1. 创建 annotator
annotator = create_annotator(screenshot_path)

# 2. 准备匹配结果
match_results = []
for template_name in self.selected_templates:
    # ... 执行匹配 ...

    match_results.append({
        "match_result": {
            "center": (x, y),
            "polygon": polygon,  # 可选
            "match_score": confidence
        },
        "name": template_name,
        "template_path": template_path
        # color 会自动分配
    })

# 3. 绘制所有结果
draw_match_results(
    annotator=annotator,
    match_results=match_results,
    save_path=result_path,
    summary_text=f"D3 Template Test - {len(screenshot_files)} screenshots",
    summary_color="green",
    auto_color=True
)
```

### 优势对比

| 功能 | 原始OpenCV | image_annotator_helper |
|------|-----------|------------------------|
| 代码量 | ~50 行/图 | ~10 行/图 |
| 颜色管理 | 手动定义 | 自动分配 |
| 模板显示 | 需手动实现 | 内置支持 |
| 统一样式 | 需自己维护 | 标准化 |
| NOT FOUND | 需手动处理 | 自动分离 |
| 坐标显示 | 手动实现 | 自动添加 |

## 🎯 具体集成方案

### 方案 A: 最小改动

只替换绘制部分:
```python
def test_single_screenshot(self, ...):
    # ... 测试逻辑 ...

    # 使用 image_annotator_helper
    from d3utils.d3u_common.image_annotator_helper import (
        create_annotator, draw_match_results
    )

    annotator = create_annotator(screenshot)
    draw_match_results(annotator, match_results, save_path=result_path)
```

### 方案 B: 完全集成

创建标准化的结果格式:
```python
class TemplateMatchingTester:
    def _convert_to_match_result(self, opencv_match):
        """转换 OpenCV 匹配结果为标准格式"""
        loc = opencv_match['location']
        w, h = opencv_match['size']

        # 计算中心点
        center = (loc[0] + w//2, loc[1] + h//2)

        # 构建多边形 (矩形四个角点)
        polygon = np.array([
            [loc[0], loc[1]],           # 左上
            [loc[0] + w, loc[1]],       # 右上
            [loc[0] + w, loc[1] + h],   # 右下
            [loc[0], loc[1] + h]        # 左下
        ])

        return {
            "center": center,
            "polygon": polygon,
            "match_score": opencv_match['confidence']
        }
```

### 方案 C: 扩展功能

添加更多可视化信息:
```python
# 显示方法对比
info_items = [
    {"text": f"Screenshot: {screenshot_name}", "bg_color": "blue"},
    {"text": f"Scale: X={scale_x:.3f} Y={scale_y:.3f}", "bg_color": "cyan"},
    {"text": f"Found: {found_count}/{total_count}", "bg_color": "green"}
]

draw_info_texts(annotator, info_items, start_y=100)
```

## 💡 最佳实践

### 1. 结果标准化

始终使用标准格式:
```python
{
    "center": tuple,      # 必需
    "polygon": np.array,  # 可选（推荐）
    "match_score": float  # 必需
}
```

### 2. 颜色策略

```python
# 自动颜色 - 用于多个模板
draw_match_results(..., auto_color=True)

# 手动颜色 - 用于特定语义
match_results = [
    {"...", "color": "green"},   # 成功
    {"...", "color": "red"},     # 失败
    {"...", "color": "yellow"}   # 警告
]
```

### 3. 模板显示

```python
# 显示模板图像（默认）
draw_match_results(..., draw_template=True)

# 不显示（节省空间）
draw_match_result(..., draw_template=False)
```

### 4. 信息分层

```python
# 顶部: 总结
summary_text = "Test Results"

# 中部: 匹配标记
draw_match_results(...)

# 底部/左侧: 详细信息
draw_info_texts(...)
```

## 🚀 推荐集成步骤

1. **第一步**: 添加导入
   ```python
   from d3utils.d3u_common.image_annotator_helper import *
   ```

2. **第二步**: 转换匹配结果格式
   ```python
   def _to_standard_format(self, opencv_result):
       ...
   ```

3. **第三步**: 替换绘制代码
   ```python
   # 删除所有 cv2.rectangle, cv2.putText
   # 使用 draw_match_results
   ```

4. **第四步**: 测试验证
   ```python
   # 运行测试，检查图像输出
   ```

## ✅ 总结

`image_annotator_helper.py` 提供了:
- ✅ 标准化的绘制接口
- ✅ 自动颜色管理
- ✅ 丰富的可视化元素
- ✅ 统一的样式
- ✅ 易于维护

**强烈推荐**在您的测试脚本中使用此库，而不是直接使用 OpenCV 绘制！
