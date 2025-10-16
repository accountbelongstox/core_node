# 🚀 Quick Start - Automatic Training System

## 最简单的使用方式

### 一、准备训练数据

```bash
cd D:\programing\core_node\apps\d3-check

# 使用您的截图和坐标准备进度条数据
python scripts/prepare_progressbar_training.py \
  --image .cache/d4_exp_farming_20251016_031749_166.png \
  --coords "1452,352,1708,375" "1457,355,1703,371" \
  --output .cache/training_data/source/progress_bar \
  --augment 30 \
  --negatives 150
```

### 二、自动训练（无需参数！）

```bash
python train_all.py
```

就这么简单！系统会自动：
- ✅ 扫描所有训练项目
- ✅ 检测GPU/CPU
- ✅ 显示详细训练信息
- ✅ 训练所有项目
- ✅ 保存模型

## 训练输出示例

```
🎯 Automatic Training System
================================================================================
Training data location: .cache\training_data

🔧 Environment Detection
================================================================================
✓ OpenCV: 4.12.0
✓ NumPy: 2.3.2
✓ Ultralytics: 8.3.204
✓ PyTorch: 2.7.1+cpu
⚠ CUDA: Not available (will use CPU)

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

✓ Found project: health_orb
   Positive samples: 45
   Negative samples: 120
   Total samples: 165
   Image size: 64x64

📊 Training Summary
================================================================================
🎮 Device: CUDA
   GPU 0: NVIDIA GeForce RTX 3080

📦 Projects to train: 2

   1. progress_bar
      Samples: 62 yes, 150 no
      Total: 212 samples
      Image size: 76x23

   2. health_orb
      Samples: 45 yes, 120 no
      Total: 165 samples
      Image size: 64x64

⚡ Ready to start training 2 project(s)
   This may take a while depending on your hardware

📦 Project 1/2: progress_bar
================================================================================
📦 Preparing Project: progress_bar
✓ Creating train/validation split (80/20):
   Train: 49 yes, 120 no
   Val:   13 yes, 30 no

🚀 Training Project: progress_bar
================================================================================
📊 Training Configuration:
   Project: progress_bar
   Model: yolov8n-cls.pt
   Epochs: 100
   Batch size: 32
   Device: cuda
   Image size: 76
   Samples: 212

🏋️  Starting Training...
Epoch 1/100: train loss=0.521, val loss=0.412
Epoch 2/100: train loss=0.387, val loss=0.298
...
Epoch 45/100: train loss=0.045, val loss=0.052
✅ Training completed: progress_bar
📦 Model saved: progress_bar_detector.pt

🔍 Validating model...
✓ Validation completed

🎉 Training Complete!
================================================================================
📊 Results:
   Total projects: 2
   Successful: 2
   Failed: 0

📦 Trained models saved to:
   .cache\training_data\models\
   ✓ progress_bar_detector.pt
   ✓ health_orb_detector.pt
```

## 文件结构

训练前只需准备：
```
.cache/training_data/source/
├── progress_bar/         # 项目1
│   ├── yes/             # 正样本
│   └── no/              # 负样本
├── health_orb/          # 项目2
│   ├── yes/
│   └── no/
└── skill_cooldown/      # 项目3
    ├── yes/
    └── no/
```

训练后自动生成：
```
.cache/training_data/
├── source/              # 原始数据（您准备的）
├── processed/           # 处理后的数据（自动生成）
│   ├── progress_bar/
│   └── health_orb/
├── models/              # 训练好的模型（自动保存）
│   ├── progress_bar_detector.pt
│   └── health_orb_detector.pt
└── runs/                # 训练记录（自动保存）
    ├── progress_bar/
    └── health_orb/
```

## 系统特点

### 🔍 自动扫描
- 自动扫描所有 `source/` 下的项目
- 自动检测样本数量和图片尺寸
- 跳过不完整的项目并给出提示

### 🎮 智能硬件检测
- 自动检测GPU（CUDA）
- 显示GPU型号和显存
- 自动选择最优设备（GPU/CPU）
- 根据设备调整batch size

### 📊 详细信息显示
训练前显示：
- 硬件信息（GPU/CPU）
- 项目列表
- 每个项目的样本数量
- 图片尺寸
- 训练配置

### ⚡ 全自动训练
- 自动创建train/val分割
- 自动配置训练参数
- 自动保存最佳模型
- 自动验证模型

### 🎯 多项目支持
- 一次训练多个项目
- 每个项目独立配置
- 进度清晰显示

## 添加新的训练项目

### 方法1：使用prepare_progressbar_training.py（推荐）

```bash
# 为新元素（如生命球）准备数据
python scripts/prepare_progressbar_training.py \
  --image screenshot_with_health_orb.png \
  --coords "100,200,164,264" \
  --output .cache/training_data/source/health_orb \
  --augment 20 \
  --negatives 100
```

### 方法2：手动组织

```bash
# 创建目录
mkdir -p .cache/training_data/source/health_orb/yes
mkdir -p .cache/training_data/source/health_orb/no

# 添加正样本到 yes/
# 添加负样本到 no/
```

然后运行：
```bash
python train_all.py
```

系统会自动检测并训练新项目！

## 使用训练好的模型

```python
from ultralytics import YOLO
import cv2

# 加载模型
model = YOLO('.cache/training_data/models/progress_bar_detector.pt')

# 读取图片
img = cv2.imread('game_screenshot.png')

# 提取感兴趣区域
region = img[352:375, 1452:1708]

# 预测
results = model.predict(region)

# 获取结果
is_progress_bar = results[0].probs.top1 == 1  # 1 = yes
confidence = results[0].probs.top1conf

if is_progress_bar:
    print(f"检测到进度条！置信度: {confidence:.2%}")
else:
    print(f"不是进度条。置信度: {confidence:.2%}")
```

## 常见问题

### Q: 没有GPU怎么办？
A: 系统会自动使用CPU训练，只是速度会慢一些。

### Q: 如何使用GPU训练？
A: 确保安装了CUDA版本的PyTorch：
```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
```

### Q: 如何添加更多训练数据？
A: 只需再次运行 `prepare_progressbar_training.py` 指向同一个输出目录，数据会累加。

### Q: 训练需要多长时间？
A:
- GPU (RTX 3080): ~5-10分钟/项目
- CPU: ~30-60分钟/项目（取决于样本数量）

### Q: 可以中断训练吗？
A: 可以按 Ctrl+C 中断，下次运行时可以从上次的检查点继续（使用 --resume 参数）。

### Q: 训练精度不高怎么办？
A:
1. 增加训练数据（多拍几张截图）
2. 增加augmentation数量
3. 训练更多epochs
4. 使用更大的模型（yolov8s/m/l-cls.pt）

## 下一步

训练完成后，您可以：
1. ✅ 将模型集成到游戏自动化系统
2. ✅ 训练更多UI元素检测器
3. ✅ 组合多个检测器实现复杂功能
4. ✅ 使用ONNX导出优化推理速度

---

**准备好了吗？** 运行 `python train_all.py` 开始训练！
