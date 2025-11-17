# DateTime Import修复
**Date**: 2025-11-18
**Status**: ✅ **FIXED**

---

## 问题

### 错误信息
```
[BaseModel] Failed to initialize table util_speech_tts_cache: name 'datetime' is not defined
```

### 根本原因
在 `pycore/database/models/util_speech/tts_cache_model.py` 的 `define_table_structure()` 方法中使用了 `datetime.utcnow`，但文件头部缺少 `datetime` 导入。

**问题代码**（第88-89行）:
```python
sqlalchemy.Column('created_at', sqlalchemy.DateTime, default=datetime.utcnow, nullable=False),
sqlalchemy.Column('last_accessed_at', sqlalchemy.DateTime, default=datetime.utcnow, nullable=False),
```

**缺失的导入**:
虽然基类 `SpeechCacheBaseModel` 导入了 `datetime`，但是导入的作用域只在基类文件中有效。当 `define_table_structure()` 方法被调用时，它在当前文件（`tts_cache_model.py`）的作用域中执行，因此需要在当前文件中导入 `datetime`。

---

## 修复

**修改文件**: `pycore/database/models/util_speech/tts_cache_model.py`

**修改位置**: 第7行（导入部分）

**修复前**:
```python
#!/usr/bin/env python3
"""
SpeechTTSCacheModel - Speech TTS cache lookup table.
"""

import hashlib
from typing import Optional, Dict, Any

from pycore.pyfoundations.third_party import get_third_package_sqlalchemy
```

**修复后**:
```python
#!/usr/bin/env python3
"""
SpeechTTSCacheModel - Speech TTS cache lookup table.
"""

import hashlib
from datetime import datetime  # 添加datetime导入
from typing import Optional, Dict, Any

from pycore.pyfoundations.third_party import get_third_package_sqlalchemy
```

---

## 相关检查

### 其他Cache模型检查结果

**`stt_cache_model.py`**: ✅ 不需要修复
- DateTime列没有使用 `datetime.utcnow` 作为默认值
- 第61-62行: `sqlalchemy.Column("created_at", sqlalchemy.DateTime, nullable=False)` (无default)

**`base_cache_model.py`**: ✅ 已有导入
- 第10行: `from datetime import datetime`
- 在类方法中使用 `datetime.utcnow()`，导入正确

---

## 为什么基类的导入不够？

### Python作用域规则

1. **基类导入的作用域**: `base_cache_model.py` 中的 `from datetime import datetime` 只在该文件的全局作用域中有效

2. **子类方法的作用域**: 当在 `tts_cache_model.py` 中定义 `define_table_structure()` 方法时，方法体内的代码在子类文件的作用域中执行

3. **SQLAlchemy的default参数**: `default=datetime.utcnow` 是将函数对象传递给SQLAlchemy，而不是调用它。SQLAlchemy后续会在自己的上下文中调用这个函数，此时如果当前文件没有导入 `datetime`，就会报错

### 示例说明

```python
# base_cache_model.py
from datetime import datetime

class SpeechCacheBaseModel:
    # datetime 在这里可用
    pass

# tts_cache_model.py (修复前)
class SpeechTTSCacheModel(SpeechCacheBaseModel):
    @classmethod
    def define_table_structure(cls, metadata):
        return sqlalchemy.Table(
            ...,
            sqlalchemy.Column('created_at', sqlalchemy.DateTime,
                            default=datetime.utcnow,  # ❌ datetime未定义在当前文件
                            nullable=False),
        )
```

---

## 测试验证

### 验证步骤
1. 启动应用: `python ./pymain.py app=spee`
2. 观察数据库初始化日志
3. 确认没有 `name 'datetime' is not defined` 错误

### 预期结果
```
[DatabaseManager] Registered database: speech
[DatabaseManager] Loaded tables: util_speech_tts_cache  ✅
[DatabaseManager] Loaded tables: util_speech_config  ✅
```

---

## 经验教训

### 1. 导入作用域的重要性
- 即使基类有导入，子类如果使用同样的模块也需要导入
- 不要依赖继承关系传递导入

### 2. SQLAlchemy default参数
- `default=callable` 传递的是函数对象引用
- 函数会在SQLAlchemy的上下文中被调用
- 必须确保函数引用在当前文件作用域中可用

### 3. 代码检查建议
- 使用静态分析工具（如 `pylint`, `mypy`）可以提前发现这类问题
- 建议在每个使用外部模块的文件中显式导入，避免隐式依赖

---

## 相关文件

### 修改的文件
1. **`pycore/database/models/util_speech/tts_cache_model.py`**
   - 添加 `from datetime import datetime` 导入

### 相关文件（无需修改）
1. **`pycore/database/models/util_speech/base_cache_model.py`** - 基类，已有正确导入
2. **`pycore/database/models/util_speech/stt_cache_model.py`** - 不使用datetime.utcnow

---

## 结论

**状态**: ✅ FIXED

**修复内容**: 在 `tts_cache_model.py` 中添加缺失的 `datetime` 导入

**影响**: 修复了TTS缓存表初始化失败的问题

**建议**: 定期运行静态代码分析工具检查导入问题

---

**修复完成**: 2025-11-18
**修复人员**: Claude Code Assistant
**文档版本**: 1.0
