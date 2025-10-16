# 🎯 双命名空间训练系统指南

完整的YOLOv8训练系统，支持两种训练模式：

1. **Namespace: Classification (small)** - 小图分类模型
2. **Namespace: Detection (large)** - 大图检测模型

---

## 📋 系统架构对比

| 特性 | Classification (small) | Detection (large) |
|------|----------------------|-------------------|
| **模型类型** | YOLOv8 Classification (`yolov8n-cls.pt`) | YOLOv8 Detection (`yolov8n.pt`) |
| **训练数据** | 切好的小图 (yes/no文件夹) | 大图 + YOLO格式坐标标注 |
| **验证方式** | 滑动窗口遍历 | 直接检测推理 |
| **速度** | 慢 (需要遍历所有窗口) | 快 (一次推理) |
| **精确度** | 窗口级定位 | 像素级精确定位 |
| **适用场景** | 固定尺寸UI元素 | 多尺度、位置不固定的对象 |
| **模型目录** | `d4_modules/` | `d4_modules_detection/` |
| **训练数据目录** | `.cache/training_data/source/` | `.cache/training_data/detection/` |

---

## 🚀 使用流程

### Namespace 1: Classification (小图分类)

#### 1.1 准备数据
```bash
python scripts/prepare_progressbar_training.py \
  --image screenshot.png \
  --coords "x1,y1,x2,y2" \
  --output .cache/training_data/source/progress_bar \
  --augment 30 \
  --negatives 150
```

**输出：**
- `.cache/training_data/source/progress_bar/yes/*.png` - 正样本小图
- `.cache/training_data/source/progress_bar/no/*.png` - 负样本小图

#### 1.2 训练
```bash
python train.py
```

**输出：**
- `d4_modules/progress_bar_detector.pt` - 分类模型
- `d4_modules/progress_bar_detector.json` - 元数据
- `d4_modules/model_registry.json` - 模型注册表

#### 1.3 验证
```bash
python validate_models.py --image screenshot.png
```

**输出：**
- `C:\Users\<user>\.core_node\pytools\tmp\model_validation\validation_*.png`

---

### Namespace 2: Detection (大图检测)

#### 2.1 准备数据

**第一步：生成小图** (如果还没有)
```bash
python scripts/prepare_progressbar_training.py \
  --image screenshot.png \
  --coords "x1,y1,x2,y2" \
  --output .cache/training_data/source/progress_bar \
  --augment 30 \
  --negatives 150
```

**第二步：生成大图检测数据** (将小图贴回大图)
```bash
python scripts/prepare_detection_training.py \
  --small-images .cache/training_data/source/progress_bar \
  --backgrounds screenshot1.png screenshot2.png screenshot3.png \
  --output .cache/training_data/detection/progress_bar \
  --namespace progress_bar_det \
  --num-images 200 \
  --objects-per-image 3 8 \
  --allow-rotation \
  --allow-stretch 0.8 1.2 \
  --allow-shrink 0.7 1.0
```

**参数说明：**
- `--small-images`: 小图目录 (包含yes/no子目录)
- `--backgrounds`: 背景大图 (可以多张)
- `--namespace`: 命名空间 (用于区分不同项目)
- `--num-images`: 生成多少张训练图
- `--objects-per-image`: 每张图贴多少个对象 (最小 最大)
- `--allow-rotation`: 是否允许随机旋转
- `--allow-stretch`: 是否允许拉伸 (改变宽高比)
- `--allow-shrink`: 是否允许缩小 (保持宽高比)

**输出：**
- `.cache/training_data/detection/progress_bar/images/train/*.png` - 训练大图
- `.cache/training_data/detection/progress_bar/images/val/*.png` - 验证大图
- `.cache/training_data/detection/progress_bar/labels/train/*.txt` - YOLO标注
- `.cache/training_data/detection/progress_bar/labels/val/*.txt` - YOLO标注
- `.cache/training_data/detection/progress_bar/data.yaml` - YOLO配置
- `.cache/training_data/detection/progress_bar/metadata.json` - 元数据

#### 2.2 训练
```bash
python train_detection.py
```

**可选参数：**
```bash
python train_detection.py --epochs 150 --batch 32 --img-size 1280
```

**输出：**
- `d4_modules_detection/progress_bar_det_detector.pt` - 检测模型
- `d4_modules_detection/progress_bar_det_detector.json` - 元数据
- `d4_modules_detection/model_registry.json` - 模型注册表

#### 2.3 验证
```bash
# 直接传图，无需--image参数
python validate_detection.py screenshot.png

# 多张图
python validate_detection.py image1.png image2.png image3.png

# 调整置信度
python validate_detection.py screenshot.png --conf 0.3 --iou 0.5
```

**输出：**
- `C:\Users\<user>\.core_node\pytools\tmp\detection_validation\detection_*.png`

---

## 📁 完整目录结构

```
apps/d3-check/
├── scripts/
│   ├── prepare_progressbar_training.py    # 准备小图数据
│   └── prepare_detection_training.py      # 准备大图检测数据 (NEW)
│
├── .cache/training_data/
│   ├── source/                            # Classification命名空间
│   │   └── progress_bar/
│   │       ├── yes/                       # 正样本小图
│   │       └── no/                        # 负样本小图
│   │
│   └── detection/                         # Detection命名空间 (NEW)
│       └── progress_bar/
│           ├── images/
│           │   ├── train/                 # 训练大图
│           │   └── val/                   # 验证大图
│           ├── labels/
│           │   ├── train/                 # YOLO标注 (.txt)
│           │   └── val/
│           ├── data.yaml                  # YOLO配置
│           └── metadata.json              # 生成元数据
│
├── d4_modules/                            # Classification模型
│   ├── model_registry.json
│   ├── progress_bar_detector.pt
│   └── progress_bar_detector.json
│
├── d4_modules_detection/                  # Detection模型 (NEW)
│   ├── model_registry.json
│   ├── progress_bar_det_detector.pt
│   └── progress_bar_det_detector.json
│
├── train.py                               # Classification训练
├── train_detection.py                     # Detection训练 (NEW)
├── validate_models.py                     # Classification验证
└── validate_detection.py                  # Detection验证 (NEW)
```

---

## 🎨 数据生成详解

### prepare_detection_training.py 工作原理

1. **加载小图**
   - 从 `--small-images` 目录加载 yes/no 图片

2. **随机变换**
   - **旋转** (`--allow-rotation`): ±15度随机旋转
   - **拉伸** (`--allow-stretch 0.8 1.2`): 宽度和高度独立缩放 0.8-1.2倍
   - **缩小** (`--allow-shrink 0.7 1.0`): 整体均匀缩放 0.7-1.0倍

3. **贴回大图**
   - 随机选择背景图
   - 随机选择 yes/no 小图
   - 应用变换
   - 随机位置粘贴到背景上
   - 记录YOLO格式坐标

4. **生成标注**
   - YOLO格式：`class_id center_x center_y width height`
   - 坐标归一化到 0-1
   - class_id: 0=no, 1=yes

### YOLO标注格式示例

```
# progress_bar_det_00001.txt
1 0.523456 0.345678 0.123456 0.034567
0 0.789012 0.678901 0.098765 0.045678
1 0.234567 0.890123 0.111111 0.033333
```

每行表示一个对象：
- `1` = class_id (yes)
- `0.523456` = 归一化的中心点x坐标
- `0.345678` = 归一化的中心点y坐标
- `0.123456` = 归一化的宽度
- `0.034567` = 归一化的高度

---

## 🔧 完整工作流示例

### 场景：训练进度条检测器

#### Step 1: 准备小图数据
```bash
python scripts/prepare_progressbar_training.py \
  --image .cache/d4_exp_farming_20251016_031749_166.png \
  --coords "1452,352,1708,375" "1457,355,1703,371" \
  --output .cache/training_data/source/progress_bar \
  --augment 30 \
  --negatives 150
```

✅ 输出：62个yes小图，150个no小图

#### Step 2a: 训练Classification模型 (可选)
```bash
python train.py
```

✅ 输出：`d4_modules/progress_bar_detector.pt`

#### Step 2b: 生成Detection训练数据
```bash
python scripts/prepare_detection_training.py \
  --small-images .cache/training_data/source/progress_bar \
  --backgrounds .cache/*.png \
  --output .cache/training_data/detection/progress_bar \
  --namespace progress_bar_det \
  --num-images 200 \
  --objects-per-image 3 8 \
  --allow-rotation \
  --allow-stretch 0.8 1.2 \
  --allow-shrink 0.8 1.0
```

✅ 输出：200张大图 (160 train, 40 val) + YOLO标注

#### Step 3: 训练Detection模型
```bash
python train_detection.py --epochs 100 --batch 16
```

✅ 输出：`d4_modules_detection/progress_bar_det_detector.pt`

#### Step 4a: 验证Classification模型
```bash
python validate_models.py --image test_screenshot.png
```

#### Step 4b: 验证Detection模型
```bash
python validate_detection.py test_screenshot.png --conf 0.3
```

---

## 📊 性能对比

### 实际测试结果 (1920x1080 图片)

| 模型类型 | 推理时间 | 精确度 | 适用场景 |
|---------|---------|--------|---------|
| **Classification** | ~2-5秒 (滑动窗口) | 窗口级 | 固定尺寸、位置固定 |
| **Detection** | ~50-200ms (一次推理) | 像素级 | 多尺度、位置不固定 |

**推荐：**
- 游戏实时检测 → **Detection模型**
- 简单固定UI → Classification模型

---

## 🎯 选择哪个命名空间？

### 使用 Classification (small) 如果：
- ✅ UI元素尺寸固定
- ✅ 位置相对固定
- ✅ 只需要简单的是/否判断
- ✅ 不需要实时性能

### 使用 Detection (large) 如果：
- ✅ UI元素尺寸变化
- ✅ 位置不固定
- ✅ 需要精确坐标
- ✅ 需要实时性能 (游戏宏)
- ✅ 需要同时检测多个对象

---

## 📝 常见问题

### Q1: 两个命名空间可以同时使用吗？

**A:** 可以！它们完全独立：
- Classification模型保存在 `d4_modules/`
- Detection模型保存在 `d4_modules_detection/`
- 可以同时训练和使用两种模型

### Q2: 如何为不同项目创建多个检测模型？

**A:** 使用不同的namespace：
```bash
# 进度条
python scripts/prepare_detection_training.py \
  --namespace progress_bar_det ...

# 生命球
python scripts/prepare_detection_training.py \
  --namespace health_orb_det ...

# 然后一起训练
python train_detection.py
```

### Q3: 变换参数如何选择？

**A:** 根据目标对象特性：
- **进度条**: 允许拉伸 (长度变化)，不旋转
  ```bash
  --allow-stretch 0.8 1.2
  ```

- **技能图标**: 允许缩小，可能旋转
  ```bash
  --allow-shrink 0.8 1.0 --allow-rotation
  ```

- **文字**: 只允许缩小，不旋转不拉伸
  ```bash
  --allow-shrink 0.9 1.0
  ```

### Q4: 需要多少训练数据？

**A:**
- **Classification**: 100-300个小图样本
- **Detection**: 100-300张大图 (每张3-8个对象 = 300-2400个标注)

### Q5: 验证输出在哪里？

**A:**
- **Classification**: `C:\Users\<user>\.core_node\pytools\tmp\model_validation\`
- **Detection**: `C:\Users\<user>\.core_node\pytools\tmp\detection_validation\`

---

## 🔑 关键命令速查

```bash
# === Classification命名空间 ===

# 1. 准备小图
python scripts/prepare_progressbar_training.py \
  --image <image> --coords "<coords>" \
  --output .cache/training_data/source/<category>

# 2. 训练
python train.py

# 3. 验证
python validate_models.py --image <image>

# === Detection命名空间 ===

# 1. 准备小图 (同上)
python scripts/prepare_progressbar_training.py ...

# 2. 生成大图检测数据
python scripts/prepare_detection_training.py \
  --small-images .cache/training_data/source/<category> \
  --backgrounds <images> \
  --output .cache/training_data/detection/<category> \
  --namespace <namespace> \
  --num-images 200 \
  --objects-per-image 3 8 \
  --allow-rotation \
  --allow-stretch 0.8 1.2 \
  --allow-shrink 0.8 1.0

# 3. 训练
python train_detection.py

# 4. 验证
python validate_detection.py <image>
```

---

## 🎉 总结

✅ **双命名空间系统已完成：**
1. **Classification** - 原有的小图分类系统（保持不变）
2. **Detection** - 新的大图检测系统（贴回小图训练）

✅ **核心特性：**
- 完全独立的两套系统
- 支持随机旋转、拉伸、缩小
- YOLO标准格式
- 自动化训练流程
- 直接传图验证

✅ **推荐使用：**
- 🎮 游戏实时检测 → **Detection模型**
- 📊 简单UI识别 → Classification模型

**开始训练吧！** 🚀
