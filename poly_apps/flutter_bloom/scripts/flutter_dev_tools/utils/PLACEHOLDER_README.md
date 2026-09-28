# 智能占位图管理系统

## 功能概述

自动管理设计图占位图，提醒开发者放置实际设计图，并在有实际图片时自动清理。

## 核心特性

### 1. 自动生成

当 `images/` 目录为空时，自动生成 `_placeholder.png`：

```
1_concept_designs/
└── images/
    ├── _placeholder.png    # 自动生成
    └── README.md           # 自动生成
```

### 2. 自动清理

当开发者添加实际图片后，占位图自动删除：

```
1_concept_designs/
└── images/
    ├── architecture.png    # 开发者添加
    └── README.md           # 保留
    # _placeholder.png 已自动删除
```

### 3. 智能重生成

当实际图片被删除后，占位图重新生成：

```bash
# 删除实际图片
rm images/architecture.png

# 再次运行自动扩展
python -m poly_apps.flutter_bloom.scripts.flutter_dev_tools.utils.design_structure_auto_expand app_main

# 结果：_placeholder.png 重新生成
```

## 占位图内容

占位图包含以下信息：

```
┌──────────────────────────────────────┐
│ 📐 Design Images Placeholder         │
│                                      │
│ Directory: 1_concept_designs/images  │
│                                      │
│ Please place your design images here │
│                                      │
│ Supported formats: PNG, JPG, SVG     │
│                                      │
│ ⚠️ This placeholder will be          │
│    auto-removed when actual images   │
│    are added                         │
└──────────────────────────────────────┘
```

## 使用场景

### 场景 1：新项目初始化

```bash
# 运行自动扩展
python -m poly_apps.flutter_bloom.scripts.flutter_dev_tools.utils.design_structure_auto_expand app_main

# 结果：所有 images/ 目录都生成占位图
# - 1_concept_designs/images/_placeholder.png
# - 2_page_designs_cn/images/_placeholder.png
# - 3_page_designs_en/home_page/images/_placeholder.png
```

### 场景 2：添加设计图

```bash
# 开发者添加实际设计图
cp my_design.png poly_apps/flutter_bloom/lib/apps/app_main/design_docs_and_progress/1_concept_designs/images/architecture.png

# 再次运行（或启动 design_doc_tool）
python -m poly_apps.flutter_bloom.scripts.flutter_dev_tools.utils.design_structure_auto_expand app_main

# 结果：_placeholder.png 自动删除
```

### 场景 3：启动设计文档工具

```bash
# 启动设计文档工具（自动管理占位图）
python -m poly_apps.flutter_bloom.scripts.flutter_dev_tools.design_doc_tool

# 输出：
# [AutoExpand] Ensuring design document structure for all apps...
# [PlaceholderGen] Generated: .../1_concept_designs/images/_placeholder.png
# [PlaceholderCleanup] Removed: .../2_page_designs_cn/images/_placeholder.png
# [AutoExpand] Processed 9/9 apps
```

## 技术细节

### 占位图检测逻辑

```python
def manage_placeholder(images_dir: Path, directory_label: str = ""):
    """管理占位图"""
    # 获取实际图片（排除占位图）
    actual_images = get_actual_images(images_dir)

    if len(actual_images) == 0:
        # 无实际图片，生成占位图
        if not placeholder.exists():
            generate_placeholder(placeholder, directory_label)
    else:
        # 有实际图片，删除占位图
        if placeholder.exists():
            remove_placeholder(images_dir)
```

### 实际图片判定

支持的图片格式：
- `.png`
- `.jpg` / `.jpeg`
- `.svg`
- `.gif`
- `.webp`

排除文件：
- `_placeholder.png` - 占位图本身
- 非图片文件（如 README.md）

### README.md 保留

即使占位图被删除，`images/README.md` 仍会保留占位图说明：

```markdown
## 占位图机制

- **文件名**: `_placeholder.png`
- **说明**: 当目录为空时自动生成
- **清理**: 当有实际图片时会自动删除
```

## 与 Markdown 集成

### 在文档中引用图片

```markdown
# architecture.md

## 整体架构

![架构图](images/architecture.png)

<!-- 占位图：images/_placeholder.png（自动管理）
     建议放置：
     - architecture.png: 架构图
     - user_flow.png: 用户流程图
-->
```

### 注释规范

即使占位图被清理，注释也会保留，说明占位图机制：

```markdown
<!-- 设计图片目录：images/
     占位图：_placeholder.png（当目录为空时自动生成，有实际图片时自动清理）

     建议放置的图片：
     - wireframe.png: 线框图
     - mockup.png: 高保真效果图
     - components.png: 组件标注图
-->
```

## API 使用

### 命令行

```bash
# 为单个应用管理占位图
python -m poly_apps.flutter_bloom.scripts.flutter_dev_tools.utils.design_structure_auto_expand app_main

# 为所有应用管理占位图
python -m poly_apps.flutter_bloom.scripts.flutter_dev_tools.utils.design_structure_auto_expand
```

### Python API

```python
from utils.placeholder_generator import manage_placeholder, ensure_images_readme

# 管理单个目录的占位图
images_dir = Path("path/to/images")
manage_placeholder(images_dir, "1_concept_designs/images")

# 确保 images/README.md 存在
ensure_images_readme(images_dir, "1_concept_designs")
```

## 文件结构示例

### 初始状态（无实际图片）

```
1_concept_designs/
└── images/
    ├── _placeholder.png    # 自动生成
    └── README.md           # 自动生成
```

### 有实际图片

```
1_concept_designs/
└── images/
    ├── architecture.png    # 开发者添加
    ├── user_flow.png       # 开发者添加
    └── README.md           # 保留
    # _placeholder.png 已删除
```

## 优势

- ✅ **提醒机制**: 占位图提醒开发者放置设计图
- ✅ **自动清理**: 有实际图片时自动清理，保持目录整洁
- ✅ **智能重生成**: 图片删除后重新生成占位图
- ✅ **注释保留**: README 中保留占位图说明
- ✅ **零配置**: 启动时自动运行，无需手动管理

## 相关文档

- **设计文档结构**: `doc/DESIGN_DOCS_STRUCTURE.md`
- **图片放置规范**: `doc/DESIGN_IMAGES_PLACEMENT.md`
- **自动扩展机制**: `design_structure_auto_expand.py`
- **占位图生成器**: `placeholder_generator.py`

## 测试

### 测试占位图生成

```bash
# 1. 生成占位图
python -m poly_apps.flutter_bloom.scripts.flutter_dev_tools.utils.design_structure_auto_expand app_example

# 2. 检查占位图
ls poly_apps/flutter_bloom/lib/apps/app_example/design_docs_and_progress/1_concept_designs/images/
# 输出：_placeholder.png  README.md
```

### 测试占位图清理

```bash
# 1. 添加实际图片
echo "test" > poly_apps/flutter_bloom/lib/apps/app_example/design_docs_and_progress/1_concept_designs/images/arch.png

# 2. 再次运行
python -m poly_apps.flutter_bloom.scripts.flutter_dev_tools.utils.design_structure_auto_expand app_example

# 3. 检查结果
ls poly_apps/flutter_bloom/lib/apps/app_example/design_docs_and_progress/1_concept_designs/images/
# 输出：arch.png  README.md
# _placeholder.png 已删除
```

### 测试占位图重生成

```bash
# 1. 删除实际图片
rm poly_apps/flutter_bloom/lib/apps/app_example/design_docs_and_progress/1_concept_designs/images/arch.png

# 2. 再次运行
python -m poly_apps.flutter_bloom.scripts.flutter_dev_tools.utils.design_structure_auto_expand app_example

# 3. 检查结果
ls poly_apps/flutter_bloom/lib/apps/app_example/design_docs_and_progress/1_concept_designs/images/
# 输出：_placeholder.png  README.md
# 占位图重新生成
```

## 故障排除

### 占位图未生成

**原因**: PIL 库未安装

**解决**: 安装 Pillow
```bash
pip install Pillow
```

**后果**: 如果没有 PIL，会生成文本占位符 `_placeholder.txt`

### 占位图未清理

**原因**: 实际图片格式不在支持列表中

**解决**: 确保图片格式为 PNG, JPG, SVG, GIF 或 WebP

### README.md 缺失

**原因**: 自动生成失败

**解决**: 手动运行
```python
from utils.placeholder_generator import ensure_images_readme
ensure_images_readme(Path("path/to/images"), "layer_name")
```
