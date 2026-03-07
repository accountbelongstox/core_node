# Dot 项目结构与依赖核对报告

**核对日期**: 2025-02  
**范围**: dotcore 与 dotapps 的架构规范、归属、依赖方向与循环依赖。规范参见 [DOT_ARCHITECTURE.md](DOT_ARCHITECTURE.md)；**UI 层以 [DOT_UI_PROJECT_SPECIFICATION.md](DOT_UI_PROJECT_SPECIFICATION.md) 及 [.cursor/rules/dot-ui.mdc](../.cursor/rules/dot-ui.mdc) 为唯一规范**。

---

## 一、核对结论摘要

| 维度 | 结论 |
|------|------|
| dotcore 未引用子 APP | 通过 |
| dotcore 无公共类库遗漏在子 APP | 需关注 1 项（配置能力重复） |
| dotcore 无对子 APP 业务的反向依赖 | 通过 |
| 子 APP 未放置“范围过宽”的公共库 | 通过 |
| 子 APP 通用能力通过 dotcore 实现 | 需关注 1 项（d3check 自实现配置） |
| 依赖方向：子 APP → dotcore | 通过 |
| 无跨子 APP 直接依赖 | 通过 |
| 无循环依赖 | 通过 |

---

## 二、依赖关系矩阵

### 2.1 dotcore 内部依赖（仅库 → 库，无 app）

| 项目 | 引用 | 符合规范 |
|------|------|----------|
| DotCore.Foundations | (无) | 是 |
| DotCore.Common | Foundations | 是 |
| DotCore.Utils | Foundations, Common | 是 |
| DotCore.Infrastructure | Foundations, Common | 是 |
| DotCore.UIInspect | (仅 FlaUI 包) | 是 |
| DotCore.UITheme | (无) | 是 |
| DotCore.VocAnnotator | Foundations, Common | 是 |

**说明**: D3-check 领域类型（路径扫描、游戏状态、Battle.net 区域/操作）已迁移至 **dotapps/d3check/D3CheckCore/**（子 APP 特征类库），不再作为 dotcore 公共库。

**结论**: 无任何 dotcore 项目引用 dotapps；依赖为 DAG，无环。

### 2.2 dotapps 对 dotcore 的依赖

| 子 APP | 引用的 dotcore | 跨 app 引用 | 符合规范 |
|--------|----------------|-------------|----------|
| d3check | Foundations, Common, Utils, UITheme, Infrastructure, D3CheckCore（子库）, VocAnnotator | 无 | 是 |
| VocAnnotator | VocAnnotator, Common | 无 | 是 |
| SimpleUi | UIInspect | 无 | 见说明 |
| Cli | Foundations, Common, Utils | 无 | 是 |
| CallModule | Foundations, Common, Utils | 无 | 是 |
| abc | Foundations, Common, Utils, UITheme | 无 | 是（未入 sln） |
| _template | Foundations, Common, Utils, UITheme | 无 | 是（模板） |

**结论**: 所有子 APP 仅引用 dotcore，无 app → app 引用。

---

## 三、不符合或需规范的项

### 3.1 【中】d3check：重复实现公共配置能力

| 项目 | 不符合规范的模块 | 具体问题点 | 调整建议 | 风险等级 |
|------|------------------|------------|----------|----------|
| ~~子 APP 重复实现公共能力~~ | ~~dotapps/d3check (D3CheckConfigService)~~ | **已按方案 A 修复**：d3check 已引用 DotCore.Infrastructure，D3CheckConfigService 基于 JsonKeyPathConfig + DefaultFileReadWriter 封装，仅在 app 层保留模板合并、默认文件路径、D3Check 专用 key 等逻辑。 | — | 已关闭 |

### 3.2 ~~【低】d3check：构建时依赖 pyapps 路径~~ 已关闭

| 项目 | 不符合规范的模块 | 具体问题点 | 调整建议 | 风险等级 |
|------|------------------|------------|----------|----------|
| ~~构建耦合~~ | ~~dotapps/d3check~~ | **已修复**：i18n 源已迁至 **dotapps/d3check/I18n/i18n_config.json**（dot 专用副本），结构与 Python 版一致，d3check 构建不再依赖 pyapps。 | — | 已关闭 |

### 3.3 【低】SimpleUi：未显式引用 Foundations/Common

| 项目 | 不符合规范的模块 | 具体问题点 | 调整建议 | 风险等级 |
|------|------------------|------------|----------|----------|
| 依赖完整性 | dotapps/SimpleUi | 仅引用 DotCore.UIInspect；若代码中使用 Guard、AppPaths 等则需通过 UIInspect 传递或显式引用。UIInspect 当前无对 Foundations/Common 的引用。 | 若 SimpleUi 实际使用 Foundations/Common 的类型，应显式添加对 DotCore.Foundations、DotCore.Common 的 ProjectReference；否则可维持现状并注明“仅演示 UIInspect”。 | 低 |

### 3.4 【低】dotcore.sln 未包含 abc / _template

| 项目 | 不符合规范的模块 | 具体问题点 | 调整建议 | 风险等级 |
|------|------------------|------------|----------|----------|
| 解决方案一致性 | dotcore/dotcore.sln | abc、_template 未入 sln，与 SimpleUi、Cli、CallModule、d3check、VocAnnotator 不一致。 | 若 abc 为正式 app，建议加入 sln；若为示例或临时项目，可在文档中说明。_template 通常保留在仓库内作脚手架即可。 | 低 |

---

## 四、已符合规范的部分

1. **dotcore 未引入子 APP 类库**  
   已核对：所有 DotCore.* 的 csproj 与源码中无对 dotapps 的 ProjectReference，仅注释中举例提到“d3check”等名称，无编译/运行时依赖。

2. **无对子 APP 业务的反向依赖**  
   dotcore 中无 DotApps 命名空间、无 d3check/VocAnnotator 等业务类型引用。

3. **子 APP 未放置“范围过宽”的公共库**  
   d3check 内为 Constants、Config、I18n、Panels、Hotkeys、Ui 等子 app 专属逻辑；未发现可被多 app 复用的通用工具库或基础组件放在 dotapps。

4. **依赖方向统一为：子 APP → dotcore**  
   所有 dotapps 的 ProjectReference 均指向 `..\..\dotcore\DotCore.*`，无 app → app。

5. **无跨子 APP 直接依赖**  
   未发现任一 dotapps 项目引用其他 dotapps 项目。

6. **无循环依赖**  
   dotcore 内部：Foundations → (无)；Common → Foundations；Utils/Infrastructure → Foundations, Common；VocAnnotator → Foundations, Common。子 APP d3check 另引用 dotapps/d3check/D3CheckCore（子 APP 特征类库）。经 DAG 检查无环。

---

## 五、建议执行的调整（按优先级）

| 优先级 | 建议 | 对应条款 |
|--------|------|----------|
| ~~P1~~ | ~~d3check 配置策略~~ **已执行方案 A**：d3check 已依赖 DotCore.Infrastructure + JsonKeyPathConfig，重复逻辑已收拢。 | §3.1 |
| ~~P2~~ | ~~d3check i18n 构建依赖~~ **已执行**：i18n 已迁至 dotapps/d3check/I18n/i18n_config.json，与现有项目风格统一。 | §3.2 |
| P3 | 确认 SimpleUi 是否使用 Foundations/Common；若使用则补上 ProjectReference。 | §3.3 |
| P4 | 明确 abc、_template 在 sln 中的取舍并更新文档。 | §3.4 |

---

## 六、附录：项目与 sln 清单

- **dotcore 库 (7)**: DotCore.Foundations, DotCore.Common, DotCore.Utils, DotCore.Infrastructure, DotCore.UIInspect, DotCore.UITheme, DotCore.VocAnnotator（D3-check 领域已迁至 dotapps/d3check/D3CheckCore）  
- **dotcore 测试**: DotCore.Foundations.Tests  
- **dotapps 已入 sln (5)**: SimpleUi, Cli, CallModule, d3check, VocAnnotator  
- **dotapps 未入 sln (2)**: abc, _template  

以上为当前项目结构与依赖的全面核对结果与调整建议。
