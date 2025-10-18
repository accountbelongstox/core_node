# UnifiedDetector 快速入门

## 5 分钟上手

### 1. 作为 Python 类库使用

```python
from pycore.pyutils.unified_detector import UnifiedDetector

# 创建检测器
detector = UnifiedDetector("d3-check")

# 检测图片
results = detector.detect("screenshot.png")

# 打印结果
for result in results:
    print(f"{result.class_name}: {result.confidence:.2f} @ {result.bbox}")
```

### 2. 作为命令行工具使用

```bash
# 基本检测
python -m pycore.pyutils.unified_detector d3-check screenshot.png

# 列出可用类别
python -m pycore.pyutils.unified_detector d3-check --list-classes

# 只检测特定类别
python -m pycore.pyutils.unified_detector d3-check screenshot.png --target progress_bar

# 保存结果
python -m pycore.pyutils.unified_detector d3-check screenshot.png --output result.png

# JSON 输出
python -m pycore.pyutils.unified_detector d3-check screenshot.png --json
```

## 核心功能

### 1. 自动加载最新模型

```python
# 无需指定模型，自动使用最新的
detector = UnifiedDetector("d3-check")
```

### 2. 检测特定类别

```python
# 查看可用类别
classes = detector.get_available_classes()
print(classes)  # ['yes', 'no', 'progress_bar', 'confirm_button', ...]

# 只检测进度条
results = detector.detect("screenshot.png", target_class="progress_bar")
```

### 3. 检测并绘制

```python
# 自动绘制检测框并保存
results, output_img = detector.detect_and_draw(
    "screenshot.png",
    output_path="result.png"
)
```

### 4. 获取检测结果

```python
results = detector.detect("screenshot.png")

for result in results:
    print(f"类别: {result.class_name}")
    print(f"置信度: {result.confidence}")
    print(f"位置: {result.bbox}")  # {'x': 100, 'y': 200, 'w': 300, 'h': 20}
    print(f"模型: {result.model_name}")
```

## 常用场景

### 场景 1: 查找特定 UI 元素

```python
detector = UnifiedDetector("d3-check")

# 查找确认按钮
results = detector.detect("screenshot.png", target_class="confirm_button")

if results:
    button = results[0]
    # 计算按钮中心点（用于点击）
    center_x = button.bbox['x'] + button.bbox['w'] // 2
    center_y = button.bbox['y'] + button.bbox['h'] // 2
    print(f"点击位置: ({center_x}, {center_y})")
```

### 场景 2: 批量处理图片

```python
from pathlib import Path

detector = UnifiedDetector("d3-check")

for img_path in Path("screenshots").glob("*.png"):
    results = detector.detect(str(img_path))
    print(f"{img_path.name}: 检测到 {len(results)} 个目标")
```

### 场景 3: Web API 服务

```python
from flask import Flask, request, jsonify
from pycore.pyutils.unified_detector import UnifiedDetector
import cv2
import numpy as np

app = Flask(__name__)
detector = UnifiedDetector("d3-check")

@app.route('/detect', methods=['POST'])
def detect():
    file = request.files['image']
    img_bytes = file.read()
    img_arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(img_arr, cv2.IMREAD_COLOR)

    results = detector.detect(img)

    return jsonify({
        'detections': [r.to_dict() for r in results],
        'count': len(results)
    })

if __name__ == '__main__':
    app.run(debug=True)
```

## 命令行快速参考

```bash
# 基本检测
python -m pycore.pyutils.unified_detector d3-check screenshot.png

# 查看帮助
python -m pycore.pyutils.unified_detector d3-check --help

# 列出类别
python -m pycore.pyutils.unified_detector d3-check --list-classes

# 模型信息
python -m pycore.pyutils.unified_detector d3-check --info

# 指定模型
python -m pycore.pyutils.unified_detector d3-check screenshot.png \
  --model unified_model_20251017_143052

# 特定类别
python -m pycore.pyutils.unified_detector d3-check screenshot.png \
  --target progress_bar

# 保存结果
python -m pycore.pyutils.unified_detector d3-check screenshot.png \
  --output result.png

# JSON 输出
python -m pycore.pyutils.unified_detector d3-check screenshot.png --json

# 调整置信度
python -m pycore.pyutils.unified_detector d3-check screenshot.png --conf 0.5

# 禁用 640x640 优化
python -m pycore.pyutils.unified_detector d3-check screenshot.png --no-640
```

## 参数说明

### Python API

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `project_name` | str | 必填 | 项目名称 |
| `model_name` | str | None | 模型名称（默认最新） |
| `model_type` | str | None | 模型类型 |
| `confidence_threshold` | float | 0.25 | 置信度阈值 |
| `device` | str | 'auto' | 设备选择 |

### 命令行

| 参数 | 说明 |
|------|------|
| `project` | 项目名称 |
| `image` | 图片路径 |
| `--model, -m` | 指定模型 |
| `--type, -t` | 模型类型 |
| `--conf` | 置信度阈值 |
| `--target` | 目标类别 |
| `--output, -o` | 输出路径 |
| `--list-classes` | 列出类别 |
| `--info` | 模型信息 |
| `--json` | JSON 输出 |
| `--no-640` | 禁用优化 |

## 检测结果格式

### Python 对象

```python
result = DetectionResult(
    class_name='progress_bar',
    confidence=0.856,
    bbox={'x': 100, 'y': 200, 'w': 300, 'h': 20},
    model_type='detection',
    model_name='unified_model_20251017_143052'
)
```

### 字典格式

```python
result.to_dict()
# {
#     'class': 'progress_bar',
#     'confidence': 0.856,
#     'bbox': {'x': 100, 'y': 200, 'w': 300, 'h': 20},
#     'model_type': 'detection',
#     'model_name': 'unified_model_20251017_143052'
# }
```

### JSON 格式

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

## 性能提示

1. **复用检测器实例**
   ```python
   # 好
   detector = UnifiedDetector("d3-check")
   for img in images:
       results = detector.detect(img)

   # 差
   for img in images:
       detector = UnifiedDetector("d3-check")
       results = detector.detect(img)
   ```

2. **使用 640x640 优化**
   ```python
   # 对大图片更快
   results = detector.detect("large_image.png", use_640=True)
   ```

3. **指定模型类型**
   ```python
   # 只需要检测模型时
   detector = UnifiedDetector("d3-check", model_type='detection')
   ```

## 错误处理

```python
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

## 下一步

- 📖 查看完整文档: `UNIFIED_DETECTOR_README.md`
- 💡 查看示例代码: `examples/unified_detector_example.py`
- 🔧 了解 640x640 优化: `apps/d3-check/DUAL_OUTPUT_640_GUIDE.md`

---

**快速链接:**
- [完整 API 文档](UNIFIED_DETECTOR_README.md)
- [使用示例](examples/unified_detector_example.py)
- [GitHub Issues](https://github.com/your-repo/issues)

**最后更新**: 2025-10-17
