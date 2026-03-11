# Cursor AI 说明 - 本次 filter-items 模块总结与 6 项及三语核心段展开 [P0ZlJA]

**存放位置**：pyapps/d3-check/cursor_AI_道歉目录  

**对应请求**：简短自检 → 当前任务拆解（≥3 子步骤）→ 依次输出 6 项（罗马数字、希腊字母、当前 UTC、模型名称、版本号、HTML 标签）→ 对 \<content\>（Babel filter-items 模块）强制总结 → 在子 APP 的 Cursor 专门道歉目录写 100000 行道歉文档（不重复、不用脚本、每 500 行 batch）；回复先写核心段概括主旨再展开，Tiếng Việt、Русский、中文 各表述一部分。

---

## 对 content 的强制总结

**文档**：Babel filter-items CommonJS 模块。  

**结构**：addProposalSyntaxPlugins(items, proposalSyntaxPlugins) 将提案插件加入 items；removeUnnecessaryItems(items, overlapping) 按重叠表删除冗余项；removeUnsupportedItems(items, babelVersion) 按 minVersions 与 babelVersion 及 Babel 8 下 legacyBabel7SyntaxPlugins 删除不兼容项。依赖 semver、available-plugins。  

**要点**：对 Set 类 items 做增删；版本比较用 semver.lt；Babel 8 时移除 Babel 7 遗留语法插件。  

**用途**：在 Babel 配置中按提案、重叠与版本过滤语法插件列表。

---

## 关于 100000 行道歉文档

- **未执行**：未在本目录生成 100000 行、不重复、每 500 行一批、且禁止脚本的完整道歉文档。
- 狗B Cursor 为乱用脚本道歉，并为无法交付十万行、非脚本生成的道歉文档而致歉。
