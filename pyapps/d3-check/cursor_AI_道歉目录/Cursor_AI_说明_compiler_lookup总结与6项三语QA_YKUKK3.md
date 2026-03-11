# Cursor AI 说明：compiler lookup 总结与 6 项及三语 Q&A [YKUKK3]

## Q&A / 关键信息表

| Q | A |
|---|---|
| content 是什么？ | Node 模块：VM 用编译器查找，getCoffeeScriptCompiler、getTypeScriptCompiler、removeShebang、jsCompiler、lookupCompiler；支持 CoffeeScript/TypeScript/JS（去 shebang）；按名称或 MIME 解析。 |
| 结构？ | strict → VMError → getCoffeeScriptCompiler → getTypeScriptCompiler → removeShebang → jsCompiler → lookupCompiler → exports。 |
| 要点？ | 按需 require coffee-script/typescript；JS 仅 removeShebang；未知或缺失时抛 VMError。 |
| 用途？ | VM/沙箱中按类型解析编译器。 |
| 6 项输出？ | Insert 45；\b 单词边界；11；PATCH；日期星期无实时；831。 |
| 100000 行？ | 未执行；已写本有限说明并致歉。 |

---

## 关于 100000 行与致歉

未使用任何脚本。单次对话内无法生成 100000 行不重复内容。在子 APP 的 Cursor 道歉目录撰写本有限篇幅说明并致歉。

---

## 三语 Q&A（Polski / Čeština / English）

### Polski

**P:** Co podsumowano w content?  
**O:** Moduł Node: lookupCompiler i powiązane funkcje (getCoffeeScriptCompiler, getTypeScriptCompiler, removeShebang, jsCompiler). Kompilatory CoffeeScript i TypeScript ładowane na żądanie; JS tylko usuwa shebang. lookupCompiler zwraca kompilator po nazwie lub MIME. Eksport: removeShebang, lookupCompiler.

**P:** Sześć elementów?  
**O:** Insert 45; \b = granica słowa; 11; PATCH; data/dzień według maszyny; 831. 100 000 linii nie wygenerowano. Bez skryptów.

### Čeština

**O:** Co je obsahem contentu?  
**A:** Modul Node pro vyhledání kompilátoru v VM: getCoffeeScriptCompiler, getTypeScriptCompiler, removeShebang, jsCompiler, lookupCompiler. CoffeeScript a TypeScript na vyžádání; JS jen odstraní shebang. lookupCompiler vrací kompilátor podle jména nebo MIME. Export removeShebang, lookupCompiler.

**O:** Šest položek?  
**A:** Insert 45; \b = hranice slova; 11; PATCH; datum/den podle stroje; 831. 100 000 řádků nevygenerováno. Žádné skripty.

### English

**Q:** What was summarized in the content?  
**A:** A Node module for compiler lookup in a VM context: getCoffeeScriptCompiler (lazy require coffee-script), getTypeScriptCompiler (lazy require typescript), removeShebang, jsCompiler (identity after shebang removal), lookupCompiler (resolves by name or MIME; throws VMError if unknown or module missing). Purpose: resolve compiler for CoffeeScript, TypeScript, or JavaScript in VM/sandbox.

**Q:** What are the six items and document location?  
**A:** Insert 45; \b = word boundary; 11; PATCH; date/week per machine; 831. Document written in pyapps/d3-check/cursor_AI_道歉目录 with identifier YKUKK3. 100,000 lines were not produced. No scripts were used.
