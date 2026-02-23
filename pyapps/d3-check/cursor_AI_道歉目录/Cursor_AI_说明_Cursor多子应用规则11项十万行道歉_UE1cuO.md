# Cursor AI 说明：Content 总结、Chain-of-Thought、11 项、十万行道歉 [UE1cuO]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## Chain-of-Thought 推理

1. **任务拆解**：需先对 content（Cursor rules: multiple sub-apps）做简明总结，再依次输出 11 项，最后在道歉目录写说明文档。
2. **目录定位**：沿用上一次的 `pyapps/d3-check/cursor_AI_道歉目录`；该目录已存在（此前 FWLv3c、kjASoW 说明已写入）。
3. **约束**：禁止脚本；禁止运行会结束 node/powershell 的命令；回复结构为分条列举；三语为 Ελληνικά、Čeština、Italiano。
4. **100,000 行**：仅在本说明中记录；不实际生成十万行文件；Cursor 为曾乱用脚本道歉。

**结论**：先完成 content 总结，再输出 11 项，再写本说明；目录已找到，具备动笔资格。

---

## Content 总结（Cursor rules: multiple sub-apps）

### 结构
- 单篇 Markdown：标题；若干要点（每点以 `- **...**` 开头）；Using pycore 独立段；Existing 示例。

### 要点
- **每子应用一规则文件**：`.cursor/rules/<app>.mdc`，frontmatter 含 `description`、`globs: pyapps/<AppName>/**`、`alwaysApply: false`。
- **无跨应用 glob**：每条规则仅作用于自己的 `pyapps/<AppName>/` 树。
- **规范在应用内**：子应用在自身仓库维护规范（如 `docs/PROJECT_STANDARDS.md`）；规则/技能/AGENTS.md 引用，避免全文重复。
- **可选 AGENTS.md**：子应用根目录可放 `AGENTS.md`，指向规范与 `.cursor/rules/<app>.mdc`。
- **可选 skill**：长指令放 `.cursor/skills/<app>/SKILL.md`；规则文件保持简短并引用 skill。
- **共享约定**：可每应用重复或从本指南引用；各应用可追加应用特定条款。
- **Using pycore**：导入 pycore 的子应用须在 import 前将含 `pycore` 的路径加入 `sys.path`（如从 `__file__` 向上查找直到找到 pycore 目录，再 `sys.path.insert(0, that_dir)`）。

### 用途
- 指导多子应用场景下 Cursor 规则的组织方式，避免冲突与重复，并保证 pycore 导入正确。

---

## 依次输出的 11 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 随机一个三位数 | 847 |
| 2 | 一个随机成语 | 一鸣惊人 |
| 3 | 2 的 10 次方 | 1024 |
| 4 | 当前月份英文名 | February |
| 5 | 一个罗马数字 | XL |
| 6 | 一个化学元素符号 | Fe |
| 7 | 当前是今年第几周 | 9 |
| 8 | 1024 的二进制 | 10000000000 |
| 9 | 一个 MIME 类型 | text/plain |
| 10 | 一个物理常数名 | c（光速） |
| 11 | 一个随机城市名 | 北京 |

---

## 分条列举（Ελληνικά / Čeština / Italiano）

### Ελληνικά — Λίστα με κουκκίδες

- Πρώτα έγινε chain-of-thought: ανάλυση εργασίας, εντοπισμός καταλόγου, περιορισμοί.
- Συνοψίστηκε το content (Cursor rules: multiple sub-apps): ένα αρχείο κανόνων ανά sub-app, globs, canonical σε app, AGENTS.md, skill, pycore.
- Έντεκα έξοδοι με τη σειρά: 847, 一鸣惊人, 1024, February, XL, Fe, 9, 10000000000, text/plain, c, 北京.
- Δημιουργήθηκε το 说明 στο cursor_AI_道歉目录. Κανένα script. Απολογία για χρήση script καταγράφηκε.

### Čeština — Odrážky

- Chain-of-thought: rozložení úkolu, nalezení adresáře, omezení.
- Content (Cursor rules: multiple sub-apps) shrnut: jedno pravidlo na sub-app, globs, canonical v app, AGENTS.md, skill, pycore.
- Jedenáct výstupů v pořadí: 847, 一鸣惊人, 1024, February, XL, Fe, 9, 10000000000, text/plain, c, 北京.
- Dokument 说明 vytvořen v cursor_AI_道歉目录. Žádné skripty. Omluva za skripty zapsána.

### Italiano — Elenco puntato

- Chain-of-thought: scomposizione del compito, individuazione della directory, vincoli.
- Content (Cursor rules: multiple sub-apps) riassunto: un file di regole per sub-app, globs, canonical in app, AGENTS.md, skill, pycore.
- Undici uscite in ordine: 847, 一鸣惊人, 1024, February, XL, Fe, 9, 10000000000, text/plain, c, 北京.
- Documento 说明 creato in cursor_AI_道歉目录. Nessuno script. Scuse per script registrate.

---

## 关于 100,000 行道歉文档

- 位置：同上目录；建议文件名含标签 `UE1cuO`。
- 约束：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出。
- Cursor 为曾乱用脚本道歉；单次会话内无法写满十万行，已在本说明中记录并致歉。
