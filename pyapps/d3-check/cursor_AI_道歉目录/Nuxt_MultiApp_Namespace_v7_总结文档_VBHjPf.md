# Nuxt Multi-App Namespace Architecture v7.0 — 总结文档 [VBHjPf]

对用户提供的 `<content>`（Nuxt 多应用命名空间架构文档 v7.0，2025-11-12）的简明总结。

## 结构
文档分节：版本与状态；AI 开发指南（common 优先、禁止改 _build_dir、pages 目录管理规则与 Entry Page 模式）；核心原则（命名空间隔离、完整目录树、废弃 apps/app_{namespace}/、新结构 app_{namespace}_pages/、路径示例）；架构层（Namespace Registry、Route Detection、Configuration、API、Layout、Pages 切换与 Factory、i18n）；Common vs App-Specific 对照表；Namespace 规则 DO/DON'T；添加新应用步骤与从废弃结构迁移；关键文件表；校验清单；常用模式；当前应用列表。

## 要点
- **源码与构建**：仅修改 `poly_apps/nuxt_main/`，永不修改 `_build_dir/`（1:1 镜像）。
- **pages 管理**：pages/ 为自动管理，仅允许 index.vue、blank.vue、layouts/、INDEX.md；所有源码在 app_{namespace}_pages/，禁止直接编辑 pages/；切换应用时清空并重新从 app_{namespace}_pages/ 复制上述文件。
- **废弃结构**：apps/app_{namespace}/ 及 components_app_{namespace}/ 等已废弃，需迁移至 app_{namespace}_pages/ 下对应目录。
- **common 层**：common/stores、common/composables、common/components/ui、common/theme 等，先扩展 common 再写应用代码。
- **应用层**：app_{namespace}_pages/ 含 components（{namespace}_index/{Namespace}App.vue 等）、composables、stores、services、config、constants、i18n、layouts、theme、types；API 请求带 X-App-Namespace；useAppI18n 合并全局与应用 i18n。
- **脚本**：switch-pages-directory.js 切换当前应用 pages；switch-app-entry-plus.js 镜像+切换+监听+启动 dev。

## 用途
为 poly_apps/nuxt_main 多应用 Nuxt 项目提供统一的命名空间、目录、pages 自动管理、common 与应用分层及迁移规范，供开发与 AI 助手遵循。
