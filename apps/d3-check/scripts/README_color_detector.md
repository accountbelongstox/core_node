# Color Region Detector 使用说明

## 功能描述

检测图像中连续相同颜色的区域，支持颜色容差匹配。

## 核心特性

1. **多颜色检测**: 支持同时检测多个目标颜色
2. **容差匹配**: 对每个颜色进行明暗±5%的容差范围匹配
3. **连通区域分析**: 自动查找并标记连续的相同颜色区域
4. **可视化输出**:
   - 在原图上用绿色矩形框圈出检测区域
   - 显示区域编号和面积
   - 保存颜色掩码图像

## 使用方法

### 基本用法

```bash
python color_region_detector.py <image_path>
```

### 示例

```bash
# 检测图像中的橙色区域
python color_region_detector.py test_image.png

# 检测不同路径的图像
python color_region_detector.py ../images/screenshot.png
```

## 配置参数

在脚本中可以修改以下参数：

### 1. 目标颜色组 (TARGET_COLORS)

```python
TARGET_COLORS = [
    (0x41, 0x99, 0xfe),  # fe9941 - BGR格式
    (0x3b, 0x77, 0xff),  # ff773b
    # ... 添加更多颜色
]
```

**注意**: 颜色使用BGR格式（OpenCV标准）

**转换方法**:
- RGB `#fe9941` → BGR `(0x41, 0x99, 0xfe)`
- RGB `#ff773b` → BGR `(0x3b, 0x77, 0xff)`

### 2. 颜色容差 (COLOR_TOLERANCE)

```python
COLOR_TOLERANCE = 0.05  # ±5%
```

调整容差范围：
- `0.05` = ±5% (推荐)
- `0.10` = ±10% (宽松)
- `0.02` = ±2% (严格)

### 3. 最小区域面积 (MIN_REGION_AREA)

```python
MIN_REGION_AREA = 10  # 像素数
```

过滤掉小于此面积的区域，避免噪点干扰。

## 输出文件

脚本会在 `./scripts/output/` 目录下生成以下文件：

1. **`<原文件名>_detected.png`**: 标注了检测区域的结果图
   - 绿色矩形框标记每个区域
   - 显示区域编号和面积

2. **`<原文件名>_mask.png`**: 颜色掩码图
   - 白色: 匹配的像素
   - 黑色: 不匹配的像素

## 输出信息

### 控制台输出示例

```
[Info] Image loaded: test_image.png
[Info] Image size: 1920x1080
[Step 1] Creating color mask...
[ColorMask] Color 1: BGR(65, 153, 254) → Range[[61, 145, 241], [68, 160, 255]] → Pixels: 1234
[ColorMask] Color 2: BGR(59, 119, 255) → Range[[56, 113, 242], [61, 124, 255]] → Pixels: 2345
[ColorMatch] Matched pixels: 3579/2073600 (0.17%)
[Step 2] Finding connected regions...
[Region] Found: Position(100,200) Size(50x30) Area=1500px
[Region] Found: Position(300,400) Size(80x60) Area=4800px
[Result] Found 2 regions (min area: 10px)
[Output] Detection result saved: ./scripts/output/test_image_detected.png
[Output] Color mask saved: ./scripts/output/test_image_mask.png

============================================================
DETECTION SUMMARY
============================================================
Input image:      test_image.png
Image size:       1920x1080
Target colors:    2 colors
Color tolerance:  ±5.0%
Matched pixels:   3579 (0.17%)
Regions found:    2
Output directory: D:\programing\core_node\apps\d3-check\scripts\output
============================================================

REGION DETAILS:
------------------------------------------------------------
Region #1:
  Position: (100, 200)
  Size:     50x30
  Area:     1500 pixels
------------------------------------------------------------
Region #2:
  Position: (300, 400)
  Size:     80x60
  Area:     4800 pixels
------------------------------------------------------------
```

## 算法原理

1. **颜色范围计算**:
   - 对每个目标颜色BGR(b,g,r)计算容差范围
   - 下界: `(b×0.95, g×0.95, r×0.95)`
   - 上界: `(b×1.05, g×1.05, r×1.05)`

2. **颜色掩码创建**:
   - 使用 `cv2.inRange()` 为每个颜色创建二值掩码
   - 合并所有颜色掩码得到最终掩码

3. **连通区域分析**:
   - 使用 `cv2.connectedComponentsWithStats()` 查找8-连通区域
   - 过滤小于最小面积的区域

4. **可视化标注**:
   - 在原图上绘制矩形框
   - 添加区域编号和面积标签

## 常见问题

### Q: 检测不到区域怎么办？

A: 尝试以下方法：
1. 增大颜色容差 (如改为 `COLOR_TOLERANCE = 0.10`)
2. 减小最小区域面积 (如改为 `MIN_REGION_AREA = 5`)
3. 检查目标颜色是否正确（BGR格式）

### Q: 检测到太多噪点怎么办？

A: 尝试以下方法：
1. 减小颜色容差 (如改为 `COLOR_TOLERANCE = 0.02`)
2. 增大最小区域面积 (如改为 `MIN_REGION_AREA = 50`)

### Q: 如何添加新的目标颜色？

A: 修改 `TARGET_COLORS` 列表：
```python
TARGET_COLORS = [
    (0x41, 0x99, 0xfe),  # 原有颜色
    (0x00, 0xff, 0x00),  # 新增绿色 (RGB: #00ff00)
]
```

## 依赖项

- OpenCV (`cv2`)
- NumPy
- Python 3.6+

## 技术细节

- **连通性**: 使用8-连通（对角线也算连通）
- **颜色空间**: BGR (OpenCV默认)
- **掩码格式**: 8位灰度 (0=不匹配, 255=匹配)
- **区域检测**: 基于连通组件标记算法
