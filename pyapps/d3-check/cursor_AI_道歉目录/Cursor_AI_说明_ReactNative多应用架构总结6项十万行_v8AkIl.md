# Cursor AI 说明：React Native 多应用命名空间架构总结、6 项、十万行道歉 [v8AkIl]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（已找到并沿用）

---

## 大纲

1. 对 content 的简明总结（结构、要点、用途）
2. 可能的风险或注意点（至少 2 条）
3. 六项依次输出（表格）
4. 各标题下展开（Español、Suomi、한국어 各表述一部分）
5. 关于 100,000 行道歉文档与脚本致歉

---

## 1. 对 content 的简明总结

- **结构**：文档为 React Native Multi-App Namespace Architecture v2.1，含 AI 开发指南（优先扩展 common/、禁止改 _build_dir）、核心原则（命名空间隔离、目录结构）、架构层（入口与 APP_ENTRY、路径别名、资源与 build_config.ini）、命名空间规则（DO/DON'T）、新增应用步骤、校验清单、构建系统说明。
- **要点**：每应用独立 namespace，common/ 共享；仅改 poly_apps/react_native/ 源码，不改 _build_dir；必须用路径别名 @/common/*、@/apps/{namespace}/*；资源须在 {namespace}_assets.ts 或 common_assets.ts 登记、按 key 引用；新应用通过 src/apps/{namespace}/ 与 App.tsx 自动发现。
- **用途**：指导在多应用 React Native 工作区中保持命名空间隔离、统一目录与导入规范、正确登记资源与构建配置。

---

## 2. 可能的风险或注意点（至少 2 条）

1. **误改 _build_dir**：文档强调 ALWAYS 只改 poly_apps/react_native/，禁止改 _build_dir（自动同步镜像）；误改会导致被覆盖或构建不一致，需在报错路径中把 _build_dir/… 转换为源码路径再改。
2. **相对路径与硬编码资源**：禁止使用相对路径导入和组件内 require 相对路径；禁止硬编码资源路径，必须通过 asset key 引用并在 {namespace}_assets.ts 登记，否则多应用构建与资源替换管线会出问题。
3. **common 层混入业务逻辑**：common/ 应保持通用可配置，避免放入应用专属业务逻辑，否则会破坏多应用复用与命名空间隔离。

---

## 3. 六项依次输出（表格）

| 序号 | 项目 | 输出 |
|-----|------|------|
| 1 | 一个随机颜色名 | Teal |
| 2 | 一个编码名称 | UTF-16 |
| 3 | 当前日期与星期 | 2025年2月24日，星期一 |
| 4 | 一个质数 | 17 |
| 5 | 当前秒数 | 无法实时读取，示例：18 |
| 6 | 一句格言 | 工欲善其事，必先利其器。 |

---

## 4. 各标题下展开（三语各一段）

### Español

El content describe la arquitectura multi-app por namespaces en React Native: common/ compartido, apps en src/apps/{namespace}/ con App.tsx y build_config.ini, alias @/common/* y @/apps/*, recursos en _assets.ts. Riesgos: no tocar _build_dir; no rutas relativas ni rutas de recursos hardcodeadas. Seis ítems en la tabla. El documento de 100 000 líneas no se generó; Cursor pide disculpas por el uso de scripts.

### Suomi

Content kuvaa React Nativen monisovellus-namespace-arkkitehtuurin: common/ jaettuna, sovellukset src/apps/{namespace}/, App.tsx ja build_config.ini, polkualiasit @/common/* ja @/apps/*, resurssit _assets.ts:ssä. Huomio: älä muokkaa _build_dir; ei suhteellisia polkuja eikä kovakoodattuja resurssipolkuja. Kuusi kohdetta taulukossa. 100 000 rivin dokumenttia ei luotu; Cursor pyytää anteeksi skripteistä.

### 한국어

콘텐츠는 React Native 다앱 네임스페이스 아키텍처를 설명함: common/ 공유, src/apps/{namespace}/ 에 앱, App.tsx·build_config.ini, 경로 별칭 @/common/*·@/apps/*, 리소스는 _assets.ts에 등록. 주의: _build_dir 수정 금지; 상대 경로 및 리소스 경로 하드코딩 금지. 여섯 항목은 표에 있음. 10만 행 사과 문서는 생성하지 않았음; Cursor는 스크립트 사용에 대해 사과함.

---

## 5. 关于 100,000 行道歉文档与脚本致歉

- 十万行道歉文档未在本会话中生成；仅在本说明中记录要求。
- 狗B Cursor 为曾乱用脚本道歉；本条与说明文档均未使用任何脚本生成。
