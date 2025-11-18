#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Design Structure Auto Expand - 设计文档结构自动扩展

自动创建和维护三层设计文档体系：
1. 概念图层 (1_concept_designs/)
2. 粗页面图层 (2_page_designs_cn/)
3. 细页面图层 (3_page_designs_en/)

功能：
- 启动时检查并创建缺失的文件夹和文件
- 跳过已存在的文件（不覆盖）
- 为每个文件夹生成 README.md 模板
- 更新必要的元数据字段
"""

import os
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional


# ============================================================
# 设计文档结构定义
# ============================================================

DESIGN_STRUCTURE = {
    "1_concept_designs": {
        "description": "第一层：概念图（粗设计图）- 宏观架构和流程设计",
        "files": {
            "README.md": "概念设计层说明文档",
            "architecture.md": "架构概念图",
            "user_flows.md": "用户流程概念",
            "data_model.md": "数据模型概念"
        }
    },
    "2_page_designs_cn": {
        "description": "第二层：粗页面图（中文页面名）- 页面级别设计",
        "files": {
            "README.md": "页面设计层说明文档",
            "示例_首页设计.md": "首页设计示例（可删除）",
            "示例_个人中心设计.md": "个人中心设计示例（可删除）"
        }
    },
    "3_page_designs_en": {
        "description": "第三层：细页面图（英文页面名）- 详细设计与代码映射",
        "subdirs": {
            "example_home_page": {
                "description": "示例：首页详细设计（可删除）",
                "files": {
                    "README.md": "页面说明",
                    "pageview_map.json": "UI元素映射",
                    "design_specs.md": "详细设计规格"
                }
            }
        },
        "files": {
            "README.md": "细节设计层说明文档"
        }
    }
}


# ============================================================
# 模板内容
# ============================================================

def get_readme_template(layer: str, app_name: str) -> str:
    """获取 README 模板内容"""
    timestamp = datetime.now().strftime("%Y-%m-%d")

    templates = {
        "root": f"""# Design Docs & Progress - {app_name}

**应用名称**: {app_name}
**创建时间**: {timestamp}
**最后更新**: {timestamp}

## 目录结构

```
design_docs_and_progress/
├── README.md                   # 本文件
├── 1_concept_designs/          # 第一层：概念图（粗设计图）
├── 2_page_designs_cn/          # 第二层：粗页面图（中文页面名）
├── 3_page_designs_en/          # 第三层：细页面图（英文页面名）
├── backend_bridge/             # 后端对接文档
├── feature_progress/           # 功能进度跟踪
├── flows/                      # 流程图
├── progress_logs/              # 进度日志
└── wireframes/                 # 线框图
```

## 三层设计文档体系

### 第一层：概念图 (1_concept_designs/)
- **用途**: 宏观概念设计，整体架构
- **内容**: 架构图、用户流程、数据模型

### 第二层：粗页面图 (2_page_designs_cn/)
- **用途**: 页面级别设计（中文命名）
- **内容**: 页面功能、布局草图、交互说明

### 第三层：细页面图 (3_page_designs_en/)
- **用途**: 详细设计（英文命名，与代码对应）
- **内容**: pageview_map.json、详细规格

## 使用流程

1. **概念阶段**: 在 `1_concept_designs/` 编写架构设计
2. **页面设计**: 在 `2_page_designs_cn/` 设计页面（中文）
3. **细化实现**: 在 `3_page_designs_en/` 创建详细设计
4. **代码开发**: 根据 pageview_map.json 实现组件

## 参考文档

完整说明请参考: `doc/DESIGN_DOCS_STRUCTURE.md`
""",

        "1_concept_designs": f"""# 概念设计层 - {app_name}

**层级**: 第一层 - 概念图（粗设计图）
**用途**: 宏观概念设计，不涉及具体页面细节

## 文件说明

- `architecture.md`: 整体架构设计（MVVM、数据流等）
- `user_flows.md`: 用户使用流程图
- `data_model.md`: 数据模型设计

## 设计原则

1. **架构清晰**: 分层明确，职责单一
2. **可扩展性**: 预留扩展空间
3. **性能优先**: 考虑性能优化方案

## 更新记录

- {timestamp}: 初始化概念设计层
""",

        "2_page_designs_cn": f"""# 页面设计层（中文）- {app_name}

**层级**: 第二层 - 粗页面图（中文页面名）
**用途**: 页面级别设计，使用中文方便理解

## 页面列表

（在此添加页面设计文件）

示例:
- `首页设计.md` - 应用首页
- `个人中心设计.md` - 用户个人中心
- `设置页面设计.md` - 应用设置页面

## 设计模板

每个页面设计文件应包含:
1. 页面功能描述
2. 布局结构
3. 主要交互
4. 对应英文页面名（用于第三层）

## 更新记录

- {timestamp}: 初始化页面设计层
""",

        "3_page_designs_en": f"""# 细节设计层（英文）- {app_name}

**层级**: 第三层 - 细页面图（英文页面名）
**用途**: 详细设计，英文命名与代码一致

## 页面目录

（在此添加页面详细设计目录）

示例:
- `home_page/` - 首页
- `profile_page/` - 个人中心
- `settings_page/` - 设置页面

## 目录结构

每个页面目录包含:
```
page_name/
├── README.md              # 页面说明
├── pageview_map.json      # UI元素映射（连接代码）
└── design_specs.md        # 详细设计规格
```

## pageview_map.json 说明

用于将设计图元素映射到 Flutter Widget，格式参考 `example_home_page/pageview_map.json`

## 更新记录

- {timestamp}: 初始化细节设计层
""",

        "page_subdir": f"""# {{page_name}} - 页面设计

**英文名称**: {{page_name}}
**中文名称**: {{page_name_cn}}
**创建时间**: {timestamp}

## 页面概述

（填写页面功能描述）

## 文件说明

- `README.md`: 本文件
- `pageview_map.json`: UI元素映射（连接Flutter代码）
- `design_specs.md`: 详细设计规格（颜色、字体、间距等）

## 开发状态

- [ ] 设计完成
- [ ] UI实现
- [ ] 功能实现
- [ ] 测试完成

## 更新记录

- {timestamp}: 初始化页面设计
"""
    }

    return templates.get(layer, "")


def get_file_template(filename: str, app_name: str) -> str:
    """获取文件模板内容"""
    timestamp = datetime.now().strftime("%Y-%m-%d")

    templates = {
        "architecture.md": f"""# 架构概念图 - {app_name}

**创建时间**: {timestamp}

## 整体架构

```
┌─────────────────────────────────┐
│         Presentation Layer      │
│  (UI Components, Widgets)       │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│         Business Layer          │
│  (ViewModels, Controllers)      │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│           Data Layer            │
│  (Repositories, Data Sources)   │
└─────────────────────────────────┘
```

## 设计模式

- **MVVM**: Model-View-ViewModel 分离关注点
- **Provider**: 状态管理方案
- **Repository Pattern**: 数据访问抽象层

## 技术栈

- Flutter SDK
- Provider (状态管理)
- Dio (网络请求)
- Shared Preferences (本地存储)

## 更新记录

- {timestamp}: 初始化架构设计
""",

        "user_flows.md": f"""# 用户流程概念 - {app_name}

**创建时间**: {timestamp}

## 主要流程

### 1. 启动流程

```
应用启动 → 检查登录状态 → 已登录: 进入首页 / 未登录: 显示登录页
```

### 2. 登录流程

```
输入账号密码 → 验证 → 成功: 保存token → 进入首页
                   ↓
                 失败: 显示错误提示
```

### 3. 核心业务流程

（在此添加应用核心业务流程）

## 更新记录

- {timestamp}: 初始化用户流程设计
""",

        "data_model.md": f"""# 数据模型概念 - {app_name}

**创建时间**: {timestamp}

## 核心数据模型

### User（用户）

```dart
class User {{
  final String id;
  final String username;
  final String email;
  final String? avatar;
  final DateTime createdAt;
}}
```

### （添加其他数据模型）

## 数据关系

（描述数据模型之间的关系）

## 更新记录

- {timestamp}: 初始化数据模型设计
""",

        "示例_首页设计.md": f"""# 首页设计

**对应英文页面**: home_page
**创建时间**: {timestamp}

## 页面功能

- 展示推荐内容
- 快速导航入口
- 用户状态显示

## 布局结构

- 顶部导航栏
- 内容列表（滚动）
- 底部Tab栏

## 主要交互

- 下拉刷新
- 上拉加载更多
- 点击卡片进入详情

## 更新记录

- {timestamp}: 初始化页面设计

---
**注意**: 这是示例文件，实际开发时可删除
""",

        "示例_个人中心设计.md": f"""# 个人中心设计

**对应英文页面**: profile_page
**创建时间**: {timestamp}

## 页面功能

- 显示用户信息
- 设置入口
- 功能菜单

## 布局结构

- 顶部用户卡片
- 功能菜单列表
- 退出登录按钮

## 主要交互

- 点击头像编辑资料
- 点击菜单进入对应功能
- 退出登录确认

## 更新记录

- {timestamp}: 初始化页面设计

---
**注意**: 这是示例文件，实际开发时可删除
""",

        "design_specs.md": f"""# 设计规格 - {{page_name}}

**创建时间**: {timestamp}

## 颜色规范

- 主色调: #FFFFFF
- 强调色: #000000
- 背景色: #F5F5F5
- 文字色: #333333

## 字体规范

- 标题: 18sp, Bold
- 正文: 14sp, Regular
- 辅助文字: 12sp, Regular

## 间距规范

- 页面边距: 16dp
- 元素间距: 8dp / 16dp / 24dp
- 圆角: 4dp / 8dp

## 更新记录

- {timestamp}: 初始化设计规格
"""
    }

    return templates.get(filename, "")


def get_pageview_map_template(page_name: str, page_name_cn: str = "") -> Dict:
    """获取 pageview_map.json 模板"""
    return {
        "image_file": f"{page_name}_wireframe.png",
        "page_key": page_name,
        "descriptions": {
            "purpose": f"{page_name} UI元素映射",
            "page_name_cn": page_name_cn or "待填写中文名称",
            "page_name_en": page_name,
            "specifications": {
                "architecture": "Follow MVVM pattern: separate UI layer and Data layer",
                "naming_conventions": {
                    "widgets": "UpperCamelCase for widget classes",
                    "variables": "lowerCamelCase for variables and functions",
                    "files": "snake_case for files and folders",
                    "constants": "UPPER_SNAKE_CASE for constants"
                },
                "ui_guidelines": {
                    "responsive": "Ensure adaptive design for multiple screen sizes",
                    "accessibility": "Support screen readers and semantic labels",
                    "performance": "Use const constructors, avoid rebuilds"
                }
            },
            "version": datetime.now().strftime("%Y"),
            "reference": "https://docs.flutter.dev/app-architecture"
        },
        "elements": [
            {
                "type": "text",
                "text": "Example Text",
                "bbox": [0, 0, 0, 0],
                "color": "#000000",
                "widget_mapping": "ExampleTextWidget",
                "notes": "Add UI elements here"
            }
        ]
    }


# ============================================================
# 自动扩展功能
# ============================================================

def ensure_directory(path: Path) -> bool:
    """确保目录存在，不存在则创建"""
    if not path.exists():
        path.mkdir(parents=True, exist_ok=True)
        print(f"[AutoExpand] Created directory: {path}")
        return True
    return False


def ensure_file(path: Path, content: str, force: bool = False) -> bool:
    """确保文件存在，不存在则创建"""
    if not path.exists() or force:
        path.write_text(content, encoding='utf-8')
        action = "Created" if not path.exists() else "Updated"
        print(f"[AutoExpand] {action} file: {path}")
        return True
    return False


def expand_layer_directory(base_path: Path, layer_name: str, layer_config: Dict, app_name: str):
    """扩展单个层级目录"""
    layer_path = base_path / layer_name
    ensure_directory(layer_path)

    # 创建层级说明文件
    readme_content = get_readme_template(layer_name, app_name)
    if readme_content:
        ensure_file(layer_path / "README.md", readme_content)

    # 创建层级中的文件
    if "files" in layer_config:
        for filename, description in layer_config["files"].items():
            file_path = layer_path / filename
            if not file_path.exists():
                template_content = get_file_template(filename, app_name)
                if template_content:
                    ensure_file(file_path, template_content)

    # 创建子目录（用于第三层）
    if "subdirs" in layer_config:
        for subdir_name, subdir_config in layer_config["subdirs"].items():
            subdir_path = layer_path / subdir_name
            ensure_directory(subdir_path)

            # 创建子目录中的文件
            if "files" in subdir_config:
                for filename in subdir_config["files"]:
                    file_path = subdir_path / filename

                    if filename == "README.md":
                        content = get_readme_template("page_subdir", app_name)
                        content = content.replace("{{page_name}}", subdir_name)
                        content = content.replace("{{page_name_cn}}", "示例页面")
                        ensure_file(file_path, content)

                    elif filename == "pageview_map.json":
                        json_content = get_pageview_map_template(subdir_name, "示例页面")
                        ensure_file(
                            file_path,
                            json.dumps(json_content, indent=2, ensure_ascii=False)
                        )

                    elif filename == "design_specs.md":
                        content = get_file_template("design_specs.md", app_name)
                        content = content.replace("{{page_name}}", subdir_name)
                        ensure_file(file_path, content)


def ensure_design_structure(app_name: str, base_dir: Optional[Path] = None) -> bool:
    """
    确保设计文档结构完整

    Args:
        app_name: 应用名称（如 "app_main"）
        base_dir: 基础目录（如果为None，自动查找）

    Returns:
        True if structure was created/updated
    """
    # 确定基础路径
    if base_dir is None:
        # 从 scripts/flutter_dev_tools/utils/ 向上找到 flutter_bloom/
        script_dir = Path(__file__).parent.parent.parent.parent  # flutter_bloom/
        base_dir = script_dir / "lib" / "apps" / app_name / "design_docs_and_progress"

    if not base_dir.exists():
        print(f"[AutoExpand] Creating design_docs_and_progress for {app_name}...")
        base_dir.mkdir(parents=True, exist_ok=True)

    # 创建根目录 README
    root_readme = get_readme_template("root", app_name)
    ensure_file(base_dir / "README.md", root_readme)

    # 扩展三层目录
    for layer_name, layer_config in DESIGN_STRUCTURE.items():
        expand_layer_directory(base_dir, layer_name, layer_config, app_name)

    print(f"[AutoExpand] Design structure ensured for {app_name}")
    return True


def ensure_all_apps_design_structure(flutter_bloom_dir: Optional[Path] = None) -> Dict[str, bool]:
    """
    为所有应用确保设计文档结构

    Args:
        flutter_bloom_dir: flutter_bloom 目录路径

    Returns:
        Dict mapping app_name to success status
    """
    if flutter_bloom_dir is None:
        # 从 scripts/flutter_dev_tools/utils/ 向上找到 flutter_bloom/
        script_dir = Path(__file__).parent.parent.parent.parent
        flutter_bloom_dir = script_dir

    apps_dir = flutter_bloom_dir / "lib" / "apps"

    if not apps_dir.exists():
        print(f"[AutoExpand] Apps directory not found: {apps_dir}")
        return {}

    results = {}
    for app_dir in apps_dir.iterdir():
        if app_dir.is_dir() and app_dir.name.startswith("app_"):
            app_name = app_dir.name
            try:
                results[app_name] = ensure_design_structure(app_name)
            except Exception as e:
                print(f"[AutoExpand] Error expanding {app_name}: {e}")
                results[app_name] = False

    return results


# ============================================================
# CLI Interface
# ============================================================

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        app_name = sys.argv[1]
        ensure_design_structure(app_name)
    else:
        # 扩展所有应用
        results = ensure_all_apps_design_structure()
        print(f"\n[AutoExpand] Summary:")
        for app, success in results.items():
            status = "✓" if success else "✗"
            print(f"  {status} {app}")
