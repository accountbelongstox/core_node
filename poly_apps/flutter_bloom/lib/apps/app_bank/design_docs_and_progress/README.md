# Design Docs & Progress - app_bank

**应用名称**: app_bank
**创建时间**: 2025-11-19
**最后更新**: 2025-11-19

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
