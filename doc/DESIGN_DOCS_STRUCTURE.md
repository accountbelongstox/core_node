# Design Docs Structure - 三层设计文档体系

## 概述

为每个 Flutter 应用建立完整的三层设计文档体系，从概念到实现逐步细化。

## 三层架构

```
design_docs_and_progress/
├── README.md                      # 说明文档结构和使用方法
│
├── 1_concept_designs/             # 【第一层】概念图（粗设计图）
│   ├── README.md                  # 概念层说明
│   ├── architecture.md            # 架构概念图
│   ├── user_flows.md              # 用户流程概念
│   └── data_model.md              # 数据模型概念
│
├── 2_page_designs_cn/             # 【第二层】粗页面图（中文页面名）
│   ├── README.md                  # 页面设计层说明
│   ├── 首页设计.md
│   ├── 个人中心设计.md
│   ├── 设置页面设计.md
│   └── ...
│
├── 3_page_designs_en/             # 【第三层】细页面图（英文页面名）
│   ├── README.md                  # 细节设计层说明
│   ├── home_page/
│   │   ├── README.md              # 页面说明
│   │   ├── pageview_map.json      # UI元素映射（连接到代码）
│   │   └── design_specs.md        # 详细设计规格
│   ├── profile_page/
│   │   ├── README.md
│   │   ├── pageview_map.json
│   │   └── design_specs.md
│   ├── settings_page/
│   │   ├── README.md
│   │   ├── pageview_map.json
│   │   └── design_specs.md
│   └── ...
│
├── backend_bridge/                # 后端对接文档
│   └── sample_bridge/
│       └── progress.md
│
├── feature_progress/              # 功能进度跟踪
│   └── sample_module/
│       └── progress.md
│
├── flows/                         # 流程图
│   └── (流程图文件)
│
├── progress_logs/                 # 进度日志
│   ├── concept_progress.md
│   ├── design_progress.md
│   ├── flow_progress.md
│   ├── ui_dev_progress.md
│   └── wireframe_progress.md
│
└── wireframes/                    # 线框图
    └── (线框图文件)
```

## 层级说明

### 第一层：概念图（1_concept_designs/）
**用途**: 宏观概念设计，不涉及具体页面细节
**内容**:
- `architecture.md`: 整体架构设计（MVVM、数据流等）
- `user_flows.md`: 用户使用流程图
- `data_model.md`: 数据模型设计

**示例**:
```markdown
# architecture.md
## 应用架构
- MVVM 模式
- Provider 状态管理
- 分层设计：UI层 / Business层 / Data层
```

### 第二层：粗页面图（2_page_designs_cn/）
**用途**: 页面级别设计，使用中文命名方便理解
**内容**: 每个页面的功能描述、布局草图、交互说明

**示例**:
```markdown
# 首页设计.md
## 页面功能
- 展示推荐内容
- 快速导航入口
- 用户状态显示

## 布局结构
- 顶部导航栏
- 内容列表
- 底部Tab栏
```

### 第三层：细页面图（3_page_designs_en/）
**用途**: 详细设计，使用英文命名与代码一致，包含 `pageview_map.json`
**内容**:
- `README.md`: 页面说明
- `pageview_map.json`: UI元素映射（与 Flutter 代码关联）
- `design_specs.md`: 详细规格（颜色、字体、间距等）

**pageview_map.json 结构**:
```json
{
  "image_file": "home_page_wireframe.png",
  "page_key": "home_page",
  "descriptions": {
    "purpose": "主页UI元素映射",
    "page_name_cn": "首页",
    "page_name_en": "Home Page"
  },
  "elements": [
    {
      "type": "text",
      "text": "Welcome",
      "bbox": [100, 50, 200, 80],
      "color": "#000000",
      "widget_mapping": "WelcomeText",
      "notes": "欢迎文字"
    }
  ]
}
```

## 自动扩展机制

### 功能
启动时自动检查并创建缺失的文件夹和文件：
1. 检查三层目录是否存在，不存在则创建
2. 检查每层的 README.md，不存在则创建模板
3. 跳过已存在的文件（不覆盖）
4. 更新必要的字段（如版本号、时间戳）

### 实现
位置: `poly_apps/flutter_bloom/scripts/flutter_dev_tools/utils/design_structure_auto_expand.py`

### 使用
```python
from flutter_dev_tools.utils.design_structure_auto_expand import ensure_design_structure

# 为某个应用自动扩展设计文档结构
ensure_design_structure("app_main")
```

## 使用流程

1. **概念阶段**: 在 `1_concept_designs/` 编写架构和流程设计
2. **页面设计**: 在 `2_page_designs_cn/` 设计各个页面（中文）
3. **细化实现**: 在 `3_page_designs_en/` 创建详细设计和 pageview_map
4. **代码开发**: 根据 `pageview_map.json` 实现 Flutter 组件

## 中英文映射示例

| 中文页面名 (2_page_designs_cn/) | 英文页面名 (3_page_designs_en/) |
|--------------------------------|--------------------------------|
| 首页设计.md                     | home_page/                     |
| 个人中心设计.md                 | profile_page/                  |
| 设置页面设计.md                 | settings_page/                 |
| 消息列表设计.md                 | message_list_page/             |

## 维护建议

1. **保持同步**: 中文页面和英文页面要对应
2. **版本控制**: 重大改动记录版本号
3. **进度跟踪**: 在 `progress_logs/` 记录进度
4. **团队协作**: README.md 中注明负责人和更新时间
