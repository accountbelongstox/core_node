# 训练时间戳命名空间使用指南

## 概述

训练系统现在支持**自动时间戳命名空间**，每次训练都会生成唯一的模型目录，防止覆盖已有模型。

## 主要特性

### 1. 自动时间戳命名

每次训练时，系统会自动生成带时间戳的模型名称：

```
unified_model_20251017_143052
unified_model_20251017_145623
unified_model_20251017_150145
```

格式：`unified_model_YYYYMMDD_HHMMSS`

### 2. 自定义命名

您也可以指定自定义名称：

```python
# 在代码中
trainer.train(name="my_custom_model_v1")

# 通过命令行（暂未实现，需要修改 train.py）
python train.py --mode detection --name "my_model_v1"
```

### 3. 模型目录结构

```
.cache/training_data/3_models/
├── classification/
│   ├── unified_model_20251017_143052/
│   │   ├── weights/
│   │   │   ├── best.pt
│   │   │   └── last.pt
│   │   ├── args.yaml
│   │   └── results.csv
│   ├── unified_model_20251017_145623/
│   │   └── ...
│   └── unified_model_20251017_150145/
│       └── ...
└── detection/
    ├── unified_model_20251017_143052/
    ├── unified_model_20251017_145623/
    └── unified_model_20251017_150145/
```

## 验证系统多模型支持

### 自动模式（使用所有模型）

```bash
# 自动使用所有找到的模型
python validate.py screenshot.png
```

### 交互式模式（手动选择模型）

```bash
# 启用交互式菜单选择模型
python validate.py screenshot.png --interactive
# 或
python validate.py screenshot.png -i
```

#### 交互式菜单示例

```
================================================================================
📦 Scanning Classification Models
================================================================================

✓ Loaded: unified_model_20251017_150145 (Classification)
   Model: D:\...\classification\unified_model_20251017_150145\weights\best.pt
   Created: 2025-10-17 15:01:45
   Window size: 76x76

✓ Loaded: unified_model_20251017_145623 (Classification)
   Model: D:\...\classification\unified_model_20251017_145623\weights\best.pt
   Created: 2025-10-17 14:56:23
   Window size: 76x76

✅ Found 2 classification model(s)

================================================================================
📦 Scanning Detection Models
================================================================================

✓ Loaded: unified_model_20251017_150145 (Detection)
   Model: D:\...\detection\unified_model_20251017_150145\weights\best.pt
   Created: 2025-10-17 15:01:45
   Classes: cancel_button, confirm_button, progress_bar

✅ Found 1 detection model(s)

================================================================================
📋 Model Selection Menu
================================================================================

📦 Classification Models (2 found):
  1. unified_model_20251017_150145
     Created: 2025-10-17 15:01:45
     Path: D:\...\classification\unified_model_20251017_150145\weights\best.pt
  2. unified_model_20251017_145623
     Created: 2025-10-17 14:56:23
     Path: D:\...\classification\unified_model_20251017_145623\weights\best.pt

Select classification models (comma-separated, e.g., 1,2,3)
Or press Enter to select all, or 'n' to skip:
Selection: 1

Selected 1 classification model(s)

📦 Detection Models (1 found):
  1. unified_model_20251017_150145
     Created: 2025-10-17 15:01:45
     Classes: cancel_button, confirm_button, progress_bar
     Path: D:\...\detection\unified_model_20251017_150145\weights\best.pt

Select detection models (comma-separated, e.g., 1,2,3)
Or press Enter to select all, or 'n' to skip:
Selection:

Selected all 1 detection model(s)
```

## 选择模型的方式

### 1. 选择单个模型
```
Selection: 1
```

### 2. 选择多个模型
```
Selection: 1,3,5
```

### 3. 选择所有模型
```
Selection: [直接按 Enter]
```

### 4. 跳过此类型模型
```
Selection: n
```

## 模型排序

模型按**创建时间倒序**排列（最新的在最前面），方便您快速选择最新训练的模型。

## 实现细节

### 1. Trainer 修改

#### Classification Trainer
```python
def train(
    self,
    epochs: int = 100,
    batch_size: int = 8,
    imgsz: int = 76,
    device: str = None,
    patience: int = 50,
    name: str = None,  # ← 新增参数
    **kwargs
) -> Any:
    from datetime import datetime

    # 自动生成时间戳名称
    if name is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        name = f"unified_model_{timestamp}"

    # 使用 Ultralytics 官方结构: project/name
    results = model.train(
        data=str(self.processed_dir),
        epochs=epochs,
        project=str(self.model_output_dir.parent),
        name=name,  # ← 使用时间戳名称
        exist_ok=True,
        **kwargs
    )
```

#### Detection Trainer
完全相同的实现逻辑。

### 2. Validator 修改

#### 扫描所有模型
```python
def scan_classification_models(self) -> bool:
    # 扫描所有子目录
    for model_dir in self.classification_dir.iterdir():
        if not model_dir.is_dir():
            continue

        best_pt = model_dir / "weights" / "best.pt"
        if best_pt.exists():
            # 加载模型
            model = YOLO(str(best_pt))

            # 获取创建时间
            mtime = best_pt.stat().st_mtime
            mtime_str = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(mtime))

            self.classification_models[model_dir.name] = {
                'model': model,
                'path': best_pt,
                'mtime': mtime,
                'mtime_str': mtime_str,
                ...
            }
```

#### 交互式选择
```python
def select_models_interactive(self) -> tuple:
    # 按时间倒序排列
    sorted_cls = sorted(
        self.classification_models.items(),
        key=lambda x: x[1]['mtime'],
        reverse=True  # 最新的在前面
    )

    # 显示菜单
    for idx, (name, info) in enumerate(sorted_cls, 1):
        print(f"  {idx}. {name}")
        print(f"     Created: {info['mtime_str']}")

    # 用户选择
    choice = input("Selection: ").strip()
    # ... 处理选择逻辑
```

## 常见问题

### Q1: 如何删除旧模型？

**A**: 直接删除模型目录即可：

```bash
# 删除旧的分类模型
rm -rf .cache/training_data/3_models/classification/unified_model_20251017_143052

# 删除旧的检测模型
rm -rf .cache/training_data/3_models/detection/unified_model_20251017_143052
```

### Q2: 如何使用特定模型？

**A**: 使用交互式模式选择：

```bash
python validate.py screenshot.png -i
```

然后在菜单中输入模型编号。

### Q3: 如何批量验证多张图片？

**A**:
```bash
# 使用所有模型验证多张图片
python validate.py img1.png img2.png img3.png

# 交互式选择模型验证多张图片
python validate.py img1.png img2.png img3.png -i
```

### Q4: 时间戳格式是什么？

**A**: `YYYYMMDD_HHMMSS`
- YYYY: 年份（4位）
- MM: 月份（2位）
- DD: 日期（2位）
- HH: 小时（24小时制，2位）
- MM: 分钟（2位）
- SS: 秒（2位）

示例: `20251017_143052` = 2025年10月17日 14:30:52

### Q5: 如何复制模型到特定目录？

**A**: 训练完成后，系统会显示模型路径：

```
SUCCESS: Unified detection model trained and saved
  Model directory: D:\...\detection\unified_model_20251017_150145
  Best weights:    D:\...\detection\unified_model_20251017_150145\weights\best.pt
```

您可以手动复制整个目录到需要的位置。

### Q6: 能否在训练前指定目录？

**A**: 可以通过 `name` 参数：

```python
trainer.train(name="production_model_v1")
```

这样会创建 `.cache/training_data/3_models/detection/production_model_v1/` 目录。

## 遵循 Ultralytics 官方结构

系统完全遵循 Ultralytics YOLO 的官方目录结构：

```python
model.train(
    data="dataset.yaml",
    project="path/to/models",  # 项目目录
    name="run_name",           # 运行名称
    exist_ok=True
)
```

生成的结构：
```
path/to/models/
└── run_name/
    ├── weights/
    │   ├── best.pt
    │   └── last.pt
    ├── args.yaml
    └── results.csv
```

## 最佳实践

1. **开发阶段**: 使用自动时间戳，快速迭代
2. **生产阶段**: 使用自定义名称，如 `production_v1`、`production_v2`
3. **定期清理**: 删除性能不佳的旧模型
4. **备份重要模型**: 复制到安全位置
5. **使用交互式模式**: 在有多个模型时方便选择

## 示例工作流

### 完整训练和验证流程

```bash
# 1. 训练模型（自动生成时间戳名称）
python train.py --mode detection

# 输出:
# SUCCESS: Unified detection model trained and saved
#   Model directory: .cache/training_data/3_models/detection/unified_model_20251017_150145
#   Best weights:    .cache/training_data/3_models/detection/unified_model_20251017_150145/weights/best.pt

# 2. 验证模型（自动使用所有模型）
python validate.py screenshot.png

# 3. 如果有多个模型，使用交互式选择
python validate.py screenshot.png -i

# 4. 验证多张图片
python validate.py img1.png img2.png img3.png -i
```

---

**最后更新**: 2025-10-17
**版本**: 1.0.0
