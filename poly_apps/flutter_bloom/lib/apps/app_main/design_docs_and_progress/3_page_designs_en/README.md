# 细节设计层（英文）- app_main

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

- 2025-11-19: 初始化细节设计层
