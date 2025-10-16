# 训练系统总结

## 📋 系统架构

### 核心组件
1. **train.py** - 自动训练系统（唯一的训练脚本）
   - 自动扫描所有项目
   - 自动训练所有项目
   - 生成模型注册表

2. **validate_models.py** - 模型验证脚本
   - 读取模型注册表
   - 滑动窗口检测
   - 标注结果并输出

3. **scripts/prepare_progressbar_training.py** - 数据准备脚本
   - 从坐标提取正样本
   - 生成负样本
   - 数据增强

### 目录结构
```
d3-check/
├── train.py                 ← 唯一训练入口
├── validate_models.py
├── scripts/
│   └── prepare_progressbar_training.py
├── .cache/training_data/
│   └── source/
│       ├── progress_bar/    ← 训练项目
│       │   ├── yes/
│       │   └── no/
│       └── ...
└── d4_modules/              ← 输出目录
    ├── model_registry.json  ← 模型注册表
    ├── *_detector.pt
    └── *_detector.json
```

## 🚀 使用流程

### 1. 准备数据
```bash
python scripts/prepare_progressbar_training.py \
  --image screenshot.png \
  --coords "x1,y1,x2,y2" \
  --output .cache/training_data/source/项目名
```

### 2. 训练所有项目
```bash
python train.py
```
自动：
- 扫描所有项目
- 检测硬件
- 训练所有项目
- 保存到 d4_modules/
- 生成 model_registry.json

### 3. 验证
```bash
python validate_models.py --image screenshot.png
```
输出到：`C:\Users\<user>\.core_node\pytools\tmp\model_validation\`

## 📦 输出文件

### model_registry.json
```json
{
  "registry_version": "1.0",
  "created_at": "...",
  "models": [
    {
      "model_name": "progress_bar_detector",
      "category": "progress_bar",
      "img_size": {"width": 76, "height": 23},
      "samples": {"positive": 62, "negative": 150}
    }
  ]
}
```

### 单个模型元数据
- `progress_bar_detector.pt` - 模型文件
- `progress_bar_detector.json` - 元数据

## 🔑 关键特性

1. **自动化** - 无需参数，自动训练所有项目
2. **智能硬件检测** - 自动使用 GPU/CPU
3. **元数据管理** - 自动生成 JSON 注册表
4. **验证集成** - 一键验证所有模型
5. **输出标准化** - 统一保存到 d4_modules/

## 📝 最简使用

```bash
# 1. 准备数据
python scripts/prepare_progressbar_training.py \
  --image .cache/d4_exp_farming_20251016_031749_166.png \
  --coords "1452,352,1708,375" "1457,355,1703,371" \
  --output .cache/training_data/source/progress_bar

# 2. 训练
python train.py

# 3. 验证
python validate_models.py --image screenshot.png
```

就这样！✅
