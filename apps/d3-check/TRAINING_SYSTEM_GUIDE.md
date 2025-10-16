# 🎯 双命名空间训练系统完整指南

## 📋 系统架构

### 数据结构

```
.cache/training_data/
├── source/                          # 公共原始数据（两个模型共享）
│   └── progress_bar/
│       ├── d4_exp_farming_*.png     # 原始大图
│       └── metadata.json            # 坐标标注 + 配置
│
└── processed/                       # 处理后的训练数据
    ├── classification/              # 命名空间1：小图分类
    │   └── progress_bar/
    │       ├── yes/                 # 正样本（切好的小图）
    │       ├── no/                  # 负样本
    │       └── metadata.json        # 处理元数据
    │
    └── detection/                   # 命名空间2：大图检测
        └── progress_bar/
            ├── images/              # 合成大图（小图贴回）
            ├── labels/              # YOLO格式标注
            ├── data.yaml            # YOLO数据配置
            └── metadata.json        # 处理元数据
```

### 输出模型

```
d4_modules/
├── classification/                  # 分类模型输出
│   └── progress_bar/
│       └── best.pt
│
└── detection/                       # 检测模型输出
    └── progress_bar/
        └── best.pt
```

## 🚀 快速开始

### 唯一入口

```bash
python train_all.py
```

### 菜单选项

```
1. 训练小图分类模型 (Classification)
   - 使用切好的小图训练
   - 验证时使用滑动窗口
   - 适合固定尺寸的UI元素

2. 训练大图检测模型 (Detection)
   - 将小图贴回大图训练
   - 验证时直接检测
   - 适合多尺度、实时检测

3. 两个都训练
```

## 🔧 系统工作流程

### 自动数据准备

训练时系统会自动：

1. **检查数据** - 检查对应命名空间的processed数据是否存在
2. **自动生成** - 如果不存在，从source自动生成
3. **开始训练** - 使用生成的数据训练模型

### Classification 数据准备

从source自动生成：
- ✅ 提取正样本（yes/）
- ✅ 随机缩放（scale_range: 0.3-1.0）
- ✅ 颜色抖动
- ✅ 生成负样本（no/）

### Detection 数据准备

从source自动生成：
- ✅ 提取小图patch
- ✅ 随机贴回大图
- ✅ **更丰富的变换**：
  - 随机缩放（scale_range: 0.6-1.4）
  - 随机拉伸 X轴（stretch_x_range: 0.8-1.2）
  - 随机拉伸 Y轴（stretch_y_range: 0.9-1.1）
  - 随机旋转（rotation_range: -15°~15°）
- ✅ 生成YOLO标注

## ⚙️ 配置文件

`config/training_config.json`

```json
{
  "augmentation_params": {
    "classification": {
      "allow_rotation": false,
      "allow_stretch": false,
      "allow_scale": true,
      "scale_range": [0.3, 1.0],
      "color_jitter": true
    },
    "detection": {
      "allow_rotation": true,
      "rotation_range": [-15, 15],
      "allow_stretch": true,
      "stretch_x_range": [0.8, 1.2],
      "stretch_y_range": [0.9, 1.1],
      "allow_scale": true,
      "scale_range": [0.6, 1.4],
      "paste_per_image": [3, 8]
    }
  }
}
```

## 🎨 添加新项目

### 1. 准备原始数据

在 `.cache/training_data/source/<project_name>/` 创建：

**metadata.json**:
```json
{
  "source_image": "screenshot.png",
  "coordinates": [
    {"x1": 100, "y1": 200, "x2": 300, "y2": 220}
  ]
}
```

### 2. 更新配置

在 `config/training_config.json` 添加：

```json
{
  "projects": {
    "your_project": {
      "source_metadata": ".cache/training_data/source/your_project/metadata.json",
      "description": "Your project description"
    }
  }
}
```

### 3. 运行训练

```bash
python train_all.py
```

系统会自动准备数据并训练！

## 🔍 验证模型

### Classification 模型

```bash
python validate_models.py --image test.png
```

### Detection 模型

```bash
# 直接传图，无需--image参数
python validate_detection.py test1.png test2.png test3.png

# 调整置信度
python validate_detection.py test.png --conf 0.5
```

## 📊 关键差异对比

| 特性 | Classification | Detection |
|------|---------------|-----------|
| **输入数据** | 切好的小图 | 小图贴回大图 |
| **数据增强** | 缩放、颜色 | 缩放、拉伸、旋转 |
| **训练输出** | 分类模型 | 检测模型（带坐标） |
| **验证方式** | 滑动窗口 | 直接检测 |
| **适用场景** | 固定尺寸UI | 多尺度实时检测 |
| **处理速度** | 慢（遍历） | 快（一次推理） |
| **精确定位** | 否 | 是 |

## 🏗️ 技术架构

### 公共通用库 (`pycore/pyutils/`)

- `dataset_generator_yolo.py` - 数据生成器基类
  - `ClassificationDatasetGenerator`
  - `DetectionDatasetGenerator`
- `ultralytics_trainer.py` - YOLO训练器

### 项目特定控制器 (`d3-check/controller/training/`)

- `data_preparation_controller.py` - 使用公共库的控制器

### 设计原则

1. **公共库通用性** - 不引入项目特定依赖
2. **项目控制器** - 可以引用公共库
3. **单一数据源** - source目录为唯一真相来源
4. **自动化** - 自动检测、自动准备、自动训练
5. **配置驱动** - 所有参数在配置文件中

## 🛠️ 维护工具

### 重组数据结构

如果数据结构混乱，运行：

```bash
python scripts/reorganize_training_data.py
```

自动将：
- source中的yes/no移到processed/classification
- 复制原始大图到source
- 更新metadata.json

## 🎯 总结

✅ **统一入口**: `python train_all.py`
✅ **自动数据准备**: 懒惰生成，有数据跳过
✅ **双命名空间**: 分类vs检测，差异化增强
✅ **公共架构**: pycore通用，d3-check特定
✅ **配置驱动**: 参数可调，易于扩展

开始训练吧！🚀
