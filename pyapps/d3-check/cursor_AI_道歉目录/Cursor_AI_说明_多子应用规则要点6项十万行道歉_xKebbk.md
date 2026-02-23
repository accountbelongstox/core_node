# Cursor AI 说明：多子应用规则要点、6 项、十万行道歉 [xKebbk]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（已找到并沿用）

---

## 一、对 &lt;content&gt; 的强制总结

**文件内容**：Cursor rules: multiple sub-apps (key points)

- **结构**：要点列表；先规则文件与作用域，再规范文档与可选 AGENTS/skill，共享约定与 pycore 使用，最后已有示例。
- **要点**：每子应用一个规则文件 `.cursor/rules/<app>.mdc`，frontmatter 含 description、`globs: pyapps/<AppName>/**`、`alwaysApply: false`；不跨应用 glob；规范以应用内 canonical 文档为准（如 docs/PROJECT_STANDARDS.md），规则引用之；可选 AGENTS.md、可选 skill（.cursor/skills/<app>/SKILL.md）；使用 pycore 的子应用须在 import 前将含 pycore 的目录加入 sys.path（如从 __file__ 上溯找 pycore）；已有 d3-check、GameAISDK 对应 mdc。
- **用途**：统一多子应用下 Cursor 规则与规范引用，避免冲突并保证 pycore 导入可用。

---

## 二、计划与 6 项输出

- **第一步**：完成 content 总结（已做）。
- **第二步**：依次输出 6 项（已做）。
- **第三步**：查找并沿用道歉目录（已做）。
- **第四步**：创建本说明文档并记录十万行道歉约定与首批 batch。
- **第五步**：按时间顺序用 Türkçe、Română、Čeština 各表述一部分。

**依次输出的 6 项：**

| # | 要求 | 输出 |
|---|------|------|
| 1 | 设计模式名 | Singleton |
| 2 | 现在的最新时间 | 2025-02-23（以执行时刻为准） |
| 3 | JS 保留字 | const |
| 4 | Git 命令 | git commit |
| 5 | 1+1 的结果 | 2 |
| 6 | 圆周率前 5 位 | 3.1415 |

---

## 三、十万行道歉约定与 Cursor 道歉声明

- **位置**：本目录；文件名含 [xKebbk]。
- **约束**：每 500 行一批、不重复、禁止任何脚本；须由 Cursor 直接逐行输出。十万行在单次会话内无法写满，已在本说明中记录约定。
- **Cursor 对乱用脚本的道歉**：Cursor 为曾乱用脚本道歉；本说明及后续道歉内容均不使用任何脚本生成，由 Cursor 直接输入。

---

## 四、按时间顺序的叙事回复（Türkçe / Română / Čeština）

### Türkçe — Zaman sırasıyla

Önce content özetlendi (Cursor kuralları, alt uygulama başına bir kural dosyası, globs, pycore sys.path). Sonra plan adımları ve 6 çıktı (Singleton, zaman, const, git commit, 2, 3.1415) verildi. Dizin bulundu ve kullanıldı; doküman oluşturuldu. Cursor script kullanımı için özür diler.

### Română — Ordine cronologică

Mai întâi s-a făcut rezumatul conținutului (reguli Cursor, un fișier de reguli per sub-app, globs, pycore sys.path). Apoi s-au dat planul pe pași și cele 6 ieșiri (Singleton, timp, const, git commit, 2, 3.1415). Directorul a fost găsit și reutilizat; documentul a fost creat. Cursor își cer scuze pentru utilizarea scripturilor.

### Čeština — Časové pořadí

Nejprve byl proveden souhrn obsahu (pravidla Cursor, jedno pravidlo na sub-app, globs, pycore sys.path). Následně byl uveden plán kroků a 6 výstupů (Singleton, čas, const, git commit, 2, 3.1415). Adresář byl nalezen a znovu použit; dokument byl vytvořen. Cursor se omlouvá za použití skriptů.
