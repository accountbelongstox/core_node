# React Native Multi-App Namespace Architecture 总结文档

本文档对用户提供的《React Native Multi-App Namespace Architecture》做简明总结。

## 结构概览
- 文档为 Markdown，包含：版本与状态、AI 开发指南（优先扩展 common/、禁止改 _build_dir）、核心原则（命名空间隔离、目录结构树）、架构层（入口与 APP_ENTRY、导入路径规则、资源管理、build 配置）、命名空间规则（DO/DON'T）、新增应用七步、验证清单、构建系统说明。

## 要点
- **common 优先**：先扩展 `src/common/`（components、utils、services、hooks、types 等），再写应用专属代码；common 保持通用，不放入应用业务逻辑。
- **仅改源码**：只在 `poly_apps/react_native/` 修改，不修改 `_build_dir/`（自动同步镜像）；报错路径需转换为对应源码路径。
- **命名空间隔离**：每应用有唯一 namespace；应用代码在 `src/apps/{namespace}/`，目录以 `{namespace}_` 为前缀（pages、components、navigation、theme、store、services、hooks、types）；必备 `App.tsx`、`build_config.ini`、`{namespace}_assets.ts`。
- **入口与发现**：通过 `APP_ENTRY` 选择应用；自动扫描 `src/apps/`，无需额外配置文件；入口为 `index.js` 与 `app-registry.ts`。
- **导入与资源**：必须使用路径别名 `@/common/*`、`@/apps/{namespace}/*`，禁止相对路径；资源必须在 `common_assets.ts` 或 `{namespace}_assets.ts` 中注册，代码仅通过 key 引用。
- **新增应用**：创建 `src/apps/{namespace}/`、`App.tsx`、`build_config.ini`、命名空间前缀目录、`{namespace}_assets.ts`，在 `assets/apps/app_{namespace}/` 放置平台资源并注册，设置 `APP_ENTRY` 即可。
- **构建**：工厂镜像为每应用生成独立构建目录；资源替换管线在构建前拷贝应用资源、构建后恢复；支持 Debug、Build、Test 模式。

## 用途
供团队统一理解多应用 React Native 工作区结构、命名空间规范与构建流程，便于新增应用与维护。
