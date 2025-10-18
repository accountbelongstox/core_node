# UnifiedDetector - 通用目标检测器

## 概述

`UnifiedDetector` 是一个通用的目标检测类库，可以：
- ✅ 作为 Python 类库使用（API 接口）
- ✅ 作为命令行工具独立运行
- ✅ 自动加载最新模型
- ✅ 支持指定模型和类别
- ✅ 提供简洁的检测接口
- ✅ 支持 640x640 检测优化

## 快速开始

### 作为类库使用

#### 1. 基本用法

```python
from pycore.pyutils.unified_detector import UnifiedDetector

# 创建检测器（自动使用最新模型）
detector = UnifiedDetector("d3-check")

# 检测图片
results = detector.detect("screenshot.png")

# 打印结果
for result in results:
    print(f"检测到: {result.class_name}")
    print(f"置信度: {result.confidence:.2f}")
    print(f"位置: {result.bbox}")
```

#### 2. 指定模型

```python
# 指定特定模型
detector = UnifiedDetector(
    "d3-check",
    model_name="unified_model_20251017_143052"
)
```

#### 3. 只检测特定类别

```python
# 只检测进度条
results = detector.detect(
    "screenshot.png",
    target_class="progress_bar"
)
```

#### 4. 查看可用类别

```python
# 获取所有可用类别
classes = detector.get_available_classes()
print(f"可用类别: {classes}")
# 输出: ['yes', 'no', 'progress_bar', 'confirm_button', 'cancel_button']
```

#### 5. 检测并绘制

```python
# 检测并绘制结果
results, output_img = detector.detect_and_draw(
    "screenshot.png",
    output_path="result.png"
)
```

#### 6. 获取模型信息

```python
info = detector.get_model_info()
print(info)
# 输出:
# {
#   'project': 'd3-check',
#   'device': 'cuda',
#   'confidence_threshold': 0.25,
#   'detection': {
#     'name': 'unified_model_20251017_143052',
#     'created': '2025-10-17 14:30:52',
#     'classes': ['progress_bar', 'confirm_button', 'cancel_button']
#   }
# }
```

### 作为命令行工具使用

#### 1. 基本检测

```bash
python -m pycore.pyutils.unified_detector d3-check screenshot.png
```

**输出:**
```
检测结果: screenshot.png
找到 2 个目标:

[1] progress_bar
    置信度: 0.856
    位置: x=100, y=200, w=300, h=20
    模型: unified_model_20251017_143052 (detection)

[2] confirm_button
    置信度: 0.923
    位置: x=400, y=500, w=80, h=30
    模型: unified_model_20251017_143052 (detection)
```

#### 2. 查看帮助

```bash
python -m pycore.pyutils.unified_detector d3-check --help
```

#### 3. 列出可用类别

```bash
python -m pycore.pyutils.unified_detector d3-check --list-classes
```

**输出:**
```
可用的检测类别:
  - yes
  - no
  - progress_bar
  - confirm_button
  - cancel_button
```

#### 4. 只检测特定类别

```bash
python -m pycore.pyutils.unified_detector d3-check screenshot.png --target progress_bar
```

#### 5. 指定模型

```bash
python -m pycore.pyutils.unified_detector d3-check screenshot.png \
  --model unified_model_20251017_143052
```

#### 6. 保存绘制结果

```bash
python -m pycore.pyutils.unified_detector d3-check screenshot.png \
  --output result.png
```

#### 7. JSON 输出

```bash
python -m pycore.pyutils.unified_detector d3-check screenshot.png --json
```

**输出:**
```json
{
  "image": "screenshot.png",
  "detections": [
    {
      "class": "progress_bar",
      "confidence": 0.856,
      "bbox": {"x": 100, "y": 200, "w": 300, "h": 20},
      "model_type": "detection",
      "model_name": "unified_model_20251017_143052"
    }
  ],
  "count": 1
}
```

#### 8. 查看模型信息

```bash
python -m pycore.pyutils.unified_detector d3-check --info
```

## API 参考

### UnifiedDetector 类

#### 初始化

```python
UnifiedDetector(
    project_name: str,
    model_name: Optional[str] = None,
    model_type: Optional[str] = None,
    confidence_threshold: float = 0.25,
    device: str = 'auto'
)
```

**参数:**
- `project_name`: 项目名称（apps 目录下的项目，如 'd3-check'）
- `model_name`: 模型名称（可选，默认使用最新模型）
- `model_type`: 模型类型（可选，'classification'/'detection'/None）
- `confidence_threshold`: 置信度阈值（默认 0.25）
- `device`: 设备（'auto'/'cpu'/'cuda'/'mps'，默认自动检测）

#### 主要方法

##### detect()

```python
detect(
    image: Union[str, Path, np.ndarray],
    target_class: Optional[str] = None,
    confidence_threshold: Optional[float] = None,
    use_640: bool = True
) -> List[DetectionResult]
```

**参数:**
- `image`: 图片路径或 numpy 数组
- `target_class`: 目标类别（可选，只返回指定类别）
- `confidence_threshold`: 置信度阈值（可选，覆盖初始化值）
- `use_640`: 是否使用 640x640 优化（默认 True）

**返回:**
- `List[DetectionResult]`: 检测结果列表

##### detect_and_draw()

```python
detect_and_draw(
    image: Union[str, Path, np.ndarray],
    output_path: Optional[Union[str, Path]] = None,
    target_class: Optional[str] = None,
    **kwargs
) -> tuple[List[DetectionResult], np.ndarray]
```

**参数:**
- `image`: 输入图片
- `output_path`: 输出路径（可选）
- `target_class`: 目标类别（可选）
- `**kwargs`: 传递给 detect() 的其他参数

**返回:**
- `(检测结果列表, 绘制后的图片)`

##### get_available_classes()

```python
get_available_classes() -> List[str]
```

**返回:**
- `List[str]`: 可用的检测类别列表

##### get_model_info()

```python
get_model_info() -> Dict[str, Any]
```

**返回:**
- `Dict`: 模型信息字典

### DetectionResult 数据类

```python
@dataclass
class DetectionResult:
    class_name: str          # 类别名称
    confidence: float        # 置信度
    bbox: Dict[str, int]     # 边界框 {x, y, w, h}
    model_type: str          # 模型类型
    model_name: str          # 模型名称
```

**方法:**
- `to_dict()`: 转换为字典
- `__repr__()`: 字符串表示

## 使用示例

### 示例 1: 批量检测图片

```python
from pycore.pyutils.unified_detector import UnifiedDetector
from pathlib import Path

detector = UnifiedDetector("d3-check")

# 批量处理图片
image_dir = Path("screenshots")
for img_path in image_dir.glob("*.png"):
    results = detector.detect(str(img_path))
    print(f"{img_path.name}: 检测到 {len(results)} 个目标")
```

### 示例 2: 查找特定目标

```python
from pycore.pyutils.unified_detector import UnifiedDetector

detector = UnifiedDetector("d3-check")

# 只查找进度条
results = detector.detect(
    "screenshot.png",
    target_class="progress_bar"
)

if results:
    progress_bar = results[0]
    print(f"找到进度条:")
    print(f"  位置: {progress_bar.bbox}")
    print(f"  置信度: {progress_bar.confidence:.2f}")
else:
    print("未找到进度条")
```

### 示例 3: 实时检测（视频流）

```python
from pycore.pyutils.unified_detector import UnifiedDetector
import cv2

detector = UnifiedDetector("d3-check")

# 打开视频流
cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # 检测并绘制
    results, output = detector.detect_and_draw(frame)

    # 显示结果
    cv2.imshow("Detection", output)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
```

### 示例 4: 自定义处理

```python
from pycore.pyutils.unified_detector import UnifiedDetector

detector = UnifiedDetector("d3-check")

# 检测
results = detector.detect("screenshot.png")

# 按置信度排序
results_sorted = sorted(results, key=lambda x: x.confidence, reverse=True)

# 只处理高置信度的结果
for result in results_sorted:
    if result.confidence > 0.8:
        print(f"高置信度检测: {result.class_name} ({result.confidence:.2f})")

        # 提取目标区域
        bbox = result.bbox
        # ... 进行其他处理
```

### 示例 5: 多项目检测

```python
from pycore.pyutils.unified_detector import UnifiedDetector

# 创建多个检测器
detector_d3 = UnifiedDetector("d3-check")
detector_other = UnifiedDetector("other-project")

# 使用不同的检测器
results_d3 = detector_d3.detect("screenshot1.png")
results_other = detector_other.detect("screenshot2.png")
```

## 命令行参数完整列表

```
positional arguments:
  project               项目名称（apps 目录下的项目）
  image                 输入图片路径

optional arguments:
  -h, --help            显示帮助信息
  --model, -m MODEL     模型名称（默认使用最新）
  --type, -t {classification,detection}
                        模型类型（默认自动检测）
  --conf CONFIDENCE     置信度阈值（默认: 0.25）
  --target TARGET       目标类别（只返回指定类别）
  --output, -o OUTPUT   输出图片路径
  --list-classes        列出可用的检测类别
  --info                显示模型信息
  --json                以 JSON 格式输出结果
  --no-640              禁用 640x640 优化
```

## 高级用法

### 1. 调整置信度阈值

```python
# 初始化时设置
detector = UnifiedDetector("d3-check", confidence_threshold=0.5)

# 或在检测时覆盖
results = detector.detect("screenshot.png", confidence_threshold=0.3)
```

### 2. 指定设备

```python
# 强制使用 CPU
detector = UnifiedDetector("d3-check", device='cpu')

# 使用 GPU
detector = UnifiedDetector("d3-check", device='cuda')

# 自动检测（默认）
detector = UnifiedDetector("d3-check", device='auto')
```

### 3. 禁用 640x640 优化

```python
# 对于小图片或需要最高精度时
results = detector.detect("screenshot.png", use_640=False)
```

### 4. 只使用特定模型类型

```python
# 只使用检测模型
detector = UnifiedDetector("d3-check", model_type='detection')

# 只使用分类模型
detector = UnifiedDetector("d3-check", model_type='classification')
```

## 集成示例

### 与 Flask Web 服务集成

```python
from flask import Flask, request, jsonify
from pycore.pyutils.unified_detector import UnifiedDetector
import cv2
import numpy as np

app = Flask(__name__)
detector = UnifiedDetector("d3-check")

@app.route('/detect', methods=['POST'])
def detect():
    # 接收图片
    file = request.files['image']
    img_bytes = file.read()
    img_arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(img_arr, cv2.IMREAD_COLOR)

    # 检测
    results = detector.detect(img)

    # 返回 JSON
    return jsonify({
        'detections': [r.to_dict() for r in results],
        'count': len(results)
    })

if __name__ == '__main__':
    app.run(debug=True)
```

### 与 FastAPI 集成

```python
from fastapi import FastAPI, File, UploadFile
from pycore.pyutils.unified_detector import UnifiedDetector
import cv2
import numpy as np

app = FastAPI()
detector = UnifiedDetector("d3-check")

@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    # 读取图片
    contents = await file.read()
    img_arr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(img_arr, cv2.IMREAD_COLOR)

    # 检测
    results = detector.detect(img)

    return {
        'detections': [r.to_dict() for r in results],
        'count': len(results)
    }
```

## 性能优化建议

1. **复用检测器实例**
   ```python
   # 好 - 复用实例
   detector = UnifiedDetector("d3-check")
   for img in images:
       results = detector.detect(img)

   # 差 - 每次创建新实例
   for img in images:
       detector = UnifiedDetector("d3-check")  # 重复加载模型
       results = detector.detect(img)
   ```

2. **使用 640x640 优化**
   ```python
   # 对大图片使用 640x640 优化
   results = detector.detect("large_image.png", use_640=True)
   ```

3. **指定模型类型**
   ```python
   # 如果只需要检测模型，避免加载分类模型
   detector = UnifiedDetector("d3-check", model_type='detection')
   ```

## 错误处理

```python
from pycore.pyutils.unified_detector import UnifiedDetector

try:
    detector = UnifiedDetector("d3-check")
    results = detector.detect("screenshot.png")
except ValueError as e:
    print(f"配置错误: {e}")
except FileNotFoundError as e:
    print(f"文件未找到: {e}")
except Exception as e:
    print(f"检测失败: {e}")
```

## 常见问题

### Q1: 如何知道项目名称？

**A**: 项目名称是 `apps` 目录下的子目录名，例如：
```
core_node/
├── apps/
│   ├── d3-check/        # 项目名称: "d3-check"
│   ├── other-project/   # 项目名称: "other-project"
│   └── ...
```

### Q2: 如何指定特定模型？

**A**: 使用模型目录名：
```python
detector = UnifiedDetector(
    "d3-check",
    model_name="unified_model_20251017_143052"
)
```

### Q3: 如何获取所有检测结果的边界框？

**A**:
```python
results = detector.detect("screenshot.png")
bboxes = [r.bbox for r in results]
print(bboxes)
# [{'x': 100, 'y': 200, 'w': 300, 'h': 20}, ...]
```

### Q4: 支持哪些图片格式？

**A**: 支持 OpenCV 支持的所有格式：
- PNG, JPG, JPEG, BMP, TIFF, WebP 等

### Q5: 如何提高检测精度？

**A**:
1. 降低置信度阈值（但可能增加误报）
2. 使用原始尺寸检测（`use_640=False`）
3. 训练更好的模型

---

**最后更新**: 2025-10-17
**版本**: 1.0.0
