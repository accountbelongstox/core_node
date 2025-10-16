# 训练和验证工作流程总结

## 概述

训练和验证现已完全分离为两个独立的脚本：
- `train.py` - 仅负责训练模型
- `validate_models.py` - 仅负责验证和测试模型

## 完整工作流程

### 1. 准备训练数据

使用专用脚本准备进度条训练数据：

```bash
python scripts/prepare_progressbar_training.py \
  --image .cache/d4_exp_farming_20251016_031749_166.png \
  --coords "1452,352,1708,375" "1457,355,1703,371" \
  --output .cache/training_data/source/progress_bar \
  --augment 30 \
  --negatives 150
```

**输出：**
- 62个正样本 (yes)
- 150个负样本 (no)
- 保存到 `.cache/training_data/source/progress_bar/`

### 2. 训练模型

运行自动训练系统：

```bash
python train.py
```

**训练过程：**
1. 🔍 扫描所有训练项目 (`.cache/training_data/source/`)
2. 🎮 检测GPU/CPU环境
3. 📊 显示训练摘要
4. 📦 创建train/val分割 (80/20)
5. 🏋️ 训练YOLOv8分类模型
6. 💾 保存模型到 `d4_modules/`
7. 📄 生成元数据JSON文件

**输出文件：**
- `d4_modules/<project>_detector.pt` - 训练好的模型
- `d4_modules/<project>_detector.json` - 模型元数据
- `d4_modules/model_registry.json` - 所有模型的注册表

**元数据包含：**
```json
{
  "model_name": "progress_bar_detector",
  "model_file": "progress_bar_detector.pt",
  "category": "progress_bar",
  "type": "binary_classification",
  "classes": ["no", "yes"],
  "img_size": {"width": 76, "height": 23},
  "samples": {
    "positive": 62,
    "negative": 150,
    "total": 212
  },
  "training_info": {
    "epochs": 100,
    "batch_size": 8,
    "device": "cpu",
    "base_model": "yolov8n-cls.pt"
  },
  "trained_at": "2025-10-16T..."
}
```

### 3. 验证模型

训练完成后，使用验证脚本测试模型：

```bash
python validate_models.py --image screenshot.png
```

**验证过程：**
1. 📋 读取 `d4_modules/model_registry.json`
2. 📦 加载所有训练好的模型
3. 🔍 使用滑动窗口在大图上检测对象
4. 🎨 在检测位置绘制边界框和标签
5. 💾 保存标注后的图片

**参数选项：**
```bash
# 基本用法
python validate_models.py --image screenshot.png

# 自定义参数
python validate_models.py \
  --image D:\screenshots\game.png \
  --stride 32 \
  --confidence 0.7 \
  --output validation_result.png
```

**输出位置：**
```
C:\Users\MPC\.core_node\pytools\tmp\model_validation\
```

**如果未训练：**
验证脚本会显示清晰的错误信息：
```
❌ Model registry not found!
   Expected location: D:\...\d4_modules\model_registry.json

   Please train models first:
   1. Prepare training data:
      python scripts/prepare_progressbar_training.py --image <image> --coords <coords> --output .cache/training_data/source/<category>
   2. Run training:
      python train.py
```

## 目录结构

```
apps/d3-check/
├── train.py                              # 训练脚本 (自动扫描并训练所有项目)
├── validate_models.py                    # 验证脚本 (测试训练好的模型)
├── scripts/
│   └── prepare_progressbar_training.py   # 数据准备脚本
├── .cache/training_data/
│   ├── source/                          # 原始训练数据
│   │   └── progress_bar/
│   │       ├── yes/                     # 正样本
│   │       └── no/                      # 负样本
│   ├── processed/                       # 处理后的数据 (train/val split)
│   │   └── progress_bar/
│   │       ├── train/
│   │       │   ├── yes/
│   │       │   └── no/
│   │       ├── val/
│   │       │   ├── yes/
│   │       │   └── no/
│   │       └── data.yaml
│   └── runs/                            # 训练日志
│       └── progress_bar/
└── d4_modules/                          # 训练好的模型
    ├── README.md
    ├── model_registry.json              # 模型注册表
    ├── progress_bar_detector.pt         # 模型文件
    └── progress_bar_detector.json       # 模型元数据
```

## 关键修复

### 问题
之前使用YAML文件路径导致训练失败：
```python
data="path/to/data.yaml"  # ❌ 错误
```

错误信息：
```
Classification datasets must be a directory (data="path/to/dir")
not a file (data="path/to/data.yaml")
```

### 解决方案
YOLOv8分类模型需要目录路径：
```python
data="path/to/processed/project_name"  # ✅ 正确
```

目录结构应为：
```
processed/project_name/
├── train/
│   ├── class1/
│   └── class2/
└── val/
    ├── class1/
    └── class2/
```

## 使用训练好的模型

在代码中直接使用：

```python
import json
from ultralytics import YOLO
from pathlib import Path

# 读取模型注册表
registry_file = Path("d4_modules/model_registry.json")
with open(registry_file) as f:
    registry = json.load(f)

# 加载模型
for model_info in registry['models']:
    model_name = model_info['model_name']
    model_file = Path("d4_modules") / model_info['model_file']

    # 加载YOLO模型
    model = YOLO(str(model_file))

    # 使用模型预测
    results = model("test_image.png")

    # 获取结果
    for result in results:
        probs = result.probs
        class_id = int(probs.top1)  # 0=no, 1=yes
        confidence = float(probs.top1conf)

        if class_id == 1:  # yes - 检测到对象
            print(f"{model_name}: Detected with {confidence:.2%} confidence")
```

## 总结

✅ **训练** (`train.py`)
- 自动扫描训练项目
- 检测环境 (GPU/CPU)
- 训练YOLOv8分类模型
- 保存到 `d4_modules/`
- 生成模型元数据和注册表

✅ **验证** (`validate_models.py`)
- 读取模型注册表
- 加载所有训练好的模型
- 在大图上检测对象
- 标注并保存结果
- 如果未训练则提示用户

✅ **完全分离**
- 训练不包含验证逻辑
- 验证独立运行
- 清晰的错误提示
