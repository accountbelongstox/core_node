# 🚀 快速开始指南

## 统一训练入口

只需运行一个命令：

```bash
python train_all.py
```

然后选择菜单：

```
================================================================================
🎯 D4 Object Detection Training System
================================================================================

请选择训练模式：

1. 训练小图分类模型 (Classification)
   - 使用切好的小图训练
   - 验证时使用滑动窗口
   - 适合固定尺寸的UI元素
   - 模型保存到: d4_modules/

2. 训练大图检测模型 (Detection)
   - 将小图贴回大图训练
   - 验证时直接检测
   - 适合多尺度、实时检测
   - 模型保存到: d4_modules_detection/

3. 两个都训练
   - 同时训练分类和检测模型

0. 退出

================================================================================
请输入选项 (0-3):
```

---

## 完整工作流

### 1. 准备小图数据

```bash
python scripts/prepare_progressbar_training.py \
  --image screenshot.png \
  --coords "x1,y1,x2,y2" \
  --output .cache/training_data/source/progress_bar \
  --augment 30 \
  --negatives 150
```

### 2. (可选) 生成大图检测数据

如果要训练检测模型，需要先生成大图数据：

```bash
python scripts/prepare_detection_training.py \
  --small-images .cache/training_data/source/progress_bar \
  --backgrounds screenshot1.png screenshot2.png \
  --output .cache/training_data/detection/progress_bar \
  --namespace progress_bar_det \
  --num-images 200 \
  --objects-per-image 3 8 \
  --allow-rotation \
  --allow-stretch 0.8 1.2 \
  --allow-shrink 0.8 1.0
```

### 3. 训练模型

```bash
python train_all.py
```

选择对应的选项即可！

---

## 验证模型

### 分类模型验证

```bash
python validate_models.py --image screenshot.png
```

### 检测模型验证

```bash
python validate_detection.py screenshot.png
```

---

## 文件结构

```
apps/d3-check/
├── train_all.py                 ← 统一入口
├── train.py                     ← 分类模型训练 (被train_all.py调用)
├── train_detection.py           ← 检测模型训练 (被train_all.py调用)
├── validate_models.py           ← 分类模型验证
├── validate_detection.py        ← 检测模型验证
├── scripts/
│   ├── prepare_progressbar_training.py    ← 准备小图
│   └── prepare_detection_training.py      ← 准备大图检测数据
├── d4_modules/                  ← 分类模型
└── d4_modules_detection/        ← 检测模型
```

---

## 快速测试

```bash
# 1. 准备数据
python scripts/prepare_progressbar_training.py \
  --image .cache/d4_exp_farming_20251016_031749_166.png \
  --coords "1452,352,1708,375" "1457,355,1703,371" \
  --output .cache/training_data/source/progress_bar

# 2. 训练
python train_all.py
# 选择 1 (小图分类) 或 2 (大图检测) 或 3 (都训练)

# 3. 验证
python validate_models.py --image screenshot.png
# 或
python validate_detection.py screenshot.png
```

就这么简单！🎉
