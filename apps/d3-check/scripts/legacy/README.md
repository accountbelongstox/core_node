# Legacy Scripts

这个目录包含旧版本的训练和验证脚本，已被统一入口替代。

## 已弃用的脚本

### 训练脚本

- **train_old.py** - 旧的自动训练系统
  - 使用旧的项目级别训练逻辑
  - 已被统一训练系统替代

- **train_detection.py** - 旧的检测模型训练脚本
  - 只训练检测模型
  - 已合并到统一训练入口

### 验证脚本

- **validate_detection.py** - 旧的检测模型验证脚本
  - 只验证检测模型
  - 已合并到统一验证入口

- **validate_models.py** - 旧的分类模型验证脚本
  - 只验证分类模型（使用滑动窗口）
  - 已合并到统一验证入口

## 新的统一入口

### 训练

```bash
# 根目录: train.py
python train.py --mode classification --epochs 100
python train.py --mode detection --epochs 100
python train.py --mode both --epochs 100
```

### 验证

```bash
# 根目录: validate.py
python validate.py screenshot.png
python validate.py image1.png image2.png --conf 0.3
```

## 迁移说明

如果您的脚本或文档引用了这些旧文件，请更新为使用新的统一入口：

| 旧文件 | 新入口 | 说明 |
|--------|--------|------|
| `train.py` (旧) | `train.py` (新) | 使用新的统一训练系统 |
| `train_all.py` | `train.py` | 已重命名 |
| `train_detection.py` | `train.py --mode detection` | 使用 --mode 参数 |
| `validate_detection.py` | `validate.py` | 自动检测所有模型 |
| `validate_models.py` | `validate.py` | 自动检测所有模型 |

---

**注意**：这些脚本保留仅供参考，不保证与当前系统兼容。
