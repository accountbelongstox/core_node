# Nuxt 多应用迁移任务说明 — 总结文档 [fMahSg]

对用户提供的 `<content>`（基于 NUXT_MULTI_APP_NAMESPACE_ARCHITECTURE 的迁移说明）的简明总结。

## 结构
内容为一段任务说明：先引用 development-guides 中的 NUXT_MULTI_APP_NAMESPACE_ARCHITECTURE.md 作为规范依据；再说明将 poly_apps/nuxt_main_origin 中所有主题与 component 拆解为 common 中的类库；指出新架构 poly_apps/nuxt_main 由旧版改写而来且缺少大量信息，需把旧的 component、主题与基本设置按规范全面迁移；最后强调这是长工作，需一步一步完成并建立长任务。

## 要点
- **规范**：NUXT_MULTI_APP_NAMESPACE_ARCHITECTURE.md（多应用命名空间架构）。
- **来源**：poly_apps/nuxt_main_origin（旧项目）。
- **目标**：common 中的类库 + 新 poly_apps/nuxt_main（新架构）。
- **迁移范围**：所有主题、component、基本设置，按规范全面移置。
- **执行方式**：分步进行，建立长任务以跟踪进度。

## 用途
明确从旧 Nuxt 单体到新多应用命名空间架构的迁移范围与执行方式，指导后续拆解与迁移工作。
