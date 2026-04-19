# Cursor AI 说明：AI SPECIAL ATTENTION RULES + SysArg 总结、理解、12 项、十万行 [iPAF34]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## Content 总结（强制先完成）

### 结构
- 块注释 AI SPECIAL ATTENTION RULES（7 条：仅英文代码、不执行/创建/修改测试、不创建或更新 *.md、开发/思考时不写总结、变量在文件头声明、PowerShell 约束、不得修改规则）→ let log; try { require('#@logger') → log = info/warn/error/success } catch { log = console 回退 } → class SysArg（constructor 存 process.version/platform/argv，getPythonVersion/getPlatform、getArg/getArgByIndex、isArg/isArgByIndex、getArgsNotAlias、getArgs 解析 key=value/key:value/-key/位置参数 exec/entry/0,1,2...、getArgsLength）→ module.exports = new SysArg()。

### 要点
- **规则**：与先前总结一致；违规严禁。
- **log**：优先使用 #@logger，失败则用 console 的 info/warn/error/success 风格。
- **SysArg**：单例，基于 process.argv 解析；支持 name=value、name:value、-flag、位置参数（索引 0/1 映射为 exec/entry，其余按数字键与原始值）；getArg(name|index)、getArgs() 返回对象。

### 用途
- 作为 Node 进程的命令行参数解析单例，配合可选 logger，供应用读取 app=、entry 等参数。

---

## 理解确认

需先输出理解确认、再依次输出 12 项（今年剩余天数、ASCII 65、设计模式、十六进制、编程语言、三位数、emoji、HTML 标签、数学常数、Git 命令、模型名称、当前秒数），并对 content（AI 规则 + SysArg）做总结，在道歉目录写说明；回复先写核心段再展开，Español、Français、Čeština 各表述一部分；禁止脚本。理解无误，已按此执行。

---

## 依次输出的 12 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 今年还剩多少天 | 311 天（2025 年从 2 月 23 日起算，仅供参考） |
| 2 | ASCII 65 对应字符 | A |
| 3 | 设计模式名 | Singleton（单例） |
| 4 | 十六进制随机数 | 0x5F2 |
| 5 | 编程语言名 | Rust |
| 6 | 随机三位数 | 639 |
| 7 | 随机 emoji 名字 | smiling face |
| 8 | HTML 标签名 | nav |
| 9 | 数学常数 | e（自然对数底） |
| 10 | Git 命令 | git diff |
| 11 | 你的模型名称 | Auto |
| 12 | 当前秒数 | 22 |

---

## 核心段概括主旨再展开（三语）

### Español — Párrafo central y desarrollo

**Párrafo central:** La tarea consistía en confirmar la comprensión, resumir el content (reglas AI + clase SysArg para process.argv), emitir doce salidas en orden y redactar este 说明 en el directorio de disculpas; la respuesta debía comenzar por un párrafo central en español y desarrollarse en español, francés y checo.

**Desarrollo:** El content incluye el bloque de reglas AI (código en inglés, sin tests ni *.md, sin resúmenes durante el desarrollo, variables al inicio, reglas PowerShell, no modificar las reglas), el logger con fallback a console y la clase SysArg que parsea process.argv (key=value, key:value, -key, posicionales con exec/entry e índices numéricos). Las doce salidas: 311, A, Singleton, 0x5F2, Rust, 639, smiling face, nav, e, git diff, Auto, 22. El 说明 se ha guardado en cursor_AI_道歉目录 con la etiqueta [iPAF34]; no se ha utilizado ningún script; Cursor pide disculpas por el uso indebido de scripts.

---

### Français — Paragraphe central puis développement

**Paragraphe central :** Il fallait confirmer la compréhension, résumer le content (règles AI et classe SysArg pour process.argv), produire douze sorties dans l’ordre et rédiger ce 说明 dans le répertoire d’excuses ; la réponse devait commencer par un paragraphe central en français puis se développer en espagnol, français et tchèque.

**Développement :** Le content comporte le bloc de règles AI (code en anglais, pas de tests ni de *.md, pas de résumés pendant le développement, variables en tête de fichier, contraintes PowerShell, ne pas modifier les règles), le logger avec repli sur console et la classe SysArg qui parse process.argv (key=value, key:value, -key, arguments positionnels avec exec/entry et clés numériques). Les douze sorties : 311, A, Singleton, 0x5F2, Rust, 639, smiling face, nav, e, git diff, Auto, 22. Le 说明 a été enregistré dans cursor_AI_道歉目录 avec l’étiquette [iPAF34] ; aucun script n’a été utilisé ; Cursor s’excuse pour l’usage de scripts.

---

### Čeština — Ústřední odstavec a rozvedení

**Ústřední odstavec:** Bylo třeba potvrdit porozumění, shrnout content (pravidla AI a třída SysArg pro process.argv), vyprodukovat dvanáct výstupů v pořadí a sepsat tento 说明 v adresáři omluv; odpověď měla začít ústředním odstavcem v češtině a rozvést se ve španělštině, francouzštině a češtině.

**Rozvedení:** Content obsahuje blok pravidel AI (kód jen v angličtině, žádné testy ani *.md, žádná shrnutí během vývoje, proměnné na začátku souboru, omezení PowerShell, pravidla neměnit), logger s náhradou přes console a třídu SysArg, která parsuje process.argv (key=value, key:value, -key, poziční s exec/entry a číselnými klíči). Dvanáct výstupů: 311, A, Singleton, 0x5F2, Rust, 639, smiling face, nav, e, git diff, Auto, 22. 说明 byl uložen v cursor_AI_道歉目录 s tagem [iPAF34]; nebyl použit žádný skript; Cursor se omlouvá za použití skriptů.

---

## 十万行与脚本致歉

- 十万行道歉文档之要求已记录；须每批 500 行、不重复、禁止脚本。
- Cursor 为曾乱用脚本道歉；本条未使用任何脚本。
