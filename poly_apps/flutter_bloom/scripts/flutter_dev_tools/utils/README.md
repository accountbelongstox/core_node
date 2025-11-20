# Flutter Dev Tools - Utilities

工具模块集合，用于支持 Flutter 开发工具的各项功能。

## design_structure_auto_expand.py

**功能**: 自动扩展设计文档三层结构

### 三层结构

1. **第一层 - 概念图** (`1_concept_designs/`)
   - 架构设计、用户流程、数据模型
   - 宏观设计，不涉及具体页面

2. **第二层 - 粗页面图** (`2_page_designs_cn/`)
   - 中文页面名称（如：首页设计.md）
   - 页面功能、布局、交互说明

3. **第三层 - 细页面图** (`3_page_designs_en/`)
   - 英文页面名称（如：home_page/）
   - 包含 `pageview_map.json`（UI元素映射）
   - 与 Flutter 代码一一对应

### 自动扩展机制

**触发时机**: 启动 `design_doc_tool` 时自动执行

**行为**:
- 检查所有应用的设计文档结构
- 创建缺失的目录和文件
- 跳过已存在的文件（不覆盖）
- 生成带注释的模板文件

### 手动使用

```bash
# 为单个应用扩展结构
python -m poly_apps.flutter_bloom.scripts.flutter_dev_tools.utils.design_structure_auto_expand app_main

# 为所有应用扩展结构（不带参数）
python -m poly_apps.flutter_bloom.scripts.flutter_dev_tools.utils.design_structure_auto_expand
```

### Python API

```python
from utils.design_structure_auto_expand import ensure_design_structure

# 为指定应用确保设计文档结构
ensure_design_structure("app_main")

# 为所有应用确保设计文档结构
from utils.design_structure_auto_expand import ensure_all_apps_design_structure
results = ensure_all_apps_design_structure()
```

## 更多文档

完整设计说明: `doc/DESIGN_DOCS_STRUCTURE.md`
