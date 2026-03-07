# 备份与恢复

本目录存放修改前的类库备份，用于需要回滚时恢复。

## 备份文件

| 备份文件 | 恢复目标 | 说明 |
|----------|----------|------|
| `scaled_template_matcher_backup_20260201.py` | `d3utils/scaled_template_matcher.py` | 原 D3 通用 scale 类库（含 D4 模式） |
| `d4_scaled_template_matcher_backup_20260201.py` | `d4utils/d4_scaled_template_matcher.py` | 原 D4 专用 scale 类库 |

## 恢复方法

在项目根目录 `pyapps/d3-check` 下执行：

**恢复 D3 scale 类库：**
```powershell
Copy-Item "docs\backup\scaled_template_matcher_backup_20260201.py" "d3utils\scaled_template_matcher.py"
```

**恢复 D4 scale 类库：**
```powershell
Copy-Item "docs\backup\d4_scaled_template_matcher_backup_20260201.py" "d4utils\d4_scaled_template_matcher.py"
```

**同时恢复两者：**
```powershell
Copy-Item "docs\backup\scaled_template_matcher_backup_20260201.py" "d3utils\scaled_template_matcher.py"
Copy-Item "docs\backup\d4_scaled_template_matcher_backup_20260201.py" "d4utils\d4_scaled_template_matcher.py"
```

恢复后若存在 `d3utils/d3_scaled_template_matcher.py`，可删除或保留（向后兼容由 `scaled_template_matcher.py` 的 re-export 提供）；若 `scaled_template_matcher.py` 已改为仅 re-export，恢复备份会覆盖为完整旧实现。
