# 🎯 D4 Object Detection Training System

完整的二分类训练系统，用于 D4 游戏 UI 元素检测。

## 🚀 快速开始

### 第一步：准备训练数据

使用专用脚本准备训练数据：

```bash
python scripts/prepare_progressbar_training.py \
  --image .cache/d4_exp_farming_20251016_031749_166.png \
  --coords "1452,352,1708,375" "1457,355,1703,371" \
  --output .cache/training_data/source/progress_bar \
  --augment 30 \
  --negatives 150
```

### 第二步：自动训练所有项目

```bash
python train.py
```

**就这样！** 系统会自动：
- 🔍 扫描所有训练项目
- 🎮 检测 GPU/CPU
- 📊 显示详细信息
- 🚀 训练所有项目
- 💾 保存到 `d4_modules/`
- 📋 生成 `model_registry.json`

### 第三步：验证训练结果

```bash
python validate_models.py --image screenshot.png
```

## 📁 目录结构

```
apps/d3-check/
├── .cache/training_data/
│   └── source/              # 训练数据源
│       ├── progress_bar/    # 项目1
│       │   ├── yes/        # 正样本
│       │   └── no/         # 负样本
│       ├── health_orb/      # 项目2
│       └── skill_icon/      # 项目3
│
├── d4_modules/              # 训练好的模型
│   ├── model_registry.json # 模型注册表
│   ├── progress_bar_detector.pt
│   ├── progress_bar_detector.json
│   └── ...
│
├── scripts/
│   └── prepare_progressbar_training.py  # 数据准备脚本
│
├── train.py                 # 训练脚本（自动训练所有项目）
└── validate_models.py       # 验证脚本
```

## 🎯 训练流程

### 1. 数据准备

#### 方法1：使用专用脚本（推荐）

```bash
python scripts/prepare_progressbar_training.py \
  --image screenshot.png \
  --coords "x1,y1,x2,y2" "x1,y1,x2,y2" \
  --output .cache/training_data/source/<项目名> \
  --augment 30 \
  --negatives 150
```

特点：
- ✅ 自动从坐标提取正样本
- ✅ 智能生成负样本（避免冲突）
- ✅ 数据增强（旋转、缩放、平移）
- ✅ 支持进度条特殊约束（随机截短）

#### 方法2：手动组织

```bash
mkdir -p .cache/training_data/source/<项目名>/yes
mkdir -p .cache/training_data/source/<项目名>/no

# 添加正样本到 yes/
# 添加负样本到 no/
```

### 2. 训练

```bash
python train.py
```

系统会：
1. 扫描 `.cache/training_data/source/` 下的所有项目
2. 显示硬件信息（GPU/CPU）
3. 显示所有项目的样本统计
4. 自动训练每个项目
5. 保存模型到 `d4_modules/`
6. 生成元数据 JSON

### 3. 验证

```bash
# 基本用法
python validate_models.py --image screenshot.png

# 自定义参数
python validate_models.py \
  --image screenshot.png \
  --stride 32 \
  --confidence 0.7 \
  --output result.png
```

验证结果保存到：
```
C:\Users\<username>\.core_node\pytools\tmp\model_validation\
```

## 📊 训练输出示例

```
🎯 Automatic Training System
================================================================================
Training data location: D:\programing\core_node\apps\d3-check\.cache\training_data

🔧 Environment Detection
================================================================================
✓ OpenCV: 4.12.0
✓ NumPy: 2.3.2
✓ Ultralytics: 8.3.204
✓ PyTorch: 2.7.1+cu118

🎮 GPU Detection:
   GPU 0: NVIDIA GeForce RTX 3080
         Memory: 10.0 GB
✓ CUDA detected - will use GPU acceleration

🔍 Scanning for Training Projects
================================================================================
✓ Found project: progress_bar
   Positive samples: 62
   Negative samples: 150
   Total samples: 212
   Image size: 76x23

📊 Training Summary
================================================================================
🎮 Device: CUDA
   GPU 0: NVIDIA GeForce RTX 3080

📦 Projects to train: 1
   1. progress_bar
      Samples: 62 yes, 150 no
      Total: 212 samples
      Image size: 76x23

⚡ Ready to start training 1 project(s)

🚀 Training Project: progress_bar
...

✅ Training completed: progress_bar
📦 Model saved: d4_modules/progress_bar_detector.pt
📄 Metadata saved: d4_modules/progress_bar_detector.json

📋 Model registry created:
   d4_modules/model_registry.json
   Total models: 1
```

## 🔍 模型注册表

`d4_modules/model_registry.json` 包含所有训练模型的信息：

```json
{
  "registry_version": "1.0",
  "created_at": "2025-10-16T...",
  "models": [
    {
      "model_name": "progress_bar_detector",
      "model_file": "progress_bar_detector.pt",
      "category": "progress_bar",
      "type": "binary_classification",
      "classes": ["no", "yes"],
      "img_size": {
        "width": 76,
        "height": 23
      },
      "samples": {
        "positive": 62,
        "negative": 150,
        "total": 212
      },
      "training_info": {
        "epochs": 100,
        "batch_size": 32,
        "device": "cuda",
        "base_model": "yolov8n-cls.pt"
      },
      "trained_at": "2025-10-16T..."
    }
  ]
}
```

## 💻 代码中使用模型

```python
from ultralytics import YOLO
import json
from pathlib import Path

# 加载注册表
with open("d4_modules/model_registry.json") as f:
    registry = json.load(f)

# 加载所有模型
models = {}
for model_info in registry['models']:
    model = YOLO(f"d4_modules/{model_info['model_file']}")
    models[model_info['category']] = model

# 使用模型检测
image = "screenshot.png"
for category, model in models.items():
    results = model(image)

    for result in results:
        probs = result.probs
        if int(probs.top1) == 1:  # "yes" class
            confidence = float(probs.top1conf)
            print(f"检测到 {category}! 置信度: {confidence:.2%}")
```

## 📝 常见问题

### Q: 如何添加新的训练项目？

**A:** 只需在 `.cache/training_data/source/` 下创建新目录：

```bash
python scripts/prepare_progressbar_training.py \
  --image new_screenshot.png \
  --coords "x1,y1,x2,y2" \
  --output .cache/training_data/source/health_orb

python train.py  # 会自动训练所有项目
```

### Q: 如何只训练特定项目？

**A:** 当前系统设计为自动训练所有项目。如需只训练特定项目，可以暂时移动其他项目到临时目录。

### Q: 训练需要多长时间？

**A:**
- GPU (RTX 3080): ~5-10分钟/项目
- CPU: ~30-60分钟/项目

### Q: 如何提高检测精度？

**A:**
1. 增加训练数据（更多截图）
2. 增加数据增强（`--augment 50`）
3. 调整训练参数（epochs, batch_size）
4. 使用更大的模型（yolov8s/m/l-cls.pt）

## 🎉 完整工作流示例

```bash
# 1. 准备进度条训练数据
python scripts/prepare_progressbar_training.py \
  --image .cache/d4_exp_farming_20251016_031749_166.png \
  --coords "1452,352,1708,375" "1457,355,1703,371" \
  --output .cache/training_data/source/progress_bar \
  --augment 30 \
  --negatives 150

# 2. 准备生命球训练数据
python scripts/prepare_progressbar_training.py \
  --image health_orb_screenshot.png \
  --coords "100,200,164,264" \
  --output .cache/training_data/source/health_orb \
  --augment 20 \
  --negatives 100

# 3. 训练所有项目
python train.py

# 4. 验证结果
python validate_models.py --image test_screenshot.png
```

## 📦 输出位置

- **训练模型**: `d4_modules/`
- **模型注册表**: `d4_modules/model_registry.json`
- **训练日志**: `.cache/training_data/runs/`
- **验证结果**: `C:\Users\<username>\.core_node\pytools\tmp\model_validation\`

---

**准备好了吗？** 运行 `python train.py` 开始训练！
