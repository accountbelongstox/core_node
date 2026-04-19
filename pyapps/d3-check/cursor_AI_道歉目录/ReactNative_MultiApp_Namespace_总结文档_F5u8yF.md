# React Native Multi-App Namespace Architecture — 总结文档 [F5u8yF]

对用户提供的 `<content>`（React Native 多应用命名空间架构文档 v2.1）的简明总结。

## 结构
文档分节：版本与状态；AI 开发指南（优先扩展 common、禁止修改 _build_dir）；核心原则（命名空间隔离、项目根目录结构、应用内结构）；架构层（入口与 APP_ENTRY、导入路径规则、资源管理、构建配置）；命名空间规则（DO/DON'T 列表）；添加新应用七步；校验清单；构建系统（镜像、资源替换、构建模式）。

## 要点
- **命名空间隔离**：每应用对应 `src/apps/{namespace}/`，目录以 `{namespace}_` 为前缀（pages、components、navigation、theme、store、services、hooks、types），必备 `App.tsx`、`build_config.ini`、`{namespace}_assets.ts`。
- **共用层**：`src/common/` 含 components、utils、services、hooks、store、types、constants、styles、common_assets.ts；先扩展 common 再写应用专属代码；禁止在 common 中写应用业务逻辑。
- **路径与资源**：必须使用路径别名 `@/common/*`、`@/apps/*`，禁止相对路径；资源仅在 `*_assets.ts` 中注册，代码通过 key 引用，禁止硬编码路径。
- **入口与构建**：`APP_ENTRY` 指定当前应用；应用自动发现（扫描 `src/apps/`）；仅修改 `poly_apps/react_native/`，禁止改 `_build_dir/`。

## 用途
为在 poly_apps/react_native 下开发、扩展与构建多应用提供统一的命名空间与目录规范，保证隔离与可维护性。
