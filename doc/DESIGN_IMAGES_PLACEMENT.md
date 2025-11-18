# 设计图片放置规范

## 概述

为设计文档提供清晰的图片组织规范，包括占位图自动管理机制。

## 图片目录结构

```
design_docs_and_progress/
├── 1_concept_designs/
│   └── images/                     # 概念设计图
│       ├── architecture.png        # 架构图
│       ├── user_flow.png          # 用户流程图
│       ├── data_model.png         # 数据模型图
│       └── _placeholder.png       # 占位图（自动生成/清理）
│
├── 2_page_designs_cn/
│   └── images/                     # 页面设计图（中文）
│       ├── 首页设计.png
│       ├── 个人中心设计.png
│       └── _placeholder.png       # 占位图（自动生成/清理）
│
└── 3_page_designs_en/
    ├── home_page/
    │   └── images/                 # 页面详细设计图
    │       ├── wireframe.png      # 线框图
    │       ├── mockup.png         # 效果图
    │       ├── components.png     # 组件标注图
    │       └── _placeholder.png   # 占位图（自动生成/清理）
    │
    └── profile_page/
        └── images/
            └── ...
```

## 占位图机制

### 占位图命名

- **文件名**: `_placeholder.png`
- **前缀**: `_` 表示系统生成文件
- **用途**: 提醒开发者放置实际设计图

### 自动管理规则

#### 生成规则

```python
# 条件：images/ 目录为空或只有占位图
if not images_dir.exists() or is_empty_or_only_placeholder(images_dir):
    generate_placeholder(images_dir / "_placeholder.png")
```

#### 清理规则

```python
# 条件：images/ 目录下有其他图片文件
if has_actual_images(images_dir):
    remove_placeholder(images_dir / "_placeholder.png")
    # 注意：README.md 中保留占位图说明
```

### 占位图内容

占位图包含以下信息：
- 提示文字："Please place design images here"
- 目录名称（如："1_concept_designs/images"）
- 尺寸：800x600 像素
- 背景：浅灰色 (#F0F0F0)
- 文字：深灰色 (#333333)

## 图片命名规范

### 概念设计层图片

```
1_concept_designs/images/
├── architecture.png              # 架构图
├── architecture_v2.png          # 架构图版本2（如有迭代）
├── user_flow_login.png          # 登录流程
├── user_flow_checkout.png       # 结账流程
└── data_model_v1.png            # 数据模型
```

**命名规则**:
- 使用 `snake_case`
- 描述性名称
- 版本号用 `_v1`, `_v2` 后缀

### 页面设计层图片（中文）

```
2_page_designs_cn/images/
├── 首页设计_v1.png
├── 首页设计_v2.png              # 迭代版本
├── 个人中心设计.png
└── 设置页面设计.png
```

**命名规则**:
- 与 Markdown 文件名对应
- 中文命名，便于识别
- 版本号用 `_v1`, `_v2` 后缀

### 细节设计层图片（英文）

```
3_page_designs_en/home_page/images/
├── wireframe.png                # 线框图（低保真）
├── wireframe_mobile.png         # 移动端线框图
├── wireframe_tablet.png         # 平板线框图
├── mockup.png                   # 效果图（高保真）
├── mockup_dark.png              # 深色模式效果图
├── components.png               # 组件标注图
└── interaction_flow.png         # 交互流程图
```

**命名规则**:
- 使用 `snake_case`
- 功能描述性名称
- 设备/模式用下划线分隔（如 `_mobile`, `_dark`）

## 图片文件格式

### 推荐格式

| 用途 | 格式 | 说明 |
|------|------|------|
| 线框图 | PNG | 透明背景，便于标注 |
| 效果图 | PNG/JPG | PNG用于透明背景，JPG用于照片级效果 |
| 流程图 | PNG/SVG | SVG可缩放，适合流程图 |
| 截图 | PNG | 无损压缩 |

### 尺寸建议

| 类型 | 推荐尺寸 |
|------|---------|
| 手机页面 | 375x812 (iPhone X) 或 360x640 (Android) |
| 平板页面 | 768x1024 (iPad) |
| 桌面页面 | 1920x1080 或 1440x900 |
| 流程图 | 不限（根据内容调整）|
| 组件图 | 根据实际组件尺寸 |

## Markdown 中引用图片

### 概念设计层

```markdown
# architecture.md

## 整体架构

![架构图](images/architecture.png)

<!-- 如果图片还未创建，占位图会自动生成在 images/_placeholder.png -->
```

### 页面设计层（中文）

```markdown
# 首页设计.md

## 页面效果

![首页设计效果图](images/首页设计_v2.png)

<!-- 占位图：images/_placeholder.png（当实际图片存在时会自动清理）-->
```

### 细节设计层（英文）

```markdown
# home_page/README.md

## Wireframe

![Home Page Wireframe](images/wireframe.png)

## High-Fidelity Mockup

![Home Page Mockup](images/mockup.png)

<!-- Placeholder: images/_placeholder.png (auto-removed when actual images exist) -->
```

## 占位图注释规范

### Markdown 文件中的注释

即使占位图被清理，也要保留注释说明：

```markdown
<!-- 设计图片目录：images/
     占位图：_placeholder.png（当目录为空时自动生成，有实际图片时自动清理）

     建议放置的图片：
     - wireframe.png: 线框图
     - mockup.png: 高保真效果图
     - components.png: 组件标注图
-->
```

### README.md 模板

每个 images/ 目录应有对应的 README.md 说明：

```markdown
# Images Directory

本目录用于存放设计图片。

## 占位图

- 文件名：`_placeholder.png`
- 说明：当目录为空时自动生成，提醒开发者放置实际设计图
- 清理：当有实际图片时会自动删除

## 建议放置的图片

根据设计需求，可放置以下类型的图片：
- 线框图（wireframe）
- 高保真效果图（mockup）
- 组件标注图（components）
- 交互流程图（interaction_flow）

## 命名规范

- 使用 snake_case 命名
- 描述性名称
- 版本号用 _v1, _v2 后缀
```

## 实现细节

### 占位图生成

```python
def generate_placeholder(image_path: Path, directory_name: str):
    """生成占位图"""
    from PIL import Image, ImageDraw, ImageFont

    # 创建图片
    img = Image.new('RGB', (800, 600), color='#F0F0F0')
    draw = ImageDraw.Draw(img)

    # 绘制文字
    text_lines = [
        "Please place design images here",
        f"Directory: {directory_name}",
        "",
        "This placeholder will be auto-removed",
        "when actual images are added"
    ]

    # 保存
    img.save(image_path)
```

### 占位图检测与清理

```python
def manage_placeholder(images_dir: Path):
    """管理占位图：生成或清理"""
    placeholder = images_dir / "_placeholder.png"

    # 获取实际图片（排除占位图）
    actual_images = [
        f for f in images_dir.glob("*")
        if f.is_file()
        and f.suffix.lower() in ['.png', '.jpg', '.jpeg', '.svg', '.gif']
        and f.name != "_placeholder.png"
    ]

    if len(actual_images) == 0:
        # 无实际图片，生成占位图
        if not placeholder.exists():
            generate_placeholder(placeholder, images_dir.name)
    else:
        # 有实际图片，删除占位图
        if placeholder.exists():
            placeholder.unlink()
            print(f"[Cleanup] Removed placeholder: {placeholder}")
```

## 工作流程示例

### 初始状态

```
home_page/
├── README.md
└── images/
    └── _placeholder.png    # 自动生成
```

### 添加设计图后

```
home_page/
├── README.md
└── images/
    ├── wireframe.png       # 开发者添加
    └── mockup.png          # 开发者添加
    # _placeholder.png 已自动删除
```

### README.md 中仍保留说明

```markdown
<!-- 占位图：_placeholder.png（已清理，当目录为空时会重新生成）-->
![Wireframe](images/wireframe.png)
```

## 总结

- ✅ 自动生成占位图提醒开发者
- ✅ 自动清理占位图避免混乱
- ✅ 保留注释说明占位图机制
- ✅ 统一的命名和组织规范
- ✅ 便于版本管理和协作
